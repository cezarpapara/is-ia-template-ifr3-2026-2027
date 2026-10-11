import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Domeniile (separate prin virgula) prin care este permis accesul, ex. cel din Nginx Proxy Manager.
// Vin din compose.yaml (ALLOWED_HOSTS <- PUBLIC_HOST din .env). localhost si adresele IP sunt mereu permise.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

// Configurarea Vite (serverul de dezvoltare pentru React)
// Documentatie: https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // accesibil din afara containerului (din browserul vostru)
    port: 5173,
    strictPort: true,
    allowedHosts,
    // Browserul vorbeste doar cu frontend-ul; cererile /api/... sunt trimise de Vite catre backend,
    // in reteaua Docker. Astfel un singur domeniu/port (5173) ajunge pentru tot, fara CORS si fara
    // "mixed content" (HTTPS -> HTTP) cand aplicatia este publicata prin Nginx Proxy Manager.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true // necesar pe Windows + Docker, ca modificarile sa se vada imediat
    }
  }
})
