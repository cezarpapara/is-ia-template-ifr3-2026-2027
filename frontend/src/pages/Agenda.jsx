import { useEffect, useState } from 'react'
import { api, PRIORITIES, when } from '../api.js'
import { usePoll } from '../hooks.jsx'
import { Empty, ErrorNote, StatusMark } from '../components/Common.jsx'

const AUTO = { name: 'auto', label: 'Auto', hint: 'alege cel mai mare model care încape în memoria liberă' }

export default function Agenda() {
  const [models, setModels] = useState([])
  const [picked, setPicked] = useState(() => JSON.parse(localStorage.getItem('models') ?? '["auto"]'))
  const [prompt, setPrompt] = useState('')
  const [system, setSystem] = useState('')
  const [priority, setPriority] = useState(2)
  const [scheduledAt, setScheduledAt] = useState('')
  const [useMemory, setUseMemory] = useState(true)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.getModels().then((d) => setModels(d.models)).catch((e) => setError(e.message)) }, [])
  usePoll(() => api.getJobs({ scope: 'active' }).then(setJobs), 2000)

  function toggle(name) {
    const next = picked.includes(name) ? picked.filter((n) => n !== name) : [...picked, name]
    const safe = next.length ? next : ['auto']
    setPicked(safe)
    localStorage.setItem('models', JSON.stringify(safe))
  }

  const realModels = models.map((m) => m.name)
  const allPicked = realModels.length > 0 && realModels.every((n) => picked.includes(n))

  function pickAll() {
    const next = allPicked ? ['auto'] : realModels
    setPicked(next)
    localStorage.setItem('models', JSON.stringify(next))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createJobs({
        prompt, system: system || null, models: picked, priority, use_memory: useMemory,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      setPrompt('')
      setJobs(await api.getJobs({ scope: 'active' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id) {
    try { await api.cancelJob(id); setJobs(await api.getJobs({ scope: 'active' })) } catch (err) { setError(err.message) }
  }

  const options = [AUTO, ...models.map((m) => ({ name: m.name, label: m.name, hint: m.provider === 'cloud' ? 'în cloud' : m.parameter_size }))]

  return (
    <>
      <h1>Agendă</h1>
      <p className="lede">Scrie ce vrei să afle modelul. Serverul le procesează pe rând, cele cu prioritate mare întâi.</p>
      <ErrorNote message={error} />

      <form className="composer" onSubmit={submit}>
        <label className="field">
          <span>Cererea</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} required
            placeholder="De exemplu: rezumă diferența dintre o diagramă de secvență și una de colaborare." />
        </label>

        <fieldset className="field">
          <legend>
            Modelul
            {realModels.length > 1 && (
              <button type="button" className="link" onClick={pickAll}>
                {allPicked ? 'renunță la toate' : `selectează toate (${realModels.length})`}
              </button>
            )}
          </legend>
          <div className="chips">
            {options.map((o) => (
              <button type="button" key={o.name} className="chip" aria-pressed={picked.includes(o.name)}
                onClick={() => toggle(o.name)} title={o.hint ?? ''}>
                {o.label}{o.hint && o.name !== 'auto' ? <small>{o.hint}</small> : null}
              </button>
            ))}
          </div>
          {picked.length > 1 && (
            <p className="hint">Ai ales {picked.length} modele: aceeași cerere rulează la fiecare, pe rând, iar răspunsurile se compară în Istoric.</p>
          )}
        </fieldset>

        <div className="inline-fields">
          <label className="field">
            <span>Prioritate</span>
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Pornește la (opțional)</span>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} />
            Folosește și îmbogățește memoria
          </label>
        </div>

        <details className="field">
          <summary>Instrucțiune pentru model (opțional)</summary>
          <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={2}
            placeholder="De exemplu: răspunde scurt, în limba română." />
        </details>

        <button className="primary" disabled={busy || !prompt.trim()}>
          {picked.length > 1 ? `Adaugă ${picked.length} joburi în agendă` : 'Adaugă în agendă'}
        </button>
      </form>

      <h2>Urmează</h2>
      {jobs.length === 0 ? (
        <Empty>Agenda este goală. Ce adaugi mai sus apare aici și se procesează singur.</Empty>
      ) : (
        <ul className="rows">
          {jobs.map((j) => (
            <li key={j.id} className={`row ${j.status === 'running' ? 'row-live' : ''}`}>
              <span className="row-main">
                <strong>{j.title}</strong>
                <small>
                  {j.model_used ?? j.model}, prioritate {PRIORITIES[j.priority].toLowerCase()}
                  {j.scheduled_at && `, pornește ${when(j.scheduled_at)}`}
                  {j.group_id && ', în comparație'}
                </small>
              </span>
              <StatusMark status={j.status} />
              <button className="ghost" onClick={() => cancel(j.id)}>Anulează</button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
