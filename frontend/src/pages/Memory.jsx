import { useState } from 'react'
import { api, when } from '../api.js'
import { usePoll } from '../hooks.jsx'
import { Empty, ErrorNote } from '../components/Common.jsx'

export default function Memory() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const load = () => api.getMemory(q).then(setItems)
  const pollError = usePoll(load, 6000, [q])
  const run = (fn) => fn().then(load).catch((e) => setError(e.message))

  function add(event) {
    event.preventDefault()
    run(() => api.addMemory({ content: text, pinned: false }).then(() => setText('')))
  }

  return (
    <>
      <h1>Memorie</h1>
      <p className="lede">
        Faptele pe care serverul le-a reținut din joburile terminate. La o cerere nouă, cele care se potrivesc
        (și cele fixate) sunt adăugate automat în instrucțiunea modelului.
      </p>
      <ErrorNote message={error ?? pollError} />

      <form className="inline-form" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} required
          placeholder="Notează manual un fapt, de exemplu: lucrez în limba română." />
        <button className="primary" disabled={!text.trim()}>Reține</button>
      </form>

      <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută în memorie" />

      {items.length === 0 ? (
        <Empty>{q ? 'Nicio amintire nu se potrivește.' : 'Memoria este goală. Se umple după primele joburi terminate.'}</Empty>
      ) : (
        <ul className="rows">
          {items.map((m) => (
            <li key={m.id} className="row">
              <span className="row-main">
                {m.content}
                <small>{m.source_job_id ? `din jobul ${m.source_job_id}` : 'adăugat manual'}, {when(m.created_at)}</small>
              </span>
              <button className="ghost" aria-pressed={m.pinned}
                onClick={() => run(() => api.updateMemory(m.id, { pinned: !m.pinned }))}>
                {m.pinned ? 'Fixat' : 'Fixează'}
              </button>
              <button className="ghost danger" onClick={() => run(() => api.deleteMemory(m.id))}>Uită</button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
