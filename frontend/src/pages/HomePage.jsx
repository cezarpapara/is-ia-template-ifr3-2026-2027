import { useState, useEffect } from 'react'

export default function HomePage() {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [ai, setAi] = useState(null)
  const [aiError, setAiError] = useState(null)

  const api = {
    url: import.meta.env.VITE_API_URL || 'http://localhost:8000'
  }

  useEffect(() => {
    fetch(`${api.url}/api/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => setHealthError(`Eroare: ${err.message}`))
  }, [])

  useEffect(() => {
    fetch(`${api.url}/api/ai/status`)
      .then(res => res.json())
      .then(data => setAi(data))
      .catch(err => setAiError(`Eroare: ${err.message}`))
  }, [])

  const modelReady = ai?.ollama === 'disponibil' && 
    (ai.models?.includes(ai.model) || ai.models?.includes(`${ai.model}:latest`))

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard Sistem</h1>
        <span className="badge-os">Platformă IS + IA</span>
      </div>

      <div className="panel-grid">
        
        {/* Card Backend & Baza de date */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            </div>
            <h2 className="card-title">Stocare & Backend</h2>
          </div>
          
          <div className="status-row">
            <span className="status-label">Conexiune Bază de date</span>
            <span className="status-value">
              {health ? health.database : (healthError ? 'Eroare' : 'Se încarcă...')}
              <span className={`dot ${health?.status === 'ok' ? 'green' : 'red'}`}></span>
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">Răspuns API</span>
            <span className="status-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {health ? health.message : (healthError || '...')}
            </span>
          </div>
        </div>

        {/* Card Inteligență Artificială */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
            </div>
            <h2 className="card-title">Motor Ollama Local</h2>
          </div>

          <div className="status-row">
            <span className="status-label">Status Serviciu</span>
            <span className="status-value">
              {ai ? ai.ollama : (aiError ? 'Eroare' : 'Se încarcă...')}
              <span className={`dot ${modelReady ? 'green' : 'red'}`}></span>
            </span>
          </div>
          
          <div className="status-row">
            <span className="status-label">Modele Instalate</span>
          </div>
          {ai?.models && (
            <div className="tag-list">
              {ai.models.map(m => (
                <span key={m} className={`tag ${m === ai.model ? 'active' : ''}`}>
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Resurse Externe */}
        <div className="glass-card">
          <div className="card-header">
            <div className="card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </div>
            <h2 className="card-title">Resurse Tehnice</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href={`${api.url}/docs`} target="_blank" rel="noreferrer" className="ext-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Documentație API (Swagger)
            </a>
            <a href="https://ollama.com/library" target="_blank" rel="noreferrer" className="ext-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              Librărie Modele Ollama
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
