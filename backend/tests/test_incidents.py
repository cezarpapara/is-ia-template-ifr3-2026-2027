import pytest
from sqlalchemy import select

from app.models import IncidentUpdate

STATES = ("deschis", "confirmat", "in_lucru", "rezolvat", "inchis")
ALLOWED = {("deschis", "confirmat"), ("confirmat", "in_lucru"),
           ("in_lucru", "rezolvat"), ("rezolvat", "in_lucru"), ("rezolvat", "inchis")}


@pytest.mark.parametrize("current", STATES)
@pytest.mark.parametrize("new", STATES)
def test_transition_matrix(client, db, incident, current, new):
    incident.status = current
    incident.postmortem = "Cauza confirmata si actiuni."
    db.commit()
    response = client.patch(f"/api/incidents/{incident.id}", json={"status": new})
    expected = 409 if current == "inchis" else 200 if current == new or (current, new) in ALLOWED else 400
    assert response.status_code == expected
    db.refresh(incident)
    assert incident.status == (new if expected == 200 else current)


def test_nullable_patch_clears_fields_and_leaves_omitted_fields(client, db, incident):
    incident.description = "description"
    incident.postmortem = "draft"
    db.commit()
    response = client.patch(f"/api/incidents/{incident.id}", json={"description": None})
    assert response.status_code == 200
    assert response.json()["description"] is None
    assert response.json()["postmortem"] == "draft"
    response = client.patch(f"/api/incidents/{incident.id}", json={"postmortem": None})
    assert response.json()["postmortem"] is None


def test_empty_patch_preserves_open_incident(client, incident):
    url = f"/api/incidents/{incident.id}"
    before = client.get(url).json()
    response = client.patch(url, json={})
    assert response.status_code == 200
    assert response.json() == before


@pytest.mark.parametrize("severity", [1, 2, 3])
@pytest.mark.parametrize("postmortem", [None, "   ", "Analiza"])
def test_close_guard(client, db, incident, severity, postmortem):
    incident.severity = severity
    incident.status = "rezolvat"
    db.commit()
    response = client.patch(f"/api/incidents/{incident.id}", json={"status": "inchis", "postmortem": postmortem})
    permitted = severity == 3 or bool((postmortem or "").strip())
    assert response.status_code == (200 if permitted else 400)
    db.refresh(incident)
    assert incident.status == ("inchis" if permitted else "rezolvat")


def test_timestamps_reopening_and_noop_status(client, db, incident):
    url = f"/api/incidents/{incident.id}"
    confirmed = client.patch(url, json={"status": "confirmat"}).json()
    assert confirmed["acknowledged_at"] is not None
    assert client.patch(url, json={"status": "confirmat"}).json()["acknowledged_at"] == confirmed["acknowledged_at"]
    assert client.patch(url, json={"status": "in_lucru"}).status_code == 200
    resolved = client.patch(url, json={"status": "rezolvat"}).json()
    assert resolved["resolved_at"] is not None
    assert client.patch(url, json={"status": "rezolvat"}).json()["resolved_at"] == resolved["resolved_at"]
    assert client.patch(url, json={"status": "in_lucru"}).json()["resolved_at"] is None


def test_resolved_cannot_change_severity_even_while_closing_or_reopening(client, db, incident):
    incident.status = "rezolvat"
    db.commit()
    for changes in ({"severity": 3}, {"severity": 3, "status": "inchis"}, {"severity": 3, "status": "in_lucru"}):
        assert client.patch(f"/api/incidents/{incident.id}", json=changes).status_code == 400
    db.refresh(incident)
    assert (incident.severity, incident.status) == (2, "rezolvat")


@pytest.mark.parametrize("changes", [{"title": "New"}, {"postmortem": None}, {}, {"description": "New"}])
def test_closed_incident_is_immutable(client, db, incident, changes):
    incident.status = "inchis"
    incident.postmortem = "Saved analysis"
    db.commit()
    assert client.patch(f"/api/incidents/{incident.id}", json=changes).status_code == 409
    db.refresh(incident)
    assert (incident.title, incident.postmortem) == ("Latenta", "Saved analysis")


@pytest.mark.parametrize("status", STATES)
def test_deletion_restricted_and_cascades_updates(client, db, incident, status):
    incident.status = status
    incident.postmortem = "Analysis"
    db.add(IncidentUpdate(incident_id=incident.id, text="Investigation", author="Ana"))
    db.commit()
    response = client.delete(f"/api/incidents/{incident.id}")
    assert response.status_code == (204 if status == "deschis" else 409)
    if status == "deschis":
        assert client.get(f"/api/incidents/{incident.id}").status_code == 404
        assert db.scalars(select(IncidentUpdate)).all() == []


def test_create_read_filters_and_missing_resources(client, service):
    first = client.post("/api/incidents", json={"title": "  First  ", "service_id": service.id, "severity": 1})
    assert first.status_code == 201
    assert first.json()["title"] == "First"
    second = client.post("/api/incidents", json={"title": "Second", "service_id": service.id, "severity": 3})
    assert second.status_code == 201
    assert client.get(f"/api/incidents/{first.json()['id']}").json() == first.json()
    assert [item["id"] for item in client.get("/api/incidents").json()] == [second.json()["id"], first.json()["id"]]
    assert len(client.get(f"/api/incidents?service_id={service.id}&status=deschis&severity=1").json()) == 1
    assert client.get("/api/incidents?status=invalid").status_code == 422
    assert client.get("/api/incidents?severity=4").status_code == 422
    assert client.post("/api/incidents", json={"title": "Missing", "service_id": 999}).status_code == 404
    for method in (client.get, client.delete):
        assert method("/api/incidents/999").status_code == 404
    assert client.patch("/api/incidents/999", json={"title": "Missing"}).status_code == 404


def test_timeline_sorted_validated_and_closed_guard(client, db, incident):
    url = f"/api/incidents/{incident.id}/updates"
    assert client.post(url, json={"text": "  First ", "author": " Ana "}).status_code == 201
    assert client.post(url, json={"text": "Second", "author": "Ana"}).status_code == 201
    assert [item["text"] for item in client.get(url).json()] == ["First", "Second"]
    assert client.post(url, json={"text": "   ", "author": "Ana"}).status_code == 422
    incident.status = "inchis"
    incident.postmortem = "Saved analysis"
    db.commit()
    assert client.post(url, json={"text": "Late", "author": "Ana"}).status_code == 409
    assert len(client.get(url).json()) == 2
    assert client.get("/api/incidents/999/updates").status_code == 404
    assert client.post("/api/incidents/999/updates", json={"text": "Text", "author": "Ana"}).status_code == 404
