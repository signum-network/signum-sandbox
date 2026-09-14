import { describe, expect, it } from 'vitest'
import { parseScenario } from './scenarioLang'
import { checkScenario } from './scenarioCheck'

const check = (source: string) => checkScenario(parseScenario(source).steps)

describe('checkScenario', () => {
  it('passes a scenario whose every reference resolves', () => {
    expect(
      check(`
        miner Miner
        account Alice
        fund Alice 100
        pay Alice -> Miner 10
      `),
    ).toEqual([])
  })

  // Without a miner nothing can be forged, and without forging nothing
  // settles -- so this is not a detail to discover at step one of a run.
  it('insists on a miner', () => {
    expect(check('account Alice')).toEqual([
      { line: 1, message: 'this scenario has no "miner" line, so nothing can forge' },
    ])
  })

  it('names an account no line creates', () => {
    expect(check('miner M\npay Alice -> M 1')).toEqual([
      { line: 2, message: 'unknown account "Alice"' },
    ])
  })

  it('sees an account only after the line that creates it', () => {
    expect(check('miner M\npay Alice -> M 1\naccount Alice')).toEqual([
      { line: 2, message: 'unknown account "Alice"' },
    ])
  })

  it('names a token used before it is issued', () => {
    expect(check('miner M\ntransfer M -> M SLICE 1')).toEqual([
      { line: 2, message: 'unknown token "SLICE"' },
    ])
  })

  it('rejects a name given twice, which would make every later line ambiguous', () => {
    expect(check('miner M\naccount Alice\naccount Alice')).toEqual([
      { line: 3, message: 'account "Alice" is already taken' },
    ])
  })

  it('knows the miner without an account line for it', () => {
    expect(check('miner Miner\nfund Miner 10')).toEqual([])
  })

  it('checks every recipient of a multi-out', () => {
    expect(check('miner M\nmulti M -> M 1, Ghost 2')).toEqual([
      { line: 2, message: 'unknown account "Ghost"' },
    ])
  })

  it('stays quiet on a file the parser could not read', () => {
    expect(check('garbage line')).toEqual([])
  })

  // Two rules the plan implemented and never exercised. Both are the kind a
  // later refactor can drop without a single test going red.
  it('rejects a second miner, which would leave the forger ambiguous', () => {
    expect(check('miner One\nminer Two')).toContainEqual({
      line: 2,
      message: 'this scenario names a miner twice',
    })
  })

  it('rejects a token issued twice under the same symbol', () => {
    expect(check('miner M\ntoken M SLICE 10 0\ntoken M SLICE 20 0')).toEqual([
      { line: 3, message: 'token "SLICE" is already issued' },
    ])
  })

  it('reports every problem, not only the first', () => {
    expect(check('miner M\npay A -> B 1\ntransfer M -> M X 1')).toHaveLength(3)
  })
})

describe('checkScenario, token precision', () => {
  it('refuses an amount finer than the token can hold', () => {
    expect(check('miner M\ntoken M ORBIT 100 2\ntransfer M -> M ORBIT 0.001')).toEqual([
      { line: 3, message: 'ORBIT has 2 decimals, so 0.001 is too fine' },
    ])
  })

  it('allows an amount the token can hold', () => {
    expect(check('miner M\ntoken M ORBIT 100 2\ntransfer M -> M ORBIT 0.25')).toEqual([])
  })

  it('refuses a supply finer than its own decimals', () => {
    expect(check('miner M\ntoken M SLICE 10.5 0')).toEqual([
      { line: 2, message: '10.5 is finer than 0 decimals can hold' },
    ])
  })
})
