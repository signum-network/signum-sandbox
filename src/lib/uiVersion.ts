/**
 * The version the installation serves, when it is not the one this page was
 * built as — or null when there is nothing to say.
 *
 * The node serves index.html without Cache-Control, so after an update a
 * browser may keep showing the old page for hours: the old file had not
 * changed in days, and heuristic caching lets a browser reuse it for a tenth
 * of that. The bundle itself is hashed and never stale; only the page that
 * names it is. version.json is fetched past the cache, so it is the one
 * answer that is always current.
 *
 * A dev server is always ahead of the last release, and an installation that
 * predates version.json says nothing — both stay quiet rather than nag.
 */
export function staleVersion(running: string, served: unknown): string | null {
  if (running.endsWith('-dev')) return null
  if (typeof served !== 'object' || served === null) return null
  const { version } = served as Record<string, unknown>
  if (typeof version !== 'string' || version === '') return null
  return version === running ? null : version
}
