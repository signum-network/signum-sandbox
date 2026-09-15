import { describe, expect, it } from 'vitest'
import { arrivals, type FeedSnapshot } from './arrivals'

const snapshot = (ids: string[], overrides: Partial<FeedSnapshot> = {}): FeedSnapshot => ({
  ids,
  page: 0,
  filter: '',
  ...overrides,
})

describe('arrivals', () => {
  it('says nothing on the first snapshot', () => {
    expect(arrivals(null, snapshot(['c', 'b', 'a']))).toEqual(new Set())
  })

  it('names the transaction that appeared at the tip', () => {
    const before = snapshot(['b', 'a'])
    const after = snapshot(['c', 'b', 'a'])
    expect(arrivals(before, after)).toEqual(new Set(['c']))
  })

  it('names every transaction of one block, up to the ceiling of eight', () => {
    const before = snapshot(['a'])
    const after = snapshot(['h8', 'h7', 'h6', 'h5', 'h4', 'h3', 'h2', 'h1', 'a'])
    expect(arrivals(before, after).size).toBe(8)
  })

  it('says nothing when more than eight arrived at once', () => {
    const before = snapshot(['a'])
    const ids = Array.from({ length: 9 }, (_, i) => `n${i}`)
    expect(arrivals(before, snapshot([...ids, 'a']))).toEqual(new Set())
  })

  it('says nothing on any page but the first', () => {
    const before = snapshot(['b', 'a'], { page: 1 })
    const after = snapshot(['c', 'b', 'a'], { page: 1 })
    expect(arrivals(before, after)).toEqual(new Set())
  })

  it('says nothing when the filter changed, because the list was rebuilt', () => {
    const before = snapshot(['b', 'a'], { filter: '' })
    const after = snapshot(['c', 'b', 'a'], { filter: 'alice' })
    expect(arrivals(before, after)).toEqual(new Set())
  })

  it('says nothing when the list was empty before, because a first fill is not an arrival', () => {
    expect(arrivals(snapshot([]), snapshot(['b', 'a']))).toEqual(new Set())
  })

  it('says nothing about a transaction that only moved position when it confirmed', () => {
    const before = snapshot(['b', 'a'])
    const after = snapshot(['a', 'b'])
    expect(arrivals(before, after)).toEqual(new Set())
  })

  it('says nothing when nothing from the previous list survived', () => {
    const before = snapshot(['b', 'a'])
    const after = snapshot(['z', 'y'])
    expect(arrivals(before, after)).toEqual(new Set())
  })
})
