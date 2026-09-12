// Imported from the granular subpath: @signumjs/core's root index re-exports only
// the full LedgerClientFactory, and the read-only client lives behind its own
// export. Pulling it in this way also keeps the unused API sections out of the
// bundle, since the package is sideEffects-free.
import { createReadOnlyClient } from '@signumjs/core/createReadOnlyClient'
import { LedgerClientFactory } from '@signumjs/core'

/**
 * Requests always target the page origin. In production the node serves the page,
 * so that is the node. In development the Vite proxy forwards /api and /events to
 * whichever node it was configured with, which keeps every request same-origin
 * and out of reach of CORS.
 */
export const nodeHost = window.location.origin

/**
 * The address to name when nothing answers. It differs from nodeHost only in
 * development, where the page comes from the dev server and telling the user to
 * look for a node there would send them to the wrong place.
 */
export const nodeAddress = __NODE_ADDRESS__ ?? window.location.origin

export const ledger = createReadOnlyClient({ nodeHost })

/**
 * The full client, for everything that writes. Kept separate from `ledger` so
 * that read paths keep pulling in only the read-only surface, and so that
 * "does this code sign something?" is answerable by looking at the import.
 */
export const signingLedger = LedgerClientFactory.createClient({ nodeHost })
