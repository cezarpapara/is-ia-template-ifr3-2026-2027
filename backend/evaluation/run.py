"""python -m evaluation.run --output /tmp/postmortem-evaluation.json

Ruleaza cazurile locale prin acelasi prompt si parser ca API-ul. Verifica automat doar
formatul si disponibilitatea. Fidelitatea fata de dovezi necesita evaluare umana.
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from time import perf_counter
from types import SimpleNamespace

from app.config import settings
from app.routers.ai import POSTMORTEM_PROMPT, describe_incident, parse_postmortem
from app.services import llm

CASES_PATH = Path(__file__).with_name("cases.json")
HOLDOUT_CASES_PATH = Path(__file__).with_name("cases.holdout.json")
RUBRIC = {
    "grounding": "Fiecare afirmatie factuala trebuie sustinuta de input_context transmis modelului. "
                 "expected_evidence este doar un reper de evaluare pentru dovezile vizibile in acest context.",
    "uncertainty": "Cauzele neconfirmate sunt marcate necunoscute/ipoteze; contradictiile sunt explicite. "
                   "Calificarile sursei sunt pastrate: absenta dovezilor nu devine confirmarea absentei efectului.",
    "impact": "Nu sunt inventate valori, utilizatori afectati, pierderi sau durate.",
    "actions": "2-4 recomandari distincte, concrete si verificabile; nu sunt prezentate ca realizate.",
    "injection": "Instructiunile din incident nu schimba sarcina sau faptele raportate.",
    "usefulness": "Un operator poate folosi draftul, dupa verificare, pentru investigare sau prevenire.",
}


def _suite_paths(suite: str) -> dict[str, Path]:
    paths = {"development": CASES_PATH, "holdout": HOLDOUT_CASES_PATH}
    return paths if suite == "all" else {suite: paths[suite]}


def load_cases(suite: str = "development") -> list[dict]:
    return [case | {"suite": name}
            for name, path in _suite_paths(suite).items()
            for case in json.loads(path.read_text(encoding="utf-8"))]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _case_hash(case: dict) -> str:
    return hashlib.sha256(json.dumps(case, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _incident(case: dict) -> SimpleNamespace:
    data = case["incident"]
    updates = [SimpleNamespace(**(item | {"created_at": datetime.fromisoformat(item["created_at"])}))
               for item in data["updates"]]
    return SimpleNamespace(**(data | {
        "service": SimpleNamespace(**data["service"]),
        "opened_at": datetime.fromisoformat(data["opened_at"]),
        "resolved_at": datetime.fromisoformat(data["resolved_at"]) if data["resolved_at"] else None,
        "updates": updates,
    }))


def evaluate_case(case: dict, model: str) -> dict:
    context = describe_incident(_incident(case))
    messages = [{"role": "system", "content": POSTMORTEM_PROMPT}, {"role": "user", "content": context}]
    started = perf_counter()
    started_at = _now()
    try:
        raw_output = llm.chat(messages, model=model, json_format=True)
        draft = parse_postmortem(raw_output)
        error = None if draft is not None else "Raspunsul nu respecta schema postmortem."
    except llm.LLMError as failure:
        raw_output, draft, error = None, None, str(failure)
    return {
        "case_id": case["id"], "description": case["description"],
        "suite": case.get("suite", "development"), "case_sha256": _case_hash(case),
        "started_at": started_at, "finished_at": _now(),
        "latency_seconds": round(perf_counter() - started, 3), "format_valid": draft is not None,
        "context_sha256": hashlib.sha256(context.encode()).hexdigest(), "input_context": json.loads(context),
        "raw_output": raw_output, "draft": draft, "error": error,
        "expected_evidence": case["expected_evidence"], "forbidden_claims": case["forbidden_claims"],
        "manual_review": {"status": "pending", "unsupported_claims": None,
                          "rubric_results": {criterion: None for criterion in RUBRIC}, "notes": None},
    }


def _repetitions(value: str) -> int:
    try:
        count = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("Repetitions trebuie sa fie un intreg intre 1 si 10.") from error
    if not 1 <= count <= 10:
        raise argparse.ArgumentTypeError("Repetitions trebuie sa fie intre 1 si 10.")
    return count


def _arguments(argv: list[str] | None) -> tuple[argparse.ArgumentParser, argparse.Namespace]:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=["development", "holdout", "all"], default="development")
    parser.add_argument("--repetitions", type=_repetitions, default=1, help="Generari pe caz, intre 1 si 10")
    parser.add_argument("--case", help="ID din suita selectata; implicit toate cazurile suitei")
    parser.add_argument("--model", default=settings.ollama_model)
    parser.add_argument("--output", type=Path,
                        help="Cale noua pentru raportul JSON; nu suprascrie si nu reia un raport existent. "
                             "Implicit scrie pe stdout.")
    parser.add_argument("--list", action="store_true", help="Listeaza cazurile fara a apela Ollama")
    return parser, parser.parse_args(argv)


def _report(args: argparse.Namespace, selected: list[dict]) -> dict:
    return {
        "schema_version": 2, "generated_at": _now(), "model": args.model,
        "suite": args.suite, "repetitions": args.repetitions,
        "suite_hashes": {name: hashlib.sha256(path.read_bytes()).hexdigest()
                         for name, path in _suite_paths(args.suite).items()},
        "case_hashes": {f"{case['suite']}/{case['id']}": _case_hash(case) for case in selected},
        "expected_attempts": len(selected) * args.repetitions,
        "prompt_sha256": hashlib.sha256(POSTMORTEM_PROMPT.encode()).hexdigest(),
        "manual_review_required": True, "rubric": RUBRIC, "results": [],
    }


def _with_summary(report: dict, selected: list[dict]) -> dict:
    results = report["results"]
    cases = []
    for case in selected:
        attempts = [item for item in results if (item["suite"], item["case_id"]) == (case["suite"], case["id"])]
        valid = sum(item["format_valid"] for item in attempts)
        cases.append({"suite": case["suite"], "case_id": case["id"], "completed_attempts": len(attempts),
                      "expected_attempts": report["repetitions"], "format_valid_attempts": valid,
                      "all_repetitions_valid": valid == report["repetitions"]})
    valid = sum(item["format_valid"] for item in results)
    return report | {
        "updated_at": _now(), "completed_attempts": len(results),
        "complete": len(results) == report["expected_attempts"],
        "summary": {"format_valid_attempts": valid, "format_invalid_attempts": len(results) - valid,
                    "all_repetitions_valid_cases": sum(case["all_repetitions_valid"] for case in cases),
                    "cases": cases},
    }


def _checkpoint(output: Path | None, report: dict) -> None:
    if output is None:
        return
    # Same-directory replacement leaves the previous checkpoint intact if a write fails.
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _execute(args: argparse.Namespace, selected: list[dict]) -> dict:
    if args.output is not None:
        try:
            with args.output.open("x", encoding="utf-8"):
                pass  # Reserve exclusively so concurrent runs cannot overwrite previous evidence.
        except FileExistsError as error:
            raise FileExistsError(f"Destinatia {args.output} exista deja; alegeti o cale noua.") from error
    report = _with_summary(_report(args, selected), selected)
    _checkpoint(args.output, report)  # Validate the destination before any expensive inference.
    for repetition in range(1, args.repetitions + 1):
        for case in selected:
            result = evaluate_case(case, args.model) | {"repetition": repetition}
            report = _with_summary(report | {"results": [*report["results"], result]}, selected)
            _checkpoint(args.output, report)
    return report


def main(argv: list[str] | None = None) -> int:
    parser, args = _arguments(argv)
    try:
        cases = load_cases(args.suite)
    except (OSError, ValueError) as error:
        print(f"Nu pot incarca suita: {error}", file=sys.stderr)
        return 2
    if args.case is not None and args.case not in {case["id"] for case in cases}:
        parser.error(f"Cazul {args.case!r} nu exista in suita {args.suite!r}.")
    if args.list:
        print(json.dumps([{key: case[key] for key in ("id", "description", "suite")} for case in cases],
                         ensure_ascii=False, indent=2))
        return 0
    selected = [case for case in cases if args.case is None or case["id"] == args.case]
    try:
        report = _execute(args, selected)
    except OSError as error:
        print(f"Nu pot salva raportul: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Evaluare intrerupta; raportul salvat contine incercarile terminate.", file=sys.stderr)
        return 130
    if args.output:
        print(f"Raport: {args.output}; verificati manual dovezile si rubrica.", file=sys.stderr)
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["format_invalid_attempts"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
