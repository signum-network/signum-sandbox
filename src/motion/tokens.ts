/**
 * The sandbox's motion vocabulary, declared once.
 *
 * Two engines animate this app — CSS for one-shot decoration that recurs
 * twelve times a minute, Framer Motion for anything that enters, leaves or
 * springs — and both have to agree on how long things take. So the numbers
 * live here in TypeScript, and `cssVariables()` is how the CSS half receives
 * them. Neither side owns a duration of its own.
 */

/** Milliseconds. */
export const DURATIONS = {
  /** A state that should not appear to travel: an icon swapping for another. */
  instant: 120,
  /** Hover, press, a colour changing, a list cross-fading to another page. */
  quick: 200,
  /** A panel opening, a row unfolding, a tab's content changing. */
  base: 350,
  /** An arrival: the row entering and its trace decaying. */
  calm: 550,
  /** The background grid's drift — the only continuous motion in the app. */
  ambient: 90_000,
} as const

export type DurationName = keyof typeof DURATIONS

/** Framer Motion's `duration` is in seconds; CSS gets milliseconds. */
export const seconds = (name: DurationName): number => DURATIONS[name] / 1000

/**
 * Typed as mutable four-tuples rather than declared `as const`: Framer's
 * `ease` accepts a bezier as `[number, number, number, number]`, and a
 * readonly tuple is not assignable to it. `SPRINGS` below keeps its `as const`
 * because there the literal `type: 'spring'` is exactly what Framer needs.
 */
type Bezier = [number, number, number, number]

export const EASINGS: { out: Bezier; inOut: Bezier } = {
  /** Leaves fast, settles gently. What the arrival demo was judged on. */
  out: [0.22, 1, 0.36, 1],
  inOut: [0.4, 0, 0.2, 1],
}

/**
 * Named for the three settings that were already scattered through the code:
 * `Card` sprang at 300/20, `AudioToggle` at 420/22, `ThemeSwitcher` at
 * 420/28. Same feel, one place.
 */
export const SPRINGS = {
  /** A card lifting under the pointer. */
  lift: { type: 'spring', stiffness: 300, damping: 20 },
  /** A control answering a press. */
  snap: { type: 'spring', stiffness: 420, damping: 22 },
  /** A panel or an overlay arriving. */
  panel: { type: 'spring', stiffness: 420, damping: 28 },
} as const

const cubic = (curve: readonly number[]) => `cubic-bezier(${curve.join(',')})`

/**
 * The tokens as custom properties, written onto the document element by
 * `MotionProvider`. `motion.css` reads nothing else.
 */
export const cssVariables = (): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(DURATIONS).map(([name, ms]) => [`--motion-${name}`, `${ms}ms`]),
  ),
  '--motion-ease-out': cubic(EASINGS.out),
  '--motion-ease-in-out': cubic(EASINGS.inOut),
})
