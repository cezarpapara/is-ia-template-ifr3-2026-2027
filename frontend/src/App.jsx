import { Navigate, NavLink, Route, Routes } from 'react-router'
import { formatDate } from './api.js'
import { useSystemHealth } from './useSystemHealth.js'
import HomePage from './pages/HomePage.jsx'
import IncidentsPage from './pages/IncidentsPage.jsx'
import IncidentDetailPage from './pages/IncidentDetailPage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'
import { Logo } from './ui.jsx'
import './App.css'

// Starea sistemului, in dreapta barei de sus: backend-ul (cu baza de date) si modelul din Ollama
function SystemStatus() {
  const { health, ai, checking, checkedAt, modelReady, refresh } = useSystemHealth()
  const lamp = (ok) => checking ? '' : ok ? 'lamp-clear' : 'lamp-down'
  const label = (ok) => checking ? 'se verifică' : ok ? 'disponibil' : 'indisponibil'

  return (
    <div className="system" aria-label="Stare conexiuni">
      <span role="status"><span className={`lamp lamp-small ${lamp(health)}`} aria-hidden="true" />API și baza de date: {label(health)}</span>
      <span role="status"><span className={`lamp lamp-small ${lamp(modelReady)}`} aria-hidden="true" />Ollama ({ai?.model ?? '…'}): {label(modelReady)}</span>
      <span className="system-checked">Ultima verificare: {formatDate(checkedAt)}</span>
      <button type="button" className="status-refresh" aria-label="Actualizează conexiunile" disabled={checking} onClick={refresh}>Verifică</button>
    </div>
  )
}

// Structura comuna a tuturor paginilor: bara de sus + pagina curenta
function App() {
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <NavLink to="/incidente" className="brand"><Logo />On-call</NavLink>
          <nav className="nav" aria-label="Navigare principală">
            <NavLink to="/incidente">Incidente</NavLink>
            <NavLink to="/asistent">Asistent IA</NavLink>
            <NavLink to="/stare">Starea sistemului</NavLink>
          </nav>
          <SystemStatus />
        </div>
      </header>

      <main className="content">
        {/* Fiecare adresa (URL) afiseaza o alta pagina; pagina de start este lista incidentelor */}
        <Routes>
          <Route path="/" element={<Navigate to="/incidente" replace />} />
          <Route path="/incidente" element={<IncidentsPage />} />
          <Route path="/incidente/:id" element={<IncidentDetailPage />} />
          <Route path="/asistent" element={<AssistantPage />} />
          <Route path="/stare" element={<HomePage />} />
          <Route path="*" element={<div className="page"><h1>Pagina nu există</h1></div>} />
        </Routes>
      </main>
    </>
  )
}

export default App
