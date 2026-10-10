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

  // GET /api/services
  getServices: () => request('/api/services'),

  // POST /api/services
  createService: (service) =>
    request('/api/services', { method: 'POST', body: JSON.stringify(service) }),

  // GET /api/incidents?service_id=&status=&severity=
  getIncidents: (filters = {}) => request(`/api/incidents${queryString(filters)}`),

  // GET /api/incidents/{id}
  getIncident: (id) => request(`/api/incidents/${id}`),

  // POST /api/incidents
  createIncident: (incident) =>
    request('/api/incidents', { method: 'POST', body: JSON.stringify(incident) }),

  // PATCH /api/incidents/{id}
  updateIncident: (id, changes) =>
    request(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  // DELETE /api/incidents/{id}
  deleteIncident: (id) => request(`/api/incidents/${id}`, { method: 'DELETE' }),

  // GET /api/incidents/{id}/updates
  getIncidentUpdates: (id) => request(`/api/incidents/${id}/updates`),

  // POST /api/incidents/{id}/updates
  addIncidentUpdate: (id, update) =>
    request(`/api/incidents/${id}/updates`, { method: 'POST', body: JSON.stringify(update) }),

  // GET /api/ai/status
  getAiStatus: () => request('/api/ai/status'),

  // POST /api/ai/chat
  chat: (message, system) =>
    request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, system }) }),

  // POST /api/ai/incidents/{id}/postmortem
  draftPostmortem: (id) => request(`/api/ai/incidents/${id}/postmortem`, { method: 'POST' }),
}

// Textele afisate pentru statusuri si severitati
export const STATUSES = {
  deschis: 'Deschis',
  confirmat: 'Confirmat',
  in_lucru: 'În lucru',
  rezolvat: 'Rezolvat',
  inchis: 'Închis',
}

export const SEVERITIES = {
  1: 'SEV1 critic',
  2: 'SEV2 major',
  3: 'SEV3 minor',
}

// Etapele din diagrama de stari, in ordine
export const STEPS = ['deschis', 'confirmat', 'in_lucru', 'rezolvat', 'inchis']

// Tranzitiile permise (aceleasi ca in backend, routers/incidents.py)
export const TRANSITIONS = {
  deschis: ['confirmat'],
  confirmat: ['in_lucru'],
  in_lucru: ['rezolvat'],
  rezolvat: ['in_lucru', 'inchis'],
  inchis: [],
}

// Ziua si ora in formatul local (ex. 10 oct., 14:05); "—" daca lipseste
export function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'
}
