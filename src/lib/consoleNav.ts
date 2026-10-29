import { toAccountId } from './recipient'

/**
 * Which stage is showing, and which drawer is open.
 *
 * These live in a library rather than in ConsoleShell because the tour needs
 * to name a tab in its step definitions, and a pure module must not import a
 * React component to do it.
 */
export type ConsoleTab = 'transactions' | 'blocks' | 'accounts' | 'contracts' | 'watch'
export type DrawerName = 'send' | 'chain' | 'help' | null

/** What a link can ask of the console: for now, which account to watch. */
export interface ConsoleSearch {
  watch?: string
}

/**
 * The console's search parameters, keeping only what parses. The router
 * reads values as JSON, so a bare numeric id arrives as a number that has
 * already lost its last digits; only a string is trusted. Links carry the
 * address for that reason.
 */
export function parseConsoleSearch(search: Record<string, unknown>): ConsoleSearch {
  if (typeof search.watch !== 'string') return {}
  try {
    return { watch: toAccountId(search.watch) }
  } catch {
    return {}
  }
}
