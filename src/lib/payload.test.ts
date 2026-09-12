import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
import { Address } from '@signumjs/core'
import { Crypto, encryptMessage, generateSignKeys } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import { decodePayload, decryptFor } from './payload'
import type { SandboxAccount } from './accounts'

const tx = (attachment: Record<string, unknown>) =>
  ({ transaction: '1', type: 1, subtype: 0, attachment }) as unknown as Transaction

describe('decodePayload', () => {
  it('returns the plain text of a message', () => {
    expect(decodePayload(tx({ message: 'shall we meet at six?' }))).toEqual([
      { label: 'message', value: 'shall we meet at six?' },
    ])
  })

  it('says an encrypted message is unreadable rather than showing ciphertext', () => {
    expect(decodePayload(tx({ encryptedMessage: { data: 'ab', nonce: 'cd' } }))).toEqual([
      { label: 'encrypted', value: null },
    ])
  })

  it('unfolds an SRC44 description into its fields', () => {
    const fields = decodePayload(tx({ description: '{"vs":1,"nm":"Pizza Coin","ds":"cheesy"}' }))
    expect(fields).toEqual([
      { label: 'name', value: 'Pizza Coin' },
      { label: 'description', value: 'cheesy' },
    ])
  })

  it('keeps a non-SRC44 description as plain text', () => {
    expect(decodePayload(tx({ description: 'just a sentence' }))).toEqual([
      { label: 'description', value: 'just a sentence' },
    ])
  })

  it('lists multi-out recipients with their individual amounts', () => {
    const fields = decodePayload(
      tx({ recipients: [['123', '100000000'], ['456', '200000000']] }),
    )
    expect(fields).toEqual([
      { label: 'recipients', value: '123: 1 SIGNA, 456: 2 SIGNA' },
    ])
  })

  it('lists multi-same-out recipients by id only, inventing no amount', () => {
    // sendMoneyMultiSame's attachment is a flat array of id strings, not
    // [id, amount] pairs — the per-recipient share isn't in the attachment.
    const fields = decodePayload(tx({ recipients: ['12345', '67890'] }))
    expect(fields).toEqual([{ label: 'recipients', value: '12345, 67890' }])
  })

  it('describes a subscription by its interval', () => {
    expect(decodePayload(tx({ frequency: 3600 }))).toEqual([
      { label: 'frequency', value: 'every 3600 s' },
    ])
  })

  it('returns nothing for an empty attachment', () => {
    expect(decodePayload(tx({}))).toEqual([])
  })
})

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
