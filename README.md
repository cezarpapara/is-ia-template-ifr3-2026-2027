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
cp backend/.env.example backend/.env   # aici (și doar aici) pui GEMINI_API_KEY; fișierul e ignorat de Git
docker compose up -d --build
```
Aplicația: http://IP-SERVER:5173 · Swagger (doar în rețeaua locală): http://IP-SERVER:8010/docs

Publicarea pe internet prin Nginx Proxy Manager: vezi `docs/nginx-proxy-manager.md`.

## Unde sunt regulile din diagrame
- Stările unui job: `backend/app/services/job_states.py` (`ALLOWED_TRANSITIONS`), verificate în `routers/jobs.py` (400) și în worker.
- Planificarea după resurse și alegerea modelului „auto”: `backend/app/services/worker.py`.
- Telemetria: `backend/app/services/system.py`; migrarea: `backend/alembic/versions/0002_scriptorium.py`.

## Gemini (opțional)
Pune `GEMINI_API_KEY=...` în `backend/.env` și rulează `docker compose restart backend` (uvicorn nu urmărește `.env`).
Modelele Gemini apar singure în Agendă și în Modele, marcate „în cloud”. Lista se citește de la API; o poți fixa cu `GEMINI_MODELS=` în același fișier.
