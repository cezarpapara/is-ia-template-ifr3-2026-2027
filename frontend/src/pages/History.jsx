import { useMemo, useState } from 'react'
import { api, secs, STATUSES, when } from '../api.js'
import { usePoll } from '../hooks.jsx'
import { Empty, ErrorNote, StatusMark } from '../components/Common.jsx'

// O coloana = un job terminat (rezultat, viteza, durata, cate amintiri a folosit)
function Run({ job, onChange, onError }) {
  const [open, setOpen] = useState(false)
  const act = (fn) => fn().then(onChange).catch((e) => onError(e.message))
  return (
    <article className="run">
      <header>
        <strong>{job.model_used ?? job.model}</strong>
        <StatusMark status={job.status} />
      </header>
      {job.status === 'done' && (
        <>
          <p className={`answer ${open ? 'answer-open' : ''}`}>{job.result}</p>
          {job.result.length > 280 && (
            <button className="link" onClick={() => setOpen(!open)}>{open ? 'Arată mai puțin' : 'Citește tot'}</button>
          )}
          <dl className="facts">
            <div><dt>Viteză</dt><dd>{job.tokens_per_s ? `${job.tokens_per_s} tokeni/s` : '–'}</dd></div>
            <div><dt>Durată</dt><dd>{secs(job.duration_ms)}</dd></div>
            <div><dt>Tokeni</dt><dd>{job.prompt_tokens ?? 0} + {job.completion_tokens ?? 0}</dd></div>
            <div><dt>Amintiri folosite</dt><dd>{job.memory_hits}</dd></div>
          </dl>
        </>
      )}
      {job.error && <p className="note note-error">{job.error}</p>}
      <footer>
        <small>{when(job.finished_at)}</small>
        <span>
          <button className="ghost" onClick={() => act(() => api.requeueJob(job.id))}>Rulează din nou</button>
          <button className="ghost danger" onClick={() => act(() => api.deleteJob(job.id))}>Șterge</button>
        </span>
      </footer>
    </article>
  )
}

export default function History() {
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const load = () => api.getJobs({ scope: 'history', status, limit: 200 }).then(setJobs)
  const pollError = usePoll(load, 5000, [status])

  // Joburile create impreuna (comparatie) au acelasi group_id si apar una langa alta
  const groups = useMemo(() => {
    const map = new Map()
    for (const j of jobs) {
      const key = j.group_id ?? `solo-${j.id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(j)
    }
    return [...map.values()]
  }, [jobs])

  return (
    <>
      <h1>Istoric</h1>
      <p className="lede">Tot ce a procesat serverul, salvat în baza de date. Comparațiile apar pe aceeași foaie.</p>
      <ErrorNote message={error ?? pollError} />

      <div className="filters">
        {['', 'done', 'failed', 'cancelled'].map((s) => (
          <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s ? STATUSES[s] : 'Toate'}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Empty>Nimic aici încă. Joburile terminate apar în istoric imediat ce se închid.</Empty>
      ) : (
        groups.map((g) => (
          <section key={g[0].group_id ?? g[0].id} className="sheet">
            <h3>{g[0].title}</h3>
            <p className="sheet-prompt">{g[0].prompt}</p>
            <div className="runs" style={{ '--cols': g.length }}>
              {g.map((j) => <Run key={j.id} job={j} onChange={load} onError={setError} />)}
            </div>
          </section>
        ))
      )}
    </>
  )
}
