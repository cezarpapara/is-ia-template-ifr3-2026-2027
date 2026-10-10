import { useEffect, useState } from 'react'
import { api, PRIORITIES, STATUSES, TRANSITIONS } from '../api.js'

const emptyForm = { title: '', project_id: '', priority: '2' }

// Pagina Sarcini: filtrare, adaugare, schimbarea statusului si stergere
function TasksPage() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [filters, setFilters] = useState({ project_id: '', status: '' })
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // GET /api/tasks cu filtrele alese
  function loadTasks() {
    setLoading(true)
    api.getTasks(filters)
      .then((data) => {
        setTasks(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // Proiectele sunt necesare pentru filtre si pentru formular (o singura data)
  useEffect(() => {
    api.getProjects()
      .then((data) => setProjects(data))
      .catch((err) => setError(err.message))
  }, [])

  // Lista se reincarca de fiecare data cand se schimba un filtru
  useEffect(() => {
    loadTasks()
  }, [filters])

  function projectName(id) {
    return projects.find((project) => project.id === id)?.name ?? `Proiectul ${id}`
  }

  function handleFilterChange(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value })
  }

  function handleFormChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  // POST /api/tasks
  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await api.createTask({
        title: form.title,
        project_id: Number(form.project_id),
        priority: Number(form.priority),
      })
      setForm(emptyForm)
      loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  // PATCH /api/tasks/{id} - se trimite doar statusul nou
  async function handleStatusChange(task, status) {
    try {
      await api.updateTask(task.id, { status })
      loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  // DELETE /api/tasks/{id}, dupa confirmare
  async function handleDelete(task) {
    if (!window.confirm(`Stergeti sarcina "${task.title}"?`)) {
      return
    }
    try {
      await api.deleteTask(task.id)
      loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Sarcini</h1>

      {error && <div className="status status-error">{error}</div>}

      <section className="card">
        <h2>Adauga o sarcina</h2>
        <form onSubmit={handleSubmit} className="form form-grid">
          <input name="title" value={form.title} onChange={handleFormChange} placeholder="Titlu" maxLength={200} required />
          <select name="project_id" value={form.project_id} onChange={handleFormChange} required>
            <option value="">Alege proiectul</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select name="priority" value={form.priority} onChange={handleFormChange}>
            {Object.entries(PRIORITIES).map(([value, label]) => (
              <option key={value} value={value}>Prioritate: {label}</option>
            ))}
          </select>
          <button type="submit">Adauga</button>
        </form>
      </section>

      <section className="card">
        <h2>Lista sarcinilor</h2>

        <div className="form filters">
          <select name="project_id" value={filters.project_id} onChange={handleFilterChange}>
            <option value="">Toate proiectele</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Toate statusurile</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading && <p className="muted">Se incarca...</p>}

        {!loading && tasks.length === 0 && <p>Nu exista sarcini pentru filtrele alese.</p>}

        {!loading && tasks.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Titlu</th>
                <th>Proiect</th>
                <th>Prioritate</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{projectName(task.project_id)}</td>
                  <td><span className={`badge priority-${task.priority}`}>{PRIORITIES[task.priority]}</span></td>
                  <td>
                    <select value={task.status} onChange={(event) => handleStatusChange(task, event.target.value)}>
                      {Object.entries(STATUSES)
                        .filter(([value]) =>
                          value === task.status || TRANSITIONS[task.status].includes(value))
                        .map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <button className="button-danger" onClick={() => handleDelete(task)}>Sterge</button>
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

export default TasksPage
