import { generateSignKeys } from '@signumjs/crypto'
import type { SandboxAccount } from './accounts'

/**
 * The public key of a recipient the sandbox owns, or undefined for anyone else.
 *
 * A Signum account that has never appeared on chain has no known public key, and
 * the node rejects a transaction to it with `Incorrect "recipient"` unless the
 * sender announces one. That is the sandbox's normal case — create two accounts,
 * send from one to the other — so the key is announced on every send rather than
 * only when something has already failed.
 *
 * Accepts either form a recipient field can hold: the Reed-Solomon address or
 * the numeric id.
 */
export function knownPublicKey(
  to: string,
  accounts: SandboxAccount[],
): string | undefined {
  const match = accounts.find((a) => a.address === to || a.id === to)
  return match ? generateSignKeys(match.passphrase).publicKey : undefined
}
