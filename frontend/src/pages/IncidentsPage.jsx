import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, formatDate, SEVERITIES, STATUSES, TRANSITIONS } from '../api.js'
import { IconPlus, IconTrash, plural, SeverityTag, StatusTrack } from '../ui.jsx'

const emptyForm = { title: '', service_id: '', severity: '2' }

// Filele de deasupra tabelului: cate incidente sunt in fiecare stare (eticheta la plural)
const TABS = [
  ['deschis', 'Deschise'],
  ['confirmat', 'Confirmate'],
  ['in_lucru', 'În lucru'],
  ['rezolvat', 'Rezolvate'],
  ['inchis', 'Închise'],
]

// Pagina Incidente: tabloul serviciilor, raportare, filtrare, schimbarea statusului si stergere
function IncidentsPage() {
  const [services, setServices] = useState([])
  const [allIncidents, setAllIncidents] = useState([])
  const [incidents, setIncidents] = useState([])
  const [filters, setFilters] = useState({ service_id: '', status: '', severity: '' })
  const [form, setForm] = useState(emptyForm)
  const [reportOpen, setReportOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const titleInput = useRef(null)

  // GET /api/incidents cu filtrele alese (lista din tabel)
  function loadIncidents() {
    setLoading(true)
    api.getIncidents(filters)
      .then((data) => {
        setIncidents(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // GET /api/incidents fara filtre si GET /api/services: tabloul serviciilor si numerele din file
  function loadOverview() {
    api.getIncidents()
      .then((data) => setAllIncidents(data))
      .catch((err) => setError(err.message))
    api.getServices()
      .then((data) => setServices(data))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadOverview()
  }, [])

  // Lista se reincarca de fiecare data cand se schimba un filtru
  useEffect(() => {
    loadIncidents()
  }, [filters])

  // Formularul primeste focusul cand se deschide
  useEffect(() => {
    if (reportOpen) {
      titleInput.current?.focus()
    }
  }, [reportOpen])

  function refresh() {
    loadIncidents()
    loadOverview()
  }

  function serviceName(id) {
    return services.find((service) => service.id === id)?.name ?? `Serviciul ${id}`
  }

  const active = allIncidents.filter((incident) => incident.status !== 'inchis')

  // Cel mai grav incident activ al unui serviciu (1 = SEV1); null daca nu are incidente active
  function worstSeverity(serviceId) {
    const severities = active.filter((incident) => incident.service_id === serviceId).map((incident) => incident.severity)
    return severities.length ? Math.min(...severities) : null
  }

  function handleFilterChange(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value })
  }

  function handleFormChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  // POST /api/incidents - incidentul nou porneste din starea "deschis"
  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await api.createIncident({
        title: form.title,
        service_id: Number(form.service_id),
        severity: Number(form.severity),
      })
      setForm(emptyForm)
      setReportOpen(false)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  // PATCH /api/incidents/{id} - se trimite doar statusul nou
  async function handleStatusChange(incident, status) {
    try {
      await api.updateIncident(incident.id, { status })
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  // DELETE /api/incidents/{id}, dupa confirmare (doar incidentele in starea "deschis")
  async function handleDelete(incident) {
    if (!window.confirm(`Ștergeți incidentul "${incident.title}"? Ștergeți doar incidentele raportate din greșeală.`)) {
      return
    }
    try {
      await api.deleteIncident(incident.id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Incidente</h1>
          <p className="subtitle">
            {plural(active.length, 'incident activ', 'incidente active')} pe {plural(services.length, 'serviciu', 'servicii')}
          </p>
        </div>
        <button
          type="button"
          className="button"
          aria-expanded={reportOpen}
          aria-controls="report"
          onClick={() => setReportOpen(!reportOpen)}
        >
          <IconPlus />
          Raportează incident
        </button>
      </header>

      {/* Tabloul serviciilor: lampa arata cel mai grav incident activ (verde = niciunul) */}
      <section className="board" aria-label="Serviciile și incidentele lor active">
        {services.map((service, index) => {
          const worst = worstSeverity(service.id)
          return (
            <article key={service.id} className="board-tile">
              <span className={`lamp ${worst ? `lamp-sev-${worst}` : 'lamp-clear'}`} style={{ '--i': index }} aria-hidden="true" />
              <h2 className="board-name">{service.name}</h2>
              <p className="board-owner">{service.owner}, nivel {service.tier}</p>
              <p className="board-state">
                {worst
                  ? <>{plural(service.open_incident_count, 'incident activ', 'incidente active')}, cel mai grav <strong>SEV{worst}</strong></>
                  : 'Fără incidente active'}
              </p>
            </article>
          )
        })}
      </section>

      {reportOpen && (
        <section id="report" className="card report" aria-labelledby="report-title">
          <h2 id="report-title">Raportează un incident</h2>
          <form onSubmit={handleSubmit} className="report-form">
            <label className="field field-wide">
              Ce nu funcționează?
              <input ref={titleInput} name="title" value={form.title} onChange={handleFormChange} placeholder="ex. Latență mare pe /checkout" maxLength={200} required />
            </label>
            <label className="field">
              Serviciu
              <select name="service_id" value={form.service_id} onChange={handleFormChange} required>
                <option value="">Alege serviciul</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </label>
            <fieldset className="segmented">
              <legend>Severitate</legend>
              <div className="segmented-options">
                {Object.keys(SEVERITIES).map((value) => (
                  <label key={value} title={SEVERITIES[value]}>
                    <input type="radio" name="severity" value={value} checked={form.severity === value} onChange={handleFormChange} />
                    SEV{value}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="actions">
              <button type="submit" className="button">Raportează</button>
              <button type="button" className="button button-secondary" onClick={() => setReportOpen(false)}>Anulează</button>
            </div>
          </form>
        </section>
      )}

      {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}

      <section aria-labelledby="list-title">
        <h2 id="list-title" className="visually-hidden">Lista incidentelor</h2>
        <div className="filters">
          <label className="field">
            Serviciu
            <select name="service_id" value={filters.service_id} onChange={handleFilterChange}>
              <option value="">Toate</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Severitate
            <select name="severity" value={filters.severity} onChange={handleFilterChange}>
              <option value="">Toate</option>
              {Object.entries(SEVERITIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="list-head">
          <div className="tabs" role="group" aria-label="Filtrează după status">
            <button type="button" aria-pressed={filters.status === ''} onClick={() => setFilters({ ...filters, status: '' })}>
              Toate <span className="tab-count">{allIncidents.length}</span>
            </button>
            {TABS.map(([status, label]) => (
              <button key={status} type="button" aria-pressed={filters.status === status} onClick={() => setFilters({ ...filters, status })}>
                {label} <span className="tab-count">{allIncidents.filter((incident) => incident.status === status).length}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="empty">Se încarcă incidentele...</p>}

        {!loading && incidents.length === 0 && (
          <p className="empty">Niciun incident nu se potrivește filtrelor. Alegeți „Toate” sau alt serviciu.</p>
        )}

        {!loading && incidents.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nr.</th>
                  <th scope="col">Incident</th>
                  <th scope="col">Serviciu</th>
                  <th scope="col">Severitate</th>
                  <th scope="col">Deschis</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="visually-hidden">Acțiuni</span></th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id} className={incident.status === 'inchis' ? 'row-closed' : undefined}>
                    <td className="incident-number">{incident.id}</td>
                    <td><Link className="incident-link" to={`/incidente/${incident.id}`}>{incident.title}</Link></td>
                    <td className="nowrap">{serviceName(incident.service_id)}</td>
                    <td><SeverityTag severity={incident.severity} /></td>
                    <td className="muted">{formatDate(incident.opened_at)}</td>
                    <td>
                      {/* Etapa din ciclul de viata + doar tranzitiile permise din diagrama de stari */}
                      <div className="status-cell">
                        <StatusTrack status={incident.status} />
                        <label>
                          <span className="visually-hidden">Statusul incidentului {incident.id}</span>
                          <select
                            value={incident.status}
                            onChange={(event) => handleStatusChange(incident, event.target.value)}
                            disabled={TRANSITIONS[incident.status].length === 0}
                          >
                            {Object.entries(STATUSES)
                              .filter(([value]) => value === incident.status || TRANSITIONS[incident.status].includes(value))
                              .map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </td>
                    <td>
                      {incident.status === 'deschis' && (
                        <button type="button" className="icon-button" aria-label={`Șterge incidentul ${incident.id}`} title="Șterge (doar dacă a fost raportat din greșeală)" onClick={() => handleDelete(incident)}>
                          <IconTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default IncidentsPage
