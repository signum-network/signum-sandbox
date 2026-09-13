import { useCallback, useEffect, useState } from 'react'
import { forge } from '@/lib/chainAdmin'
import { parseAutoInterval } from '@/lib/autoForge'
import type { SandboxAccount } from '@/lib/accounts'

const INTERVAL_KEY = 'signum-sandbox.autoInterval.v1'

export function useForge(forger: SandboxAccount | undefined) {
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intervalS, setIntervalSeconds] = useState(() =>
    parseAutoInterval(window.localStorage.getItem(INTERVAL_KEY)),
  )
  /** When the next automatic forge is due, for the countdown. Null when off. */
  const [nextForgeAt, setNextForgeAt] = useState<number | null>(null)

  const setAutoInterval = useCallback((seconds: number) => {
    setIntervalSeconds(seconds)
    window.localStorage.setItem(INTERVAL_KEY, String(seconds))
  }, [])

  // Always resolves, never rejects: ChainService.send throws on any errorCode
  // in the response (e.g. the node restarting mid-forge), and the loop below
  // has nothing to catch a rejection with — an uncaught one there is an
  // unhandled promise rejection once per interval, forever.
  const forgeOnce = useCallback(async () => {
    if (!forger) return
    setBusy(true)
    try {
      await forge(forger.passphrase)
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [forger])

  // A self-scheduling timeout rather than an interval: the gap is measured
  // from when a forge finished, not from when the last one started, so a slow
  // node cannot stack overlapping calls that then collapse into one block.
  // The first block comes immediately, because switching the thing on and
  // waiting five seconds for any sign of life reads as broken.
  useEffect(() => {
    if (!auto || !forger) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const loop = async () => {
      setNextForgeAt(null)
      await forgeOnce()
      if (stopped) return
      setNextForgeAt(Date.now() + intervalS * 1000)
      timer = setTimeout(() => void loop(), intervalS * 1000)
    }
    void loop()

    return () => {
      stopped = true
      setNextForgeAt(null)
      if (timer) clearTimeout(timer)
    }
  }, [auto, forger, forgeOnce, intervalS])

  // A dangling forger id (the account was removed) or no forger at all leaves
  // auto-forge switched on with nothing to forge with — the effect above bails
  // silently, so the toggle would read "on" forever while doing nothing.
  useEffect(() => {
    if (!forger) setAuto(false)
  }, [forger])

  return {
    forgeOnce,
    busy,
    auto,
    setAuto,
    intervalS,
    setAutoInterval,
    nextForgeAt,
    canForge: forger !== undefined,
    error,
  }
}
