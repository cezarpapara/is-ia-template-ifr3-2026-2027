import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router'
import { api } from './api.js'
import { TelemetryProvider, usePoll, useTelemetry } from './hooks.jsx'
import Desk from './pages/Desk.jsx'
import Agenda from './pages/Agenda.jsx'
import History from './pages/History.jsx'
import Memory from './pages/Memory.jsx'
import Models from './pages/Models.jsx'
import './App.css'

// Marginea din stanga: numele aplicatiei, meniul si doua masuratori mici, mereu la vedere
function Rail() {
  const { stats, connected } = useTelemetry()
  const [counts, setCounts] = useState({})
  usePoll(() => api.getJobStats().then((s) => setCounts(s.by_status)), 4000)
  const waiting = (counts.queued ?? 0) + (counts.running ?? 0)
  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-name">Scriptorium</span>
        <span className="brand-sub">atelierul modelelor locale</span>
      </div>
      <nav>
        <NavLink to="/" end>Birou</NavLink>
        <NavLink to="/agenda">Agendă{waiting > 0 && <b className="count">{waiting}</b>}</NavLink>
        <NavLink to="/istoric">Istoric</NavLink>
        <NavLink to="/memorie">Memorie</NavLink>
        <NavLink to="/modele">Modele</NavLink>
      </nav>
      <div className="rail-meters" aria-live="off">
        {stats ? (
          <>
            <Meter label="Procesor" value={stats.cpu_percent} />
            <Meter label="Memorie" value={stats.ram_percent} />
          </>
        ) : (
          <p className="rail-note">{connected ? 'Se citește serverul…' : 'Serverul nu răspunde încă.'}</p>
        )}
      </div>
    </aside>
  )
}

const Meter = ({ label, value }) => (
  <div className="meter">
    <span>{label}</span>
    <strong>{Math.round(value)}%</strong>
    <div className="meter-bar"><div style={{ width: `${Math.min(value, 100)}%` }} /></div>
  </div>
)

function App() {
  return (
    <TelemetryProvider>
      <div className="shell">
        <Rail />
        <main className="page">
          <Routes>
            <Route path="/" element={<Desk />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/istoric" element={<History />} />
            <Route path="/memorie" element={<Memory />} />
            <Route path="/modele" element={<Models />} />
            <Route path="*" element={<p className="empty">Pagina nu există.</p>} />
          </Routes>
        </main>
      </div>
    </TelemetryProvider>
  )
}

export default App
