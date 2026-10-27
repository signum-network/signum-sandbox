/**
 * Names a person gave to a contract's slots, keyed by code hash and then by
 * slot index. By code hash rather than by contract, because the same code
 * has the same layout: a redeployed contract keeps its labels, and so does
 * every other instance of it.
 */
export type ContractLabels = Record<string, Record<number, string>>

/** Tolerant like parseContacts: storage can be hand-edited, and one odd entry should not cost the rest. */
export function parseContractLabels(raw: string | null): ContractLabels {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw ?? '')
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const labels: ContractLabels = {}
  for (const [codeHash, slots] of Object.entries(parsed)) {
    if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) continue
    const kept: Record<number, string> = {}
    for (const [index, label] of Object.entries(slots)) {
      if (!/^\d+$/.test(index) || typeof label !== 'string' || label.trim() === '') continue
      kept[Number(index)] = label
    }
    if (Object.keys(kept).length > 0) labels[codeHash] = kept
  }
  return labels
}

export function serializeContractLabels(labels: ContractLabels): string {
  return JSON.stringify(labels)
}

/** An empty label removes the entry, and a code hash with no labels left goes with it. */
export function setSlotLabel(
  labels: ContractLabels,
  codeHash: string,
  index: number,
  label: string,
): ContractLabels {
  const slots = { ...labels[codeHash] }
  const trimmed = label.trim()
  if (trimmed === '') delete slots[index]
  else slots[index] = trimmed

  const next = { ...labels }
  if (Object.keys(slots).length === 0) delete next[codeHash]
  else next[codeHash] = slots
  return next
}
