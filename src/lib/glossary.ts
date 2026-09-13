/**
 * The words the console uses without apology, and the single place they are
 * listed. Adding one here without translating it fails glossary.test.ts, and
 * translating it in English alone fails locales.test.ts — so a term either
 * arrives in ten languages or it does not arrive.
 */
export const GLOSSARY_TERMS = [
  'block',
  'height',
  'forge',
  'forger',
  'passphrase',
  'address',
  'publicKey',
  'unconfirmed',
  'fee',
  'payload',
  'src44',
  'token',
  'alias',
  'subscription',
  'multiOut',
  'contact',
] as const

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]

export const termKey = (term: GlossaryTerm) => `glossary.${term}.term`
export const helpKey = (term: GlossaryTerm) => `glossary.${term}.help`

export interface GlossaryEntry {
  id: GlossaryTerm
  term: string
  help: string
}

/**
 * Accents dropped so a query can be typed without them. Someone looking up
 * "Höhe" should not have to find the umlaut key first, and the same holds for
 * every accented language the console speaks.
 */
const foldable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * The terms a query matches, searched over the explanation as well as the
 * word.
 *
 * Sixteen words fit on one screen, so a filter that only matched the words
 * would save nobody anything. What it is for is the other direction: you
 * remember a thing the sandbox told you — that a fee is charged per slot, that
 * an account appears once it receives something — and you want the word for
 * it back. That only works if the sentences are searched too.
 */
export function filterGlossary(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
  const needle = foldable(query.trim())
  if (!needle) return entries
  return entries.filter(
    (entry) => foldable(entry.term).includes(needle) || foldable(entry.help).includes(needle),
  )
}
