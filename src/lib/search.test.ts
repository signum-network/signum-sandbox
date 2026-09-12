import { describe, expect, it } from 'vitest'
import { Address, type Block, type Transaction } from '@signumjs/core'
import {
  interpret,
  localNameMatches,
  matchesAccountQuery,
  matchesBlock,
  matchesTransaction,
  resolveQuery,
  NO_QUERY,
} from './search'
import type { SandboxAccount } from './accounts'

describe('interpret', () => {
  it('reads a small number as a block height', () => {
    expect(interpret('128')).toEqual({ kind: 'height', height: 128 })
  })

  it('reads a long number as an id, since heights do not get that big', () => {
    expect(interpret('13703929038484906594')).toEqual({
      kind: 'id',
      value: '13703929038484906594',
    })
  })

  it('reads a Reed-Solomon address as an address', () => {
    expect(interpret('TS-ABCD-EFGH-IJKL-MNOPQ')).toEqual({
      kind: 'address',
      value: 'TS-ABCD-EFGH-IJKL-MNOPQ',
    })
  })

  it('treats anything else as a name', () => {
    expect(interpret('pizza')).toEqual({ kind: 'name', value: 'pizza' })
  })

  it('treats blank input as no filter at all', () => {
    expect(interpret('   ')).toEqual({ kind: 'none' })
  })
})

const ALICE_ID = '6185519450308823172'
const BOB_ID = '10723870776761944597'
const aliceAddress = Address.fromNumericId(ALICE_ID, 'TS').getReedSolomonAddress(true)

const account = (id: string, name: string): SandboxAccount => ({
  id,
  address: Address.fromNumericId(id, 'TS').getReedSolomonAddress(true),
  name,
  passphrase: 'irrelevant here',
})

const tx = (extra: Partial<Transaction>) =>
  ({ transaction: '99', sender: ALICE_ID, recipient: BOB_ID, ...extra }) as Transaction

const block = (extra: Partial<Block>) =>
  ({ block: '555', height: 12, generator: ALICE_ID, ...extra }) as Block

describe('resolveQuery', () => {
  it('folds an address to the numeric id it names, whatever the spelling', () => {
    const canonical = resolveQuery(interpret(aliceAddress), [], {})
    const lowercased = resolveQuery(interpret(aliceAddress.toLowerCase()), [], {})
    expect([...canonical.accountIds]).toEqual([ALICE_ID])
    expect([...lowercased.accountIds]).toEqual([ALICE_ID])
  })

  it('collects the accounts and contacts a name points at', () => {
    const resolved = resolveQuery(
      interpret('ali'),
      [account(ALICE_ID, 'Alice')],
      { [BOB_ID]: 'Alistair' },
    )
    expect([...resolved.accountIds].sort()).toEqual([ALICE_ID, BOB_ID].sort())
  })

  it('merges in the ids the node found for an exact on-chain name', () => {
    const resolved = resolveQuery(interpret('carol'), [], {}, [BOB_ID])
    expect([...resolved.accountIds]).toEqual([BOB_ID])
  })

  it('resolves nothing for the kinds that do not name an account', () => {
    expect(resolveQuery(interpret('12'), [], {}).accountIds.size).toBe(0)
    expect(resolveQuery(interpret(''), [], {}).accountIds.size).toBe(0)
  })
})

describe('localNameMatches', () => {
  it('matches an owned account and a contact case-insensitively', () => {
    expect(localNameMatches('LIC', [account(ALICE_ID, 'Alice')], { [BOB_ID]: 'Bob' })).toEqual([
      ALICE_ID,
    ])
    expect(localNameMatches('bo', [account(ALICE_ID, 'Alice')], { [BOB_ID]: 'Bob' })).toEqual([
      BOB_ID,
    ])
  })

  it('reports an account once even when it is both owned and a contact', () => {
    expect(localNameMatches('a', [account(ALICE_ID, 'Alice')], { [ALICE_ID]: 'Alice' })).toEqual([
      ALICE_ID,
    ])
  })
})

