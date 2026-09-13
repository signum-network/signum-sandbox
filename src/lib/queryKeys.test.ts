import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STALE_ON_BLOCK, STALE_ON_PENDING } from './queryKeys'

/**
 * Answers that no block can change, so they are deliberately absent from the
 * lists above. Adding a key here is a claim, and the claim is written down.
 */
const NEVER_STALE = [
  'networkInfo', // fixed for the life of a node
  'asset', // a token's name and decimals do not change
  'decrypt', // a decrypted message stays decrypted
  'accountsWithName', // answers about a typed name, not about chain state
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

/**
 * The console lost refreshes three times over by adding a query and not
 * telling the socket about it — the paginated block list, the watched account
 * and the expanded account row all sat stale on a new block. This test is the
 * reminder that adding a query is a decision, not just a call.
 */
describe('every query key is classified', () => {
  const used = new Set<string>()
  for (const file of sourceFiles('src')) {
    for (const [, key] of readFileSync(file, 'utf8').matchAll(/queryKey: \['([^']+)'/g)) {
      used.add(key)
    }
  }

  it('finds the keys the app actually uses', () => {
    expect(used.size).toBeGreaterThan(5)
  })

  it.each([...used])('%s is either invalidated on a block or declared static', (key) => {
    const classified =
      (STALE_ON_BLOCK as readonly string[]).includes(key) ||
      (STALE_ON_PENDING as readonly string[]).includes(key) ||
      NEVER_STALE.includes(key)
    expect(
      classified,
      `Query key '${key}' is unclassified. Add it to STALE_ON_BLOCK in src/lib/queryKeys.ts if a new block can change its answer, or to NEVER_STALE in this test if it cannot.`,
    ).toBe(true)
  })
})
