import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api.js'
import { deferred, incident, service } from '../test/fixtures.js'
import { ThemeContext } from '../ui.jsx'
import IncidentsPage from './IncidentsPage.jsx'

vi.mock('../api.js', async (original) => ({ ...await original(), api: {
  getServices: vi.fn(), getIncidents: vi.fn(), updateIncident: vi.fn(), deleteIncident: vi.fn(),
} }))
// SEV1 rezolvat fara postmortem (nu se poate inchide) si SEV3 rezolvat (se poate inchide)
const blocked = { ...incident, id: 9, title: 'Certificat expirat', status: 'rezolvat', severity: 1 }
const minor = { ...incident, id: 11, title: 'Întârziere e-mail', status: 'rezolvat', severity: 3 }
beforeEach(() => {
  vi.resetAllMocks()
  api.getServices.mockResolvedValue([service])
  api.getIncidents.mockResolvedValue([incident, blocked, minor])
})
afterEach(() => { delete document.startViewTransition })

const openBoard = () => render(
  <ThemeContext value={{ theme: 'benzi', setTheme: () => {} }}>
    <MemoryRouter><IncidentsPage /></MemoryRouter>
  </ThemeContext>,
)
const bay = (name) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
// Ca in browser: actualizarea paginii ruleaza mai tarziu, nu in momentul apelului
const asyncTransition = () => vi.fn((update) => {
  const done = Promise.resolve().then(update)
  return { updateCallbackDone: done, ready: done, finished: done }
})

it('shows one bay per state with each incident as a strip and only its allowed moves', async () => {
  openBoard()
  await screen.findByRole('link', { name: incident.title })
  expect(api.getIncidents).toHaveBeenCalledWith({ service_id: '', status: '', severity: '' }, expect.any(Object))
  expect(screen.queryByRole('group', { name: 'Filtrează după status' })).not.toBeInTheDocument()
  expect(within(bay('Deschis')).getByText('INC-7')).toBeVisible()
  expect(within(bay('Deschis')).getByRole('button', { name: 'Confirmă (incidentul 7)' })).toBeVisible()
  expect(within(bay('Rezolvat')).getByRole('button', { name: 'Redeschide (incidentul 9)' })).toBeVisible()
  expect(within(bay('Rezolvat')).getByRole('button', { name: 'Închide incidentul (incidentul 11)' })).toBeVisible()
  expect(within(bay('Confirmat')).getByText('Niciun incident')).toBeVisible()
})

it('sends a SEV1 strip without postmortem to its page instead of offering a closing the API rejects', async () => {
  openBoard()
  await screen.findByRole('link', { name: blocked.title })
  expect(screen.queryByRole('button', { name: 'Închide incidentul (incidentul 9)' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Scrie postmortem-ul (incidentul 9)' })).toHaveAttribute('href', '/incidente/9')
})

it('moves a strip after the animated update, then focuses and announces it in the new bay', async () => {
  document.startViewTransition = asyncTransition()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  api.updateIncident.mockResolvedValue({ ...incident, status: 'confirmat' })
  openBoard()
  await screen.findByRole('link', { name: incident.title })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirmă (incidentul 7)' })))
  expect(api.updateIncident).toHaveBeenCalledWith(7, { status: 'confirmat' })
  expect(document.startViewTransition).toHaveBeenCalledTimes(1)
  const moved = within(bay('Confirmat')).getByRole('link', { name: incident.title })
  expect(document.activeElement).toBe(moved)
  expect(screen.getByRole('status')).toHaveTextContent('INC-7 a trecut în compartimentul Confirmat.')
  expect(within(bay('Confirmat')).getByRole('button', { name: 'Începe lucrul (incidentul 7)' })).toBeEnabled()
  expect(within(bay('Deschis')).getByText('Niciun incident')).toBeVisible()
  expect(api.getIncidents).toHaveBeenCalledTimes(2)
})

it('skips the animation when the system asks for reduced motion', async () => {
  document.startViewTransition = asyncTransition()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  api.updateIncident.mockResolvedValue({ ...minor, status: 'inchis' })
  openBoard()
  await screen.findByRole('link', { name: minor.title })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Închide incidentul (incidentul 11)' })))
  expect(document.startViewTransition).not.toHaveBeenCalled()
  expect(within(bay('Închis')).getByText('INC-11')).toBeVisible()
})

it('keeps the strip in place and shows the error when the backend rejects the move', async () => {
  const pending = deferred()
  api.updateIncident.mockReturnValue(pending.promise)
  openBoard()
  await screen.findByRole('link', { name: blocked.title })
  fireEvent.click(screen.getByRole('button', { name: 'Redeschide (incidentul 9)' }))
  expect(screen.getByRole('button', { name: 'Confirmă (incidentul 7)' })).toBeDisabled()
  expect(screen.getByLabelText('Serviciu')).toBeDisabled()
  await act(async () => pending.reject(new Error('Incidentul 9 este inchis si nu mai poate fi modificat.')))
  expect(screen.getByRole('alert')).toHaveTextContent('nu mai poate fi modificat')
  expect(within(bay('Rezolvat')).getByText('INC-9')).toBeVisible()
  expect(document.activeElement).toBe(screen.getByRole('link', { name: blocked.title }))
})

it('removes a deleted strip locally, updates the service summary and focuses its bay', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.deleteIncident.mockResolvedValue(null)
  api.getIncidents.mockResolvedValue([incident])
  openBoard()
  await screen.findByRole('link', { name: incident.title })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Șterge incidentul 7' })))
  expect(api.deleteIncident).toHaveBeenCalledWith(7)
  expect(screen.queryByText('INC-7')).not.toBeInTheDocument()
  expect(screen.getByText('Fără incidente active')).toBeVisible()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^Deschis/ }))
  expect(screen.getByRole('status')).toHaveTextContent('INC-7 a fost șters.')
  expect(api.getIncidents).toHaveBeenCalledTimes(2)
})

it('never draws the board from a list fetched for a single status tab', async () => {
  function Switchable() {
    const [theme, setTheme] = useState('semnale')
    return (
      <ThemeContext value={{ theme, setTheme }}>
        <button type="button" onClick={() => setTheme('benzi')}>Benzi</button>
        <MemoryRouter><IncidentsPage /></MemoryRouter>
      </ThemeContext>
    )
  }
  const all = deferred()
  let switched = false
  api.getIncidents.mockImplementation((filters) => filters?.status === 'rezolvat' ? Promise.resolve([blocked, minor])
    : switched && filters?.status === '' ? all.promise : Promise.resolve([incident, blocked, minor]))
  render(<Switchable />)
  await screen.findByRole('link', { name: incident.title })
  fireEvent.click(screen.getByRole('button', { name: /Rezolvate/ }))
  await screen.findByRole('link', { name: blocked.title })
  expect(screen.queryByRole('link', { name: incident.title })).not.toBeInTheDocument()
  switched = true
  fireEvent.click(screen.getByRole('button', { name: 'Benzi' }))
  expect(screen.getByText('Se încarcă incidentele...')).toBeVisible()
  expect(screen.queryByRole('region', { name: /^Deschis/ })).not.toBeInTheDocument()
  await act(async () => all.resolve([incident, blocked, minor]))
  expect(within(bay('Deschis')).getByText('INC-7')).toBeVisible()
})
