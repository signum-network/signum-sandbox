import { describe, expect, it } from 'vitest'
import { apiDocRecipe } from './apiDocRecipe'
import type { SandboxAccount } from './accounts'

const account = (name: string, id: string): SandboxAccount => ({
  id,
  address: `TS-${name.toUpperCase()}`,
  name,
  passphrase: `sandbox-${name}`,
})

describe('apiDocRecipe', () => {
  it('has nothing to say with fewer than two accounts', () => {
    expect(apiDocRecipe([], undefined)).toBeNull()
    expect(apiDocRecipe([account('alice', '1')], undefined)).toBeNull()
  })

  it('lets the first account send to the second when no forger is chosen', () => {
    const recipe = apiDocRecipe([account('alice', '1'), account('bob', '2')], undefined)
    expect(recipe?.sender).toBe('1')
    expect(recipe?.senderName).toBe('alice')
    expect(recipe?.secretPhrase).toBe('sandbox-alice')
    expect(recipe?.recipient).toBe('2')
    expect(recipe?.recipientName).toBe('bob')
  })

  it('prefers the forger as the sender, because it is the one collecting rewards', () => {
    const bob = account('bob', '2')
    const recipe = apiDocRecipe([account('alice', '1'), bob], bob)
    expect(recipe?.senderName).toBe('bob')
    expect(recipe?.recipient).toBe('1')
  })

  it('falls back to the first account when the forger is not one of them', () => {
    const recipe = apiDocRecipe(
      [account('alice', '1'), account('bob', '2')],
      account('carol', '3'),
    )
    expect(recipe?.senderName).toBe('alice')
    expect(recipe?.recipient).toBe('2')
  })

  it('quotes one Signa, the minimum fee and the longest deadline', () => {
    const recipe = apiDocRecipe([account('alice', '1'), account('bob', '2')], undefined)
    expect(recipe?.amountNQT).toBe('100000000')
    expect(recipe?.feeNQT).toBe('1000000')
    expect(recipe?.deadline).toBe('1440')
  })
})
