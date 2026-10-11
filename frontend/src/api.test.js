import { beforeEach, expect, it, vi } from 'vitest'
import { api, formatDate } from './api.js'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

it('encodes filled filters and forwards cancellation to reads', async () => {
  fetch.mockResolvedValue(response([]))
  const signal = new AbortController().signal
  await api.getIncidents({ service_id: '', status: 'în lucru', severity: null }, { signal })
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status=%C3%AEn+lucru'), expect.objectContaining({ signal }))
  expect(fetch.mock.calls[0][0]).not.toContain('service_id')
})

it('preserves AbortError instead of reporting a backend outage', async () => {
  const aborted = new DOMException('Cancelled', 'AbortError')
  fetch.mockRejectedValue(aborted)
  await expect(api.getServices()).rejects.toBe(aborted)
})

it('rejects malformed successful JSON with a controlled error', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json') } })
  await expect(api.getHealth()).rejects.toThrow('Răspuns invalid')
})

it('formats string, validation, unknown and network failures', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'Nu se poate' }, 409))
  await expect(api.deleteIncident(7)).rejects.toThrow('Nu se poate')
  fetch.mockResolvedValueOnce(response({ detail: [{ loc: ['body', 'title'], msg: 'obligatoriu' }] }, 422))
  await expect(api.createIncident({})).rejects.toThrow('title: obligatoriu')
  fetch.mockResolvedValueOnce(response(null, 500))
  await expect(api.getHealth()).rejects.toThrow('Eroare 500')
  fetch.mockRejectedValueOnce(new Error('offline'))
  await expect(api.getHealth()).rejects.toThrow('Backend-ul nu raspunde')
})

it('sends all resource endpoints with their correct verb and payload', async () => {
  fetch.mockResolvedValue(response({ ok: true }))
  await api.getHealth(); await api.getServices(); await api.getIncidents(); await api.getIncident(7)
  await api.getIncidentUpdates(7); await api.getAiStatus()
  const signal = new AbortController().signal
  await api.createService({ name: 'API' }); await api.createIncident({ title: 'Outage' })
  await api.updateIncident(7, { status: 'confirmat' }); await api.addIncidentUpdate(7, { text: 'Fix' })
  await api.chat('Salut', 'Sistem'); await api.draftPostmortem(7, { signal })
  expect(fetch.mock.calls.map(([url]) => url.replace(api.url, ''))).toEqual([
    '/api/health', '/api/services', '/api/incidents', '/api/incidents/7', '/api/incidents/7/updates',
    '/api/ai/status', '/api/services', '/api/incidents', '/api/incidents/7', '/api/incidents/7/updates',
    '/api/ai/chat', '/api/ai/incidents/7/postmortem',
  ])
  expect(fetch.mock.calls[8][1]).toMatchObject({ method: 'PATCH', body: '{"status":"confirmat"}' })
  expect(fetch.mock.calls[11][1]).toMatchObject({ signal })
  fetch.mockResolvedValue(response(null, 204))
  expect(await api.deleteIncident(7)).toBeNull()
})

it('formats absent and present incident timestamps', () => {
  expect(formatDate(null)).toBe('—')
  expect(formatDate('2026-10-10T10:00:00Z')).toContain('oct')
})
