import { SEVERITIES, STEPS } from './api.js'

// Elemente de interfata folosite pe mai multe pagini: iconite (SVG desenat cu linii) si etichete.
// Iconitele sunt decorative (aria-hidden); textul de langa ele spune ce face butonul.
const line = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

// Semnul aplicatiei: un semafor cu trei lampi, ca pe tabloul serviciilor
export function Logo() {
  return (
    <svg width="18" height="30" viewBox="0 0 18 30" aria-hidden="true">
      <rect width="18" height="30" rx="4" fill="var(--ink)" />
      <circle cx="9" cy="7" r="3.5" fill="var(--signal-red)" />
      <circle cx="9" cy="15" r="3.5" fill="var(--signal-yellow)" />
      <circle cx="9" cy="23" r="3.5" fill="var(--signal-green)" />
    </svg>
  )
}

export function IconPlus() {
  return (
    <svg {...line}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg {...line} strokeWidth={1.8}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  )
}

export function IconInfo() {
  return (
    <svg {...line} width={20} height={20} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16v.5" />
    </svg>
  )
}

export function IconRefresh() {
  return (
    <svg {...line} strokeWidth={1.8}>
      <path d="M4 4v6h6" />
      <path d="M20 12a8 8 0 0 1-14.9 4" />
      <path d="M4 12A8 8 0 0 1 18.9 8" />
      <path d="M20 20v-6h-6" />
    </svg>
  )
}

// Severitatea, in culoarea semnalului: SEV1 rosu, SEV2 portocaliu, SEV3 galben
export function SeverityTag({ severity, large = false }) {
  return (
    <span className={`tag sev-${severity}${large ? ' tag-large' : ''}`} title={SEVERITIES[severity]}>
      SEV{severity}
    </span>
  )
}

// Cele cinci etape din diagrama de stari; segmentele pana la statusul curent sunt aprinse
export function StatusTrack({ status }) {
  const current = STEPS.indexOf(status)
  return (
    <span className={`track${status === 'inchis' ? ' track-closed' : ''}`} aria-hidden="true">
      {STEPS.map((step, index) => (
        <span key={step} className={index <= current ? 'on' : undefined} />
      ))}
    </span>
  )
}

// "1 incident activ", "3 incidente active"
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}
