import { toComparableId } from './recipient'
import type { SandboxAccount } from './accounts'

/**
 * A local address book: a name for an account the sandbox does not own,
 * keyed by numeric account id — the same id SandboxAccount.id and every
 * on-chain reference use. A map rather than a list because the only thing
 * every consumer does with it is "what's the name for this id?" on every row
 * of a transaction stream; a list would make that a linear scan per row.
 */
export type Contacts = Record<string, string>

/** Adding a name for an id that already has one renames it rather than duplicating it. */
export function addContact(
  contacts: Contacts,
  accountIdOrAddress: string,
  name: string,
): Contacts {
  return { ...contacts, [toComparableId(accountIdOrAddress)]: name }
}

export function removeContact(contacts: Contacts, accountIdOrAddress: string): Contacts {
  const next = { ...contacts }
  delete next[toComparableId(accountIdOrAddress)]
  return next
}

export function serializeContacts(contacts: Contacts): string {
  return JSON.stringify(contacts)
}

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the console. A malformed document yields an empty book; a malformed
 * entry within an otherwise-good document is dropped rather than sinking the
 * rest, the same tolerance parseAccounts gives its own entries. Keys are
 * re-normalised on the way in too, so a book saved under an older key shape
 * (or edited by hand as a Reed-Solomon address) still resolves by numeric id.
 */
export function parseContacts(raw: string | null): Contacts {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

    const contacts: Contacts = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string' || value.length === 0) continue
      contacts[toComparableId(key)] = value
    }
    return contacts
  } catch {
    return {}
  }
}

/**
 * Keeps enough of both ends of an identifier to tell two accounts apart at a
 * glance, without carrying the whole thing. Reed-Solomon addresses are
 * hyphen-grouped (TS-C2LP-A9QP-VT74-CJMCU, or one group longer in the
 * extended form that carries a public key) so cutting on those groups keeps
 * the shortened form looking like the address it came from: prefix plus
 * first group, an ellipsis, then the last group. A numeric id has no natural
 * grouping, so it falls back to a fixed head/tail slice; anything already
 * short enough to read at a glance is left alone.
 */
function shortenAddress(value: string): string {
  const trimmed = value.trim()
  const groups = trimmed.split('-')
  if (groups.length >= 3) {
    return `${groups[0]}-${groups[1]}…${groups[groups.length - 1]}`
  }
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-5)}`
}

/**
 * The single rule every view uses to answer "what do I call this account?".
 * Most specific first: the sandbox's own name for an account it owns, then a
 * local contact name, then the name the account itself published on chain
 * (an account with no on-chain name reports it as ""; that's absence, not a
 * name), and finally a shortened form of whatever identifier was passed in,
 * so there is always something readable to show even for a stranger the
 * chain has never labelled.
 *
 * Matching folds accountIdOrAddress through the same normalisation
 * knownPublicKey uses, so any spelling of the same account — Reed-Solomon,
 * lowercase, prefix-stripped, extended, or the bare numeric id — resolves to
 * the same name.
 */
export function displayName(
  accountIdOrAddress: string,
  accounts: SandboxAccount[],
  contacts: Contacts,
  onChainName?: string,
): string {
  const id = toComparableId(accountIdOrAddress)

  const owned = accounts.find((a) => a.id === id || a.address === accountIdOrAddress)
  if (owned?.name) return owned.name

  const contactName = contacts[id]
  if (contactName) return contactName

  if (onChainName && onChainName.trim().length > 0) return onChainName

  return shortenAddress(accountIdOrAddress)
}
