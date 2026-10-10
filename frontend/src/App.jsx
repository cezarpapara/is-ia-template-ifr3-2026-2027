import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import { api } from './api.js'
import HomePage from './pages/HomePage.jsx'
import IncidentsPage from './pages/IncidentsPage.jsx'
import IncidentDetailPage from './pages/IncidentDetailPage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'
import { Logo } from './ui.jsx'
import './App.css'

// Starea sistemului, in dreapta barei de sus: backend-ul (cu baza de date) si modelul din Ollama
function SystemStatus() {
  const [backendOk, setBackendOk] = useState(null)
  const [ai, setAi] = useState(null)

  useEffect(() => {
    api.getHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
    api.getAiStatus()
      .then((data) => setAi(data))
      .catch(() => setAi({ ollama: 'indisponibil', model: '-', models: [] }))
  }, [])

  // Ollama ruleaza si modelul ales este descarcat
  const modelReady = ai?.ollama === 'disponibil' &&
    (ai.models.includes(ai.model) || ai.models.includes(`${ai.model}:latest`))
  // Gri cat timp se verifica, verde daca merge, rosu daca nu
  const lamp = (ok, loaded) => (loaded ? (ok ? 'lamp-clear' : 'lamp-down') : '')

  return (
    <div className="system">
      <span><span className={`lamp lamp-small ${lamp(backendOk, backendOk !== null)}`} aria-hidden="true" />API și baza de date</span>
      <span><span className={`lamp lamp-small ${lamp(modelReady, ai !== null)}`} aria-hidden="true" />Ollama ({ai?.model ?? '...'})</span>
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
