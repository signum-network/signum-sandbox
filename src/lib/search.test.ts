import { describe, expect, it } from 'vitest'
import { interpret, matchesAccountQuery, matchesTransaction } from './search'
import type { Transaction } from '@signumjs/core'

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

const tx = (extra: Partial<Transaction>) =>
  ({ transaction: '99', senderRS: 'TS-AAAA', recipientRS: 'TS-BBBB', ...extra }) as Transaction

describe('matchesTransaction', () => {
  it('keeps everything when there is no filter', () => {
    expect(matchesTransaction(tx({}), { kind: 'none' })).toBe(true)
  })

  it('matches an address against sender and recipient', () => {
    expect(matchesTransaction(tx({}), { kind: 'address', value: 'TS-BBBB' })).toBe(true)
    expect(matchesTransaction(tx({}), { kind: 'address', value: 'TS-ZZZZ' })).toBe(false)
  })

  it('matches an id against the transaction id', () => {
    expect(matchesTransaction(tx({}), { kind: 'id', value: '99' })).toBe(true)
  })

  it('matches a height against the containing block', () => {
    expect(matchesTransaction(tx({ height: 128 }), { kind: 'height', height: 128 })).toBe(true)
    expect(matchesTransaction(tx({ height: 127 }), { kind: 'height', height: 128 })).toBe(false)
  })

  it('matches a name case-insensitively against the attachment', () => {
    expect(
      matchesTransaction(
        tx({ attachment: { name: 'Pizza Coin' } } as Partial<Transaction>),
        { kind: 'name', value: 'pizza' },
      ),
    ).toBe(true)
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
