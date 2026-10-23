import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TriageBox from '../components/TriageBox.jsx' //---23.10.2026---

// Exemple de intrebari, puse pe butoane
const EXAMPLES = [
  'Ce este o diagrama de clase UML?',
  'Explica pe scurt diferenta dintre cerinte functionale si nefunctionale.',
  'Da-mi 3 idei de aplicatii care folosesc un model de limbaj local.',
]

// Instructiunea de sistem: spune modelului cum sa se comporte
const SYSTEM_PROMPT = 'Esti un asistent pentru studentii la informatica. Raspunde clar si pe scurt, in limba romana.'

// Pagina Asistent IA: intrebari libere catre model + propunere de subsarcini
function AssistantPage() {
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)

  const [tasks, setTasks] = useState([])
  const [taskId, setTaskId] = useState('')
  const [subtasks, setSubtasks] = useState([])
  const [subtasksLoading, setSubtasksLoading] = useState(false)
  const [subtasksError, setSubtasksError] = useState(null)

  // Sarcinile pentru lista de selectie
  useEffect(() => {
    api.getTasks()
      .then((data) => setTasks(data))
      .catch((err) => setSubtasksError(err.message))
  }, [])

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

  // POST /api/ai/tasks/{id}/subtasks
  async function handleSubtasks() {
    setSubtasksLoading(true)
    setSubtasksError(null)
    setSubtasks([])
    try {
      const data = await api.suggestSubtasks(taskId)
      setSubtasks(data.subtasks)
    } catch (err) {
      setSubtasksError(err.message)
    } finally {
      setSubtasksLoading(false)
    }
  }

  return (
    <>
      <h1>Asistent IA</h1>
      <p className="subtitle">Intrebarile sunt trimise modelului de limbaj care ruleaza local, in Ollama.</p>

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

      <section className="card">
        <h2>Propune subsarcini</h2>
        <p className="muted">Modelul imparte sarcina aleasa in 3-5 pasi. Propunerile nu se salveaza.</p>

        <div className="form">
          <select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="">Alege sarcina</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
          <button onClick={handleSubtasks} disabled={!taskId || subtasksLoading}>Propune subsarcini</button>
        </div>

        {subtasksLoading && <p className="muted">Modelul se gandeste...</p>}

        {subtasksError && <div className="status status-error">{subtasksError}</div>}

        {subtasks.length > 0 && (
          <ol className="answer subtasks">
            {subtasks.map((subtask, index) => (
              <li key={index}>{subtask}</li>
            ))}
          </ol>
        )}
      </section>
      <TriageBox />
    </>
  )
}


export default AssistantPage
