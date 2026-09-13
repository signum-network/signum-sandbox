import { useCallback, useEffect, useState } from 'react'
import { toComparableId } from '@/lib/recipient'

const STORAGE_KEY = 'signum-sandbox.watched.v1'

export interface WatchStore {
  /** The numeric id of the account under observation, or null. */
  watchedId: string | null
  watch: (accountIdOrAddress: string) => void
  unwatch: () => void
}

/**
 * One account kept under observation across sessions.
 *
 * Deliberately one and not a set: the point is a place to keep looking while
 * you work on something else, and a list of them would just be the accounts
 * tab again. Stored by numeric id so any spelling of the address resolves to
 * the same subject, and holding no secret it needs no network rail.
 */
export function useWatched(): WatchStore {
  const [watchedId, setWatchedId] = useState<string | null>(null)

  useEffect(() => {
    setWatchedId(window.localStorage.getItem(STORAGE_KEY))
  }, [])

  const watch = useCallback((accountIdOrAddress: string) => {
    const id = toComparableId(accountIdOrAddress)
    setWatchedId(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const unwatch = useCallback(() => {
    setWatchedId(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { watchedId, watch, unwatch }
}
