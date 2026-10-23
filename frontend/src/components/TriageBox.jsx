//----23.10.2026----

import { useState } from 'react'
import { api } from '../api.js'

export default function TriageBox() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await api.triage(text)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>Triaj Inteligent Tichet (PoC LLM)</h2>
      
      <form onSubmit={handleSubmit} className="chat-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descrie problema (minim 5 caractere)..."
          rows={3}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Se analizează...' : 'Analizează tichetul'}
        </button>
      </form>

      {error && <div className="status status-error">{error}</div>}

      {result && (
        <div className="answer">
          <p><strong>Prioritate:</strong> {result.priority}</p>
          <p><strong>Categorie:</strong> {result.category}</p>
          <p><strong>Timp estimat:</strong> {result.estimated_hours} ore</p>
          <p><strong>Rezumat:</strong> {result.summary}</p>
          <p><strong>Motivare:</strong> {result.reason}</p>
        </div>
      )}
    </section>
  )
}