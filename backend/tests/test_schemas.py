import pytest
from pydantic import ValidationError

from app.schemas import ChatRequest, IncidentCreate, IncidentPatch, IncidentUpdateCreate, ServiceCreate


@pytest.mark.parametrize("schema,values,field", [
    (ServiceCreate, {"name": "service", "owner": "team"}, "name"),
    (ServiceCreate, {"name": "service", "owner": "team"}, "owner"),
    (IncidentCreate, {"title": "incident", "service_id": 1}, "title"),
    (IncidentPatch, {}, "title"),
    (IncidentUpdateCreate, {"text": "update", "author": "person"}, "text"),
    (IncidentUpdateCreate, {"text": "update", "author": "person"}, "author"),
    (ChatRequest, {}, "message"),
])
def test_required_text_is_trimmed_and_cannot_be_blank(schema, values, field):
    with pytest.raises(ValidationError):
        schema(**{**values, field: " \n\t "})
    assert getattr(schema(**{**values, field: "  content \n"}), field) == "content"


@pytest.mark.parametrize("field", ["title", "severity", "status"])
def test_patch_rejects_explicit_null_for_required_fields(field):
    with pytest.raises(ValidationError):
        IncidentPatch(**{field: None})


def test_patch_distinguishes_omitted_fields_from_nullable_clear():
    assert IncidentPatch().model_dump(exclude_unset=True) == {}
    assert IncidentPatch(description=None, postmortem=None).model_dump(exclude_unset=True) == {
        "description": None, "postmortem": None,
    }


@pytest.mark.parametrize("schema,values,field,limit", [
    (ServiceCreate, {"name": "service", "owner": "team"}, "description", 10000),
    (IncidentCreate, {"title": "incident", "service_id": 1}, "description", 10000),
    (IncidentPatch, {}, "description", 10000),
    (IncidentPatch, {}, "postmortem", 20000),
    (IncidentUpdateCreate, {"author": "person"}, "text", 10000),
    (ChatRequest, {}, "message", 10000),
    (ChatRequest, {"message": "question"}, "system", 4000),
])
def test_free_text_has_bounded_size(schema, values, field, limit):
    schema(**{**values, field: "a" * limit})
    with pytest.raises(ValidationError):
        schema(**{**values, field: "a" * (limit + 1)})


@pytest.mark.parametrize("service_id", [0, -1])
def test_incident_service_identifier_must_be_positive(service_id):
    with pytest.raises(ValidationError):
        IncidentCreate(title="Incident", service_id=service_id)
