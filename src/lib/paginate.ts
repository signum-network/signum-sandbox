/** Rows per page. Fifty fills a screen without asking anyone to scroll a mile. */
export const PAGE_SIZE = 50

export interface Page<T> {
  items: T[]
  /** Zero-based, clamped into range. */
  page: number
  pages: number
  /** One-based positions of the first and last row shown, for "12–61 of 340". */
  from: number
  to: number
  total: number
}

/**
 * A page of a list already in memory.
 *
 * Clamps rather than trusting the caller: a page index can outlive the list it
 * indexed when a filter narrows the results or a chain gets reset, and showing
 * an empty page in that case would look like the data disappeared.
 */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(0, page), pages - 1)
  const start = current * size
  const shown = items.slice(start, start + size)
  return {
    items: shown,
    page: current,
    pages,
    from: total === 0 ? 0 : start + 1,
    to: start + shown.length,
    total,
  }
}

/**
 * The block indices a page covers, for the endpoints that take a range.
 *
 * getBlocks counts from the newest block backwards, so page zero is the tip of
 * the chain — the same direction the list reads in.
 */
export function pageRange(page: number, size = PAGE_SIZE): { firstIndex: number; lastIndex: number } {
  const firstIndex = Math.max(0, page) * size
  return { firstIndex, lastIndex: firstIndex + size - 1 }
}

/** How many pages a chain of this height needs, genesis included. */
export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size))
}
