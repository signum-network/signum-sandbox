import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
import { Address } from '@signumjs/core'
import { Crypto, encryptMessage, generateSignKeys } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import { decryptFor } from './payload'
import type { SandboxAccount } from './accounts'

const tx = (attachment: Record<string, unknown>) =>
  ({ transaction: '1', type: 1, subtype: 0, attachment }) as unknown as Transaction

// Runs at module-collection time, before the describe callback below evaluates
// (which needs Crypto to build the fixture accounts) — beforeAll would run too
// late, since describe callbacks execute synchronously during collection.
Crypto.init(new NodeJSCryptoAdapter())

const account = (name: string, passphrase: string): SandboxAccount => {
  const { publicKey } = generateSignKeys(passphrase)
  const address = Address.fromPublicKey(publicKey, 'TS')
  return { id: address.getNumericId(), address: address.getReedSolomonAddress(true), name, passphrase }
}

describe('decryptFor', () => {
  const alice = account('Alice', 'sandbox-alice')
  const bob = account('Bob', 'sandbox-bob')

  const encryptedTx = async () => {
    const message = await encryptMessage(
      'shall we meet at six?',
      generateSignKeys(bob.passphrase).publicKey,
      generateSignKeys(alice.passphrase).agreementPrivateKey,
    )
    return {
      transaction: '1',
      type: 1,
      subtype: 0,
      sender: alice.id,
      senderPublicKey: generateSignKeys(alice.passphrase).publicKey,
      recipient: bob.id,
      attachment: { encryptedMessage: message },
    } as unknown as Transaction
  }

  it('reads the message when the sandbox owns the recipient', async () => {
    expect(await decryptFor(await encryptedTx(), [bob])).toBe('shall we meet at six?')
  })

  it('reads its own outgoing message when it owns both ends', async () => {
    expect(await decryptFor(await encryptedTx(), [alice, bob])).toBe('shall we meet at six?')
  })

  it('returns null when it owns neither side', async () => {
    expect(await decryptFor(await encryptedTx(), [])).toBeNull()
  })

  it('returns null for a transaction that carries no encrypted message', async () => {
    expect(await decryptFor(tx({ message: 'plain' }), [alice, bob])).toBeNull()
  })
})
