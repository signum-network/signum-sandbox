import { describe, expect, it } from 'vitest'
import type { Contract } from '@signumjs/core'
import { fetchAllContracts, matchesContract, sortContracts } from './contractList'
import { interpret } from './search'

const contract = (fields: Partial<Contract>): Contract =>
  ({
    at: '1',
    atRS: 'TS-AAAA-AAAA-AAAA-AAAAA',
    name: 'Construct',
    creator: '2',
    creatorRS: 'TS-BBBB-BBBB-BBBB-BBBBB',
    machineCodeHashId: '3',
    creationBlock: 10,
    ...fields,
  }) as Contract

describe('fetchAllContracts', () => {
  it('reads an empty chain as no contracts', async () => {
    expect(await fetchAllContracts(async () => ({ ats: [] }))).toEqual([])
  })

  it('reads a single page', async () => {
    const ats = [contract({ at: '1' }), contract({ at: '2' })]
    expect(await fetchAllContracts(async () => ({ ats }))).toEqual(ats)
  })

  it('follows nextIndex until the node has no more', async () => {
    const asked: number[] = []
    const all = await fetchAllContracts(async (firstIndex) => {
      asked.push(firstIndex)
      return firstIndex === 0
        ? { ats: [contract({ at: 'a' })], nextIndex: 1 }
        : { ats: [contract({ at: 'b' })] }
    })
    expect(asked).toEqual([0, 1])
    expect(all.map((c) => c.at)).toEqual(['a', 'b'])
  })
})

describe('sortContracts', () => {
  it('puts the newest first and breaks a tie by id', () => {
    const sorted = sortContracts([
      contract({ at: '5', creationBlock: 10 }),
      contract({ at: '7', creationBlock: 30 }),
      contract({ at: '20', creationBlock: 10 }),
    ])
    expect(sorted.map((c) => c.at)).toEqual(['7', '20', '5'])
  })
})

describe('matchesContract', () => {
  const c = contract({
    at: '7897904199765918619',
    atRS: 'TS-U2WV-2TEK-UGHM-8YR8V',
    name: 'Construct',
    creator: '15494782160211780241',
    creatorRS: 'TS-RANK-AYKR-LJBJ-F864G',
    machineCodeHashId: '16947085825514351353',
    creationBlock: 1069,
  })
  const matches = (input: string) => matchesContract(c, interpret(input), 'Alice')

  it('matches everything without a query', () => {
    expect(matches('')).toBe(true)
  })

  it('matches the contract or the creator by name', () => {
    expect(matches('struc')).toBe(true)
    expect(matches('ali')).toBe(true)
    expect(matches('bob')).toBe(false)
  })

  it('matches the contract or the creator by address', () => {
    expect(matches('TS-U2WV-2TEK-UGHM-8YR8V')).toBe(true)
    expect(matches('ts-rank-aykr-ljbj-f864g')).toBe(true)
    expect(matches('TS-2222-2222-2222-22222')).toBe(false)
  })

  it('matches the contract, the creator or the code hash by id', () => {
    expect(matches('7897904199765918619')).toBe(true)
    expect(matches('15494782160211780241')).toBe(true)
    expect(matches('16947085825514351353')).toBe(true)
    expect(matches('1111111111')).toBe(false)
  })

  it('matches the block it was created in', () => {
    expect(matches('1069')).toBe(true)
    expect(matches('1070')).toBe(false)
  })
})
