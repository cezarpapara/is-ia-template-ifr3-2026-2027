# Verificare

Testele rulează pe baze PostgreSQL temporare, separate de incidentele din aplicația locală. `compose.test.yaml` nu montează `docker/postgres/data`; bazele sale sunt în memorie și dispar la eliminarea containerelor. Nu folosiți baza aplicației pentru teste.

## Backend

Din rădăcina proiectului:

```bash
docker compose -f compose.test.yaml run --build --rm tests
```

Suita verifică matricea tranzițiilor, postmortem-ul obligatoriu la închiderea SEV1/SEV2, redeschiderea, restricțiile pentru incidente închise, ștergerea, validarea intrărilor și erorile Ollama. Testele concurente folosesc sesiuni PostgreSQL reale pentru a verifica blocarea aceluiași incident în PATCH, DELETE și adăugarea unei actualizări. Testele de migrare verifică instalarea de la zero și refuzul datelor istorice incompatibile.

Pentru depanare cu Python 3.12 și o bază de test proprie:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:PORT/oncall_test python -m pytest
```

Harness-ul refuză o bază al cărei nume nu se termină în `_test`. El recreează tabelele acelei baze: folosiți un utilizator și o bază dedicate.

## Frontend

Verificarea locală folosește Node.js 24:

```bash
cd frontend
npm ci
npm run test:coverage
npm run build
npm audit --audit-level=high
```

Testele de componente și adaptor API verifică răspunsurile întârziate, erorile și stările necunoscute, cererile duplicate, păstrarea textului, previzualizarea IA, serviciile și starea sistemului. Pragul de acoperire este 80%; raportul listează ramurile neacoperite pentru investigație.

## Fluxuri în browser

Din rădăcina proiectului porniți API-ul separat de test:

```bash
docker compose -f compose.test.yaml up --build --detach --wait e2e-api
cd frontend
npx playwright install chromium
npm run test:e2e
```

Playwright pornește singur frontend-ul pe `127.0.0.1:15173`, conectat la API-ul de test pe `127.0.0.1:18000`. Porturile aplicației obișnuite, 5173 și 8000, nu sunt folosite.

Fluxul principal creează un serviciu și un incident cu descriere, adaugă o actualizare, confirmă și rezolvă incidentul, verifică respingerea închiderii fără postmortem, redeschide, revizuiește și aplică o propunere IA, salvează și închide. Un al doilea flux verifică recuperarea textului nesalvat și păstrarea lui când modelul nu răspunde. Verificarea mobilă confirmă că tabelul lat se derulează în propriul container și nu lărgește pagina.

Doar răspunsurile modelului sunt simulate în browser, pentru rezultate repetabile. Operațiile asupra incidentelor folosesc API-ul și PostgreSQL reale. La eșec, capturile și traseele se găsesc în `frontend/test-results`.

La final, din rădăcina proiectului:

```bash
docker compose -f compose.test.yaml down --volumes
```

## Contracte și concurență

- Câmpurile text obligatorii sunt curățate de spații la margini și nu acceptă text gol. Textele libere au limite explicite în scheme.
- În PATCH, un câmp omis rămâne neschimbat. `description: null` și `postmortem: null` șterg câmpurile opționale; câmpurile obligatorii nu acceptă `null`.
- Închiderea SEV1/SEV2 cere un postmortem nevid; niciun câmp și nicio actualizare nu se pot modifica după închidere.
- Operațiile concurente blochează rândul incidentului și îi recitesc starea înainte de validare. Un nume de serviciu duplicat întoarce 409 inclusiv când două cereri ajung simultan.
- Un răspuns Ollama incompatibil întoarce o eroare controlată; generarea folosește un instantaneu al incidentului, fără tranzacție deschisă pe durata inferenței.

## Evaluarea modelului local

Evaluarea este opțională față de testele automate și apelează modelul configurat în Ollama. Setul `development` păstrează cele patru incidente sintetice folosite la dezvoltarea promptului; setul `holdout` adaugă opt incidente noi, definite înaintea rulării repetate. Nu citește și nu modifică incidentele din baza aplicației.

```bash
docker compose exec -T backend python -m evaluation.run --suite all --list
docker compose exec -T backend python -m evaluation.run --suite all --repetitions 3 --output /tmp/postmortem-evaluation.json
docker compose cp backend:/tmp/postmortem-evaluation.json ./postmortem-evaluation.json
```

Implicit se rulează setul `development` o singură dată. Pentru un singur caz folosiți `--case known_cause`; pentru setul nou, `--suite holdout`; pentru alt model deja instalat, `--model NUME`. `--repetitions` acceptă între 1 și 10 repetări. Generările sunt seriale: fiecare caz selectat, apoi următoarea repetare.

Raportul păstrează modelul, hash-urile promptului, seturilor, cazurilor și contextului, intrarea exactă, ieșirea brută, validitatea formatului, repetarea și latența fiecărei încercări. Fișierul de ieșire este actualizat după fiecare încercare; `complete` și numărul de încercări arată dacă rularea s-a încheiat. Eșecurile rămân în raport și în numitor. Codul de ieșire 0 înseamnă numai că toate răspunsurile au trecut validarea formatului.

Fiecare rulare cere o cale de ieșire nouă. Un fișier existent este refuzat înainte de inferență, pentru a păstra rezultatele anterioare. O rulare întreruptă nu este reluată automat; păstrați raportul parțial și alegeți alt nume pentru o rulare nouă.

[Protocolul de evaluare](evaluare-ia/protocol-holdout.md) definește scorurile 0–2, criteriul de fidelitate factuală și limitele măsurării. Comparați fiecare afirmație cu `input_context`, exact datele primite de model. Evaluările asistentului se păstrează separat de `manual_review`, care rămâne în așteptarea unui evaluator uman; nu transformați lipsa dovezilor în certitudine și nu considerați recomandările drept acțiuni deja realizate.

[Evaluarea din 11 octombrie 2026](evaluare-ia/README.md) păstrează rularea inițială și rularea după îmbunătățirea promptului, cu observațiile de revizuire.
