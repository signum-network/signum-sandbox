import { useState } from 'react'
import { resolveFromAccount } from '@/lib/fromAccount'

/**
 * A "From" field's state, defaulting to the configured forger until the user
 * picks someone else. Derived rather than synced with an effect: the default
 * is computed fresh on every render from whatever the forger currently is,
 * so it still applies if the forger resolves after this form has already
 * mounted (see useAccounts, which loads it from storage asynchronously).
 */
export function useFromAccount(forgerId: string | null | undefined) {
  const [chosen, setChosen] = useState('')
  const value = resolveFromAccount(chosen, forgerId)
  return [value, setChosen] as const
}
