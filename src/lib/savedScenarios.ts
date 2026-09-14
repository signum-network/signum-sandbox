/**
 * A scenario someone wrote, kept under a name.
 *
 * A list rather than a map keyed by name: the editor shows them in the order
 * they were saved, and re-saving under an existing name should replace that
 * entry where it stands rather than move it to the end.
 */
export interface SavedScenario {
  name: string
  source: string
}

/** Saving under a name that exists overwrites it, in place. */
export function saveScenario(
  list: SavedScenario[],
  name: string,
  source: string,
): SavedScenario[] {
  const trimmed = name.trim()
  const existing = list.findIndex((entry) => entry.name === trimmed)
  if (existing === -1) return [...list, { name: trimmed, source }]
  return list.map((entry, index) => (index === existing ? { name: trimmed, source } : entry))
}

export function removeScenario(list: SavedScenario[], name: string): SavedScenario[] {
  return list.filter((entry) => entry.name !== name)
}

export const serializeScenarios = (list: SavedScenario[]) => JSON.stringify(list)

/**
 * Storage written by an older version, by hand, or by another app must never
 * crash the editor. A malformed document yields an empty list; a malformed
 * entry within an otherwise-good one is dropped rather than sinking the rest,
 * the same tolerance parseAccounts and parseContacts give theirs.
 */
export function parseScenarios(raw: string | null): SavedScenario[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SavedScenario =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SavedScenario).name === 'string' &&
        typeof (entry as SavedScenario).source === 'string' &&
        (entry as SavedScenario).name !== '',
    )
  } catch {
    return []
  }
}

/**
 * A filename for a downloaded scenario.
 *
 * Anything a filesystem might object to becomes a hyphen — a name typed into
 * a text box is not a path, and a scenario called "Alice / Bob" should
 * download rather than fail. An empty result falls back rather than producing
 * a file called ".scenario", which some systems hide.
 */
export function scenarioFilename(name: string): string {
  const safe = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${safe || 'scenario'}.scenario`
}
