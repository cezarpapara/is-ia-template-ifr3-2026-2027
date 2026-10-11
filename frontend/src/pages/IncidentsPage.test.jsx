import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api.js'
import { deferred, incident, service } from '../test/fixtures.js'
import IncidentsPage from './IncidentsPage.jsx'

vi.mock('../api.js', async (original) => ({ ...await original(), api: {
  getServices: vi.fn(), getIncidents: vi.fn(), createIncident: vi.fn(), createService: vi.fn(),
  updateIncident: vi.fn(), deleteIncident: vi.fn(),
} }))
beforeEach(() => {
  vi.resetAllMocks()
  api.getServices.mockResolvedValue([service])
  api.getIncidents.mockResolvedValue([incident])
})
const openPage = () => render(<MemoryRouter><IncidentsPage /></MemoryRouter>)

it('keeps the newest filter results even when an older request completes last', async () => {
  const old = deferred(), latest = deferred()
  api.getIncidents.mockImplementation((filters) => filters?.status === 'deschis' ? old.promise : filters?.status === 'inchis' ? latest.promise : Promise.resolve([incident]))
  openPage()
  await screen.findByRole('link', { name: incident.title })
  fireEvent.click(screen.getByRole('button', { name: /Deschise/ }))
  fireEvent.click(screen.getByRole('button', { name: /Închise/ }))
  await act(async () => latest.resolve([{ ...incident, id: 8, status: 'inchis', title: 'Închis recent' }]))
  await screen.findByText('Închis recent')
  await act(async () => old.resolve([incident]))
  expect(screen.queryByRole('link', { name: incident.title })).not.toBeInTheDocument()
  expect(screen.getByText('Închis recent')).toBeVisible()
})

