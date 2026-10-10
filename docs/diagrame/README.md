# Diagrame UML (draw.io)

Exemple de diagrame UML pentru aplicația din template, desenate în draw.io. Sunt puncte de plecare
pentru laboratoarele de Inginerie software: deschideți-le, comparați-le cu codul și adaptați-le
pentru proiectul vostru.

| Fișier | Diagrama | Ce cod descrie |
|---|---|---|
| `01-cazuri-de-utilizare.drawio` | cazuri de utilizare | paginile React și endpoint-urile din `backend/app/routers/` |
| `02-clase.drawio` | clase | `backend/app/models.py` (tabelele `project` și `task`) |
| `03-stari-sarcina.drawio` | stări | câmpul `status` al sarcinii (`de_facut`, `in_lucru`, `finalizat`) |
| `04-activitati-adaugare-sarcina.drawio` | activități | adăugarea unei sarcini: `TasksPage.jsx` → `POST /api/tasks` |
| `05-secventa-adaugare-sarcina.drawio` | secvență | `TasksPage` → `api.js` → `create_task` → `Session` → PostgreSQL |
| `06-colaborare-adaugare-sarcina.drawio` | colaborare | aceeași interacțiune, cu mesaje numerotate |
| `07-componente-si-desfasurare.drawio` | componente și desfășurare (2 pagini) | fișierele proiectului; containerele din `compose.yaml` și Ollama |

## Diagramele proiectului (Excalidraw)

Diagramele de mai jos descriu proiectul de pe acest branch, gestionarea incidentelor on-call
(`Service`, `Incident`, `IncidentUpdate`). Fișierele `.drawio` din tabelul de mai sus sunt exemplele
inițiale din template, pentru proiecte și sarcini.

| Fișier | Diagrama | Ce cod descrie |
|---|---|---|
| `01-cazuri-de-utilizare.excalidraw` / `.png` | cazuri de utilizare | paginile React și endpoint-urile din `backend/app/routers/` |
| `02-clase.excalidraw` / `.png` | clase | `backend/app/models.py` (tabelele `service`, `incident`, `incident_update`) |
| `03-stari-incident.excalidraw` / `.png` | stări | câmpul `status` al incidentului și regulile din `routers/incidents.py` |
| `05-secventa-inchidere.excalidraw` / `.png` | secvență | închiderea unui incident: `IncidentDetailPage` → `api.js` → `update_incident()` → `Session` → PostgreSQL |
| `07-componente.excalidraw` / `.png` | componente | modulele din `frontend/src` și `backend/app` |
| `07-desfasurare.excalidraw` / `.png` | desfășurare | containerele din `compose.yaml` și Ollama |

Fișierele `.excalidraw` se deschid la https://excalidraw.com (meniu → Open) sau în VS Code cu extensia
Excalidraw (`pomdtr.excalidraw-editor`).

## Cum le deschideți

- online: https://app.diagrams.net/ → **File → Open from → Device**;
- aplicația desktop: https://github.com/jgraph/drawio-desktop/releases ;
- în VS Code: extensia **Draw.io Integration** (`hediet.vscode-drawio`, recomandată în `.vscode/extensions.json`);
  fișierul `.drawio` se deschide direct în editor.

## Reguli pentru proiect

- Salvați diagramele proprii tot aici, în `docs/diagrame/`, cu nume fără spații și diacritice
  (de exemplu `01-cazuri-de-utilizare.drawio`).
- Pentru fiecare diagramă exportați și o imagine: **File → Export as → PNG** (zoom 200%),
  cu același nume (`01-cazuri-de-utilizare.png`).
- Când modificați codul (o clasă nouă în `models.py`, un endpoint nou), actualizați și diagrama.
