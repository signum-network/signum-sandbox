/**
 * What the list looked like at one moment.
 *
 * `filter` is any string that changes when the displayed set was rebuilt
 * rather than appended to — the search query, and for blocks also the
 * hide-empty switch. Its content is never inspected; only whether it changed.
 */
export interface FeedSnapshot {
  /** In display order, newest first. */
  ids: string[]
  page: number
  filter: string
}

/**
 * Past a handful, per-row highlighting stops informing and becomes a wall of
 * colour. Beyond this the height and the border flash carry the block alone.
 */
const CEILING = 8

/**
 * Which of the rows on screen arrived since the previous snapshot.
 *
 * It answers with an empty set far more often than not, and that restraint is
 * the point: the feed mixes unconfirmed transactions with confirmed ones, so a
 * transaction already on screen can move position when its block lands, and
 * paging or searching replaces the whole list at once. None of those is an
 * arrival, and treating any of them as one turns a single event into a
 * firework.
 */
export function arrivals(previous: FeedSnapshot | null, next: FeedSnapshot): Set<string> {
  const none = new Set<string>()

  // The first list anyone sees did not arrive; it was already there.
  if (!previous) return none
  // Arrivals happen at the tip. Every other page is history.
  if (next.page !== 0) return none
  // A changed filter rebuilt the list; it did not receive anything.
  if (next.filter !== previous.filter) return none
  // Nor is the first fill of an empty list an arrival.
  if (previous.ids.length === 0) return none

  const known = new Set(previous.ids)
  // A list where nothing from before survived was replaced, not appended to.
  if (!next.ids.some((id) => known.has(id))) return none

  const leading: string[] = []
  for (const id of next.ids) {
    // Anything past the first familiar row is not new material at the tip:
    // it either was there before or it moved, and neither is an arrival.
    if (known.has(id)) break
    leading.push(id)
    if (leading.length > CEILING) return none
  }

  return new Set(leading)
}