it('shows unavailable overview instead of healthy services when summary loading fails', async () => {
  api.getIncidents.mockImplementation((filters) => filters ? Promise.resolve([incident]) : Promise.reject(new Error('Sumar indisponibil')))
  openPage()
  expect(await screen.findByText('Stare indisponibilă')).toBeVisible()
  expect(screen.queryByText('Fără incidente active')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Sumar indisponibil')
})

it('reports description once while pending and keeps form input after failure', async () => {
  const pending = deferred()
  api.createIncident.mockReturnValue(pending.promise)
  openPage()
  await screen.findByRole('link', { name: incident.title })
  fireEvent.click(screen.getByRole('button', { name: 'Raportează incident' }))
  const report = screen.getByRole('region', { name: 'Raportează un incident' })
  fireEvent.change(within(report).getByLabelText('Ce nu funcționează?'), { target: { value: 'Problemă' } })
  fireEvent.change(within(report).getByLabelText('Descriere'), { target: { value: 'Context' } })
  fireEvent.change(within(report).getByLabelText('Serviciu'), { target: { value: '1' } })
  const button = within(report).getByRole('button', { name: 'Raportează' })
  fireEvent.click(button); fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(api.createIncident).toHaveBeenCalledTimes(1)
  expect(api.createIncident).toHaveBeenCalledWith({ title: 'Problemă', description: 'Context', service_id: 1, severity: 2 })
  await act(async () => pending.reject(new Error('Salvare eșuată')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Salvare eșuată')
  expect(within(report).getByLabelText('Descriere')).toHaveValue('Context')
})

it('creates a service and makes it immediately available in reporting', async () => {
  api.createService.mockResolvedValue({ ...service, id: 2, name: 'Gateway' })
  api.getServices.mockResolvedValueOnce([service]).mockResolvedValue([service, { ...service, id: 2, name: 'Gateway' }])
  openPage()
  await screen.findByRole('link', { name: incident.title })
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă serviciu' }))
  fireEvent.change(screen.getByLabelText('Nume serviciu'), { target: { value: 'Gateway' } })
  fireEvent.change(screen.getByLabelText('Echipă responsabilă'), { target: { value: 'Platformă' } })
  fireEvent.change(screen.getByLabelText('Nivel'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează serviciul' }))
  await waitFor(() => expect(api.createService).toHaveBeenCalledWith({ name: 'Gateway', owner: 'Platformă', tier: 2 }))
  fireEvent.click(screen.getByRole('button', { name: 'Raportează incident' }))
  expect(within(screen.getByRole('region', { name: 'Raportează un incident' })).getByRole('option', { name: 'Gateway' })).toBeInTheDocument()
})

it('keeps incident rows available after a rejected transition and prevents duplicate changes', async () => {
  const pending = deferred()
  api.updateIncident.mockReturnValue(pending.promise)
  openPage()
  const status = await screen.findByLabelText('Statusul incidentului 7')
  fireEvent.change(status, { target: { value: 'confirmat' } })
  expect(status).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Șterge incidentul 7' })).toBeDisabled()
  await act(async () => pending.reject(new Error('Tranziție respinsă')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Tranziție respinsă')
  expect(screen.getByLabelText('Statusul incidentului 7')).toBeEnabled()
})

it('confirms deletion, handles cancellation, and refreshes the empty result', async () => {
  vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  api.deleteIncident.mockResolvedValue(null)
  openPage()
  const button = await screen.findByRole('button', { name: 'Șterge incidentul 7' })
  fireEvent.click(button)
  expect(api.deleteIncident).not.toHaveBeenCalled()
  api.getIncidents.mockResolvedValue([])
  fireEvent.click(button)
  expect(await screen.findByText(/Niciun incident nu se potrivește/)).toBeVisible()
  expect(screen.getByText('Fără incidente active')).toBeVisible()
})

it('filters severity and service then reports a new incident successfully', async () => {
  api.createIncident.mockResolvedValue(incident)
  openPage()
  await screen.findByRole('link', { name: incident.title })
  fireEvent.change(screen.getByLabelText('Serviciu'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Severitate'), { target: { value: '3' } })
  await waitFor(() => expect(api.getIncidents).toHaveBeenCalledWith({ service_id: '1', status: '', severity: '3' }, expect.any(Object)))
  fireEvent.click(screen.getByRole('button', { name: 'Raportează incident' }))
  const form = screen.getByRole('region', { name: 'Raportează un incident' })
  fireEvent.change(within(form).getByLabelText('Ce nu funcționează?'), { target: { value: '  Eroare nouă  ' } })
  fireEvent.change(within(form).getByLabelText('Serviciu'), { target: { value: '1' } })
  fireEvent.click(within(form).getByRole('radio', { name: 'SEV3' }))
  fireEvent.click(within(form).getByRole('button', { name: 'Raportează' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Raportează un incident' })).not.toBeInTheDocument())
  expect(api.createIncident).toHaveBeenCalledWith({ title: 'Eroare nouă', description: null, service_id: 1, severity: 3 })
  fireEvent.click(screen.getByRole('button', { name: /^Toate/ }))
})

it('shows list load errors instead of a misleading empty result and can retry', async () => {
  api.getIncidents.mockRejectedValue(new Error('Date indisponibile'))
  openPage()
  await screen.findAllByRole('alert')
  expect(screen.queryByText(/Niciun incident/)).not.toBeInTheDocument()
  api.getIncidents.mockResolvedValue([incident])
  fireEvent.click(screen.getByRole('button', { name: 'Actualizează lista' }))
  expect(await screen.findByRole('link', { name: incident.title })).toBeVisible()
})

it('invalidates an older service request after creation so the new service stays selectable', async () => {
  const old = deferred()
  const created = { ...service, id: 2, name: 'Gateway', open_incident_count: 0 }
  api.getServices.mockReturnValueOnce(old.promise).mockResolvedValue([service, created])
  api.createService.mockResolvedValue(created)
  openPage()
  await screen.findByRole('link', { name: incident.title })
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă serviciu' }))
  fireEvent.change(screen.getByLabelText('Nume serviciu'), { target: { value: 'Gateway' } })
  fireEvent.change(screen.getByLabelText('Echipă responsabilă'), { target: { value: 'Platformă' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează serviciul' }))
  expect(await screen.findByRole('heading', { name: 'Gateway' })).toBeVisible()
  await act(async () => old.resolve([service]))
  expect(screen.getByRole('heading', { name: 'Gateway' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Raportează incident' }))
  expect(within(screen.getByRole('region', { name: 'Raportează un incident' })).getByRole('option', { name: 'Gateway' })).toBeVisible()
})
