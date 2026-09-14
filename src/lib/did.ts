import { ChainTime } from '@signumjs/util'
import type { Transaction } from '@signumjs/core'

/**
 * Which chain a DID resolves against.
 *
 * `signum-did-resolver` recognises `mainnet` and `testnet`, with mainnet
 * written as no segment at all. A sandbox chain is neither, and printing a
 * DID without a segment would claim mainnet — someone could reasonably paste
 * it into the real resolver and get nothing back. So the sandbox names
 * itself, which extends the method by one network and is a change worth
 * making upstream rather than only here.
 *
 * `sandbox` rather than `mocknet` because it names the thing the reader is
 * holding.
 */
export const SANDBOX_NETWORK = 'sandbox'

export type DidType = 'acc' | 'tx' | 'alias' | 'token' | 'contract'

/** `did:signum:sandbox:acc:TS-…` — the network segment is never omitted here. */
export const didFor = (type: DidType, identifier: string) =>
  `did:signum:${SANDBOX_NETWORK}:${type}:${identifier}`

export interface VerificationMethod {
  id: string
  type: 'Ed25519VerificationKey2020'
  controller: string
  publicKeyMultibase: string
}

export interface DidDocument {
  '@context': string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string
  verificationMethod?: VerificationMethod[]
  authentication?: string[]
  src44?: Record<string, unknown>
}

export interface DidDocumentMetadata {
  created?: string
  blockHeight?: number
  confirmations?: number
  immutable: boolean
}

export interface DidResolution {
  didResolutionMetadata: { contentType: 'application/did+ld+json' }
  didDocument: DidDocument
  didDocumentMetadata: DidDocumentMetadata
}

const DID_CONTEXT = 'https://www.w3.org/ns/did/v1'
const ED25519_CONTEXT = 'https://w3id.org/security/suites/ed25519-2020/v1'

/**
 * A public key as multibase, which is what the verification method carries.
 *
 * The `f` prefix is multibase's tag for lowercase base16 — the key is already
 * hex on this chain, so the encoding is a prefix and a case fold rather than
 * a conversion. Taken from the resolver rather than chosen here, because a
 * document that encodes its key differently is not the same document.
 */
export const toMultibase = (publicKeyHex: string) => `f${publicKeyHex.toLowerCase()}`

const resolution = (
  didDocument: DidDocument,
  didDocumentMetadata: DidDocumentMetadata,
): DidResolution => ({
  didResolutionMetadata: { contentType: 'application/did+ld+json' },
  didDocument,
  didDocumentMetadata,
})

export interface AccountInput {
  accountId: string
  accountRS: string
  publicKey?: string
  src44?: Record<string, unknown>
}

/**
 * The DID document for an account.
 *
 * Built from what the console already has — the id, the address, the public
 * key, the SRC44 profile — so resolving is a transformation rather than a
 * request.
 *
 * Named by the numeric id, with the address as `alsoKnownAs`. The id is the
 * account's own name on the chain — everything the node knows about an
 * account hangs off it, and the address is that same number regrouped for
 * people to read. An identifier meant to be resolved by machines should be
 * the canonical one; the readable spelling is still in the document, because
 * a document that mentions only one of the two leaves a reader to work out
 * that they are the same thing.
 *
 * An account the chain has never seen has no public key, and then there is no
 * verification method and no authentication: nothing can be proven about a
 * key that does not exist, and inventing the section would be the document
 * lying about what the chain knows.
 */
export function accountDid(account: AccountInput): DidResolution {
  const did = didFor('acc', account.accountId)
  const doc: DidDocument = {
    '@context': [DID_CONTEXT],
    id: did,
    alsoKnownAs: [didFor('acc', account.accountRS)],
  }

  if (account.publicKey) {
    doc['@context'] = [DID_CONTEXT, ED25519_CONTEXT]
    const keyId = `${did}#key-1`
    doc.verificationMethod = [
      {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: toMultibase(account.publicKey),
      },
    ]
    doc.authentication = [keyId]
  }

  if (account.src44) doc.src44 = account.src44

  // An account is not immutable: its name, description and balance all change.
  return resolution(doc, { immutable: false })
}

/**
 * The DID document for a transaction.
 *
 * Controlled by its sender rather than by itself — a transaction cannot act,
 * it was acted. The verification method is the sender's key under the
 * transaction's own id, which is what lets a verifier check that this
 * particular transaction came from that particular account.
 */
export function transactionDid(
  tx: Transaction,
  src44?: Record<string, unknown>,
): DidResolution {
  const did = didFor('tx', tx.transaction)
  // The sender by its id too, so a controller and the account document it
  // points at are the same string rather than two spellings of one account.
  const controller = didFor('acc', tx.sender)
  const doc: DidDocument = {
    '@context': [DID_CONTEXT, ED25519_CONTEXT],
    id: did,
    controller,
  }

  if (tx.senderPublicKey) {
    doc.verificationMethod = [
      {
        id: `${did}#creator`,
        type: 'Ed25519VerificationKey2020',
        controller,
        publicKeyMultibase: toMultibase(tx.senderPublicKey),
      },
    ]
  }

  if (src44) doc.src44 = src44

  return resolution(doc, {
    // Signum counts time from its own epoch, not from 1970.
    created: tx.blockTimestamp
      ? ChainTime.fromChainTimestamp(tx.blockTimestamp).getDate().toISOString()
      : undefined,
    blockHeight: tx.height,
    confirmations: tx.confirmations,
    // A confirmed transaction cannot be changed. That is the whole point of
    // one, and the reason a verification application would name it.
    immutable: true,
  })
}

export interface AliasInput {
  aliasId: string
  aliasName: string
  /** The owner's numeric id — a controller names the account the way the account does. */
  accountId: string
  timestamp?: number
  tld?: string
  src44?: Record<string, unknown>
}

/**
 * The DID document for an alias.
 *
 * Not immutable: what an alias points at can be changed by its owner at any
 * time, and the alias itself can be handed to someone else. That is what
 * makes it interesting and what a verifier has to know before trusting one.
 */
export function aliasDid(alias: AliasInput): DidResolution {
  const fullName = `${alias.tld ?? 'signum'}:${alias.aliasName}`
  const did = didFor('alias', fullName)
  return resolution(
    {
      '@context': [DID_CONTEXT],
      id: did,
      alsoKnownAs: [didFor('alias', alias.aliasId)],
      controller: didFor('acc', alias.accountId),
      ...(alias.src44 ? { src44: alias.src44 } : {}),
    },
    {
      created: alias.timestamp
        ? ChainTime.fromChainTimestamp(alias.timestamp).getDate().toISOString()
        : undefined,
      immutable: false,
    },
  )
}
