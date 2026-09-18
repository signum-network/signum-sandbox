/**
 * Which picture an account address wears.
 *
 * `hashicon` is first and default on purpose: its version is pinned so that an
 * address looks the same here as it does in the Signum wallets, and that match
 * is worth keeping for anyone who has not asked for something else. The other
 * two are DiceBear styles, chosen for looking like the identicons the rest of
 * the web had in 2013 — squares in a mirrored grid, and pixel art.
 */
export const IDENTICON_STYLES = ['hashicon', 'identicon', 'pixel-art'] as const

export type IdenticonStyle = (typeof IDENTICON_STYLES)[number]

export const DEFAULT_IDENTICON_STYLE: IdenticonStyle = 'hashicon'

/**
 * Nothing stored, a name we no longer recognise, or a value someone typed into
 * devtools all mean the same thing: this person has not chosen, so give them
 * the one that matches their wallet.
 */
export function readStyle(stored: string | null): IdenticonStyle {
  return IDENTICON_STYLES.includes(stored as IdenticonStyle)
    ? (stored as IdenticonStyle)
    : DEFAULT_IDENTICON_STYLE
}

/** One click forward, wrapping at the end of the list. */
export function nextStyle(current: IdenticonStyle): IdenticonStyle {
  const at = IDENTICON_STYLES.indexOf(current)
  return IDENTICON_STYLES[(at + 1) % IDENTICON_STYLES.length]
}
