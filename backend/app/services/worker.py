# Worker-ul: un fir de executie care scoate joburile din agenda (tabelul job), unul cate unul,
# in ordinea prioritatii, si le trimite modelului. Pe un server cu procesor, un singur job
# odata este alegerea corecta: doua modele mari in paralel ar bloca masina.
import json
import re
import threading
from datetime import datetime, timezone

import psutil
from sqlalchemy import func, or_, select

from app.database import SessionLocal
from app.models import Job, MemoryItem
from app.services import llm
from app.services.job_states import can_transition

# Starea afisata in interfata (Birou): idle / running / waiting_ram
state: dict = {"phase": "idle", "job_id": None, "title": None, "detail": ""}
_stop = threading.Event()
_RAM_MARGIN = 1.1  # un model are nevoie de ~marimea lui in RAM, plus putina rezerva


def _set(phase: str, job: Job | None = None, detail: str = "") -> None:
    state.update(phase=phase, job_id=job.id if job else None, title=job.title if job else None, detail=detail)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _set_status(job: Job, new: str) -> None:
    if not can_transition(job.status, new):
        raise RuntimeError(f"Tranzitie nepermisa {job.status} -> {new}")
    job.status = new


# ---------- alegerea modelului ----------



def resolve_model(requested: str, models: list[dict], loaded: list[dict]) -> str:
    """'auto' alege cel mai mare model care incape in memoria libera; altfel cel mai mic."""
    if requested != "auto":
        return requested
    local = [m for m in models if m["provider"] == "ollama" and "embed" not in m["name"].lower()]
    if not local:
        raise llm.LLMError("Nu exista modele locale instalate.")
    free = psutil.virtual_memory().available + sum(m["size_bytes"] for m in loaded)
    fitting = [m for m in local if m["size_bytes"] * _RAM_MARGIN <= free]
    chosen = max(fitting, key=lambda m: m["size_bytes"]) if fitting else min(local, key=lambda m: m["size_bytes"])
    return chosen["name"]


# ---------- memoria ----------

def recall(db, prompt: str, limit: int = 5) -> list[MemoryItem]:
    """Faptele fixate + cele mai apropiate de cuvintele din prompt (cautare full-text PostgreSQL)."""
    items = list(db.scalars(select(MemoryItem).where(MemoryItem.pinned).order_by(MemoryItem.id).limit(5)))
    words = sorted({w for w in re.findall(r"[^\W_]{4,}", prompt.lower())})[:15]
    if words:
        ts = func.to_tsvector("simple", MemoryItem.content)
        tq = func.to_tsquery("simple", " | ".join(words))
        found = db.scalars(
            select(MemoryItem).where(ts.op("@@")(tq)).order_by(func.ts_rank(ts, tq).desc()).limit(limit)
        )
        for item in found:
            if item.id not in {i.id for i in items}:
                items.append(item)
    return items


def learn(db, job: Job, model: str) -> None:
    """Dupa un job reusit, modelul extrage 0-3 fapte durabile, salvate in memory_item."""
    messages = [
        {"role": "system", "content": (
            "Din schimbul de mai jos extrage cel mult 3 fapte scurte si durabile, utile pentru "
            "conversatii viitoare (preferinte, decizii, date despre proiect). "
            'Raspunde DOAR cu JSON de forma {"facts": ["...", "..."]}. Daca nu exista fapte utile: {"facts": []}.')},
        {"role": "user", "content": f"Cerere: {job.prompt}\n\nRaspuns: {(job.result or '')[:3000]}"},
    ]
    try:
        raw = llm.generate(messages, model, json_mode=True).text
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        facts = json.loads(match.group(0)).get("facts", []) if match else []
    except (llm.LLMError, ValueError):
        return
    existing = {c.lower() for c in db.scalars(select(MemoryItem.content))}
    for fact in facts[:3]:
        fact = str(fact).strip()[:500]
        if fact and fact.lower() not in existing:
            db.add(MemoryItem(content=fact, source_job_id=job.id))
    db.commit()


