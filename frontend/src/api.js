// Toate cererile catre backend sunt grupate aici, intr-un singur loc.
// Implicit, cererile merg la aceeasi adresa ca pagina (/api/...), iar Vite le trimite backend-ului
// (vezi vite.config.js). Doar daca setati VITE_API_URL in compose.yaml, se foloseste o adresa separata.
const API_URL = import.meta.env.VITE_API_URL ?? ''

function errorMessage(data, status) {
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => `${item.loc.at(-1)}: ${item.msg}`).join('; ')
  }
  return `Eroare ${status}`
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error(`Backend-ul nu răspunde${API_URL ? ` la ${API_URL}` : ''}.`)
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorMessage(data, response.status))
  return data
}

function queryString(params) {
  const filled = Object.entries(params).filter(([, v]) => v !== '' && v != null)
  return filled.length ? `?${new URLSearchParams(filled)}` : ''
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const api = {
  url: API_URL,
  // Server
  streamUrl: `${API_URL}/api/system/stream`,
  getHistory: (minutes = 60) => request(`/api/system/history?minutes=${minutes}`),
  // Modele
  getModels: () => request('/api/models'),
  unloadModel: (name) => request(`/api/models/${encodeURIComponent(name)}/unload`, { method: 'POST' }),
  // Agenda si istoric
  getJobs: (filters = {}) => request(`/api/jobs${queryString(filters)}`),
  getJobStats: () => request('/api/jobs/stats'),
  createJobs: (job) => request('/api/jobs', json('POST', job)),
  cancelJob: (id) => request(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  requeueJob: (id) => request(`/api/jobs/${id}/requeue`, { method: 'POST' }),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: 'DELETE' }),
  // Memorie
  getMemory: (q = '') => request(`/api/memory${queryString({ q })}`),
  addMemory: (item) => request('/api/memory', json('POST', item)),
  updateMemory: (id, changes) => request(`/api/memory/${id}`, json('PATCH', changes)),
  deleteMemory: (id) => request(`/api/memory/${id}`, { method: 'DELETE' }),
}

export const PRIORITIES = { 1: 'Mică', 2: 'Medie', 3: 'Mare' }
export const STATUSES = {
  queued: 'În așteptare',
  running: 'Se procesează',
  done: 'Terminat',
  failed: 'Eșuat',
  cancelled: 'Anulat',
}

export const gb = (bytes) => `${(bytes / 2 ** 30).toFixed(1)} GB`
export const secs = (ms) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)} s`)
export const when = (iso) =>
  iso ? new Date(iso).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'
