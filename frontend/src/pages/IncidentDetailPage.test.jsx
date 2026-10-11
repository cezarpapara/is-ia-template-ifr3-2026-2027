import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api.js'
import { deferred, incident, service } from '../test/fixtures.js'
import IncidentDetailPage from './IncidentDetailPage.jsx'

vi.mock('../api.js', async (original) => ({ ...await original(), api: {
  getIncident: vi.fn(), getIncidentUpdates: vi.fn(), getServices: vi.fn(),
  updateIncident: vi.fn(), addIncidentUpdate: vi.fn(), draftPostmortem: vi.fn(),
} }))
beforeEach(() => {
  vi.resetAllMocks()
  api.getIncident.mockResolvedValue(incident)
  api.getIncidentUpdates.mockResolvedValue([])
  api.getServices.mockResolvedValue([service])
})
const openPage = () => render(<MemoryRouter initialEntries={['/incidente/7']}><Routes><Route path="/incidente/:id" element={<IncidentDetailPage />} /></Routes></MemoryRouter>)

it('preserves newer edits when an earlier postmortem save completes', async () => {
  const pending = deferred()
  api.updateIncident.mockReturnValue(pending.promise)
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: 'Prima versiune' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează postmortem' }))
  fireEvent.change(editor, { target: { value: 'Editare mai nouă' } })
  api.getIncident.mockResolvedValue({ ...incident, postmortem: 'Prima versiune' })
  await act(async () => pending.resolve({ ...incident, postmortem: 'Prima versiune' }))
  await screen.findByText('Postmortem salvat.')
  expect(editor).toHaveValue('Editare mai nouă')
  expect(screen.getByText('Nesalvat')).toBeVisible()
})

it('previews the AI draft separately and confirms replacing written text', async () => {
  const pending = deferred()
  api.draftPostmortem.mockReturnValue(pending.promise)
  vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: 'Analiza mea' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generează din nou cu IA' }))
  fireEvent.change(editor, { target: { value: 'Analiza completată' } })
  await act(async () => pending.resolve({ cauza: 'Ipoteză', impact: 'Latență', actiuni: ['Verifică loguri'] }))
  expect(editor).toHaveValue('Analiza completată')
  fireEvent.click(await screen.findByRole('button', { name: 'Aplică draftul' }))
  expect(editor).toHaveValue('Analiza completată')
  fireEvent.click(screen.getByRole('button', { name: 'Aplică draftul' }))
  expect(editor).toHaveValue('Cauza: Ipoteză\nImpact: Latență\nAcțiuni:\n- Verifică loguri')
  expect(api.updateIncident).not.toHaveBeenCalled()
})

it('recovers unsaved text after remount and scopes recovery to the incident', async () => {
  const view = openPage()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Postmortem' }), { target: { value: 'În lucru' } })
  view.unmount()
  openPage()
  expect(await screen.findByRole('textbox', { name: 'Postmortem' })).toHaveValue('În lucru')
  expect(screen.getByText(/Draft recuperat/)).toBeVisible()
  expect(sessionStorage.getItem('oncall:postmortem:8')).toBeNull()
})

it('blocks duplicate timeline submissions and preserves submitted input after failure', async () => {
  const pending = deferred()
  api.addIncidentUpdate.mockReturnValue(pending.promise)
  openPage()
  fireEvent.change(await screen.findByLabelText('Autor'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Ce s-a întâmplat?'), { target: { value: 'Am verificat' } })
  const button = screen.getByRole('button', { name: 'Adaugă în cronologie' })
  fireEvent.click(button); fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(api.addIncidentUpdate).toHaveBeenCalledTimes(1)
  await act(async () => pending.reject(new Error('Nu s-a salvat')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu s-a salvat')
  expect(screen.getByLabelText('Ce s-a întâmplat?')).toHaveValue('Am verificat')
})

it('serializes status transitions and submits the editor text when closing', async () => {
  api.getIncident.mockResolvedValue({ ...incident, status: 'rezolvat', resolved_at: '2026-10-10T12:00:00Z' })
  const pending = deferred()
  api.updateIncident.mockReturnValue(pending.promise)
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: 'Cauza verificată' } })
  const close = screen.getByRole('button', { name: 'Închide incidentul' })
  fireEvent.click(close)
  expect(close).toBeDisabled()
  expect(editor).toHaveAttribute('readonly')
  expect(api.updateIncident).toHaveBeenCalledWith('7', { status: 'inchis', postmortem: 'Cauza verificată' })
  await act(async () => pending.resolve({ ...incident, status: 'inchis', postmortem: 'Cauza verificată' }))
  expect(editor).toHaveValue('Cauza verificată')
  expect(screen.queryByRole('button', { name: 'Salvează postmortem' })).not.toBeInTheDocument()
  expect(sessionStorage.getItem('oncall:postmortem:7')).toBeNull()
})

it('supports confirmation, work, resolution, and reopening without discarding a draft', async () => {
  api.updateIncident.mockImplementation(async (_id, { status }) => ({ ...incident, status }))
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: 'Analiză în lucru' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmă' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Începe lucrul' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Marchează rezolvat' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Redeschide' }))
  expect(await screen.findByRole('button', { name: 'Marchează rezolvat' })).toBeVisible()
  expect(editor).toHaveValue('Analiză în lucru')
})

