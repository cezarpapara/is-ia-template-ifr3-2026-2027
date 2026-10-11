# Telemetria serverului: un singur fir de executie masoara CPU/RAM la 2 secunde si pastreaza
# ultima valoare in memorie; API-ul (REST si SSE) doar o citeste. Din 10 in 10 secunde
# esantionul se salveaza si in PostgreSQL, pentru graficul de istoric.
# Nota: in Docker, psutil citeste /proc de pe gazda, deci valorile sunt ale serverului.
import os
import threading
import time
from datetime import datetime, timedelta, timezone

import psutil
from sqlalchemy import delete

from app.database import SessionLocal
from app.models import ResourceSample
from app.services import llm

_latest: dict = {}
_stop = threading.Event()


def latest() -> dict:
    return _latest


def _snapshot(loaded: list[dict]) -> dict:
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()
    load = os.getloadavg() if hasattr(os, "getloadavg") else (0, 0, 0)
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "cpu_percent": psutil.cpu_percent(interval=None),
        "cpu_cores": psutil.cpu_percent(interval=None, percpu=True),
        "cpu_count": psutil.cpu_count(logical=True),
        "load_avg": [round(x, 2) for x in load],
        "ram_total_mb": vm.total // 2**20,
        "ram_used_mb": (vm.total - vm.available) // 2**20,
        "ram_available_mb": vm.available // 2**20,
        "ram_percent": round((vm.total - vm.available) / vm.total * 100, 1),
        "swap_percent": sw.percent,
        "loaded_models": loaded,
    }


def _loop() -> None:
    global _latest
    psutil.cpu_percent(interval=None)  # prima apelare doar initializeaza contorul
    time.sleep(1)
    tick, loaded = 0, []
    while not _stop.is_set():
        try:
            if tick % 3 == 0:  # modelele incarcate se intreaba la ~6 secunde
                loaded = llm.loaded_models()
            _latest = _snapshot(loaded)
            if tick % 5 == 0:
                _save(_latest)
            if tick % 300 == 0:
                _prune()
        except Exception as err:  # telemetria nu trebuie sa opreasca aplicatia
            print(f"[telemetrie] {err}")
        tick += 1
        _stop.wait(2)


def _save(s: dict) -> None:
    with SessionLocal() as db:
        db.add(ResourceSample(cpu=s["cpu_percent"], ram_percent=s["ram_percent"], ram_used_mb=s["ram_used_mb"]))
        db.commit()


def _prune() -> None:
    with SessionLocal() as db:
        db.execute(delete(ResourceSample).where(ResourceSample.ts < datetime.now(timezone.utc) - timedelta(hours=24)))
        db.commit()


def start() -> None:
    _stop.clear()
    threading.Thread(target=_loop, name="telemetrie", daemon=True).start()


def stop() -> None:
    _stop.set()
