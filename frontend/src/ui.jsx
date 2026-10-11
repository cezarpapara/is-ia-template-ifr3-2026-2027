import { createContext, useContext, useLayoutEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { SEVERITIES, STEPS } from './api.js'

// Temele interfetei: "semnale" (implicita) si "benzi", dupa tabloul cu benzi de hartie
// pe care controlorii de trafic aerian urmaresc fiecare avion (flight progress strips)
export const THEMES = { semnale: 'Semnale', benzi: 'Benzi de zbor' }
const THEME_KEY = 'oncall:tema'

export const ThemeContext = createContext({ theme: 'semnale', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

// Tema aleasa ramane in browser (localStorage) si se pune pe <html data-theme="...">, unde o citeste CSS-ul
export function useThemeState() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      return Object.hasOwn(THEMES, saved ?? '') ? saved : 'semnale'
    } catch {
      return 'semnale'
    }
  })
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // fara localStorage, tema se pastreaza doar pana la reincarcarea paginii
    }
  }, [theme])
  return { theme, setTheme }
}

// Schimbarea animata cu View Transitions API (de exemplu banda care trece in compartimentul urmator);
// fara suport in browser sau cu animatiile dezactivate, schimbarea se face direct.
// Promisiunea se rezolva dupa ce pagina arata starea noua (de exemplu, ca focusul sa treaca pe banda mutata).
export function withTransition(update) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced) {
    flushSync(update)
    return Promise.resolve()
  }
  return document.startViewTransition(() => flushSync(update)).updateCallbackDone
}

// Textul butonului pentru o tranzitie permisa; "in_lucru" inseamna altceva dupa rezolvare
export function transitionLabel(from, to) {
  if (to === 'confirmat') return 'Confirmă'
  if (to === 'in_lucru') return from === 'rezolvat' ? 'Redeschide' : 'Începe lucrul'
  if (to === 'rezolvat') return 'Marchează rezolvat'
  return 'Închide incidentul'
}

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

// Semnul aplicatiei: un semafor cu trei lampi, ca pe tabloul serviciilor;
// in tema "benzi", o banda de hartie in suportul ei colorat
export function Logo() {
  const { theme } = useTheme()
  if (theme === 'benzi') {
    return (
      <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">
        <rect width="34" height="20" rx="2" fill="var(--strip)" />
        <rect width="7" height="20" rx="1" fill="var(--holder-1)" />
        <path d="M11 7h12M11 13h8M27 3v14" stroke="var(--ink)" strokeWidth="1.6" />
      </svg>
    )
  }
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
