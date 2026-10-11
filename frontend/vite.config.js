import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Configurarea Vite (serverul de dezvoltare pentru React)
// Documentatie: https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
  server: {
    host: true,        // accesibil din afara containerului (din browserul vostru)
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true // necesar pe Windows + Docker, ca modificarile sa se vada imediat
    }
  }
})
