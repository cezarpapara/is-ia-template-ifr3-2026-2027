import { useState } from 'react'
import { api, gb } from '../api.js'
import { usePoll, useTelemetry } from '../hooks.jsx'
import InkChart from '../components/InkChart.jsx'
import { ErrorNote } from '../components/Common.jsx'

// Fraza care spune ce face worker-ul chiar acum
function workerLine(w) {
  if (!w || w.phase === 'idle') return 'Liber. Agenda este goală sau așteaptă ora programată.'
  if (w.phase === 'waiting_ram') return `Aștept memorie liberă: ${w.detail}.`
  return `Lucrez la „${w.title}” (${w.detail}).`
}

export default function Desk() {
  const { stats, cpu, ram, connected } = useTelemetry()
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  usePoll(() => api.getHistory(60).then(setHistory), 30000)

  async function unload(name) {
    try { await api.unloadModel(name); setError(null) } catch (err) { setError(err.message) }
  }

  if (!stats) {
    return (
      <>
        <h1>Birou</h1>
        <p className="lede">{connected ? 'Se citește serverul…' : 'Aștept prima măsurătoare de la backend.'}</p>
      </>
    )
  }

  return (
    <>
      <h1>Birou</h1>
      <p className="lede">{workerLine(stats.worker)}</p>
      <ErrorNote message={error} />

      <section className="plot-grid">
        <figure className="plot">
          <figcaption>
            <span>Procesor, ultimele 3 minute</span>
            <strong className="big">{Math.round(stats.cpu_percent)}%</strong>
          </figcaption>
          <InkChart values={cpu} label="Utilizarea procesorului" />
          <p className="plot-foot">{stats.cpu_count} nuclee, încărcare medie {stats.load_avg.join(' / ')}</p>
        </figure>
        <figure className="plot">
          <figcaption>
            <span>Memorie, ultimele 3 minute</span>
            <strong className="big">{Math.round(stats.ram_percent)}%</strong>
          </figcaption>
          <InkChart values={ram} color="var(--green)" label="Utilizarea memoriei" />
          <p className="plot-foot">
            {gb(stats.ram_used_mb * 2 ** 20)} folosiți din {gb(stats.ram_total_mb * 2 ** 20)}; swap {Math.round(stats.swap_percent)}%
          </p>
        </figure>
      </section>

      <section className="block">
        <h2>Nucleele</h2>
        <div className="cores">
          {stats.cpu_cores.map((c, i) => (
            <div key={i} className="core" title={`Nucleul ${i + 1}: ${c}%`}>
              <div className="core-fill" style={{ height: `${Math.max(c, 2)}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>Modele din memorie acum</h2>
        {stats.loaded_models.length === 0 ? (
          <p className="empty">Niciun model încărcat. Primul job din agendă va încărca unul.</p>
        ) : (
          <ul className="rows">
            {stats.loaded_models.map((m) => (
              <li key={m.name} className="row">
                <span className="row-main"><strong>{m.name}</strong> ocupă {gb(m.size_bytes)}</span>
                <button className="ghost" onClick={() => unload(m.name)}>Eliberează memoria</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Ultima oră, din baza de date</h2>
        {history.length > 1 ? (
          <div className="plot plot-flat">
            <InkChart values={history.map((h) => h.cpu)} height={90} label="Procesor în ultima oră" />
            <InkChart values={history.map((h) => h.ram_percent)} color="var(--green)" height={90} label="Memorie în ultima oră" />
            <p className="plot-foot">Burgundiu: procesor. Verde: memorie. {history.length} măsurători salvate.</p>
          </div>
        ) : (
          <p className="empty">Măsurătorile se salvează la 10 secunde; graficul apare în câteva clipe.</p>
        )}
      </section>
    </>
  )
}
