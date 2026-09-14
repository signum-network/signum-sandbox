import { describe, expect, it } from 'vitest'
import { Names } from './scenarioNames'

const account = { id: '1', address: 'TS-A', name: 'Alice', passphrase: 'sandbox-alice' }

describe('Names', () => {
  it('gives back the account it was given', () => {
    const names = new Names()
    names.rememberAccount('Alice', account)
    expect(names.account('Alice').id).toBe('1')
  })

  // Decimals travel with the id because the runner needs both: the id to
  // address the asset, the decimals to turn a written amount into the
  // smallest units the chain counts in.
  it('remembers a token by the symbol the scenario used, decimals and all', () => {
    const names = new Names()
    names.rememberToken('SLICE', '99', 2)
    expect(names.token('SLICE')).toEqual({ assetId: '99', decimals: 2 })
  })

  // checkScenario rejects a scenario that could reach these, which is why
  // they throw rather than returning undefined: reaching one means the
  // checker and the runner disagree, and that is a bug to surface.
  it('throws on a name it was never told', () => {
    const names = new Names()
    expect(() => names.account('Bob')).toThrow('unknown account "Bob"')
    expect(() => names.token('NONE')).toThrow('unknown token "NONE"')
  })
})
