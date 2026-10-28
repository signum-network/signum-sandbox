import type { Contract } from '@signumjs/contracts'
import type { Contacts } from './contacts'
import type { SandboxAccount } from './accounts'
import type { TxKind } from './txSummary'
import { toComparableId } from './recipient'

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

function textOf(bytes: number[]): string | null {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  if (end === 0) return null
  try {
    const text = utf8.decode(new Uint8Array(bytes.slice(0, end)))
    // A number that happens to decode is not text: a slot holding 1 would
    // otherwise show an invisible \u0001.
    return /[\u0000-\u001f\u007f-\u009f]/.test(text) ? null : text
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
      text: textOf(bytes),
    })
  }
  return slots
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
