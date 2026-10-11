import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api.js'
import App from './App.jsx'
import { healthyAi, incident, service } from './test/fixtures.js'
vi.mock('./api.js', async (original) => ({ ...await original(), api: {
  getHealth: vi.fn(), getAiStatus: vi.fn(), getServices: vi.fn(), getIncidents: vi.fn(),
} }))
beforeEach(() => {
  vi.resetAllMocks()
  api.getHealth.mockResolvedValue({ message: 'OK', database: 'ok' })
  api.getAiStatus.mockResolvedValue(healthyAi)
  api.getServices.mockResolvedValue([service]); api.getIncidents.mockResolvedValue([incident])
})
it('redirects to incidents and exposes accessible health text with a refresh control', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Incidente', level: 1 })).toBeVisible()
  expect(await screen.findByText('API și baza de date: disponibil')).toBeVisible()
  expect(screen.getByText('Ollama (test): disponibil')).toBeVisible()
  api.getHealth.mockRejectedValue(new Error('Offline')); api.getAiStatus.mockRejectedValue(new Error('Offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Actualizează conexiunile' }))
  expect(await screen.findByText('API și baza de date: indisponibil')).toBeVisible()
  expect(screen.getByText('Ollama (…): indisponibil')).toBeVisible()
})
it('shows unknown route and allows navigating to the assistant', async () => {
  render(<MemoryRouter initialEntries={['/unknown']}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Pagina nu există' })).toBeVisible()
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navigare principală' })).getByRole('link', { name: 'Asistent IA' }))
  expect(await screen.findByRole('heading', { name: 'Întreabă modelul' })).toBeVisible()
})
it('switches to the flight strip theme, remembers it, and restores it on the next visit', async () => {
  const { unmount } = render(<MemoryRouter initialEntries={['/incidente']}><App /></MemoryRouter>)
  const themes = screen.getByRole('group', { name: 'Tema interfeței' })
  expect(within(themes).getByRole('button', { name: 'Semnale' })).toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement.dataset.theme).toBe('semnale')
  fireEvent.click(within(themes).getByRole('button', { name: 'Benzi de zbor' }))
  expect(within(themes).getByRole('button', { name: 'Benzi de zbor' })).toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement.dataset.theme).toBe('benzi')
  expect(localStorage.getItem('oncall:tema')).toBe('benzi')
  expect(await screen.findByRole('region', { name: /Deschis/ })).toBeVisible()
  unmount()
  render(<MemoryRouter initialEntries={['/incidente']}><App /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Benzi de zbor' })).toHaveAttribute('aria-pressed', 'true')
  await act(async () => {})
})
it('falls back to the default theme when the stored value is unknown or storage is blocked', async () => {
  localStorage.setItem('oncall:tema', 'neon')
  const { unmount } = render(<MemoryRouter initialEntries={['/stare']}><App /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Semnale' })).toHaveAttribute('aria-pressed', 'true')
  unmount()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  render(<MemoryRouter initialEntries={['/stare']}><App /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Benzi de zbor' }))
  expect(document.documentElement.dataset.theme).toBe('benzi')
  await act(async () => {})
})
