import type { SlotType } from './contractData'

const SLOT_TYPES: readonly SlotType[] = ['unsigned', 'signed', 'string', 'bool', 'address']

/** What a person said about one slot: a name, how to show it, or both. */
export interface SlotMeta {
  label?: string
  type?: SlotType
}

/**
 * What a person said about a contract's slots, keyed by code hash and then by
 * slot index. By code hash rather than by contract, because the same code
 * has the same layout: a redeployed contract keeps its labels and types, and
 * so does every other instance of it.
 */
export type ContractLabels = Record<string, Record<number, SlotMeta>>

const isSlotType = (value: unknown): value is SlotType =>
  typeof value === 'string' && (SLOT_TYPES as readonly string[]).includes(value)

/**
 * One stored slot entry, or null when nothing usable is in it. A plain
 * string is how a label was stored before slots had types, and it still
 * reads as that label, so nothing set earlier is lost.
 */
function parseSlotMeta(value: unknown): SlotMeta | null {
  if (typeof value === 'string') return value.trim() === '' ? null : { label: value }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const { label, type } = value as { label?: unknown; type?: unknown }
  const meta: SlotMeta = {}
  if (typeof label === 'string' && label.trim() !== '') meta.label = label
  if (isSlotType(type)) meta.type = type
  return Object.keys(meta).length > 0 ? meta : null
}

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
    const kept: Record<number, SlotMeta> = {}
    for (const [index, value] of Object.entries(slots)) {
      const meta = parseSlotMeta(value)
      if (!/^\d+$/.test(index) || meta === null) continue
      kept[Number(index)] = meta
    }
    if (Object.keys(kept).length > 0) labels[codeHash] = kept
  }
  return labels
}

export function serializeContractLabels(labels: ContractLabels): string {
  return JSON.stringify(labels)
}

/**
 * Changes what is said about one slot. A key present in the patch replaces
 * that part, so `{ type: undefined }` clears the type and leaves the label.
 * An empty label clears the label. A slot with nothing left is removed, and
 * a code hash with no slots left goes with it.
 */
export function setSlotMeta(
  labels: ContractLabels,
  codeHash: string,
  index: number,
  patch: SlotMeta,
): ContractLabels {
  const meta: SlotMeta = { ...labels[codeHash]?.[index] }
  if ('label' in patch) {
    const trimmed = patch.label?.trim() ?? ''
    if (trimmed === '') delete meta.label
    else meta.label = trimmed
  }
  if ('type' in patch) {
    if (patch.type === undefined) delete meta.type
    else meta.type = patch.type
  }

  const slots = { ...labels[codeHash] }
  if (Object.keys(meta).length === 0) delete slots[index]
  else slots[index] = meta

  const next = { ...labels }
  if (Object.keys(slots).length === 0) delete next[codeHash]
  else next[codeHash] = slots
  return next
}
