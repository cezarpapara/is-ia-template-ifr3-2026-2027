import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { api } from '../api.js'
import { deferred } from '../test/fixtures.js'
import AssistantPage from './AssistantPage.jsx'
vi.mock('../api.js', async (original) => ({ ...await original(), api: { chat: vi.fn() } }))
it('submits one request while pending then displays the answer', async () => {
  const pending = deferred()
  api.chat.mockReturnValue(pending.promise)
  render(<AssistantPage />)
  fireEvent.change(screen.getByLabelText('Întrebarea'), { target: { value: 'Ce este MTTR?' } })
  const submit = screen.getByRole('button', { name: 'Trimite întrebarea' })
  act(() => { fireEvent.submit(submit.closest('form')); fireEvent.submit(submit.closest('form')) })
  expect(api.chat).toHaveBeenCalledTimes(1)
  expect(submit).toBeDisabled()
  expect(screen.getByLabelText('Întrebarea')).toHaveAttribute('maxlength', '10000')
  await act(async () => pending.resolve({ answer: 'Timpul până la rezolvare.', model: 'test' }))
  expect(screen.getByText('Timpul până la rezolvare.')).toBeVisible()
})
it('handles examples, empty input, and an unavailable model', async () => {
  api.chat.mockReset().mockRejectedValue(new Error('Model indisponibil'))
  render(<AssistantPage />)
  fireEvent.change(screen.getByLabelText('Întrebarea'), { target: { value: '  ' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Trimite întrebarea' }).closest('form'))
  expect(api.chat).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Ce înseamnă MTTA și MTTR?' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Model indisponibil')
  expect(screen.getByLabelText('Întrebarea')).toHaveValue('Ce înseamnă MTTA și MTTR?')
})
