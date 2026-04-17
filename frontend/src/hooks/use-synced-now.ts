import { useEffect, useRef, useState } from "react"

/**
 * Keeps a client-side clock aligned to the latest server timestamp without
 * requiring continuous server ticks.
 */
export function useSyncedNow(serverTime?: string, scopeKey?: string): number {
  const [syncedNow, setSyncedNow] = useState(() => Date.now())
  const serverOffsetRef = useRef(0)

  useEffect(() => {
    if (!serverTime) {
      serverOffsetRef.current = 0
      return
    }

    serverOffsetRef.current = new Date(serverTime).getTime() - Date.now()
    setSyncedNow(Date.now() + serverOffsetRef.current)
  }, [serverTime, scopeKey])

  useEffect(() => {
    let frameId = 0

    const tick = () => {
      setSyncedNow(Date.now() + serverOffsetRef.current)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return syncedNow
}
