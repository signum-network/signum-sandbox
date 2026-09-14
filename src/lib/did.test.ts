import { describe, expect, it } from 'vitest'
import type { Transaction } from '@signumjs/core'
import { accountDid, aliasDid, didFor, toMultibase, transactionDid } from './did'

const KEY = 'AB12CD34'
const ADDRESS = 'TS-C2LP-A9QP-VT74-CJMCU'
const ID = '12477909146040336981'

describe('didFor', () => {
  // A DID without a network segment means mainnet to the real resolver, so a
  // sandbox one that omitted it would be a claim about a chain it has never
  // touched — pasteable into the public resolver, and answered with nothing.
  it('always names the sandbox, so nobody mistakes it for mainnet', () => {
    expect(didFor('acc', ADDRESS)).toBe(`did:signum:sandbox:acc:${ADDRESS}`)
    expect(didFor('tx', '99')).toBe('did:signum:sandbox:tx:99')
  })
})

describe('toMultibase', () => {
  // `f` is multibase's tag for lowercase base16. Taken from the resolver
  // rather than chosen: a document that encodes its key differently is not
  // the same document.
  it('tags the hex key the way the resolver does', () => {
    expect(toMultibase(KEY)).toBe('fab12cd34')
  })
})

describe('accountDid', () => {
  const full = accountDid({ accountId: ID, accountRS: ADDRESS, publicKey: KEY })

  it('is the shape the real resolver returns', () => {
    expect(full.didResolutionMetadata).toEqual({ contentType: 'application/did+ld+json' })
    expect(full.didDocumentMetadata.immutable).toBe(false)
  })

  // The numeric id is the account's own name on the chain — everything the
  // node knows about an account hangs off it — and an identifier meant for
  // machines should be the canonical spelling. The readable one is still in
  // the document, because naming only one leaves a reader to work out that
  // the two are the same account.
  it('is named by the numeric id, with the address alongside', () => {
    expect(full.didDocument.id).toBe(didFor('acc', ID))
    expect(full.didDocument.alsoKnownAs).toEqual([didFor('acc', ADDRESS)])
  })

  it('carries the key as a verification method it can authenticate with', () => {
    expect(full.didDocument.verificationMethod).toEqual([
      {
        id: `${didFor('acc', ID)}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: didFor('acc', ID),
        publicKeyMultibase: 'fab12cd34',
      },
    ])
    expect(full.didDocument.authentication).toEqual([`${didFor('acc', ID)}#key-1`])
    expect(full.didDocument['@context']).toContain(
      'https://w3id.org/security/suites/ed25519-2020/v1',
    )
  })

  // The case a sandbox hits constantly: an account derived but never paid, so
  // the chain has never seen its key. Inventing the section would be the
  // document claiming something can be proven that cannot.
  it('says nothing about keys for an account the chain has not seen', () => {
    const bare = accountDid({ accountId: ID, accountRS: ADDRESS })
    expect(bare.didDocument.verificationMethod).toBeUndefined()
    expect(bare.didDocument.authentication).toBeUndefined()
    expect(bare.didDocument['@context']).toEqual(['https://www.w3.org/ns/did/v1'])
  })

  it('carries an SRC44 profile when the account has one', () => {
    const named = accountDid({
      accountId: ID,
      accountRS: ADDRESS,
      src44: { nm: 'Alice', ds: 'Builds things' },
    })
    expect(named.didDocument.src44).toEqual({ nm: 'Alice', ds: 'Builds things' })
  })
})

describe('transactionDid', () => {
  const tx = {
    transaction: '15410379011921721749',
    sender: ID,
    senderRS: ADDRESS,
    senderPublicKey: KEY,
    blockTimestamp: 381679000,
    height: 13,
    confirmations: 2,
  } as unknown as Transaction

  // A transaction cannot act; it was acted. So it is controlled by its sender
  // rather than by itself, and the key that verifies it is the sender's.
  it('is controlled by its sender, and verified with the sender key', () => {
    const doc = transactionDid(tx).didDocument
    // By id, so this string and the sender's own account document agree
    // rather than being two spellings of one account.
    expect(doc.controller).toBe(didFor('acc', ID))
    expect(doc.verificationMethod?.[0].id).toBe(`${didFor('tx', tx.transaction)}#creator`)
    expect(doc.verificationMethod?.[0].controller).toBe(didFor('acc', ID))
  })

  // The property a verification application is built on.
  it('says a confirmed transaction is immutable, and where it sits', () => {
    const meta = transactionDid(tx).didDocumentMetadata
    expect(meta.immutable).toBe(true)
    expect(meta.blockHeight).toBe(13)
    expect(meta.confirmations).toBe(2)
  })

  // Signum counts time from its own epoch, so a chain timestamp read as unix
  // time would date every transaction to 1982.
  it('converts the chain timestamp rather than passing it through', () => {
    const created = transactionDid(tx).didDocumentMetadata.created
    expect(created).toMatch(/^20\d\d-/)
    expect(created).not.toContain('1982')
  })

  it('has no created date for a transaction still waiting for a block', () => {
    const pending = { ...tx, blockTimestamp: undefined } as unknown as Transaction
    expect(transactionDid(pending).didDocumentMetadata.created).toBeUndefined()
  })
})

describe('aliasDid', () => {
  const alias = aliasDid({ aliasId: '777', aliasName: 'vesuvio', accountId: ID })

  it('names the alias under its top-level domain', () => {
    expect(alias.didDocument.id).toBe(didFor('alias', 'signum:vesuvio'))
    expect(alias.didDocument.alsoKnownAs).toEqual([didFor('alias', '777')])
  })

  it('is controlled by its owner', () => {
    expect(alias.didDocument.controller).toBe(didFor('acc', ID))
  })

  // What an alias points at can be changed at any time and the alias itself
  // can be handed on. A verifier has to know that before trusting one.
  it('is not immutable, unlike a transaction', () => {
    expect(alias.didDocumentMetadata.immutable).toBe(false)
  })
})
