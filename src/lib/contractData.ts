import type { Contract } from '@signumjs/contracts'
import type { Contacts } from './contacts'
import type { SandboxAccount } from './accounts'
import type { TxKind } from './txSummary'
import { toAddress, toComparableId } from './recipient'

/**
 * One 8-byte variable of a contract, read every way a person might need it.
 *
 * `raw` is what the node stores: little-endian hex. `hex` and the decimals are
 * the value a contract computes with. `text` is the bytes in stored order,
 * which is how SmartC packs a short string, so "hi" reads as "hi".
 */
export interface DataSlot {
  index: number
  raw: string
  hex: string
  /** Unsigned, the way a contract reads an id. */
  decimal: string
  /** Two's complement, only when it differs from `decimal`. */
  signed: string | null
  /** Null when the slot is empty, not UTF-8, or not printable. */
  text: string | null
}

const SLOT_HEX = 16
const TWO_63 = 2n ** 63n
const TWO_64 = 2n ** 64n
const utf8 = new TextDecoder('utf-8', { fatal: true })

function bytesOf(raw: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < raw.length; i += 2) bytes.push(parseInt(raw.slice(i, i + 2), 16))
  return bytes
}

function textOf(bytes: number[], minChars: number): string | null {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  if (end === 0) return null
  try {
    const text = utf8.decode(new Uint8Array(bytes.slice(0, end)))
    // A number that happens to decode is not text: a slot holding 1 would
    // otherwise show an invisible \u0001.
    if (/[\u0000-\u001f\u007f-\u009f]/.test(text)) return null
    return [...text].length < minChars ? null : text
  } catch {
    return null
  }
}

/**
 * The data stack as slots.
 *
 * Decoded here rather than through ContractDataView, which in 3.3.4 reads
 * strings from the big-endian hex (so "hi" comes back "ih") and throws on
 * bytes that are not UTF-8 and on a partial slot. Nothing in here throws.
 * A partial trailing slot is padded at its high end, which keeps its value.
 */
export function toDataSlots(machineData: string): DataSlot[] {
  const slots: DataSlot[] = []
  for (let index = 0; index * SLOT_HEX < machineData.length; index++) {
    const raw = machineData
      .slice(index * SLOT_HEX, (index + 1) * SLOT_HEX)
      .toLowerCase()
      .padEnd(SLOT_HEX, '0')
    const bytes = bytesOf(raw)
    const hex = [...bytes]
      .reverse()
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const unsigned = BigInt(`0x${hex}`)
    slots.push({
      index,
      raw,
      hex,
      decimal: unsigned.toString(),
      signed: unsigned >= TWO_63 ? (unsigned - TWO_64).toString() : null,
      // One character is a small number far more often than a word: 85 would
      // otherwise read "U" in every counter that passes it.
      text: textOf(bytes, 2),
    })
  }
  return slots
}

/** A page of AT memory is 256 bytes, so 32 slots. */
const PAGE_SLOTS = 32

/** How a contract's memory divides: its variables, then its two stacks. */
export interface StackLayout {
  dataSlots: number
  callStackSlots: number
  userStackSlots: number
}

/**
 * Where a contract's data ends and its stacks begin, read from the creation
 * bytes of its deployment.
 *
 * getAT's machineData is the whole memory: the data pages, then the call
 * stack, then the user stack. Only the header written at deployment says
 * where one ends: six little-endian shorts for version, a reserved field,
 * and the code, data, call stack and user stack page counts.
 */
export function stackLayout(creationBytes: string): StackLayout | null {
  if (creationBytes.length < 24) return null
  // Little-endian: the low byte comes first.
  const short = (n: number) =>
    parseInt(creationBytes.slice(n * 4 + 2, n * 4 + 4) + creationBytes.slice(n * 4, n * 4 + 2), 16)
  return {
    dataSlots: short(3) * PAGE_SLOTS,
    callStackSlots: short(4) * PAGE_SLOTS,
    userStackSlots: short(5) * PAGE_SLOTS,
  }
}

