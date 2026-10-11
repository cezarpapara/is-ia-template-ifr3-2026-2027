"""The evaluation runner never contacts a model in this test suite."""

import json
from datetime import datetime

import pytest

from evaluation import run


VALID_DRAFT = {
    "cauza": "Necunoscuta; lipsesc dovezile.",
    "impact": "Impactul nu este confirmat.",
    "actiuni": ["Colectati logurile serviciului.", "Verificati probele sintetice."],
}


@pytest.fixture(autouse=True)
def no_live_inference(monkeypatch):
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: pytest.fail("unexpected live inference"))


@pytest.fixture
def suites(monkeypatch, tmp_path):
    base = run.load_cases()[0]
    development = [base | {"id": "development-a"}, base | {"id": "development-b"}]
    holdout = [base | {"id": "holdout-a"}]
    paths = [tmp_path / "development.json", tmp_path / "holdout.json"]
    for path, cases in zip(paths, [development, holdout]):
        path.write_text(json.dumps(cases))
    monkeypatch.setattr(run, "CASES_PATH", paths[0])
    monkeypatch.setattr(run, "HOLDOUT_CASES_PATH", paths[1], raising=False)
    return paths


@pytest.mark.parametrize("suite, ids", [
    ("development", ["development-a", "development-b"]),
    ("holdout", ["holdout-a"]),
    ("all", ["development-a", "development-b", "holdout-a"]),
])
def test_suite_selection_and_listing_are_offline(suites, capsys, suite, ids):
    assert run.main(["--suite", suite, "--list"]) == 0
    assert [case["id"] for case in json.loads(capsys.readouterr().out)] == ids


def test_default_loader_keeps_development_cases(suites):
    assert [case["id"] for case in run.load_cases()] == ["development-a", "development-b"]


def test_repetitions_keep_all_attempts_and_pending_semantic_review(suites, monkeypatch, tmp_path):
    output = tmp_path / "report.json"
    responses = iter([json.dumps(VALID_DRAFT), "not JSON", json.dumps(VALID_DRAFT)])
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: next(responses))
    assert run.main(["--suite", "holdout", "--repetitions", "3", "--output", str(output)]) == 1
    report = json.loads(output.read_text())
    assert report["schema_version"] == 2
    assert report["suite"] == "holdout"
    assert report["repetitions"] == 3
    assert report["expected_attempts"] == report["completed_attempts"] == 3
    assert report["complete"] is True
    assert [result["repetition"] for result in report["results"]] == [1, 2, 3]
    assert {result["suite"] for result in report["results"]} == {"holdout"}
    assert report["results"][1]["raw_output"] == "not JSON"
    assert report["results"][1]["error"]
    assert report["summary"]["format_valid_attempts"] == 2
    assert report["summary"]["format_invalid_attempts"] == 1
    assert report["summary"]["cases"][0]["all_repetitions_valid"] is False
    assert report["manual_review_required"] is True
    assert report["rubric"] == run.RUBRIC
    for result in report["results"]:
        assert result["manual_review"]["status"] == "pending"
        assert all(value is None for value in result["manual_review"]["rubric_results"].values())
        assert datetime.fromisoformat(result["started_at"]) <= datetime.fromisoformat(result["finished_at"])


def test_hashes_capture_suites_and_selected_cases(suites, monkeypatch, capsys):
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: json.dumps(VALID_DRAFT))
    args = ["--suite", "all", "--case", "holdout-a"]
    assert run.main(args) == 0
    first = json.loads(capsys.readouterr().out)
    assert set(first["suite_hashes"]) == {"development", "holdout"}
    assert set(first["case_hashes"]) == {"holdout/holdout-a"}
    assert first["summary"]["cases"][0]["all_repetitions_valid"] is True
    cases = json.loads(suites[1].read_text())
    suites[1].write_text(json.dumps([cases[0] | {"description": "Changed evidence description"}]))
    assert run.main(args) == 0
    second = json.loads(capsys.readouterr().out)
    assert second["suite_hashes"]["holdout"] != first["suite_hashes"]["holdout"]
    assert second["case_hashes"] != first["case_hashes"]
    assert second["results"][0]["case_sha256"] == second["case_hashes"]["holdout/holdout-a"]


@pytest.mark.parametrize("arguments", [
    ["--repetitions", "0"], ["--repetitions", "11"], ["--repetitions", "-1"],
    ["--repetitions", "abc"], ["--suite", "unknown"], ["--case", "unknown"],
    ["--suite", "holdout", "--case", "development-a"],
])
def test_invalid_cli_input_fails_before_inference(suites, arguments):
    with pytest.raises(SystemExit) as failure:
        run.main(arguments)
    assert failure.value.code == 2


