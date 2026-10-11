import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, formatDate, STATUSES, STEPS, TRANSITIONS } from '../api.js'
import { useMutation } from '../useMutation.js'
import { IconInfo, IconRefresh, SeverityTag } from '../ui.jsx'

// Textul butonului pentru o tranzitie permisa; "in_lucru" inseamna altceva dupa rezolvare
function transitionLabel(from, to) {
  if (to === 'confirmat') return 'Confirmă'
  if (to === 'in_lucru') return from === 'rezolvat' ? 'Redeschide' : 'Începe lucrul'
  if (to === 'rezolvat') return 'Marchează rezolvat'
  return 'Închide incidentul'
}

// Textul draftului propus de model, in forma in care se salveaza in campul postmortem
function formatDraft(draft) {
  const actions = draft.actiuni.map((action) => `- ${action}`).join('\n')
  return `Cauza: ${draft.cauza}\nImpact: ${draft.impact}\nAcțiuni:\n${actions}`
}

// Pagina unui incident: ciclul de viata, schimbarea statusului, postmortem-ul si cronologia
function IncidentDetailPage() {
  const { id } = useParams()
  return <IncidentEditor key={id} id={id} />
}

function IncidentEditor({ id }) {
  const [incident, setIncident] = useState(null)
  const [service, setService] = useState(null)
  const [updates, setUpdates] = useState([])
  const [form, setForm] = useState({ author: '', text: '' })
  const [postmortem, setPostmortem] = useState('')
  const [fromAi, setFromAi] = useState(false)
  const [aiDraft, setAiDraft] = useState(null)
  const [recovered, setRecovered] = useState(false)
  const [storageError, setStorageError] = useState(null)
  const [closing, setClosing] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const { pending, run } = useMutation(setError)
  const { pending: drafting, run: runDraft } = useMutation(setError)
  const storageKey = `oncall:postmortem:${id}`

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    Promise.all([api.getIncident(id, options), api.getIncidentUpdates(id, options), api.getServices(options)])
      .then(([data, timeline, services]) => {
        if (controller.signal.aborted) return
        setIncident(data)
        setUpdates(timeline)
        setService(services.find((item) => item.id === data.service_id) ?? null)
        let restored = null
        try { restored = sessionStorage.getItem(storageKey) }
        catch { setStorageError('Recuperarea automată nu este disponibilă în acest browser. Copiați textul înainte de a părăsi pagina.') }
        const canRecover = data.status !== 'inchis' && restored !== null && restored !== (data.postmortem ?? '')
        setPostmortem(canRecover ? restored : (data.postmortem ?? ''))
        setRecovered(canRecover)
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [id, storageKey])

  const closed = incident?.status === 'inchis'
  const unsaved = incident !== null && postmortem !== (incident.postmortem ?? '')

  useEffect(() => {
    if (!incident) return
    try {
      if (unsaved && !closed) sessionStorage.setItem(storageKey, postmortem)
      else sessionStorage.removeItem(storageKey)
    } catch {
      setStorageError('Recuperarea automată nu este disponibilă în acest browser. Copiați textul înainte de a părăsi pagina.')
    }
  }, [incident, postmortem, unsaved, closed, storageKey])

  useEffect(() => {
    if (!unsaved || closed) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, closed])

  function handleStatusChange(status) {
    run(async () => {
      setError(null)
      setClosing(status === 'inchis')
      try {
        const changes = status === 'inchis' ? { status, postmortem } : { status }
        const saved = await api.updateIncident(id, changes)
        setIncident(saved)
        if (status === 'inchis') { setPostmortem(saved.postmortem ?? ''); setAiDraft(null) }
        setMessage(null)
      } finally { setClosing(false) }
    })
  }

  function handleAddUpdate(event) {
    event.preventDefault()
    if (!form.author.trim() || !form.text.trim()) return
    run(async () => {
      setError(null)
      const saved = await api.addIncidentUpdate(id, { author: form.author.trim(), text: form.text.trim() })
      setUpdates((current) => [...current, saved])
      setForm((current) => ({ ...current, text: '' }))
    })
  }

  function handleSavePostmortem() {
    run(async () => {
      setError(null)
      const submittedText = postmortem
      const saved = await api.updateIncident(id, { postmortem: submittedText })
      // Acceptăm normalizarea doar dacă utilizatorul nu a editat între timp.
      setPostmortem((current) => current === submittedText ? (saved.postmortem ?? '') : current)
      setIncident(saved)
      setMessage('Postmortem salvat.')
      setRecovered(false)
    })
  }

  function handleDraft() {
    runDraft(async () => {
      setError(null)
      setMessage(null)
      const draft = await api.draftPostmortem(id)
      setAiDraft(formatDraft(draft))
    })
  }

  function handleApplyDraft() {
    if (postmortem.trim() && !window.confirm('Înlocuiți textul postmortem-ului cu propunerea IA?')) return
    setPostmortem(aiDraft)
    setFromAi(true)
    setAiDraft(null)
  }

  if (!incident) {
    return (
      <div className="page">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/incidente">Incidente</Link></nav>
        {error ? <div className="notice notice-error" role="alert"><p>{error}</p></div> : <p className="muted">Se încarcă incidentul...</p>}
      </div>
    )
  }

  // Momentul fiecarei etape (doar deschiderea, confirmarea si rezolvarea au o coloana in baza de date)
  const stepTimes = { deschis: incident.opened_at, confirmat: incident.acknowledged_at, rezolvat: incident.resolved_at }
  const current = STEPS.indexOf(incident.status)
  const transitions = TRANSITIONS[incident.status]

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/incidente">Incidente</Link> <span aria-hidden="true">/</span> Incidentul {incident.id}
      </nav>

      <header className="page-header incident-head">
        <div className="incident-title">
          <SeverityTag severity={incident.severity} large />
          <h1>{incident.title}</h1>
          {service && <p className="subtitle">{service.name}, {service.owner}</p>}
        </div>
        {/* Un buton pentru fiecare tranzitie permisa; tranzitia "inainte" este butonul plin */}
        <div className="actions">
          {transitions.map((to) => (
            <button
              key={to}
              type="button"
              className={STEPS.indexOf(to) > current ? 'button' : 'button button-secondary'}
              onClick={() => handleStatusChange(to)}
              disabled={pending || drafting}
            >
              {transitionLabel(incident.status, to)}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}
      {storageError && <div className="notice notice-rule" role="alert"><p>{storageError}</p></div>}
      {recovered && <p className="notice notice-rule" role="status">Draft recuperat din această sesiune. Verificați textul înainte de salvare.</p>}
      {message && <div className="notice notice-ok" role="status"><p>{message}</p></div>}

      <section className="card" aria-label="Ciclul de viață al incidentului">
        <ol className="line">
          {STEPS.map((step, index) => {
            const state = closed || index < current ? 'passed' : index === current ? 'here' : undefined
            const time = stepTimes[step]
              ? formatDate(stepTimes[step])
              : step === 'inchis' && !closed && incident.severity <= 2 ? 'cere postmortem' : ''
            return (
              <li key={step} className={state} aria-current={index === current ? 'step' : undefined}>
                <span className="line-name">{STATUSES[step]}</span>
                {time && <span className="line-time">{time}</span>}
              </li>
            )
          })}
        </ol>
      </section>

      {!closed && incident.severity <= 2 && (
        <div className="notice notice-rule" role="note">
          <IconInfo />
          <p>Un incident SEV1 sau SEV2 se închide doar după ce postmortem-ul este completat. Severitatea nu se mai schimbă după rezolvare.</p>
        </div>
      )}

      <div className="columns">
        <section className="card column-main" aria-labelledby="pm-title">
          <div className="card-head">
            <h2 id="pm-title">Postmortem</h2>
            {unsaved && <span className="draft-badge">{fromAi ? 'Draft IA, nesalvat' : 'Nesalvat'}</span>}
          </div>
          <textarea
            className="postmortem"
            aria-labelledby="pm-title"
            value={postmortem}
            onChange={(event) => setPostmortem(event.target.value)}
            readOnly={closed || closing}
            maxLength={20000}
            placeholder="Cauza, impactul și acțiunile care previn repetarea incidentului"
          />
          {!closed && (
            <div className="actions">
              <button type="button" className="button" onClick={handleSavePostmortem} disabled={!unsaved || pending}>Salvează postmortem</button>
              <button type="button" className="button button-secondary" onClick={handleDraft} disabled={drafting || pending}>
                <IconRefresh />
                {postmortem.trim() ? 'Generează din nou cu IA' : 'Generează draft cu IA'}
              </button>
              {drafting && <span className="muted">Modelul scrie draftul din cronologie...</span>}
              {fromAi && unsaved && !drafting && <span className="muted">Verificați draftul înainte de salvare.</span>}
            </div>
          )}
          {aiDraft !== null && !closed && (
            <section className="answer" aria-labelledby="ai-draft-title">
              <h3 id="ai-draft-title">Propunere IA</h3>
              <p>Verificați faptele și ipotezele. Aplicarea copiază propunerea în editor; salvarea rămâne un pas separat.</p>
              <pre className="draft-preview">{aiDraft}</pre>
              <div className="actions">
                <button type="button" className="button" onClick={handleApplyDraft} disabled={pending || drafting}>Aplică draftul</button>
                <button type="button" className="button button-secondary" onClick={() => setAiDraft(null)}>Renunță la propunere</button>
              </div>
            </section>
          )}
        </section>

        <div className="column-side">
          <section className="card" aria-labelledby="det-title">
            <h2 id="det-title">Detalii</h2>
            <dl className="details">
              <dt>Deschis</dt>
              <dd>{formatDate(incident.opened_at)}</dd>
              <dt>Confirmat</dt>
              <dd>{formatDate(incident.acknowledged_at)}</dd>
              <dt>Rezolvat</dt>
              <dd>{formatDate(incident.resolved_at)}</dd>
              {incident.description && (
                <>
                  <dt>Descriere</dt>
                  <dd>{incident.description}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card" aria-labelledby="tl-title">
            <h2 id="tl-title">Cronologie</h2>
            {updates.length === 0 && <p className="muted">Nicio actualizare încă. Scrieți prima observație mai jos.</p>}
            {updates.length > 0 && (
              <ol className="timeline">
                {updates.map((update) => (
                  <li key={update.id}>
                    <span className="timeline-rail" aria-hidden="true" />
                    <div>
                      <span className="timeline-meta">{formatDate(update.created_at)}, {update.author}</span>
                      <div>{update.text}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {!closed && (
              <form onSubmit={handleAddUpdate} className="timeline-form">
                <label className="field">
                  Autor
                  <input disabled={pending} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Numele vostru" maxLength={100} required />
                </label>
                <label className="field">
                  Ce s-a întâmplat?
                  <textarea disabled={pending} maxLength={10000} rows={2} value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder="ex. Am confirmat cauza în loguri" required />
                </label>
                <button type="submit" className="button" disabled={pending || !form.author.trim() || !form.text.trim()}>Adaugă în cronologie</button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default IncidentDetailPage