/** What a slot can be shown as, chosen by hand for each slot. */
export type SlotType = 'unsigned' | 'signed' | 'string' | 'bool' | 'address'

export interface SlotReadings {
  unsigned: string
  /** Always given, even when it equals the unsigned reading. */
  signed: string
  /** Printable UTF-8 of any length, a single character included. */
  string: string | null
  bool: boolean
  /** Null for 0, which is no account. */
  address: string | null
  hex: string
  stored: string
}

/**
 * Every way to read one slot. Nothing here decides which is meant: only the
 * contract's code knows that, so the person picks one (SlotType) instead.
 */
export function slotReadings(slot: DataSlot, addressPrefix: string): SlotReadings {
  const zero = slot.decimal === '0'
  return {
    unsigned: slot.decimal,
    signed: slot.signed ?? slot.decimal,
    string: textOf(bytesOf(slot.raw), 1),
    bool: !zero,
    address: zero ? null : toAddress(slot.decimal, addressPrefix),
    hex: slot.hex,
    stored: slot.raw,
  }
}

/**
 * The value the slot list shows: the reading of the type set for the slot,
 * or hex when none is set. A set type with no reading shows a dash rather
 * than falling back to something the person did not ask for.
 */
export function slotValue(
  slot: DataSlot,
  type: SlotType | undefined,
  addressPrefix: string,
): string {
  if (type === undefined) return slot.hex
  const readings = slotReadings(slot, addressPrefix)
  switch (type) {
    case 'unsigned':
      return readings.unsigned
    case 'signed':
      return readings.signed
    case 'string':
      return readings.string === null ? '—' : `"${readings.string}"`
    case 'bool':
      return String(readings.bool)
    case 'address':
      return readings.address ?? '—'
  }
}

/**
 * A map value, as the node answers it in decimal and possibly negative, as
 * the slot that would hold it. Map entries then share the slots' readings
 * and search instead of a second set of rules.
 */
export function slotOfValue(decimal: string): DataSlot {
  let value = BigInt(decimal)
  if (value < 0n) value += TWO_64
  const hex = value.toString(16).padStart(SLOT_HEX, '0')
  const stored = hex.match(/../g)!.reverse().join('')
  return toDataSlots(stored)[0]
}

/**
 * Whether a slot holds what a search asks for, in any of its readings, its
 * address, the name of an account it holds, or its label. Case is ignored,
 * and so is a leading 0x for the hex readings. An empty query matches
 * nothing, so an empty search field marks nothing.
 */
export function slotMatches(
  slot: DataSlot,
  query: string,
  context: { addressPrefix: string; known: Map<string, KnownId>; label?: string },
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return false
  const hexNeedle = needle.replace(/^0x/, '')
  if (hexNeedle !== '' && (slot.hex.includes(hexNeedle) || slot.raw.includes(hexNeedle))) {
    return true
  }
  const readings = [
    slot.decimal,
    slot.signed,
    slot.text,
    slot.decimal === '0' ? null : toAddress(slot.decimal, context.addressPrefix),
    context.known.get(slot.decimal)?.name,
    context.label,
  ]
  return readings.some((reading) => reading?.toLowerCase().includes(needle))
}

/** Slots in the AT's own pages, each keeping its index. */
export function toPages(slots: DataSlot[]): DataSlot[][] {
  const pages: DataSlot[][] = []
  for (let i = 0; i < slots.length; i += PAGE_SLOTS) pages.push(slots.slice(i, i + PAGE_SLOTS))
  return pages
}

/**
 * The hit to step to from a slot, or null when there are none. `hits` are
 * slot indices in ascending order. A step starts at a slot, not at a hit, so
 * it still works when a block changes which slots match. Both ways wrap.
 */
export function stepHit(hits: number[], from: number | null, direction: 1 | -1): number | null {
  if (hits.length === 0) return null
  if (direction === 1) {
    return hits.find((hit) => from === null || hit > from) ?? hits[0]
  }
  return [...hits].reverse().find((hit) => from === null || hit < from) ?? hits[hits.length - 1]
}

