import { toAccountId, toComparableId } from './recipient'
import { isUnknownAccount } from './accountStatus'
import type { SandboxAccount } from './accounts'

export type ContactKind = 'account' | 'contract'

/**
 * A name for an account the sandbox does not own, and what kind of account
 * it is. The kind is learned once, when the contact is added, from the
 * node's own `isAT` — an id that is a contract stays one — so it is safe to
 * keep rather than ask for on every send.
 */
export interface Contact {
  name: string
  kind: ContactKind
}

/**
 * A local address book, keyed by numeric account id — the same id
 * SandboxAccount.id and every on-chain reference use. A map rather than a
 * list because the only thing every consumer does with it is "what's the
 * name for this id?" on every row of a transaction stream; a list would make
 * that a linear scan per row.
 */
export type Contacts = Record<string, Contact>

/** Adding a contact for an id that already has one replaces it rather than duplicating it. */
export function addContact(
  contacts: Contacts,
  accountIdOrAddress: string,
  contact: Contact,
): Contacts {
  return { ...contacts, [toComparableId(accountIdOrAddress)]: contact }
}

export function removeContact(contacts: Contacts, accountIdOrAddress: string): Contacts {
  const next = { ...contacts }
  delete next[toComparableId(accountIdOrAddress)]
  return next
}

/**
 * Whether a "To" field holds a contract from the book, in whichever spelling
 * it was typed — the same folding knownPublicKey uses.
 */
export function isContract(contacts: Contacts, accountIdOrAddress: string): boolean {
  const value = accountIdOrAddress.trim()
  if (value === '') return false
  return contacts[toComparableId(value)]?.kind === 'contract'
}

export type ResolveContactError = 'invalidAddress' | 'unknownAccount' | 'unreachable'

/** `getAccount`, injected so this file stays free of the browser-only ledger. */
export type AccountLookup = (accountId: string) => Promise<{ isAT?: boolean }>

/**
 * What an address is, before it gets a name: a contact has to be something
 * the chain knows. One getAccount answers both questions — an unknown id is
 * error code 5, a contract comes back with `isAT: true` — so no separate
 * contract lookup is needed here. Anything other than "unknown" is the node
 * failing to answer, and nothing is saved on a guess.
 */
export async function resolveContact(
  accountIdOrAddress: string,
  lookup: AccountLookup,
): Promise<{ id: string; kind: ContactKind } | { error: ResolveContactError }> {
  let id: string
  try {
    id = toAccountId(accountIdOrAddress)
  } catch {
    return { error: 'invalidAddress' }
  }
  try {
    const account = await lookup(id)
    return { id, kind: account.isAT ? 'contract' : 'account' }
  } catch (error) {
    return { error: isUnknownAccount(error) ? 'unknownAccount' : 'unreachable' }
  }
}

export function serializeContacts(contacts: Contacts): string {
  return JSON.stringify(contacts)
}

const isKind = (v: unknown): v is ContactKind => v === 'account' || v === 'contract'

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the console. A malformed document yields an empty book; a malformed
 * entry within an otherwise-good document is dropped rather than sinking the
 * rest, the same tolerance parseAccounts gives its own entries. Keys are
 * re-normalised on the way in too, so a book saved under an older key shape
 * (or edited by hand as a Reed-Solomon address) still resolves by numeric id.
 *
 * Two value shapes are read. The previous version stored a bare name; that
 * is an account, since the sandbox had no notion of contracts then. The
 * storage key did not change, because a reader that understands both is
 * cheaper than a key bump that orphans every existing book.
 */
export function parseContacts(raw: string | null): Contacts {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

    const contacts: Contacts = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        if (value.length > 0) contacts[toComparableId(key)] = { name: value, kind: 'account' }
        continue
      }
      if (typeof value !== 'object' || value === null) continue
      const { name, kind } = value as Record<string, unknown>
      if (typeof name !== 'string' || name.length === 0 || !isKind(kind)) continue
      contacts[toComparableId(key)] = { name, kind }
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

  const contactName = contacts[id]?.name
  if (contactName) return contactName

  if (onChainName && onChainName.trim().length > 0) return onChainName

  return shortenAddress(accountIdOrAddress)
}
