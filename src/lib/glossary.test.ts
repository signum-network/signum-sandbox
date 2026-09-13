import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { GLOSSARY_TERMS, filterGlossary, helpKey, termKey } from './glossary'

// The other nine locales are covered by locales.test.ts, which demands the
// exact English key set — so English being complete makes all ten complete.
const glossary = (en as unknown as { glossary: Record<string, { term?: string; help?: string }> })
  .glossary

describe('glossary', () => {
  it('has a word and an explanation for every term', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(glossary[term]?.term, `${term}.term`).toBeTruthy()
      expect(glossary[term]?.help, `${term}.help`).toBeTruthy()
    }
  })

  it('names its keys the way the locale file nests them', () => {
    expect(termKey('fee')).toBe('glossary.fee.term')
    expect(helpKey('fee')).toBe('glossary.fee.help')
  })
})

describe('filterGlossary', () => {
  const entries = [
    { id: 'fee' as const, term: 'Fee', help: 'What a transaction costs its sender.' },
    { id: 'block' as const, term: 'Block', help: 'A batch of transactions.' },
    { id: 'height' as const, term: 'Höhe', help: 'Wie viele Blöcke die Chain hat.' },
  ]

  it('keeps everything when nothing was typed', () => {
    expect(filterGlossary(entries, '   ')).toEqual(entries)
  })

  it('matches the word', () => {
    expect(filterGlossary(entries, 'fee').map((e) => e.id)).toEqual(['fee'])
  })

  // Searching the explanations means a query can legitimately reach entries
  // whose word does not contain it. That is the feature, not a leak: "blo"
  // finds the block, and also the height, which is defined in terms of blocks.
  it('reaches an entry through its explanation as readily as through its word', () => {
    expect(filterGlossary(entries, 'blo').map((e) => e.id)).toEqual(['block', 'height'])
  })

  // The reason the filter exists at all: sixteen words fit on one screen, so
  // finding a word you can already see is worth nothing. Finding the word for
  // something you half remember is the whole point.
  it('matches the explanation, not only the word', () => {
    expect(filterGlossary(entries, 'costs its sender').map((e) => e.id)).toEqual(['fee'])
  })

  it('ignores case and accents, in the word and in the explanation', () => {
    expect(filterGlossary(entries, 'HOHE').map((e) => e.id)).toEqual(['height'])
    expect(filterGlossary(entries, 'blocke').map((e) => e.id)).toEqual(['height'])
  })

  it('finds nothing when nothing matches', () => {
    expect(filterGlossary(entries, 'zzz')).toEqual([])
  })
})
