import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Pagina Starea sistemului: verifica daca backend-ul (cu baza de date) si Ollama raspund
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
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Starea sistemului</h1>
          <p className="subtitle">Frontend React conectat la un backend FastAPI, la PostgreSQL și la un model de limbaj local (Ollama)</p>
        </div>
      </header>

      <section className="card">
        <h2>Backend și baza de date</h2>
        <p className="muted">Cerere: <code>GET {api.url}/api/health</code></p>

        {!health && !healthError && <p className="muted">Se verifică...</p>}

        {healthError && (
          <div className="notice notice-error" role="alert">
            <div>
              <p><strong>Backend-ul nu răspunde.</strong> {healthError}</p>
              <p>Porniți proiectul: din folderul principal rulați <code>docker compose up -d</code>.</p>
            </div>
          </div>
        )}

        {health && (
          <div className="notice notice-ok">
            <div>
              <p><strong>Mesaj:</strong> {health.message}</p>
              <p><strong>Baza de date:</strong> {health.database}</p>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Ollama (model de limbaj local)</h2>
        <p className="muted">Cerere: <code>GET {api.url}/api/ai/status</code></p>

        {!ai && !aiError && <p className="muted">Se verifică...</p>}

        {aiError && <div className="notice notice-error" role="alert"><p>{aiError}</p></div>}

        {ai && (
          <div className={`notice ${modelReady ? 'notice-ok' : 'notice-error'}`}>
            <div>
              <p><strong>Ollama:</strong> {ai.ollama}</p>
              <p><strong>Model folosit:</strong> <code>{ai.model}</code></p>
              {ai.models.length > 0 && <p><strong>Modele descărcate:</strong> {ai.models.join(', ')}</p>}
              <p>{ai.detalii}</p>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Link-uri utile</h2>
        <ul>
          <li>
            Documentația API (Swagger):{' '}
            <a href={`${api.url}/docs`} target="_blank" rel="noreferrer">{api.url}/docs</a>
          </li>
          <li>
            Modele Ollama:{' '}
            <a href="https://ollama.com/library" target="_blank" rel="noreferrer">ollama.com/library</a>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default HomePage
