import { src44 } from '@signumjs/standards'

const { DescriptorDataBuilder } = src44

export type Src44Type = 'hum' | 'smc' | 'bot' | 'biz' | 'cex' | 'dex' | 'tok' | 'oth'

/** The whole descriptor must fit this, and the node counts bytes, not characters. */
export const SRC44_MAX_BYTES = 1000

/** What SRC44 lets a descriptor say it is. */
export const SRC44_TYPES: Src44Type[] = ['hum', 'smc', 'bot', 'biz', 'cex', 'dex', 'tok', 'oth']

/**
 * The subset of SRC44 the console offers.
 *
 * Left out on purpose: `alias`, `account` and `id` describe a descriptor's
 * relationship to something else and only make sense once you are building a
 * profile graph; `sendRule` and `extension` are protocol features rather than
 * things to type into a sandbox. Custom fields are in, because inventing your
 * own payload is exactly what someone is here to try.
 */
export interface Src44Fields {
  name: string
  description: string
  type: Src44Type | ''
  avatarCid: string
  avatarMime: string
  homePage: string
  /** One URL per line. */
  socialLinks: string
  /** One `key = value` per line. */
  custom: string
}

export const EMPTY_SRC44: Src44Fields = {
  name: '',
  description: '',
  type: '',
  avatarCid: '',
  avatarMime: 'image/png',
  homePage: '',
  socialLinks: '',
  custom: '',
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

/**
 * `key = value` per line, because a developer typing an experimental payload
 * should not also have to type JSON punctuation. A line without a separator is
 * dropped rather than guessed at; the preview shows what survived.
 */
export function parseCustomFields(text: string): [string, string][] {
  return lines(text).flatMap((line) => {
    const at = line.indexOf('=')
    if (at <= 0) return []
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    return key === '' ? [] : [[key, value] as [string, string]]
  })
}

export type Src44Result = { json: string } | { error: string }

/**
 * The descriptor these fields describe, or why it is not one.
 *
 * Built through the reference implementation rather than by assembling JSON,
 * so what lands on chain is valid by construction — and when it is not, the
 * standard's own message says why, which is more use than anything this
 * module could invent.
 */
export function buildSrc44(fields: Src44Fields): Src44Result {
  try {
    const builder = DescriptorDataBuilder.create(fields.name || undefined)
    if (fields.description) builder.setDescription(fields.description)
    if (fields.type) builder.setType(fields.type)
    if (fields.avatarCid) builder.setAvatar(fields.avatarCid, fields.avatarMime || 'image/png')
    if (fields.homePage) builder.setHomePage(fields.homePage)
    const social = lines(fields.socialLinks)
    if (social.length > 0) builder.setSocialMediaLinks(social)
    for (const [key, value] of parseCustomFields(fields.custom)) {
      builder.setCustomField(key, value)
    }
    return { json: builder.build().stringify() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** What the node will count, so the form can warn before the node refuses. */
export const byteLength = (text: string) => new TextEncoder().encode(text).length
