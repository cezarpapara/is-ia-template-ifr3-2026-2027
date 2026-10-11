# Publicarea prin Nginx Proxy Manager (echipa.asociatiamb.ro)

## Cum circulă cererile
```
browser (HTTPS) → Nginx Proxy Manager (:443) → is-ia-node (Vite, :5173) → /api/...  → is-ia-python (:8000, în Docker)
```
Browserul vorbește **doar cu domeniul tău**. Cererile `/api/...` le trimite Vite mai departe către backend, în rețeaua
Docker (`vite.config.js`, secțiunea `proxy`). De aceea ai nevoie de **un singur Proxy Host**, fără subdomeniu pentru
API, fără „Custom Location /api” și fără CORS sau „mixed content” (HTTPS → HTTP).

## 1. Fișierele proiectului (deja modificate în această arhivă)
| Fișier | Ce s-a schimbat |
|---|---|
| `.env` | `PUBLIC_HOST=echipa.asociatiamb.ro`; `VITE_API_URL=` rămâne gol |
| `compose.yaml` | frontend primește `ALLOWED_HOSTS` și `VITE_PROXY_TARGET`; backend primește domeniul în `CORS_ORIGINS` |
| `frontend/vite.config.js` | `allowedHosts` din `ALLOWED_HOSTS`, plus `proxy` pentru `/api` |
| `frontend/src/api.js` | fără `VITE_API_URL`, apelează `/api/...` pe aceeași adresă |

Aplici cu (fără `--build`, pentru că nu s-au schimbat pachetele):
```bash
docker compose up -d
```
Dacă schimbi domeniul, modifici doar `PUBLIC_HOST` în `.env` și rulezi aceeași comandă.

## 2. Proxy Host în Nginx Proxy Manager
**Details**
- Domain Names: `echipa.asociatiamb.ro`
- Scheme: `http`
- Forward Hostname / IP: `192.168.1.254`
- Forward Port: `5173`
- Block Common Exploits: bifat
- Websockets Support: bifat (pentru reîncărcarea automată a Vite)
- Access List: vezi pasul 4

**SSL**: Request a new SSL Certificate, apoi Force SSL și HTTP/2 Support.

**Advanced** (pentru graficele live, care vin printr-un flux continuu):
```
proxy_buffering off;
proxy_read_timeout 3600s;
```
Nu adăuga alte directive (`Upgrade`, `Connection`, `Host`): NPM le pune singur când Websockets Support e bifat.

## 3. Ce să ștergi dacă ai încercat deja
- Proxy Host-ul pentru un subdomeniu de API (`api-echipa...`), dacă l-ai creat.
- Custom Location `/api` din host-ul principal.
- `VITE_API_URL: https://...` sau `/api` din `compose.yaml` (acum e gol, intenționat: cu `/api` s-ar obține `/api/api/...`).

## 4. Protecția (important)
Aplicația nu are autentificare. Cine ajunge pe domeniu poate trimite joburi către modelele tale, poate consuma
cheia Gemini și poate șterge istoricul. În NPM: **Access Lists → Add Access List**, adaugă un utilizator și o parolă
(Authorization), apoi alege lista la **Access List** în Proxy Host. Browserul cere parola o dată, iar apelurile
`/api` și fluxul live o trimit automat.

În router redirecționează **doar 80 și 443**, către mașina cu NPM. Nu deschide spre exterior 5173, 8010
(Swagger), 11434 (Ollama nu are parolă) sau 5432. Swagger (`/docs`) rămâne accesibil doar în rețeaua locală.

## 5. Verificare
1. `https://echipa.asociatiamb.ro` cere parola, apoi apare Scriptorium.
2. În F12 → Network, cererile `jobs`, `models`, `stream` merg către **același domeniu** și au status 200.
3. Pagina Birou arată graficele mișcându-se la 2 secunde.

## 6. Dacă nu merge
| Simptom | Cauză și remediu |
|---|---|
| „Blocked request. This host is not allowed” | `PUBLIC_HOST` nu e domeniul exact din NPM; verifică cu `docker exec is-ia-node env \| grep ALLOWED` |
| 502 de la NPM | frontend-ul e oprit: `docker logs --tail 40 is-ia-node` |
| Pagina se vede, dar „Backend-ul nu răspunde” | `docker exec is-ia-node env \| grep VITE` trebuie să arate `VITE_API_URL=` gol și `VITE_PROXY_TARGET=http://backend:8000`; apoi `docker compose up -d` |
| Graficele îngheață după un minut | lipsesc directivele din Advanced (pasul 2) |
| Merge pe `http://192.168.1.254:5173`, nu pe domeniu | verifică DNS-ul și redirecționarea 80/443 în router |