def test_checkpoint_is_written_before_inference_and_after_each_attempt(suites, monkeypatch, tmp_path):
    output = tmp_path / "partial.json"
    snapshots = []

    def generate(*args, **kwargs):
        snapshots.append(json.loads(output.read_text()))
        if len(snapshots) == 2:
            raise RuntimeError("simulated interrupted process")
        return json.dumps(VALID_DRAFT)

    monkeypatch.setattr(run.llm, "chat", generate)
    with pytest.raises(RuntimeError, match="interrupted"):
        run.main(["--case", "development-a", "--repetitions", "3", "--output", str(output)])
    assert [snapshot["completed_attempts"] for snapshot in snapshots] == [0, 1]
    partial = json.loads(output.read_text())
    assert partial["complete"] is False
    assert partial["completed_attempts"] == 1
    assert partial["expected_attempts"] == 3
    assert partial["summary"]["cases"][0]["all_repetitions_valid"] is False
    assert len(partial["results"]) == 1


@pytest.mark.parametrize("destination", ["missing/report.json", "."])
def test_output_preflight_fails_before_inference(suites, tmp_path, capsys, destination):
    assert run.main(["--output", str(tmp_path / destination)]) == 2
    assert "Nu pot salva raportul" in capsys.readouterr().err


def test_controlled_model_failure_does_not_discard_other_repetitions(suites, monkeypatch, capsys):
    calls = []

    def generate(*args, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            raise run.llm.LLMError("offline")
        return json.dumps(VALID_DRAFT)

    monkeypatch.setattr(run.llm, "chat", generate)
    assert run.main(["--case", "development-a", "--repetitions", "2", "--model", "test-model"]) == 1
    report = json.loads(capsys.readouterr().out)
    assert report["results"][0]["error"] == "offline"
    assert report["results"][0]["raw_output"] is None
    assert report["results"][1]["format_valid"] is True
    assert all(call == {"model": "test-model", "json_format": True} for call in calls)


def test_successful_default_case_run_still_writes_stdout(suites, monkeypatch, capsys):
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: json.dumps(VALID_DRAFT))
    assert run.main([]) == 0
    report = json.loads(capsys.readouterr().out)
    assert len(report["results"]) == 2
    assert report["complete"] is True
    assert report["summary"]["all_repetitions_valid_cases"] == 2


def test_invalid_draft_has_explicit_parser_error(suites, monkeypatch):
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: "{}")
    result = run.evaluate_case(run.load_cases()[0], "test-model")
    assert result["raw_output"] == "{}"
    assert result["error"] == "Raspunsul nu respecta schema postmortem."


def test_missing_suite_is_a_controlled_cli_error(suites, capsys):
    suites[1].unlink()
    assert run.main(["--suite", "holdout", "--list"]) == 2
    assert "Nu pot incarca" in capsys.readouterr().err


def test_round_robin_runs_each_case_before_repeating(suites, monkeypatch, capsys):
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: json.dumps(VALID_DRAFT))
    assert run.main(["--repetitions", "2"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert [(item["case_id"], item["repetition"]) for item in report["results"]] == [
        ("development-a", 1), ("development-b", 1),
        ("development-a", 2), ("development-b", 2),
    ]


def test_keyboard_interrupt_returns_130_with_partial_checkpoint(suites, monkeypatch, tmp_path):
    def interrupt(*args, **kwargs):
        raise KeyboardInterrupt

    monkeypatch.setattr(run.llm, "chat", interrupt)
    output = tmp_path / "report.json"
    assert run.main(["--output", str(output)]) == 130
    report = json.loads(output.read_text())
    assert report["complete"] is False
    assert report["completed_attempts"] == 0


def test_checkpoint_replacement_failure_keeps_previous_report(suites, monkeypatch, tmp_path, capsys):
    output = tmp_path / "report.json"
    original_replace = run.Path.replace
    calls = []

    def replace(path, target):
        calls.append(target)
        if len(calls) == 2:
            raise OSError("disk write failure")
        return original_replace(path, target)

    monkeypatch.setattr(run.Path, "replace", replace)
    monkeypatch.setattr(run.llm, "chat", lambda *a, **kw: json.dumps(VALID_DRAFT))
    assert run.main(["--output", str(output)]) == 2
    assert "disk write failure" in capsys.readouterr().err
    assert json.loads(output.read_text())["completed_attempts"] == 0
    assert sorted(path.name for path in tmp_path.iterdir()) == ["development.json", "holdout.json", "report.json"]


def test_malformed_json_suite_is_controlled(suites, capsys):
    suites[1].write_text("bad json")
    assert run.main(["--suite", "holdout", "--list"]) == 2
    assert "Nu pot incarca" in capsys.readouterr().err


def test_existing_report_is_preserved_without_inference(suites, tmp_path, capsys):
    output = tmp_path / "previous-report.json"
    previous = b'{"results": [{"raw_output": "original evidence"}]}\n'
    output.write_bytes(previous)
    assert run.main(["--output", str(output)]) == 2
    assert output.read_bytes() == previous
    assert "exista deja" in capsys.readouterr().err
