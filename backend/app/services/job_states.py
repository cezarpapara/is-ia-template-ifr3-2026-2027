# Diagrama de stari a unui job, in cod. Dictionarul este, literal, lista sagetilor din diagrama
# (docs/diagrame/03-stari-job.drawio). Orice schimbare de status trece prin check_transition().

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"running", "cancelled"},
    "running": {"done", "failed", "cancelled", "queued"},  # queued = reluat dupa o repornire
    "done": {"queued"},        # rulat din nou
    "failed": {"queued"},      # reincercat
    "cancelled": {"queued"},   # reactivat
}


def can_transition(current: str, new: str) -> bool:
    return new == current or new in ALLOWED_TRANSITIONS.get(current, set())


def transition_error(current: str, new: str) -> str:
    allowed = ", ".join(sorted(ALLOWED_TRANSITIONS.get(current, set()))) or "nimic"
    return f"Tranzitie nepermisa: din '{current}' nu se poate trece in '{new}'. Din '{current}' se poate trece doar in: {allowed}."
