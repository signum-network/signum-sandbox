/**
 * Which stage is showing, and which drawer is open.
 *
 * These live in a library rather than in ConsoleShell because the tour needs
 * to name a tab in its step definitions, and a pure module must not import a
 * React component to do it.
 */
export type ConsoleTab = 'transactions' | 'blocks' | 'accounts' | 'watch'
export type DrawerName = 'send' | 'chain' | 'help' | null
