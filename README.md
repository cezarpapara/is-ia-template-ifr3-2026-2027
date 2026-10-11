# Scriptorium – orchestrator pentru modelele locale

Aplicație construită pe template-ul de la Inginerie software (FastAPI + PostgreSQL + React, în Docker).
Serverul propriu cu modele Ollama devine un „atelier”: cererile se pun într-o agendă salvată în baza de
date, un worker le procesează pe rând, rezultatele rămân în istoric, iar faptele importante intră într-o memorie
care se reinjectează în cererile următoare.

## Ce face
- **Birou**: CPU și RAM în timp real (SSE), pe nuclee, modelele aflate în memorie, ultima oră din baza de date.
- **Agendă**: joburi cu prioritate și oră programată; alegi unul sau mai multe modele (mai multe = comparație).
- **Istoric**: tot ce s-a procesat, cu tokeni/secundă, durată, amintiri folosite; „Rulează din nou”.
- **Memorie**: fapte extrase automat de model din joburile terminate, plus cele adăugate sau fixate manual.
- **Modele**: ce e instalat, ce e încărcat, viteza medie măsurată, „Eliberează memoria”.

## Pornire
```bash
cp backend/.env.example backend/.env   # aici (și doar aici) pui GEMINI_API_KEY, dacă o folosești
docker compose up -d --build
```
Aplicația: http://IP-SERVER:5173 · Swagger: http://IP-SERVER:8010/docs

## Unde sunt regulile din diagrame
- Stările unui job: `backend/app/services/job_states.py` (`ALLOWED_TRANSITIONS`), verificate în `routers/jobs.py` (400) și în worker.
- Planificarea după resurse și alegerea modelului „auto”: `backend/app/services/worker.py`.
- Telemetria: `backend/app/services/system.py`; migrarea: `backend/alembic/versions/0002_scriptorium.py`.
