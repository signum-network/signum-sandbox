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
