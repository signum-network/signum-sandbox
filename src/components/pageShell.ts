/**
 * How wide a page is allowed to get, in one place.
 *
 * The console, the scenario editor and the start page all centre a column in
 * the viewport, and the number they cap it at is a judgement about reading,
 * not a per-page detail — so it lives here rather than in three class lists
 * that drifted the moment one of them was tuned.
 *
 * 1600px for the working surfaces. It is not a compromise between 1152 and
 * the full viewport: a fluid console on a 27" display puts a transaction's
 * kind at the far left and the block it landed in nearly two thousand pixels
 * away, and the eye has to cross the whole monitor to connect two halves of
 * one row. The cap keeps that pairing readable and still hands back most of
 * the space a wide display has to offer.
 *
 * The start page stays narrower. It is two cards and a fork in the road, and
 * a landing page stretched to a working width reads as empty rather than
 * spacious.
 */
export const PAGE_WIDTH = 'max-w-[1600px]'
export const START_PAGE_WIDTH = 'max-w-6xl'
