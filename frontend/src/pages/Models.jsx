import { useState } from 'react'
import { api, gb } from '../api.js'
import { usePoll } from '../hooks.jsx'
import { ErrorNote } from '../components/Common.jsx'

export default function Models() {
  const [models, setModels] = useState([])
  const [speeds, setSpeeds] = useState({})
  const [geminiOn, setGeminiOn] = useState(true)
  const [error, setError] = useState(null)
  const pollError = usePoll(async () => {
    const [m, s] = await Promise.all([api.getModels(), api.getJobStats()])
    setModels(m.models)
    setGeminiOn(m.gemini_configured)
    setSpeeds(s.models)
  }, 5000)

  async function unload(name) {
    try { await api.unloadModel(name); setError(null) } catch (err) { setError(err.message) }
  }

  return (
    <>
      <h1>Modele</h1>
      <p className="lede">Ce este instalat pe server. Viteza medie vine din joburile deja terminate, deci se precizează cu fiecare rulare.</p>
      <ErrorNote message={error ?? pollError} />
      {!geminiOn && (
        <p className="note">
          Gemini nu este configurat. Pune GEMINI_API_KEY în backend/.env, apoi rulează
          {' '}<code>docker compose restart backend</code>; modelele Gemini apar aici singure.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Model</th><th>Parametri</th><th>Cuantizare</th><th>Mărime</th><th>Viteză medie</th><th>Stare</th></tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.name}>
                <td><strong>{m.name}</strong>{m.provider === 'cloud' && <small>în cloud: cererea pleacă la Google</small>}</td>
                <td>{m.parameter_size ?? '–'}</td>
                <td>{m.quantization ?? '–'}</td>
                <td>{m.size_bytes ? gb(m.size_bytes) : '–'}</td>
                <td>{speeds[m.name]?.avg_tokens_per_s ? `${speeds[m.name].avg_tokens_per_s} tokeni/s` : 'încă nemăsurată'}</td>
                <td>
                  {m.provider === 'cloud' ? (
                    <span className="mark mark-done"><i aria-hidden="true" />În cloud</span>
                  ) : m.loaded ? (
                    <span className="mark mark-running"><i aria-hidden="true" />În memorie
                      <button className="link" onClick={() => unload(m.name)}>eliberează</button></span>
                  ) : <span className="mark mark-cancelled"><i aria-hidden="true" />Pe disc</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
