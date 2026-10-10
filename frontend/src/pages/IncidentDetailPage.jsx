import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, formatDate, STATUSES, STEPS, TRANSITIONS } from '../api.js'
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
  const [incident, setIncident] = useState(null)
  const [service, setService] = useState(null)
  const [updates, setUpdates] = useState([])
  const [form, setForm] = useState({ author: '', text: '' })
  const [postmortem, setPostmortem] = useState('')
  const [fromAi, setFromAi] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // GET /api/incidents/{id}, GET /api/incidents/{id}/updates si serviciul incidentului.
  // keepPostmortem: pastreaza textul nesalvat din campul postmortem (de exemplu un draft al modelului)
  function load({ keepPostmortem = false } = {}) {
    Promise.all([api.getIncident(id), api.getIncidentUpdates(id), api.getServices()])
      .then(([incidentData, updatesData, services]) => {
        setIncident(incidentData)
        setUpdates(updatesData)
        setService(services.find((item) => item.id === incidentData.service_id) ?? null)
        if (!keepPostmortem) {
          setPostmortem(incidentData.postmortem ?? '')
          setFromAi(false)
        }
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [id])

  const closed = incident?.status === 'inchis'
  const unsaved = incident !== null && postmortem !== (incident.postmortem ?? '')

  // PATCH /api/incidents/{id}; la inchidere se trimite si postmortem-ul scris in pagina
  async function handleStatusChange(status) {
    const changes = status === 'inchis' && postmortem.trim() ? { status, postmortem } : { status }
    try {
      await api.updateIncident(id, changes)
      setMessage(null)
      load({ keepPostmortem: status !== 'inchis' })
    } catch (err) {
      setError(err.message)
    }
  }

  // POST /api/incidents/{id}/updates
  async function handleAddUpdate(event) {
    event.preventDefault()
    try {
      await api.addIncidentUpdate(id, form)
      setForm({ ...form, text: '' })
      load({ keepPostmortem: true })
    } catch (err) {
      setError(err.message)
    }
  }

  // PATCH /api/incidents/{id} cu postmortem-ul
  async function handleSavePostmortem() {
    try {
      await api.updateIncident(id, { postmortem })
      setMessage('Postmortem salvat.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  // POST /api/ai/incidents/{id}/postmortem - draftul apare in camp; se salveaza doar daca apasati Salvează
  async function handleDraft() {
    setDrafting(true)
    setError(null)
    setMessage(null)
    try {
      const draft = await api.draftPostmortem(id)
      setPostmortem(formatDraft(draft))
      setFromAi(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setDrafting(false)
    }
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
            >
              {transitionLabel(incident.status, to)}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}
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
            readOnly={closed}
            placeholder="Cauza, impactul și acțiunile care previn repetarea incidentului"
          />
          {!closed && (
            <div className="actions">
              <button type="button" className="button" onClick={handleSavePostmortem} disabled={!unsaved}>Salvează postmortem</button>
              <button type="button" className="button button-secondary" onClick={handleDraft} disabled={drafting}>
                <IconRefresh />
                {postmortem.trim() ? 'Generează din nou cu IA' : 'Generează draft cu IA'}
              </button>
              {drafting && <span className="muted">Modelul scrie draftul din cronologie...</span>}
              {fromAi && unsaved && !drafting && <span className="muted">Verificați draftul înainte de salvare.</span>}
            </div>
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
                  <input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Numele vostru" maxLength={100} required />
                </label>
                <label className="field">
                  Ce s-a întâmplat?
                  <textarea rows={2} value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder="ex. Am confirmat cauza în loguri" required />
                </label>
                <button type="submit" className="button">Adaugă în cronologie</button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default IncidentDetailPage