# ---------- ciclul worker-ului ----------

def _claim() -> int | None:
    """Alege urmatorul job (prioritate mare intai, apoi cel mai vechi) si il trece in 'running'."""
    with SessionLocal() as db:
        job = db.scalars(
            select(Job)
            .where(Job.status == "queued", or_(Job.scheduled_at.is_(None), Job.scheduled_at <= _now()))
            .order_by(Job.priority.desc(), Job.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if job is None:
            _set("idle")
            return None

        try:
            models, loaded = llm.list_models(), llm.loaded_models()
            model = resolve_model(job.model, models, loaded)
        except llm.LLMError as err:
            _fail(db, job, str(err))
            return None

        # Planificare constransa de resurse: nu pornim un model care nu incape in RAM
        info = next((m for m in models if m["name"] == model), None)
        if info and info["provider"] == "ollama" and model not in {m["name"] for m in loaded}:
            need = info["size_bytes"] * _RAM_MARGIN
            free = psutil.virtual_memory().available
            if need > free:
                if loaded:  # asteptam sa se elibereze (modelele incarcate expira singure)
                    _set("waiting_ram", job, f"{model} are nevoie de {need / 2**30:.1f} GB, liberi: {free / 2**30:.1f} GB")
                    return None
                _fail(db, job, f"Modelul {model} nu incape in RAM: are nevoie de {need / 2**30:.1f} GB, liberi: {free / 2**30:.1f} GB.")
                return None

        _set_status(job, "running")
        job.model_used, job.started_at, job.error = model, _now(), None
        db.commit()
        _set("running", job, f"model: {model}")
        return job.id


def _fail(db, job: Job, message: str) -> None:
    _set_status(job, "failed")
    job.error, job.finished_at = message, _now()
    db.commit()


def _process(job_id: int) -> None:
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        model = job.model_used
        messages = []
        memory = recall(db, job.prompt) if job.use_memory else []
        system = job.system or ""
        if memory:
            system += "\n\nCe stii deja din conversatiile anterioare:\n" + "\n".join(f"- {m.content}" for m in memory)
        if system.strip():
            messages.append({"role": "system", "content": system.strip()})
        messages.append({"role": "user", "content": job.prompt})
        job.memory_hits = len(memory)
        db.commit()

        try:
            result = llm.generate(messages, model)
        except llm.LLMError as err:
            db.refresh(job)
            if job.status == "running":
                _fail(db, job, str(err))
            return

        db.refresh(job)
        if job.status != "running":  # anulat intre timp: aruncam rezultatul
            return
        _set_status(job, "done")
        job.result, job.finished_at = result.text, _now()
        job.prompt_tokens, job.completion_tokens, job.duration_ms = result.prompt_tokens, result.completion_tokens, result.duration_ms
        if result.gen_seconds > 0 and result.completion_tokens:
            job.tokens_per_s = round(result.completion_tokens / result.gen_seconds, 2)
        db.commit()

        if job.use_memory:
            _set("running", job, "retin faptele importante in memorie")
            learn(db, job, model)


def _recover() -> None:
    """La pornire: joburile ramase 'running' (cadere, repornire) revin in agenda."""
    with SessionLocal() as db:
        for job in db.scalars(select(Job).where(Job.status == "running")):
            _set_status(job, "queued")
        db.commit()


def _loop() -> None:
    _recover()
    while not _stop.is_set():
        try:
            job_id = _claim()
            if job_id is None:
                _stop.wait(2)
                continue
            _process(job_id)
            _set("idle")
        except Exception as err:  # un job stricat nu opreste worker-ul
            print(f"[worker] {err}")
            _set("idle")
            _stop.wait(5)


def start() -> None:
    _stop.clear()
    threading.Thread(target=_loop, name="worker", daemon=True).start()


def stop() -> None:
    _stop.set()
