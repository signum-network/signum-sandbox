import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, pageCount, pageRange, paginate } from './paginate'

const items = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('paginate', () => {
  it('returns the first page and reports the range in one-based positions', () => {
    const p = paginate(items(120), 0, 50)
    expect(p.items).toHaveLength(50)
    expect([p.from, p.to, p.total, p.pages]).toEqual([1, 50, 120, 3])
  })

  it('returns a short last page', () => {
    const p = paginate(items(120), 2, 50)
    expect(p.items).toHaveLength(20)
    expect([p.from, p.to]).toEqual([101, 120])
  })

  it('clamps a page index that outlived its list', () => {
    const p = paginate(items(10), 7, 50)
    expect(p.page).toBe(0)
    expect(p.items).toHaveLength(10)
  })

  it('clamps a negative page', () => {
    expect(paginate(items(10), -3, 50).page).toBe(0)
  })

  it('reports an empty list as one empty page rather than none', () => {
    const p = paginate<number>([], 0, 50)
    expect([p.pages, p.total, p.from, p.to]).toEqual([1, 0, 0, 0])
  })

  it('defaults to the shared page size', () => {
    expect(paginate(items(PAGE_SIZE + 1), 0).items).toHaveLength(PAGE_SIZE)
  })
})

describe('pageRange', () => {
  it('starts at the tip of the chain', () => {
    expect(pageRange(0, 50)).toEqual({ firstIndex: 0, lastIndex: 49 })
  })

  it('walks backwards a page at a time', () => {
    expect(pageRange(2, 50)).toEqual({ firstIndex: 100, lastIndex: 149 })
  })

  it('never asks for a negative index', () => {
    expect(pageRange(-1, 50).firstIndex).toBe(0)
  })
})

describe('pageCount', () => {
  it('counts partial pages', () => {
    expect(pageCount(120, 50)).toBe(3)
    expect(pageCount(100, 50)).toBe(2)
  })

  it('is never zero, so there is always a page to show', () => {
    expect(pageCount(0, 50)).toBe(1)
  })
})
