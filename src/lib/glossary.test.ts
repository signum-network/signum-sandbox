import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { GLOSSARY_TERMS, helpKey, termKey } from './glossary'

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
