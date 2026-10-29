import { useCallback, useState } from 'react'
import {
  parseContractLabels,
  serializeContractLabels,
  setSlotMeta,
  type ContractLabels,
  type SlotMeta,
} from '@/lib/contractLabels'

const STORAGE_KEY = 'signum-sandbox.contractLabels.v1'

/**
 * The labels and types for one contract's code. `codeHash` is null until the
 * contract has loaded, and nothing can be labelled before then.
 *
 * Writes go through a functional update, as in useContacts, so two labels
 * set in quick succession cannot overwrite each other with a stale store.
 */
export function useContractLabels(codeHash: string | null) {
  // Read on the first render, not in an effect: the label inputs are
  // uncontrolled, so a table drawn from a cached contract before the effect
  // ran would keep its empty defaults.
  const [all, setAll] = useState<ContractLabels>(() =>
    parseContractLabels(window.localStorage.getItem(STORAGE_KEY)),
  )

  const setMeta = useCallback(
    (index: number, patch: SlotMeta) => {
      if (codeHash === null) return
      setAll((previous) => {
        const next = setSlotMeta(previous, codeHash, index, patch)
        window.localStorage.setItem(STORAGE_KEY, serializeContractLabels(next))
        return next
      })
    },
    [codeHash],
  )

  return { meta: (codeHash && all[codeHash]) || {}, setMeta }
}
