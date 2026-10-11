export const service = { id: 1, name: 'Checkout', owner: 'Plăți', tier: 1, open_incident_count: 1 }
export const incident = {
  id: 7, title: 'Latență mare', service_id: 1, severity: 2, status: 'deschis',
  description: 'Timeout după plată', postmortem: null,
  opened_at: '2026-10-10T10:00:00Z', acknowledged_at: null, resolved_at: null,
}
export const healthyAi = { ollama: 'disponibil', model: 'test', models: ['test:latest'], detalii: 'Pregătit' }
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
