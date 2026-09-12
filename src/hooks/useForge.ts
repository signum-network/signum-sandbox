import { useCallback, useEffect, useState } from 'react'
import { forge } from '@/lib/chainAdmin'
import type { SandboxAccount } from '@/lib/accounts'

/**
 * Roughly five seconds apart, each submitNonce yields exactly one block; faster
 * calls all report success but collapse into one, since they compete for the
 * same height. The auto interval respects that.
 */
const AUTO_INTERVAL_MS = 5000

export function useForge(forger: SandboxAccount | undefined) {
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Always resolves, never rejects: ChainService.send throws on any errorCode
  // in the response (e.g. the node restarting mid-forge), and the interval
  // below has nothing to catch a rejection with — an uncaught one there is an
  // unhandled promise rejection every AUTO_INTERVAL_MS, forever.
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

  useEffect(() => {
    if (!auto || !forger) return
    const id = setInterval(() => void forgeOnce(), AUTO_INTERVAL_MS)
    return () => clearInterval(id)
  }, [auto, forger, forgeOnce])

  // A dangling forger id (the account was removed) or no forger at all leaves
  // auto-forge switched on with nothing to forge with — the effect above bails
  // silently, so the toggle would read "on" forever while doing nothing.
  useEffect(() => {
    if (!forger) setAuto(false)
  }, [forger])

  return { forgeOnce, busy, auto, setAuto, canForge: forger !== undefined, error }
}
