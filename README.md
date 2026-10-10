# Template de proiect – Inginerie software și Inteligență artificială

Proiect de pornire pentru laboratoarele de **Inginerie software** și **Inteligență artificială**, Informatică IFR, anul III, 2026–2027.
Cadru didactic: Asist. univ. drd. asoc. Cezar-Marian Papară.

Aplicația gestionează proiecte și sarcini și are un asistent bazat pe un model de limbaj (LLM) care rulează local:

- **backend** – Python 3.12, FastAPI, SQLAlchemy, Alembic, cu bază de date PostgreSQL 17;
- **frontend** – React 19 + Vite;
- **LLM** – Ollama, instalat direct pe calculator (nu în Docker).

Backend-ul, frontend-ul și baza de date rulează în containere Docker; nu este nevoie să instalați Python, Node.js sau PostgreSQL.

## Pornire

```bash
git clone https://github.com/cezarpapara/is-ia-template-ifr3-2026-2027.git
cd is-ia-template-ifr3-2026-2027
git checkout -b nume.prenume
docker compose up -d --build
```

La pornirile următoare: `docker compose up -d`; oprire: `docker compose stop`.

| Container | Ce conține | Adresa |
|---|---|---|
| `is-ia-node` | aplicația React (Vite) | http://localhost:5173 |
| `is-ia-python` | API-ul FastAPI; documentația (Swagger) | http://localhost:8000/docs |
| `is-ia-postgres` | PostgreSQL (pentru DBeaver) | `localhost:5432`, bază/utilizator/parolă `isia` / `isia` / `isia` |

## Structura proiectului

```
.env              configurarea: baza de date, porturile, modelul Ollama
compose.yaml      cele trei containere (folosesc valorile din .env)
backend/          codul Python (FastAPI)
frontend/         codul React
docker/
  python/         Dockerfile-ul containerului is-ia-python
  node/           Dockerfile-ul containerului is-ia-node
  postgres/data/  datele bazei de date (create la prima pornire; nu se urcă pe GitHub)
docs/diagrame/    diagramele UML (draw.io)
```

Dacă un port este ocupat sau vreți alt model Ollama, modificați valoarea în `.env`, apoi rulați `docker compose up -d`.
Pentru a porni cu o bază de date goală: `docker compose down`, ștergeți conținutul folderului `docker/postgres/data` (fără fișierul `.gitkeep`), apoi `docker compose up -d`.

## Diagrame UML

Diagramele se află în `docs/diagrame/`. Diagrama de clase descrie modelul de date din `backend/app/models.py`, inclusiv clasa `Comment` adăugată la laboratorul 2 (sursa: `docs/diagrame/02-clase.excalidraw`).

![Diagrama de clase](docs/diagrame/02-clase.png)

## Ollama

Instalați Ollama de pe https://ollama.com și descărcați modelul implicit:

```bash
ollama pull qwen2.5:1.5b
```

Pe Linux, Ollama trebuie să accepte conexiuni din Docker: porniți-l cu `OLLAMA_HOST=0.0.0.0 ollama serve`.
Pagina **Acasă** a aplicației arată dacă backend-ul și Ollama funcționează.

## Îndrumarele de laborator

Îndrumarele de laborator (instalare, modul de lucru cu Git, explicarea fiecărui fișier, cerințele proiectului) se găsesc pe grupul Teams al disciplinei.
