import { useCallback, useEffect, useState } from 'react'
import {
  parseScenarios,
  removeScenario,
  saveScenario,
  serializeScenarios,
  type SavedScenario,
} from '@/lib/savedScenarios'

const STORAGE_KEY = 'signum-sandbox.scenarios.v1'

export interface SavedScenarioStore {
  saved: SavedScenario[]
  save: (name: string, source: string) => void
  remove: (name: string) => void
}

/**
 * The scenarios someone has written, kept across sessions.
 *
 * No network rail, unlike the account store: a scenario is text about a chain
 * and holds no secret — the passphrases in it are the deliberately fake,
 * published ones, and any it names by hand are the author's own business.
 */
export function useSavedScenarios(): SavedScenarioStore {
  const [saved, setSaved] = useState<SavedScenario[]>([])

  useEffect(() => {
    setSaved(parseScenarios(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const persist = useCallback((list: SavedScenario[]) => {
    setSaved(list)
    window.localStorage.setItem(STORAGE_KEY, serializeScenarios(list))
  }, [])

  return {
    saved,
    save: (name, source) => persist(saveScenario(saved, name, source)),
    remove: (name) => persist(removeScenario(saved, name)),
  }
}
