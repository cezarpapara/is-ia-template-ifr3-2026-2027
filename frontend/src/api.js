// Toate cererile catre backend sunt grupate aici, intr-un singur loc.
// Adresa backend-ului vine din fisierul .env (VITE_API_URL).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Transforma raspunsul de eroare FastAPI ({"detail": ...}) intr-un mesaj citibil
function errorMessage(data, status) {
  if (typeof data?.detail === 'string') {
    return data.detail
  }
  // Eroare 422 (validare): detail este o lista cu cate o problema pentru fiecare camp
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => `${item.loc.at(-1)}: ${item.msg}`).join('; ')
  }
  return `Eroare ${status}`
}

// Functie generala: trimite cererea si intoarce raspunsul JSON (sau arunca o eroare)
async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error(`Backend-ul nu raspunde la ${API_URL}.`)
  }

  // 204 = "No Content" (de exemplu dupa stergere): nu exista JSON in raspuns
  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(data, response.status))
  }
  return data
}

// Construieste "?cheie=valoare&..." doar din filtrele completate
function queryString(params) {
  const filled = Object.entries(params).filter(([, value]) => value !== '' && value != null)
  return filled.length ? `?${new URLSearchParams(filled)}` : ''
}

export const api = {
  url: API_URL,

  // GET /api/health
  getHealth: () => request('/api/health'),

  // GET /api/projects
  getProjects: () => request('/api/projects'),

  // POST /api/projects
  createProject: (project) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(project) }),

  // GET /api/tasks?project_id=&status=
  getTasks: (filters = {}) => request(`/api/tasks${queryString(filters)}`),

  // GET /api/tasks/{id}
  getTask: (id) => request(`/api/tasks/${id}`),

  // POST /api/tasks
  createTask: (task) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(task) }),

  // PATCH /api/tasks/{id}
  updateTask: (id, changes) =>
    request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  // DELETE /api/tasks/{id}
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),

  // GET /api/ai/status
  getAiStatus: () => request('/api/ai/status'),

  // POST /api/ai/chat
  chat: (message, system) =>
    request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, system }) }),

  // POST /api/ai/tasks/{id}/subtasks
  suggestSubtasks: (taskId) => request(`/api/ai/tasks/${taskId}/subtasks`, { method: 'POST' }),
  // POST /api/ai/triage ---- 23.10.2026
  triage: (text) => request('/api/ai/triage', {method: 'POST', body: JSON.stringify({ text }),}),
  // POST /api/ai/triage ---- 23.10.2026
  triage: (text) => request('/api/ai/triage', {method: 'POST', body: JSON.stringify({ text }),}),
}

// Textele afisate pentru statusuri si prioritati
export const STATUSES = {
  de_facut: 'De facut',
  in_lucru: 'In lucru',
  finalizat: 'Finalizat',
}

export const PRIORITIES = {
  1: 'Mica',
  2: 'Medie',
  3: 'Mare',
}
