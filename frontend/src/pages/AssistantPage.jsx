import { useState } from 'react'
import { api } from '../api.js'

// Exemple de intrebari, puse pe butoane
const EXAMPLES = [
  'Ce este un postmortem fără vinovați (blameless)?',
  'Care este diferența dintre un incident SEV1 și unul SEV3?',
  'Ce înseamnă MTTA și MTTR?',
]

// Instructiunea de sistem: spune modelului cum sa se comporte
const SYSTEM_PROMPT = 'Esti un asistent pentru o echipa on-call care gestioneaza incidente. Raspunde clar si pe scurt, in limba romana.'

// Pagina Asistent IA: intrebari libere catre model (draftul de postmortem este in pagina fiecarui incident)
function AssistantPage() {
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)

  // POST /api/ai/chat
  async function ask(text) {
    if (!text.trim()) {
      return
    }
    setThinking(true)
    setError(null)
    setAnswer(null)
    try {
      const data = await api.chat(text, SYSTEM_PROMPT)
      setAnswer(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setThinking(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    ask(message)
  }

  function handleExample(text) {
    setMessage(text)
    ask(text)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Asistent IA</h1>
          <p className="subtitle">Întrebările merg la modelul de limbaj care rulează local, în Ollama. Draftul de postmortem se generează din pagina fiecărui incident.</p>
        </div>
      </header>

      <section className="card" aria-labelledby="ask-title">
        <h2 id="ask-title">Întreabă modelul</h2>
        <form onSubmit={handleSubmit} className="timeline-form">
          <label className="field">
            Întrebarea
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Scrieți o întrebare..."
              rows={3}
              required
            />
          </label>
          <button type="submit" className="button" disabled={thinking}>Trimite întrebarea</button>
        </form>

        <div className="examples">
          {EXAMPLES.map((text) => (
            <button key={text} type="button" className="button button-secondary" onClick={() => handleExample(text)} disabled={thinking}>
              {text}
            </button>
          ))}
        </div>

        {thinking && <p className="muted">Modelul se gândește...</p>}

        {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}

        {answer && (
          <div className="answer">
            <p className="muted">Răspunsul modelului {answer.model}:</p>
            <p>{answer.answer}</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default AssistantPage
