import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS, instructionAt } from './scenarioHelp'
import { parseScenario } from './scenarioLang'
import { checkScenario } from './scenarioCheck'

describe('INSTRUCTIONS', () => {
  // The reference is a second statement of the grammar, and a reference that
  // has drifted from the parser is worse than none: it teaches a line the
  // language will reject. Every skeleton is therefore parsed for real.
  it.each(INSTRUCTIONS.map((i) => [i.verb, i] as const))('%s parses its own skeleton', (_v, i) => {
    expect(parseScenario(i.skeleton).problems).toEqual([])
  })

  it.each(INSTRUCTIONS.map((i) => [i.verb, i] as const))('%s signature names the verb', (_v, i) => {
    expect(i.signature.startsWith(i.verb)).toBe(true)
  })

  it('lists every verb once', () => {
    expect(new Set(INSTRUCTIONS.map((i) => i.verb)).size).toBe(INSTRUCTIONS.length)
  })

  // Sharper than checking each line alone: a skeleton is inserted into a
  // scenario that already has a cast, so the examples have to name the same
  // people rather than each inventing its own. Given those three accounts,
  // every skeleton together must be a scenario that would actually run.
  it('reads as a working scenario when every skeleton is used together', () => {
    const cast = 'account Bob\naccount Carol\n'
    const source = cast + INSTRUCTIONS.map((i) => i.skeleton).join('\n')
    const { steps, problems } = parseScenario(source)
    expect(problems).toEqual([])
    expect(checkScenario(steps)).toEqual([])
  })
})

describe('instructionAt', () => {
  const source = 'miner M\nsubscribe A -> B 12 every 3600\n\nforge 2'

  it('finds the instruction the caret sits in', () => {
    expect(instructionAt(source, 0)?.verb).toBe('miner')
    expect(instructionAt(source, 10)?.verb).toBe('subscribe')
    expect(instructionAt(source, source.length)?.verb).toBe('forge')
  })

  it('finds it at either end of the line, since a caret is often at one', () => {
    const line = source.indexOf('subscribe')
    expect(instructionAt(source, line)?.verb).toBe('subscribe')
    expect(instructionAt(source, source.indexOf('\n', line))?.verb).toBe('subscribe')
  })

  it('has nothing to say about a blank line or an unknown word', () => {
    expect(instructionAt(source, source.indexOf('\n\n') + 1)).toBeNull()
    expect(instructionAt('nonsense here', 3)).toBeNull()
  })

  it('ignores leading whitespace and a trailing comment', () => {
    expect(instructionAt('   forge 2 # later', 5)?.verb).toBe('forge')
  })
})