it('keeps a rejected close editable and appends a saved timeline observation', async () => {
  api.getIncident.mockResolvedValue({ ...incident, status: 'rezolvat' })
  api.updateIncident.mockRejectedValue(new Error('Postmortem necesar'))
  api.addIncidentUpdate.mockResolvedValue({ id: 1, author: 'Ana', text: 'Verificat', created_at: '2026-10-10T12:00:00Z' })
  openPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Închide incidentul' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Postmortem necesar')
  expect(screen.getByRole('textbox', { name: 'Postmortem' })).not.toHaveAttribute('readonly')
  fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Ce s-a întâmplat?'), { target: { value: 'Verificat' } })
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă în cronologie' }))
  expect(await screen.findByText('Verificat')).toBeVisible()
  expect(screen.getByLabelText('Ce s-a întâmplat?')).toHaveValue('')
})

it('applies AI text to an empty editor without confirmation and handles draft failure', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  api.draftPostmortem.mockResolvedValueOnce({ cauza: 'Necunoscută', impact: 'Necunoscut', actiuni: [] }).mockRejectedValueOnce(new Error('IA indisponibilă'))
  openPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Generează draft cu IA' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Aplică draftul' }))
  expect(confirm).not.toHaveBeenCalled()
  expect(screen.getByText('Draft IA, nesalvat')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Generează din nou cu IA' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('IA indisponibilă')
})

it('reports load errors and storage restrictions without silently losing recovery guarantees', async () => {
  const storage = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied') })
  openPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Recuperarea automată nu este disponibilă')
  expect(screen.getByRole('textbox', { name: 'Postmortem' })).toBeVisible()
  storage.mockRestore()
})

it.each([1, 2])('sends a cleared draft when closing SEV%s, then keeps it editable after rejection', async (severity) => {
  const saved = { ...incident, severity, status: 'rezolvat', postmortem: 'Analiza salvată anterior' }
  api.getIncident.mockResolvedValue(saved)
  api.updateIncident.mockImplementation(async (_id, changes) => {
    if (changes.postmortem === '') throw new Error('Postmortem necesar')
    return { ...saved, ...changes }
  })
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Închide incidentul' }))
  expect(api.updateIncident).toHaveBeenCalledWith('7', { status: 'inchis', postmortem: '' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Postmortem necesar')
  expect(editor).toHaveValue('')
  expect(editor).not.toHaveAttribute('readonly')
  expect(screen.getByText('Nesalvat')).toBeVisible()
  expect(sessionStorage.getItem('oncall:postmortem:7')).toBe('')
})

it('clears an older saved postmortem when closing SEV3 with a blank editor', async () => {
  const saved = { ...incident, severity: 3, status: 'rezolvat', postmortem: 'Analiza salvată anterior' }
  api.getIncident.mockResolvedValue(saved)
  api.updateIncident.mockImplementation(async (_id, changes) => ({ ...saved, ...changes }))
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Închide incidentul' }))
  expect(api.updateIncident).toHaveBeenCalledWith('7', { status: 'inchis', postmortem: '' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Închide incidentul' })).not.toBeInTheDocument())
  expect(editor).toHaveValue('')
  expect(editor).toHaveAttribute('readonly')
  expect(sessionStorage.getItem('oncall:postmortem:7')).toBeNull()
})

it('adopts backend normalization when no newer postmortem edit exists', async () => {
  api.updateIncident.mockResolvedValue({ ...incident, postmortem: 'Analiza verificată' })
  openPage()
  const editor = await screen.findByRole('textbox', { name: 'Postmortem' })
  fireEvent.change(editor, { target: { value: '  Analiza verificată\n' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează postmortem' }))
  await screen.findByText('Postmortem salvat.')
  expect(editor).toHaveValue('Analiza verificată')
  expect(screen.queryByText('Nesalvat')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează postmortem' })).toBeDisabled()
  expect(sessionStorage.getItem('oncall:postmortem:7')).toBeNull()
})
