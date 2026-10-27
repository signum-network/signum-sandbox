import { useCallback, useEffect, useState } from 'react'
import {
  parseContractLabels,
  serializeContractLabels,
  setSlotLabel,
  type ContractLabels,
} from '@/lib/contractLabels'

const STORAGE_KEY = 'signum-sandbox.contractLabels.v1'

/**
 * The labels for one contract's code. `codeHash` is null until the contract
 * has loaded, and nothing can be labelled before then.
 *
 * Writes go through a functional update, as in useContacts, so two labels
 * set in quick succession cannot overwrite each other with a stale store.
 */
export function useContractLabels(codeHash: string | null) {
  const [all, setAll] = useState<ContractLabels>({})

  useEffect(() => {
    setAll(parseContractLabels(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const setLabel = useCallback(
    (index: number, label: string) => {
      if (codeHash === null) return
      setAll((previous) => {
        const next = setSlotLabel(previous, codeHash, index, label)
        window.localStorage.setItem(STORAGE_KEY, serializeContractLabels(next))
        return next
      })
    },
    [codeHash],
  )

  return { labels: (codeHash && all[codeHash]) || {}, setLabel }
}
