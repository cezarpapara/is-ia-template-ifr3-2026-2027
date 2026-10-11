import { useRef, useState } from 'react'

// Ref-ul blochează și două trimiteri în același cadru, înainte de rerandare.
export function useMutation(onError) {
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  async function run(action) {
    if (locked.current) return
    locked.current = true
    setPending(true)
    try {
      await action()
    } catch (error) {
      onError(error.message)
    } finally {
      locked.current = false
      setPending(false)
    }
  }
  return { pending, run }
}
