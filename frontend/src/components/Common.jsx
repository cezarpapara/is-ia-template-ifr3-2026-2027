import { STATUSES } from '../api.js'

export const ErrorNote = ({ message }) => (message ? <p className="note note-error" role="alert">{message}</p> : null)

export const StatusMark = ({ status }) => (
  <span className={`mark mark-${status}`}><i aria-hidden="true" />{STATUSES[status]}</span>
)

export const Empty = ({ children }) => <p className="empty">{children}</p>
