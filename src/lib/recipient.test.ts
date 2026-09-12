import { describe, expect, it } from 'vitest'
import { Address } from '@signumjs/core'
import { Crypto, generateSignKeys } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import { knownPublicKey } from './recipient'
import type { SandboxAccount } from './accounts'

// Vitest evaluates a describe body during collection, before any beforeAll hook
// runs, and the accounts below derive keys at that point. Crypto.init is
// synchronous, so calling it in file order is what makes that work.
Crypto.init(new NodeJSCryptoAdapter())

const account = (name: string, passphrase: string): SandboxAccount => {
  const { publicKey } = generateSignKeys(passphrase)
  const address = Address.fromPublicKey(publicKey, 'TS')
  return {
    id: address.getNumericId(),
    address: address.getReedSolomonAddress(true),
    name,
    passphrase,
  }
}

describe('knownPublicKey', () => {
  const alice = account('Alice', 'sandbox-alice')
  const bob = account('Bob', 'sandbox-bob')
  const accounts = [alice, bob]

  it('finds a recipient by its Reed-Solomon address', () => {
    expect(knownPublicKey(bob.address, accounts)).toBe(
      generateSignKeys(bob.passphrase).publicKey,
    )
  })

  it('finds the same recipient by its numeric id', () => {
    expect(knownPublicKey(bob.id, accounts)).toBe(knownPublicKey(bob.address, accounts))
  })

  it('returns undefined for an account the sandbox does not own', () => {
    expect(knownPublicKey('TS-ZZZZ-ZZZZ-ZZZZ-ZZZZZ', accounts)).toBeUndefined()
  })

  it('returns undefined when there are no accounts at all', () => {
    expect(knownPublicKey(bob.address, [])).toBeUndefined()
  })

  it('does not confuse two accounts', () => {
    expect(knownPublicKey(alice.address, accounts)).not.toBe(
      knownPublicKey(bob.address, accounts),
    )
  })
})
