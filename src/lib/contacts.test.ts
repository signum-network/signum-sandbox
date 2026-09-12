import { describe, expect, it } from 'vitest'
import { Address } from '@signumjs/core'
import { Crypto, generateSignKeys } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import {
  addContact,
  displayName,
  parseContacts,
  removeContact,
  serializeContacts,
  type Contacts,
} from './contacts'
import type { SandboxAccount } from './accounts'

// Same reasoning as recipient.test.ts: the describe bodies below derive keys
// during collection, before any beforeAll hook would run, so Crypto.init has
// to happen here, in file order, rather than inside a beforeAll.
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

const alice = account('Alice', 'sandbox-alice')
const bob = account('Bob', 'sandbox-bob')

describe('addContact / removeContact', () => {
  it('adds a contact keyed by numeric id', () => {
    const contacts = addContact({}, bob.address, 'Bob at the exchange')
    expect(contacts[bob.id]).toBe('Bob at the exchange')
  })

  it('renames rather than duplicating when the same account is added again', () => {
    const first = addContact({}, bob.address, 'Bob')
    const second = addContact(first, bob.address, 'Bob (renamed)')
    expect(Object.keys(second)).toHaveLength(1)
    expect(second[bob.id]).toBe('Bob (renamed)')
  })

  it('finds a contact saved by Reed-Solomon address when looked up by numeric id later', () => {
    const contacts = addContact({}, bob.address, 'Bob')
    expect(contacts[bob.id]).toBe('Bob')
  })

  it('finds a contact saved by numeric id when added again via its Reed-Solomon address', () => {
    const byId = addContact({}, bob.id, 'Bob')
    const byAddress = addContact(byId, bob.address, 'Bob (updated)')
    expect(Object.keys(byAddress)).toHaveLength(1)
    expect(byAddress[bob.id]).toBe('Bob (updated)')
  })

  it('removes a contact by whichever address form is passed in', () => {
    const contacts = addContact({}, bob.id, 'Bob')
    expect(removeContact(contacts, bob.address)).toEqual({})
  })

  it('leaves other contacts alone when removing one', () => {
    const contacts = addContact(addContact({}, bob.id, 'Bob'), alice.id, 'Alice')
    expect(removeContact(contacts, bob.id)).toEqual({ [alice.id]: 'Alice' })
  })
})

describe('serializeContacts / parseContacts', () => {
  it('round-trips through serialization', () => {
    const contacts = addContact(addContact({}, bob.id, 'Bob'), alice.id, 'Alice')
    expect(parseContacts(serializeContacts(contacts))).toEqual(contacts)
  })

  it('returns an empty book for missing or malformed storage', () => {
    expect(parseContacts(null)).toEqual({})
    expect(parseContacts('')).toEqual({})
    expect(parseContacts('not json')).toEqual({})
    expect(parseContacts('[]')).toEqual({})
    expect(parseContacts('"just a string"')).toEqual({})
  })

  it('drops individual malformed entries without discarding the rest', () => {
    const raw = JSON.stringify({
      [bob.id]: 'Bob',
      [alice.id]: 42, // not a string
      broken: '', // empty name
    })
    expect(parseContacts(raw)).toEqual({ [bob.id]: 'Bob' })
  })

  it('normalises keys written as a Reed-Solomon address', () => {
    const raw = JSON.stringify({ [bob.address]: 'Bob' })
    expect(parseContacts(raw)).toEqual({ [bob.id]: 'Bob' })
  })
})

describe('displayName', () => {
  const accounts: SandboxAccount[] = [alice]
  const contacts: Contacts = addContact({}, bob.id, 'Bob from the book')

  it('prefers the sandbox\'s own name for an account it owns', () => {
    expect(displayName(alice.address, accounts, contacts, 'On-chain Alice')).toBe('Alice')
  })

  it('falls back to a contact name for an account the sandbox does not own', () => {
    expect(displayName(bob.address, accounts, contacts, 'On-chain Bob')).toBe(
      'Bob from the book',
    )
  })

  it('matches a contact by numeric id even when the contact was saved another way', () => {
    expect(displayName(bob.id, accounts, contacts)).toBe('Bob from the book')
  })

  it('falls back to the on-chain name when there is no owned account or contact', () => {
    const stranger = account('Carol', 'sandbox-carol')
    expect(displayName(stranger.address, accounts, contacts, 'Carol Inc.')).toBe(
      'Carol Inc.',
    )
  })

  // Reed-Solomon addresses are hyphen-grouped as PREFIX-G1-G2-G3-G4; the
  // shortened form keeps the prefix plus first group and the last group.
  const shortened = (address: string) => {
    const groups = address.split('-')
    return `${groups[0]}-${groups[1]}…${groups[groups.length - 1]}`
  }

  it('treats an empty on-chain name as absent, not a name', () => {
    const stranger = account('Carol', 'sandbox-carol')
    expect(displayName(stranger.address, accounts, contacts, '')).toBe(
      shortened(stranger.address),
    )
  })

  it('falls back to a shortened address when nothing else is known', () => {
    const stranger = account('Carol', 'sandbox-carol')
    expect(displayName(stranger.address, accounts, contacts)).toBe(
      shortened(stranger.address),
    )
  })

  it('shortens a bare numeric id when nothing else is known', () => {
    const stranger = account('Carol', 'sandbox-carol')
    const longId = stranger.id.padEnd(13, '0')
    expect(displayName(longId, accounts, contacts)).toBe(
      `${longId.slice(0, 6)}…${longId.slice(-5)}`,
    )
  })

  it('leaves a short, already-readable identifier alone', () => {
    expect(displayName('12345', [], {})).toBe('12345')
  })
})
