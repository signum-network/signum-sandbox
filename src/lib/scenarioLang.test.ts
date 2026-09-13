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
