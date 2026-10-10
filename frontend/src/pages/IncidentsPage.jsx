import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, formatDate, SEVERITIES, STATUSES, TRANSITIONS } from '../api.js'

const emptyForm = { title: '', service_id: '', severity: '2' }

// Pagina Incidente: raportare, filtrare, schimbarea statusului si stergerea incidentelor raportate gresit
function IncidentsPage() {
  const [services, setServices] = useState([])
  const [incidents, setIncidents] = useState([])
  const [filters, setFilters] = useState({ service_id: '', status: '', severity: '' })
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // GET /api/incidents cu filtrele alese
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

  // GET /api/services - pentru filtre, formular si numarul de incidente active
  function loadServices() {
    api.getServices()
      .then((data) => setServices(data))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadServices()
  }, [])

  // Lista se reincarca de fiecare data cand se schimba un filtru
  useEffect(() => {
    loadIncidents()
  }, [filters])

  function serviceName(id) {
    return services.find((service) => service.id === id)?.name ?? `Serviciul ${id}`
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
      loadIncidents()
      loadServices()
    } catch (err) {
      setError(err.message)
    }
  }

  // PATCH /api/incidents/{id} - se trimite doar statusul nou
  async function handleStatusChange(incident, status) {
    try {
      await api.updateIncident(incident.id, { status })
      loadIncidents()
      loadServices()
    } catch (err) {
      setError(err.message)
    }
  }

  // DELETE /api/incidents/{id}, dupa confirmare (doar incidentele in starea "deschis")
  async function handleDelete(incident) {
    if (!window.confirm(`Stergeti incidentul "${incident.title}"? Stergeti doar incidentele raportate din greseala.`)) {
      return
    }
    try {
      await api.deleteIncident(incident.id)
      loadIncidents()
      loadServices()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Incidente</h1>

      {error && <div className="status status-error">{error}</div>}

      <section className="card">
        <h2>Raporteaza un incident</h2>
        <form onSubmit={handleSubmit} className="form form-grid">
          <input name="title" value={form.title} onChange={handleFormChange} placeholder="Ce nu functioneaza?" maxLength={200} required />
          <select name="service_id" value={form.service_id} onChange={handleFormChange} required>
            <option value="">Alege serviciul</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <select name="severity" value={form.severity} onChange={handleFormChange}>
            {Object.entries(SEVERITIES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit">Raporteaza</button>
        </form>
        <p className="muted">
          Servicii: {services.map((service) => `${service.name} (${service.open_incident_count} active)`).join(' · ')}
        </p>
      </section>

      <section className="card">
        <h2>Lista incidentelor</h2>

        <div className="form filters">
          <select name="service_id" value={filters.service_id} onChange={handleFilterChange}>
            <option value="">Toate serviciile</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Toate statusurile</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="severity" value={filters.severity} onChange={handleFilterChange}>
            <option value="">Toate severitatile</option>
            {Object.entries(SEVERITIES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading && <p className="muted">Se incarca...</p>}

        {!loading && incidents.length === 0 && <p>Nu exista incidente pentru filtrele alese.</p>}

        {!loading && incidents.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Serviciu</th>
                <th>Severitate</th>
                <th>Deschis la</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td><Link to={`/incidente/${incident.id}`}>{incident.title}</Link></td>
                  <td>{serviceName(incident.service_id)}</td>
                  <td><span className={`badge sev-${incident.severity}`}>{SEVERITIES[incident.severity]}</span></td>
                  <td>{formatDate(incident.opened_at)}</td>
                  <td>
                    {/* Doar statusul curent si tranzitiile permise din diagrama de stari */}
                    <select
                      value={incident.status}
                      onChange={(event) => handleStatusChange(incident, event.target.value)}
                      disabled={TRANSITIONS[incident.status].length === 0}
                    >
                      {Object.entries(STATUSES)
                        .filter(([value]) =>
                          value === incident.status || TRANSITIONS[incident.status].includes(value))
                        .map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                  </td>
                  <td>
                    {incident.status === 'deschis' && (
                      <button className="button-danger" onClick={() => handleDelete(incident)}>Sterge</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

export default IncidentsPage
