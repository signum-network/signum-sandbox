import { describe, expect, it } from 'vitest'
import { tokenize } from './scenarioLang'

describe('tokenize', () => {
  it('splits a line into words', () => {
    expect(tokenize('fund Alice 1000')).toEqual(['fund', 'Alice', '1000'])
  })

  it('keeps a quoted string together, spaces and all', () => {
    expect(tokenize('msg Bob -> Alice "see you Friday"')).toEqual([
      'msg',
      'Bob',
      '->',
      'Alice',
      '"see you Friday"',
    ])
  })

  it('treats the arrow and the comma as tokens of their own', () => {
    expect(tokenize('multi A -> B 1, C 2')).toEqual(['multi', 'A', '->', 'B', '1', ',', 'C', '2'])
  })

  it('drops a comment and the whitespace around everything', () => {
    expect(tokenize('  forge 2   # two empty blocks ')).toEqual(['forge', '2'])
    expect(tokenize('# nothing but a comment')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })

  // A '#' inside a quoted string is text, not the start of a comment. Getting
  // this wrong would silently truncate any message that mentions one.
  it('does not see a comment inside a string', () => {
    expect(tokenize('msg A -> B "meet at #3"')).toEqual(['msg', 'A', '->', 'B', '"meet at #3"'])
  })

  it('keeps an unterminated string as one token, for the parser to complain about', () => {
    expect(tokenize('msg A -> B "unfinished')).toEqual(['msg', 'A', '->', 'B', '"unfinished'])
  })
})

import { parseScenario, type ScenarioStep } from './scenarioLang'

const parse = (source: string) => parseScenario(source)

describe('parseScenario', () => {
  it('reads a whole scenario', () => {
    const { steps, problems } = parse(`
      # a small chain
      miner Miner
      account Alice
      fund Alice 1000
      pay Alice -> Miner 10 "thanks"
      forge 2
    `)
    expect(problems).toEqual([])
    expect(steps).toEqual<ScenarioStep[]>([
      { line: 3, kind: 'miner', name: 'Miner' },
      { line: 4, kind: 'account', name: 'Alice' },
      { line: 5, kind: 'fund', account: 'Alice', signa: '1000' },
      { line: 6, kind: 'pay', from: 'Alice', to: 'Miner', signa: '10', message: 'thanks' },
      { line: 7, kind: 'forge', count: 2 },
    ])
  })

  it('carries the line number, since that is what the editor points at', () => {
    const { problems } = parse('miner Miner\n\nnonsense here')
    expect(problems).toEqual([{ line: 3, message: 'unknown instruction "nonsense"' }])
  })

  it('names the argument that is missing rather than saying the line is wrong', () => {
    expect(parse('fund Alice').problems).toEqual([{ line: 1, message: 'fund needs an amount' }])
    expect(parse('pay Alice -> Bob').problems).toEqual([
      { line: 1, message: 'pay needs an amount' },
    ])
  })

  it('insists on the arrow, so a direction is never guessed', () => {
    expect(parse('pay Alice Bob 10').problems).toEqual([
      { line: 1, message: 'pay needs "->" between the two accounts' },
    ])
  })

  it('rejects an unterminated string where it starts', () => {
    expect(parse('msg A -> B "unfinished').problems).toEqual([
      { line: 1, message: 'a quoted text is missing its closing quote' },
    ])
  })

  it('rejects an amount that is not a number', () => {
    expect(parse('fund Alice lots').problems).toEqual([
      { line: 1, message: '"lots" is not an amount' },
    ])
  })

  it('reports every bad line, so one pass fixes the file', () => {
    expect(parse('fund Alice\nwhat\npay A -> B 1').problems).toHaveLength(2)
  })

  it('reads a multi-out with any number of recipients', () => {
    const { steps } = parse('multi Alice -> Bob 250, Carol 250, Dave 60')
    expect(steps[0]).toEqual({
      line: 1,
      kind: 'multi',
      from: 'Alice',
      recipients: [
        { to: 'Bob', signa: '250' },
        { to: 'Carol', signa: '250' },
        { to: 'Dave', signa: '60' },
      ],
    })
  })

  it('reads the two message kinds as one step with a flag', () => {
    expect(parse('msg A -> B "hello"').steps[0]).toMatchObject({ kind: 'msg', encrypted: false })
    expect(parse('secret A -> B "hello"').steps[0]).toMatchObject({ kind: 'msg', encrypted: true })
  })

  it('reads a subscription and its interval', () => {
    expect(parse('subscribe A -> B 12 every 3600').steps[0]).toEqual({
      line: 1,
      kind: 'subscribe',
      from: 'A',
      to: 'B',
      signa: '12',
      frequencyS: 3600,
    })
  })

  it('derives a passphrase from the name, and lets one be given instead', () => {
    expect(parse('account Alice').steps[0]).toEqual({ line: 1, kind: 'account', name: 'Alice' })
    expect(parse('account Alice "my own words"').steps[0]).toEqual({
      line: 1,
      kind: 'account',
      name: 'Alice',
      passphrase: 'my own words',
    })
  })

  it('defaults forge to a single block', () => {
    expect(parse('forge').steps[0]).toEqual({ line: 1, kind: 'forge', count: 1 })
  })
})

describe('parseScenario, arguments it must not swallow', () => {
  // The worst failure this language could have: a line that runs, succeeds,
  // and produces a chain the author did not describe. An unquoted passphrase
  // was silently dropped and the account derived from its name instead.
  it('refuses an unquoted passphrase rather than ignoring it', () => {
    expect(parse('account Alice mysecretwords').problems).toEqual([
      { line: 1, message: 'account: put "mysecretwords" in quotes to use it as text' },
    ])
  })

  it('refuses an unquoted message rather than dropping it', () => {
    expect(parse('pay A -> B 10 thanks').problems).toEqual([
      { line: 1, message: 'pay: put "thanks" in quotes to use it as text' },
    ])
  })

  it('refuses a surplus argument it has no use for', () => {
    expect(parse('fund Alice 10 20').problems).toEqual([
      { line: 1, message: 'fund does not take "20"' },
    ])
  })

  // Blocks, decimals and seconds are whole things. Accepting a fraction here
  // told the author the line was fine and handed the runner half a block.
  it('refuses a fractional count where only whole ones exist', () => {
    expect(parse('forge 1.5').problems).toEqual([
      { line: 1, message: '"1.5" is not a whole number of blocks' },
    ])
    expect(parse('subscribe A -> B 1 every 0.5').problems).toEqual([
      { line: 1, message: 'subscribe needs "every <seconds>", a whole number of seconds' },
    ])
    expect(parse('token M SLICE 10 0.5').problems).toEqual([
      { line: 1, message: 'token needs a whole number of decimals' },
    ])
  })

  // Blaming the decimals for a missing symbol sends the author to the wrong
  // end of the line.
  it('says the symbol is missing rather than blaming the argument after it', () => {
    expect(parse('token Alice 1000 0').problems).toEqual([
      { line: 1, message: 'token needs a symbol before the quantity' },
    ])
    expect(parse('transfer A -> B 10 SLICE').problems).toEqual([
      { line: 1, message: 'transfer needs the token symbol before the quantity' },
    ])
  })

  it('tells a missing sender from a missing arrow', () => {
    expect(parse('pay -> Bob 10').problems).toEqual([
      { line: 1, message: 'pay needs an account on each side of "->"' },
    ])
    expect(parse('pay Alice Bob 10').problems).toEqual([
      { line: 1, message: 'pay needs "->" between the two accounts' },
    ])
  })
})
