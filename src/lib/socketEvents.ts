/**
 * The node's SIP-50 event envelope is { e: <name>, p: <payload> }.
 * The full set of names comes from brs/web/api/ws/common/WebsocketEventNames.java.
 */
const REFETCH_ON = new Set(['BLOCK_PUSHED', 'PENDING_TRANSACTIONS_ADDED'])

export function parseEvent(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { e?: unknown }
    return typeof parsed.e === 'string' ? parsed.e : null
  } catch {
    return null
  }
}

/** CONNECTED and HEARTBEAT carry no new chain state, so they must not trigger a refetch. */
export function isRefetchTrigger(event: string | null): boolean {
  return event !== null && REFETCH_ON.has(event)
}
