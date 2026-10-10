import { useState } from 'react'
import { api } from '../api.js'

// Exemple de intrebari, puse pe butoane
const EXAMPLES = [
  'Ce este un postmortem fara vinovati (blameless)?',
  'Care este diferenta dintre un incident SEV1 si unul SEV3?',
  'Ce inseamna MTTA si MTTR?',
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
    <>
      <h1>Asistent IA</h1>
      <p className="subtitle">Intrebarile sunt trimise modelului de limbaj care ruleaza local, in Ollama. Draftul de postmortem se genereaza din pagina fiecarui incident.</p>

      <section className="card">
        <h2>Intreaba modelul</h2>
        <form onSubmit={handleSubmit} className="chat-form">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Scrieti o intrebare..."
            rows={3}
            required
          />
          <button type="submit" disabled={thinking}>Trimite</button>
        </form>

        <div className="examples">
          {EXAMPLES.map((text) => (
            <button key={text} className="button-secondary" onClick={() => handleExample(text)} disabled={thinking}>
              {text}
            </button>
          ))}
        </div>

        {thinking && <p className="muted">Modelul se gandeste...</p>}

        {error && <div className="status status-error">{error}</div>}

        {answer && (
          <div className="answer">
            <p className="muted">Raspuns ({answer.model}):</p>
            <p>{answer.answer}</p>
          </div>
        )}
      </section>
    </>
  )
}

export default AssistantPage
