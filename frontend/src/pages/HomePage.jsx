import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Pagina de start: verifica daca backend-ul (cu baza de date) si Ollama raspund
function HomePage() {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [ai, setAi] = useState(null)
  const [aiError, setAiError] = useState(null)

  useEffect(() => {
    api.getHealth()
      .then((data) => setHealth(data))
      .catch((err) => setHealthError(err.message))

    api.getAiStatus()
      .then((data) => setAi(data))
      .catch((err) => setAiError(err.message))
  }, [])

  // Ollama ruleaza si modelul ales este descarcat
  const modelReady = ai?.ollama === 'disponibil' &&
    (ai.models.includes(ai.model) || ai.models.includes(`${ai.model}:latest`))

  return (
    <>
      <h1>Aplicatie IS + IA</h1>
      <p className="subtitle">Frontend React conectat la un backend FastAPI si la un model de limbaj local (Ollama)</p>

      <section className="card">
        <h2>Backend si baza de date</h2>
        <p>Cerere: <code>GET {api.url}/api/health</code></p>

        {!health && !healthError && <p className="muted">Se verifica...</p>}

        {healthError && (
          <div className="status status-error">
            <strong>Backend-ul nu raspunde.</strong>
            <p>{healthError}</p>
            <p>Porniti proiectul: din folderul principal rulati <code>docker compose up -d</code>.</p>
          </div>
        )}

        {health && (
          <div className="status status-ok">
            <p><strong>Mesaj:</strong> {health.message}</p>
            <p><strong>Baza de date:</strong> {health.database}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Ollama (model de limbaj local)</h2>
        <p>Cerere: <code>GET {api.url}/api/ai/status</code></p>

        {!ai && !aiError && <p className="muted">Se verifica...</p>}

        {aiError && <div className="status status-error">{aiError}</div>}

        {ai && (
          <div className={`status ${modelReady ? 'status-ok' : 'status-error'}`}>
            <p><strong>Ollama:</strong> {ai.ollama}</p>
            <p><strong>Model folosit:</strong> {ai.model}</p>
            {ai.models.length > 0 && <p><strong>Modele descarcate:</strong> {ai.models.join(', ')}</p>}
            <p>{ai.detalii}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Link-uri utile</h2>
        <ul>
          <li>
            Documentatia API (Swagger):{' '}
            <a href={`${api.url}/docs`} target="_blank" rel="noreferrer">{api.url}/docs</a>
          </li>
          <li>
            Modele Ollama:{' '}
            <a href="https://ollama.com/library" target="_blank" rel="noreferrer">ollama.com/library</a>
          </li>
        </ul>
      </section>
    </>
  )
}

export default HomePage
