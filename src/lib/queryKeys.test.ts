import { describe, expect, it } from 'vitest'
import { STALE_ON_BLOCK } from './queryKeys'

describe('STALE_ON_BLOCK', () => {
  it('refreshes what the contract inspector shows', () => {
    for (const key of ['contractState', 'contractMap', 'account', 'sentBy', 'receivedBy']) {
      expect(STALE_ON_BLOCK).toContain(key)
    }
  })

  it('leaves the fixed activation amount alone', () => {
    expect(STALE_ON_BLOCK).not.toContain('contract')
  })
})