describe('matchesTransaction', () => {
  const withQuery = (input: string, nodeIds: string[] = []) =>
    resolveQuery(interpret(input), [account(ALICE_ID, 'Alice')], {}, nodeIds)

  it('keeps everything when there is no filter', () => {
    expect(matchesTransaction(tx({}), NO_QUERY)).toBe(true)
  })

  it('matches an address against sender and recipient, in any spelling', () => {
    expect(matchesTransaction(tx({}), withQuery(aliceAddress))).toBe(true)
    expect(matchesTransaction(tx({}), withQuery(aliceAddress.toLowerCase()))).toBe(true)
    expect(matchesTransaction(tx({ sender: '1', recipient: '2' }), withQuery(aliceAddress))).toBe(
      false,
    )
  })

  it('matches an id against the transaction id', () => {
    expect(matchesTransaction(tx({}), withQuery('99'))).toBe(false)
    expect(matchesTransaction(tx({ transaction: '13703929038484906594' }), withQuery('13703929038484906594'))).toBe(true)
  })

  it('matches a height against the containing block', () => {
    expect(matchesTransaction(tx({ height: 128 }), withQuery('128'))).toBe(true)
    expect(matchesTransaction(tx({ height: 127 }), withQuery('128'))).toBe(false)
  })

  it('matches a name against the account it names', () => {
    expect(matchesTransaction(tx({}), withQuery('alice'))).toBe(true)
    expect(matchesTransaction(tx({ sender: '1', recipient: '2' }), withQuery('alice'))).toBe(false)
  })

  it('matches a name the node resolved, not only a local one', () => {
    expect(matchesTransaction(tx({ sender: BOB_ID }), withQuery('carol', [BOB_ID]))).toBe(true)
  })

  it('still matches a name against free text in the attachment', () => {
    const issuance = tx({ sender: '1', recipient: '2', attachment: { name: 'Pizza Coin' } })
    expect(matchesTransaction(issuance, withQuery('pizza'))).toBe(true)
  })
})

describe('matchesBlock', () => {
  const withQuery = (input: string) =>
    resolveQuery(interpret(input), [account(ALICE_ID, 'Alice')], {})

  it('keeps everything when there is no filter', () => {
    expect(matchesBlock(block({}), NO_QUERY)).toBe(true)
  })

  it('matches a height against the block', () => {
    expect(matchesBlock(block({}), withQuery('12'))).toBe(true)
    expect(matchesBlock(block({}), withQuery('13'))).toBe(false)
  })

  it('matches an id against the block id, not a transaction id', () => {
    expect(matchesBlock(block({ block: '13703929038484906594' }), withQuery('13703929038484906594'))).toBe(true)
    expect(matchesBlock(block({}), withQuery('13703929038484906594'))).toBe(false)
  })

  it('filters to the blocks an account forged, by address or by name', () => {
    expect(matchesBlock(block({}), withQuery(aliceAddress))).toBe(true)
    expect(matchesBlock(block({}), withQuery('alice'))).toBe(true)
    expect(matchesBlock(block({ generator: BOB_ID }), withQuery('alice'))).toBe(false)
  })
})

describe('matchesAccountQuery', () => {
  it('matches a name case-insensitively as a substring', () => {
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'name', value: 'lic' })).toBe(true)
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'name', value: 'bob' })).toBe(false)
  })

  it('matches an address exactly, not as a substring', () => {
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'address', value: 'TS-AAAA' })).toBe(
      true,
    )
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'address', value: 'TS-AA' })).toBe(
      false,
    )
  })

  it('passes everything through for a query kind that does not apply to accounts', () => {
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'none' })).toBe(true)
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'height', height: 5 })).toBe(true)
    expect(matchesAccountQuery('Alice', 'TS-AAAA', { kind: 'id', value: '123' })).toBe(true)
  })
})
