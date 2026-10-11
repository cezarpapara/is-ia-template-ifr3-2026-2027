import { useEffect, useState } from 'react'
import { api } from './api.js'

export function useSystemHealth() {
  const [health, setHealth] = useState(null)
  const [ai, setAi] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [checking, setChecking] = useState(true)
  const [checkedAt, setCheckedAt] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    setChecking(true)
    setHealth(null)
    setAi(null)
    setHealthError(null)
    setAiError(null)
    Promise.allSettled([api.getHealth(options), api.getAiStatus(options)]).then(([backend, model]) => {
      if (controller.signal.aborted) return
      if (backend.status === 'fulfilled') setHealth(backend.value)
      else setHealthError(backend.reason.message)
      if (model.status === 'fulfilled') setAi(model.value)
      else setAiError(model.reason.message)
      setCheckedAt(new Date().toISOString())
      setChecking(false)
    })
    return () => controller.abort()
  }, [revision])

  const modelReady = ai?.ollama === 'disponibil' &&
    Array.isArray(ai.models) && (ai.models.includes(ai.model) || ai.models.includes(`${ai.model}:latest`))
  return { health, ai, healthError, aiError, checking, checkedAt, modelReady, refresh: () => setRevision((value) => value + 1) }
}
