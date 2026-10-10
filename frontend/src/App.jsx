import { NavLink, Route, Routes } from 'react-router'
import HomePage from './pages/HomePage.jsx'
import IncidentsPage from './pages/IncidentsPage.jsx'
import IncidentDetailPage from './pages/IncidentDetailPage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'
import './App.css'

// Structura comuna a tuturor paginilor: meniul de sus + pagina curenta
function App() {
  return (
    <>
      <header className="header">
        <span className="logo">Incidente on-call</span>
        <nav>
          <NavLink to="/" end>Acasa</NavLink>
          <NavLink to="/incidente">Incidente</NavLink>
          <NavLink to="/asistent">Asistent IA</NavLink>
        </nav>
      </header>

      <main className="container">
        {/* Fiecare adresa (URL) afiseaza o alta pagina */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/incidente" element={<IncidentsPage />} />
          <Route path="/incidente/:id" element={<IncidentDetailPage />} />
          <Route path="/asistent" element={<AssistantPage />} />
          <Route path="*" element={<p>Pagina nu exista.</p>} />
        </Routes>
      </main>
    </>
  )
}

export default App
