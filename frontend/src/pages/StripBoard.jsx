import { Link } from 'react-router'
import { formatDate, STATUSES, STEPS, TRANSITIONS } from '../api.js'
import { IconTrash, SeverityTag, transitionLabel } from '../ui.jsx'

// Tabloul de benzi (tema "Benzi de zbor"): ca la controlorii de trafic aerian, fiecare incident
// este o banda de hartie intr-un suport colorat dupa severitate. Compartimentele sunt starile din
// diagrama de stari, iar butoanele benzii o muta doar pe tranzitiile permise (TRANSITIONS).

// Aceeasi garda ca check_can_close() din backend: SEV1 si SEV2 se inchid doar cu postmortem completat
function canClose(incident) {
  return incident.severity > 2 || Boolean(incident.postmortem?.trim())
}

function StripBoard({ incidents, serviceName, pending, onMove, onDelete }) {
  return (
    <div className="bays">
      {STEPS.map((status) => {
        const strips = incidents.filter((incident) => incident.status === status)
        return (
          <section key={status} className={`bay bay-${status}`} aria-labelledby={`bay-${status}`}>
            <h3 id={`bay-${status}`} className="bay-head" tabIndex={-1}>
              {STATUSES[status]} <span className="bay-count">{strips.length}</span>
            </h3>
            {strips.length === 0 && <p className="bay-empty">Niciun incident</p>}
            {strips.length > 0 && (
              <ol className="bay-strips">
                {strips.map((incident) => (
                  // Numele de tranzitie leaga banda de aceeasi banda dupa mutare, ca sa alunece intre compartimente
                  <li key={incident.id} className={`strip strip-sev-${incident.severity}`} style={{ viewTransitionName: `strip-${incident.id}` }}>
                    <div className="strip-top">
                      <span className="strip-callsign">INC-{incident.id}</span>
                      <SeverityTag severity={incident.severity} />
                    </div>
                    <Link id={`strip-${incident.id}`} className="strip-title" to={`/incidente/${incident.id}`}>{incident.title}</Link>
                    <div className="strip-cells">
                      <span>{serviceName(incident.service_id)}</span>
                      <span>{formatDate(incident.opened_at)}</span>
                    </div>
                    {status !== 'inchis' && (
                      <div className="strip-actions">
                        {TRANSITIONS[status].map((to) => to === 'inchis' && !canClose(incident) ? (
                          // Garda nu este indeplinita: in loc de o inchidere respinsa, duce la postmortem
                          <Link key={to} className="strip-move" to={`/incidente/${incident.id}`} aria-label={`Scrie postmortem-ul (incidentul ${incident.id})`}>
                            Scrie postmortem-ul
                          </Link>
                        ) : (
                          <button
                            key={to}
                            type="button"
                            className="strip-move"
                            disabled={pending}
                            aria-label={`${transitionLabel(status, to)} (incidentul ${incident.id})`}
                            onClick={() => onMove(incident, to)}
                          >
                            {transitionLabel(status, to)}
                          </button>
                        ))}
                        {status === 'deschis' && (
                          <button type="button" className="icon-button" disabled={pending} aria-label={`Șterge incidentul ${incident.id}`} title="Șterge (doar dacă a fost raportat din greșeală)" onClick={() => onDelete(incident)}>
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default StripBoard
