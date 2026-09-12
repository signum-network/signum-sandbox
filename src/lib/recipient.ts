import { Address } from '@signumjs/core'
import { generateSignKeys } from '@signumjs/crypto'
import type { SandboxAccount } from './accounts'

/**
 * Folds a recipient candidate down to the numeric id an account is keyed by,
 * so the same account is recognised whichever form someone pasted it in.
 *
 * Address.create is pickier than the forms people actually paste: its
 * Reed-Solomon codec only recognises uppercase, and it requires the leading
 * network-prefix segment, so a lowercase or prefix-stripped address throws
 * rather than normalising. Folding to uppercase and reattaching the sandbox's
 * own "TS" prefix when a segment is missing turns those into the canonical
 * form Address.create does accept; a properly-prefixed address is untouched.
 * Anything still unparseable (or a numeric id, which passes through as-is)
 * falls back to the raw value, which is what lets the caller degrade to plain
 * string comparison instead of throwing.
 */
export function toComparableId(value: string): string {
  const candidate = value.trim().toUpperCase()
  const withPrefix = candidate.split('-').length === 4 ? `TS-${candidate}` : candidate
  try {
    return Address.create(withPrefix).getNumericId()
  } catch {
    return value
  }
}

/**
 * The public key of a recipient the sandbox owns, or undefined for anyone else.
 *
 * A Signum account that has never appeared on chain has no known public key, and
 * the node rejects a transaction to it with `Incorrect "recipient"` unless the
 * sender announces one. That is the sandbox's normal case — create two accounts,
 * send from one to the other — so the key is announced on every send rather than
 * only when something has already failed.
 *
 * Accepts any form a recipient field can hold: the canonical or extended
 * Reed-Solomon address (any case, with or without the network prefix), or the
 * numeric id — matched by normalising both sides rather than by raw string
 * equality, so a spelling difference alone can't hide a key the sandbox holds.
 */
export function knownPublicKey(
  to: string,
  accounts: SandboxAccount[],
): string | undefined {
  // a.id is already the numeric id (see SandboxAccount), so normalising just
  // `to` and comparing against it covers every address form; the raw
  // comparison stays as a fallback for whatever toComparableId couldn't parse.
  const normalizedTo = toComparableId(to)
  const match = accounts.find((a) => a.id === normalizedTo || a.address === to)
  return match ? generateSignKeys(match.passphrase).publicKey : undefined
}
