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

  const forgeOnce = useCallback(async () => {
    if (!forger) return
    setBusy(true)
    try {
      await forge(forger.passphrase)
    } finally {
      setBusy(false)
    }
  }, [forger])

  useEffect(() => {
    if (!auto || !forger) return
    const id = setInterval(() => void forgeOnce(), AUTO_INTERVAL_MS)
    return () => clearInterval(id)
  }, [auto, forger, forgeOnce])

  return { forgeOnce, busy, auto, setAuto, canForge: forger !== undefined }
}
