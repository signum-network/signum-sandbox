import { Address } from '@signumjs/core'
import { generateSignKeys } from '@signumjs/crypto'

export interface SandboxAccount {
  /** Numeric account id, the form the API expects as recipient. */
  id: string
  /** Reed-Solomon address including the network prefix, the form people read. */
  address: string
  name: string
  /**
   * Stored in plain text. Legitimate only on the mock chain — see isMockNetwork,
   * which every consumer of this store checks first.
   */
  passphrase: string
}

export function deriveAccount(
  name: string,
  passphrase: string,
  addressPrefix: string,
): SandboxAccount {
  const { publicKey } = generateSignKeys(passphrase)
  const address = Address.fromPublicKey(publicKey, addressPrefix)
  return {
    id: address.getNumericId(),
    address: address.getReedSolomonAddress(true),
    name,
    passphrase,
  }
}

/** Adding a passphrase that is already stored renames it rather than duplicating it. */
export function addAccount(
  list: SandboxAccount[],
  account: SandboxAccount,
): SandboxAccount[] {
  const without = list.filter((a) => a.id !== account.id)
  return [...without, account]
}

export function removeAccount(list: SandboxAccount[], id: string): SandboxAccount[] {
  return list.filter((a) => a.id !== id)
}

export function serializeAccounts(list: SandboxAccount[]): string {
  return JSON.stringify(list)
}

const isAccount = (v: unknown): v is SandboxAccount =>
  typeof v === 'object' &&
  v !== null &&
  ['id', 'address', 'name', 'passphrase'].every(
    (k) => typeof (v as Record<string, unknown>)[k] === 'string',
  )

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the console. Anything that is not a complete account is dropped.
 */
export function parseAccounts(raw: string | null): SandboxAccount[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isAccount) : []
  } catch {
    return []
  }
}
