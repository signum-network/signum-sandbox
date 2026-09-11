// Imported from the granular subpath: @signumjs/core's root index re-exports only
// the full LedgerClientFactory, and the read-only client lives behind its own
// export. Pulling it in this way also keeps the unused API sections out of the
// bundle, since the package is sideEffects-free.
import { createReadOnlyClient } from '@signumjs/core/createReadOnlyClient'

/** Same origin in production (the node serves us); the Vite proxy handles development. */
export const nodeHost = import.meta.env.VITE_NODE_URL ?? window.location.origin

export const ledger = createReadOnlyClient({ nodeHost })
