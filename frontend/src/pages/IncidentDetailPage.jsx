import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, formatDate, SEVERITIES, STATUSES, TRANSITIONS } from '../api.js'

// Textul draftului propus de model, in forma in care se salveaza in campul postmortem
function formatDraft(draft) {
  const actions = draft.actiuni.map((action) => `- ${action}`).join('\n')
  return `Cauza: ${draft.cauza}\nImpact: ${draft.impact}\nActiuni:\n${actions}`
}

// Pagina unui incident: detalii, schimbarea statusului, cronologia si postmortem-ul
function IncidentDetailPage() {
  const { id } = useParams()
  const [incident, setIncident] = useState(null)
  const [service, setService] = useState(null)
  const [updates, setUpdates] = useState([])
  const [form, setForm] = useState({ author: '', text: '' })
  const [postmortem, setPostmortem] = useState('')
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
        }
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [id])

  const closed = incident?.status === 'inchis'

  // PATCH /api/incidents/{id}; la inchidere se trimite si postmortem-ul scris in pagina
  async function handleStatusChange(status) {
    const changes = status === 'inchis' && postmortem.trim() ? { status, postmortem } : { status }
    try {
      await api.updateIncident(id, changes)
      setMessage(null)
      load({ keepPostmortem: true })
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
      setMessage('Postmortem-ul a fost salvat.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  // POST /api/ai/incidents/{id}/postmortem - draftul apare in camp; se salveaza doar daca apasati Salveaza
  async function handleDraft() {
    setDrafting(true)
    setError(null)
    setMessage(null)
    try {
      const draft = await api.draftPostmortem(id)
      setPostmortem(formatDraft(draft))
      setMessage('Draft generat de model. Verificati-l si apasati Salveaza.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDrafting(false)
    }
  }

  return (
    <>
      <p><Link to="/incidente">&larr; Inapoi la incidente</Link></p>

      {error && <div className="status status-error">{error}</div>}

      {!incident && !error && <p className="muted">Se incarca...</p>}

      {incident && (
        <>
          <h1>{incident.title}</h1>

          <section className="card">
            <h2>Detalii</h2>
            <dl className="details">
              <dt>Serviciu</dt>
              <dd>{service ? `${service.name} (${service.owner})` : incident.service_id}</dd>
              <dt>Severitate</dt>
              <dd><span className={`badge sev-${incident.severity}`}>{SEVERITIES[incident.severity]}</span></dd>
              <dt>Status</dt>
              <dd>
                {/* Doar statusul curent si tranzitiile permise din diagrama de stari */}
                <select value={incident.status} onChange={(event) => handleStatusChange(event.target.value)} disabled={closed}>
                  {Object.entries(STATUSES)
                    .filter(([value]) => value === incident.status || TRANSITIONS[incident.status].includes(value))
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </dd>
              <dt>Deschis la</dt>
              <dd>{formatDate(incident.opened_at)}</dd>
              <dt>Confirmat la</dt>
              <dd>{formatDate(incident.acknowledged_at)}</dd>
              <dt>Rezolvat la</dt>
              <dd>{formatDate(incident.resolved_at)}</dd>
              {incident.description && (
                <>
                  <dt>Descriere</dt>
                  <dd>{incident.description}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h2>Cronologie</h2>
            {updates.length === 0 && <p className="muted">Nu exista actualizari.</p>}
            <ul className="timeline">
              {updates.map((update) => (
                <li key={update.id}>
                  <span className="muted">{formatDate(update.created_at)} · {update.author}</span>
                  <br />
                  {update.text}
                </li>
              ))}
            </ul>

            {!closed && (
              <form onSubmit={handleAddUpdate} className="form">
                <input
                  value={form.author}
                  onChange={(event) => setForm({ ...form, author: event.target.value })}
                  placeholder="Autor"
                  maxLength={100}
                  required
                />
                <input
                  value={form.text}
                  onChange={(event) => setForm({ ...form, text: event.target.value })}
                  placeholder="Ce s-a intamplat?"
                  required
                />
                <button type="submit">Adauga</button>
              </form>
            )}
          </section>

          <section className="card">
            <h2>Postmortem</h2>
            <p className="muted">Obligatoriu inainte de inchiderea unui incident SEV1 sau SEV2.</p>
            <textarea
              className="postmortem"
              value={postmortem}
              onChange={(event) => setPostmortem(event.target.value)}
              rows={8}
              readOnly={closed}
              placeholder="Cauza, impactul si actiunile care previn repetarea incidentului"
            />
            {!closed && (
              <div className="form">
                <button onClick={handleSavePostmortem}>Salveaza</button>
                <button className="button-secondary" onClick={handleDraft} disabled={drafting}>
                  Genereaza draft cu IA
                </button>
              </div>
            )}
            {drafting && <p className="muted">Modelul scrie draftul...</p>}
            {message && <div className="status status-ok">{message}</div>}
          </section>
        </>
      )}
    </>
  )
}

export default IncidentDetailPage
