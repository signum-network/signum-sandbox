import { beforeAll, describe, expect, it } from 'vitest'
import { Crypto } from '@signumjs/crypto'
import { NodeJSCryptoAdapter } from '@signumjs/crypto/adapters'
import {
  addAccount,
  deriveAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
  type SandboxAccount,
} from './accounts'

// The browser adapter needs window.crypto; under vitest's node environment the
// Node adapter is the equivalent. Crypto.init must run before generateSignKeys.
beforeAll(() => Crypto.init(new NodeJSCryptoAdapter()))

const alice = () => deriveAccount('Alice', 'sandbox-alice', 'TS')

describe('deriveAccount', () => {
  it('derives the same id and address every time from the same passphrase', () => {
    const a = alice()
    const b = alice()
    expect(a.id).toBe(b.id)
    expect(a.address).toBe(b.address)
  })

  it('formats the address with the network prefix rather than assuming S', () => {
    expect(alice().address.startsWith('TS-')).toBe(true)
  })

  it('keeps the name and passphrase it was given', () => {
    expect(alice()).toMatchObject({ name: 'Alice', passphrase: 'sandbox-alice' })
  })

  it('gives different passphrases different accounts', () => {
    expect(deriveAccount('Bob', 'sandbox-bob', 'TS').id).not.toBe(alice().id)
  })
})

describe('addAccount', () => {
  it('appends an account', () => {
    const list = addAccount([], alice())
    expect(list).toHaveLength(1)
  })

  it('replaces instead of duplicating when the same account is added again', () => {
    const list = addAccount(addAccount([], alice()), deriveAccount('Alice 2', 'sandbox-alice', 'TS'))
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Alice 2')
  })
})

describe('removeAccount', () => {
  it('removes by id and leaves the rest alone', () => {
    const list = addAccount(addAccount([], alice()), deriveAccount('Bob', 'sandbox-bob', 'TS'))
    const rest = removeAccount(list, alice().id)
    expect(rest).toHaveLength(1)
    expect(rest[0].name).toBe('Bob')
  })
})

describe('parseAccounts', () => {
  it('round-trips through serialization', () => {
    const list: SandboxAccount[] = [alice()]
    expect(parseAccounts(serializeAccounts(list))).toEqual(list)
  })

  it('returns an empty list for missing, malformed or foreign storage', () => {
    expect(parseAccounts(null)).toEqual([])
    expect(parseAccounts('not json')).toEqual([])
    expect(parseAccounts('{"nope":1}')).toEqual([])
    expect(parseAccounts('[{"id":"1"}]')).toEqual([])
  })
})
