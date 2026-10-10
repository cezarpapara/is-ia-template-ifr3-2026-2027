import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Apeleaza fn imediat si apoi la fiecare `ms` milisecunde (erorile trec in `error`)
export function usePoll(fn, ms, deps = []) {
  const [error, setError] = useState(null)
  const saved = useRef(fn)
  saved.current = fn
  useEffect(() => {
    let alive = true
    const run = () =>
      Promise.resolve(saved.current())
        .then(() => alive && setError(null))
        .catch((err) => alive && setError(err.message))
    run()
    const id = setInterval(run, ms)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [ms, ...deps])
  return error
}

// Telemetria serverului, primita prin Server-Sent Events si pastrata ca serie (ultimele ~3 minute)
const TelemetryContext = createContext(null)
const KEEP = 90

export function TelemetryProvider({ children }) {
  const [value, setValue] = useState({ stats: null, cpu: [], ram: [], connected: false })
  useEffect(() => {
    const source = new EventSource(api.streamUrl)
    source.onmessage = (event) => {
      const stats = JSON.parse(event.data)
      if (!stats.ts) return
      setValue((prev) => ({
        stats,
        cpu: [...prev.cpu, stats.cpu_percent].slice(-KEEP),
        ram: [...prev.ram, stats.ram_percent].slice(-KEEP),
        connected: true,
      }))
    }
    source.onerror = () => setValue((prev) => ({ ...prev, connected: false }))
    return () => source.close()
  }, [])
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
}

export const useTelemetry = () => useContext(TelemetryContext)