/**
 * Where a key moves the selection among `count` slots, by position, or null
 * for a key it ignores. A page move keeps the row; moves stop at the ends.
 */
export function moveSlot(count: number, position: number, key: string): number | null {
  const clamp = (next: number) => Math.max(0, Math.min(count - 1, next))
  switch (key) {
    case 'ArrowDown':
      return clamp(position + 1)
    case 'ArrowUp':
      return clamp(position - 1)
    case 'ArrowRight':
    case 'PageDown':
      return clamp(position + PAGE_SLOTS)
    case 'ArrowLeft':
    case 'PageUp':
      return clamp(position - PAGE_SLOTS)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * The slots whose stored bytes differ. Nothing on first sight: a stack
 * appearing for the first time did not change, it arrived.
 */
export function changedSlots(previous: DataSlot[] | null, next: DataSlot[]): Set<number> {
  const changed = new Set<number>()
  if (previous === null) return changed
  for (const slot of next) {
    if (previous[slot.index]?.raw !== slot.raw) changed.add(slot.index)
  }
  return changed
}

export type ContractStatus = 'dead' | 'outOfFunds' | 'finished' | 'stopped' | 'running' | 'idle'

/**
 * One word for the node's five flags, which can be set together.
 *
 * `frozen` is not a status of its own. The node sets it on every FIN and STP
 * as well as when a step cannot be paid for, and it means only "do not run
 * again until the activation amount has come in". Next to finished or
 * stopped that is the ordinary wait for the next call. Next to running it
 * means the run was cut off for lack of SIGNA, which is the one case worth a
 * warning. Dead is final and wins over everything.
 */
export function contractStatus(
  contract: Pick<Contract, 'dead' | 'frozen' | 'finished' | 'stopped' | 'running'>,
): ContractStatus {
  if (contract.dead) return 'dead'
  if (contract.finished) return 'finished'
  if (contract.stopped) return 'stopped'
  if (contract.running) return contract.frozen ? 'outOfFunds' : 'running'
  return 'idle'
}

/**
 * The balance, in planck, at which a frozen contract is picked up again, or
 * null when it is not frozen. The node's own test (SqlATStore) is the account
 * balance minus the balance after the last run, against the activation amount.
 */
export function wakeThreshold(
  contract: Pick<Contract, 'frozen' | 'prevBalanceNQT' | 'minActivation'>,
): string | null {
  if (!contract.frozen) return null
  return (BigInt(contract.prevBalanceNQT) + BigInt(contract.minActivation)).toString()
}

export interface KnownId {
  id: string
  name: string
  contract: boolean
}

/**
 * Every id the page can put a name to without asking the chain: what the
 * console already knows, plus what this contract says about itself. A slot
 * is matched against this; a per-slot getAccount would be an N+1 on every
 * block. Owned accounts and contacts win over the extras, because a name the
 * person gave is the one they recognise. Zero is never an account: it is
 * what every unset slot holds.
 */
export function knownIds(
  accounts: SandboxAccount[],
  contacts: Contacts,
  extra: KnownId[],
): Map<string, KnownId> {
  const known = new Map<string, KnownId>()
  for (const entry of extra) known.set(entry.id, entry)
  for (const [id, contact] of Object.entries(contacts)) {
    known.set(id, { id, name: contact.name, contract: contact.kind === 'contract' })
  }
  for (const account of accounts) {
    known.set(account.id, { id: account.id, name: account.name, contract: false })
  }
  known.delete('0')
  return known
}

/**
 * The contract id behind a sender or recipient, when the row can tell it is
 * one: a contact saved as a contract, or the sender of a contract payment,
 * a subtype only a contract ever creates. Anyone else is not looked up.
 */
export function contractPartyId(
  address: string,
  role: 'sender' | 'recipient',
  kind: TxKind,
  contacts: Contacts,
): string | null {
  const id = toComparableId(address)
  if (contacts[id]?.kind === 'contract') return id
  if (role === 'sender' && kind === 'contractPayment') return id
  return null
}
