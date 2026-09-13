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
