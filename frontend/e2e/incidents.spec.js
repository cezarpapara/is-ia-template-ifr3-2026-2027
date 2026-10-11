import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'

const API = 'http://127.0.0.1:18000/api'

test('mobile layout keeps the wide incident table inside its own scroll area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/incidente')
  await expect(page.getByRole('table')).toBeVisible()
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(pageFits).toBe(true)
  const tableScroll = page.locator('.table-scroll')
  expect(await tableScroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await tableScroll.scrollIntoViewIfNeeded()
  await tableScroll.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect(page.getByRole('columnheader', { name: 'Acțiuni' })).toBeInViewport()
})

test('report, investigate, reject premature closure, reopen and close with a reviewed postmortem', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8)
  const serviceName = `checkout-${suffix}`
  const title = `Plăți indisponibile ${suffix}`
  await page.goto('/incidente')
  await page.getByRole('button', { name: 'Adaugă serviciu', exact: true }).click()
  await page.getByLabel('Nume serviciu').fill(serviceName)
  await page.getByLabel('Echipă responsabilă').fill('Echipa Plăți')
  await page.getByRole('button', { name: 'Salvează serviciul', exact: true }).click()
  await expect(page.getByRole('heading', { name: serviceName })).toBeVisible()

  await page.getByRole('button', { name: 'Raportează incident', exact: true }).click()
  await page.getByLabel('Ce nu funcționează?').fill(title)
  await page.getByRole('region', { name: 'Raportează un incident' }).getByRole('combobox', { name: 'Serviciu', exact: true }).selectOption({ label: serviceName })
  await page.getByLabel('Descriere', { exact: true }).fill('Procesatorul de plăți răspunde cu 502 după lansare.')
  const criticalSeverity = page.getByRole('radio', { name: 'SEV1', exact: true })
  await criticalSeverity.focus()
  await criticalSeverity.press('Space')
  await expect(criticalSeverity).toBeChecked()
  await page.getByRole('button', { name: 'Raportează', exact: true }).click()
  await page.getByRole('link', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Procesatorul de plăți răspunde cu 502 după lansare.', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Confirmă', exact: true }).click()
  await page.getByRole('button', { name: 'Începe lucrul', exact: true }).click()
  await page.getByLabel('Autor', { exact: true }).fill('Test on-call')
  await page.getByLabel('Ce s-a întâmplat?').fill('Rollback finalizat; rata de erori a revenit la normal.')
  await page.getByRole('button', { name: 'Adaugă în cronologie' }).click()
  await expect(page.getByText('Rollback finalizat; rata de erori a revenit la normal.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Marchează rezolvat' }).click()
  await page.getByRole('button', { name: 'Închide incidentul' }).click()
  await expect(page.getByRole('alert')).toContainText('fara postmortem')
  await page.getByRole('button', { name: 'Redeschide', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Marchează rezolvat' })).toBeVisible()

  // Simulate only the nondeterministic model. All lifecycle/data requests hit PostgreSQL.
  await page.route('**/api/ai/incidents/*/postmortem', (route) => route.fulfill({
    json: { incident_id: Number(page.url().split('/').at(-1)), cauza: 'Ipoteză: regresie după lansare.',
      impact: 'Plățile au eșuat; amploarea exactă nu este documentată.',
      actiuni: ['Verifică diferențele dintre versiuni.', 'Adaugă test de regresie pentru plăți.'] },
  }))
  await page.getByRole('button', { name: 'Generează draft cu IA' }).click()
  await expect(page.getByRole('heading', { name: 'Propunere IA' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Aplică draftul' }).click()
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveValue(/Ipoteză/)
  await page.getByRole('button', { name: 'Salvează postmortem' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Postmortem salvat' })).toBeVisible()
  await page.getByRole('button', { name: 'Marchează rezolvat' }).click()
  await page.getByRole('button', { name: 'Închide incidentul' }).click()
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: 'Adaugă în cronologie' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveValue(/Ipoteză/)
})

test('restores an unsaved incident draft after reload and preserves it when AI is unavailable', async ({ page, request }) => {
  const suffix = randomUUID().slice(0, 8)
  const service = await request.post(`${API}/services`, { data: { name: `recovery-${suffix}`, owner: 'Test' } })
  expect(service.status()).toBe(201)
  const incident = await request.post(`${API}/incidents`, {
    data: { title: `Draft ${suffix}`, service_id: (await service.json()).id, severity: 2 },
  })
  expect(incident.status()).toBe(201)
  await page.goto(`/incidente/${(await incident.json()).id}`)
  await page.getByRole('textbox', { name: 'Postmortem', exact: true }).fill('Observații nesalvate, de păstrat.')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveValue('Observații nesalvate, de păstrat.')
  await page.route('**/api/ai/incidents/*/postmortem', (route) => route.fulfill({ status: 503, json: { detail: 'Model indisponibil în test.' } }))
  await page.getByRole('button', { name: /Generează.*cu IA/ }).click()
  await expect(page.getByRole('alert')).toContainText('Model indisponibil în test.')
  await expect(page.getByRole('textbox', { name: 'Postmortem', exact: true })).toHaveValue('Observații nesalvate, de păstrat.')
})
