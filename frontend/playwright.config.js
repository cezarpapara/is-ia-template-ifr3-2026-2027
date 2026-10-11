import { defineConfig, devices } from '@playwright/test'

// Dedicated test ports prevent accidentally running destructive flows on the demo.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:15173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 15173',
    url: 'http://127.0.0.1:15173',
    env: { VITE_API_URL: 'http://127.0.0.1:18000' },
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
