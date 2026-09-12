import { describe, expect, it } from 'vitest'
import { resolveFromAccount } from './fromAccount'

describe('resolveFromAccount', () => {
  it('defaults to the forger when nothing has been chosen', () => {
    expect(resolveFromAccount('', 'FORGER-1')).toBe('FORGER-1')
  })

  it('stays blank when there is no forger either', () => {
    expect(resolveFromAccount('', null)).toBe('')
    expect(resolveFromAccount('', undefined)).toBe('')
  })

  it('keeps a user choice over the forger default', () => {
    expect(resolveFromAccount('OTHER-2', 'FORGER-1')).toBe('OTHER-2')
  })

  it('keeps a user choice of the forger itself', () => {
    expect(resolveFromAccount('FORGER-1', 'FORGER-1')).toBe('FORGER-1')
  })
})
