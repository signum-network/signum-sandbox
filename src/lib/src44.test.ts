import { describe, expect, it } from 'vitest'
import {
  EMPTY_SRC44,
  SRC44_MAX_BYTES,
  buildSrc44,
  byteLength,
  namedFields,
  type Src44Fields,
} from './src44'

const fields = (over: Partial<Src44Fields> = {}): Src44Fields => ({ ...EMPTY_SRC44, ...over })

const json = (result: ReturnType<typeof buildSrc44>) => {
  if ('error' in result) throw new Error(`expected a descriptor, got: ${result.error}`)
  return JSON.parse(result.json) as Record<string, unknown>
}

describe('namedFields', () => {
  it('keeps the rows that name something', () => {
    expect(namedFields([{ key: 'a', value: '1' }])).toEqual([{ key: 'a', value: '1' }])
  })

  it('drops a row with no key, since an empty row names nothing', () => {
    expect(namedFields([{ key: '', value: '1' }, { key: '  ', value: '2' }])).toEqual([])
  })

  it('keeps a row whose value is empty, which is a real thing to say', () => {
    expect(namedFields([{ key: 'a', value: '' }])).toEqual([{ key: 'a', value: '' }])
  })
})

describe('buildSrc44', () => {
  it('carries the name and description', () => {
    expect(json(buildSrc44(fields({ name: 'Alice', description: 'a test' })))).toMatchObject({
      nm: 'Alice',
      ds: 'a test',
    })
  })

  it('leaves out what was not filled in', () => {
    const descriptor = json(buildSrc44(fields({ name: 'Alice' })))
    expect(descriptor).not.toHaveProperty('ds')
    expect(descriptor).not.toHaveProperty('hp')
  })

  it('carries an avatar as a CID and a mime type', () => {
    const descriptor = json(
      buildSrc44(fields({ avatarCid: 'QmSomeCid', avatarMime: 'image/webp' })),
    )
    expect(descriptor.av).toEqual({ QmSomeCid: 'image/webp' })
  })

  it('carries social links as a list, normalised by the standard', () => {
    // The reference implementation runs each link through URL parsing, which
    // appends the root path. Asserting what it actually does rather than what
    // was typed keeps this a test of the standard and not of our wishes.
    expect(json(buildSrc44(fields({ socialLinks: 'https://a\nhttps://b' }))).sc).toEqual([
      'https://a/',
      'https://b/',
    ])
  })

  it('carries custom fields', () => {
    expect(
      json(buildSrc44(fields({ custom: [{ key: 'role', value: 'miner' }] }))),
    ).toMatchObject({ role: 'miner' })
  })

  it('ignores a half-filled custom row rather than refusing the whole descriptor', () => {
    // An unnamed row contributes nothing, so what comes out is the bare
    // descriptor: a version and nothing else.
    expect(Object.keys(json(buildSrc44(fields({ custom: [{ key: '', value: 'orphan' }] }))))).toEqual([
      'vs',
    ])
  })

  it('leaves the name out when there is none, since an attachment rarely has one', () => {
    expect(json(buildSrc44(fields({ custom: [{ key: 'role', value: 'miner' }] })))).not.toHaveProperty(
      'nm',
    )
  })

  it('reports the standard’s own complaint instead of throwing', () => {
    const result = buildSrc44(fields({ description: 'x'.repeat(500) }))
    expect('error' in result).toBe(true)
  })

  it('builds an empty descriptor rather than failing on no input', () => {
    expect(json(buildSrc44(EMPTY_SRC44))).toHaveProperty('vs')
  })
})

describe('byteLength', () => {
  it('counts bytes, not characters, since that is what the limit is in', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('ä')).toBe(2)
    expect(byteLength('🙂')).toBe(4)
  })

  it('knows the limit it exists to check', () => {
    expect(SRC44_MAX_BYTES).toBe(1000)
  })
})
