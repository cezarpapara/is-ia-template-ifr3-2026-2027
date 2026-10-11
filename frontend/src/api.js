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
  } catch (err) {
    if (err.name === 'AbortError') throw err
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
  if (data === null) throw new Error('Răspuns invalid de la backend.')
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
  getHealth: (options) => request('/api/health', options),

  // GET /api/services
  getServices: (options) => request('/api/services', options),

  // POST /api/services
  createService: (service) =>
    request('/api/services', { method: 'POST', body: JSON.stringify(service) }),

  // GET /api/incidents?service_id=&status=&severity=
  getIncidents: (filters = {}, options) => request(`/api/incidents${queryString(filters)}`, options),

  // GET /api/incidents/{id}
  getIncident: (id, options) => request(`/api/incidents/${id}`, options),

  // POST /api/incidents
  createIncident: (incident) =>
    request('/api/incidents', { method: 'POST', body: JSON.stringify(incident) }),

  // PATCH /api/incidents/{id}
  updateIncident: (id, changes) =>
    request(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  // DELETE /api/incidents/{id}
  deleteIncident: (id) => request(`/api/incidents/${id}`, { method: 'DELETE' }),

  // GET /api/incidents/{id}/updates
  getIncidentUpdates: (id, options) => request(`/api/incidents/${id}/updates`, options),

  // POST /api/incidents/{id}/updates
  addIncidentUpdate: (id, update) =>
    request(`/api/incidents/${id}/updates`, { method: 'POST', body: JSON.stringify(update) }),

  // GET /api/ai/status
  getAiStatus: (options) => request('/api/ai/status', options),

  // POST /api/ai/chat
  chat: (message, system) =>
    request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, system }) }),

  // POST /api/ai/incidents/{id}/postmortem
  draftPostmortem: (id, options) => request(`/api/ai/incidents/${id}/postmortem`, { ...options, method: 'POST' }),
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
