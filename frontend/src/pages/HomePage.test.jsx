import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api.js'
import { deferred, healthyAi } from '../test/fixtures.js'
import HomePage from './HomePage.jsx'
vi.mock('../api.js', async (original) => ({ ...await original(), api: { url: 'http://localhost:8000', getHealth: vi.fn(), getAiStatus: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); api.getHealth.mockResolvedValue({ database: 'ok', message: 'Funcționează' }); api.getAiStatus.mockResolvedValue(healthyAi) })
it('shows health in text with last checked time and supports refresh', async () => {
  render(<HomePage />)
  await screen.findByText('Funcționează')
  expect(screen.getByText(/Ultima verificare:/)).toBeVisible()
  const pending = deferred()
  api.getHealth.mockReturnValue(pending.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Actualizează starea' }))
  expect(screen.getByRole('button', { name: 'Actualizează starea' })).toBeDisabled()
  await act(async () => pending.reject(new Error('Offline')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  expect(screen.queryByText('Funcționează')).not.toBeInTheDocument()
})
it('shows AI failures and missing models without crashing', async () => {
  api.getAiStatus.mockRejectedValue(new Error('Ollama inaccesibil'))
  render(<HomePage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Ollama inaccesibil')
  api.getAiStatus.mockResolvedValue({ ollama: 'disponibil', model: 'absent', models: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Actualizează starea' }))
  expect(await screen.findByText('Model indisponibil')).toBeVisible()
})
