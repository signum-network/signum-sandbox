# Signum Sandbox — Identicon Style Picker

**Date:** 2026-09-18
**Status:** approved
**Scope:** a fourth control in `AppHeader`'s personal-settings cluster that cycles the picture drawn for an account address between three styles — today's `hashicon` and two DiceBear styles. Covers the state that outlives a reload, the render path for both engines, and the button itself. Builds on `2026-09-14-animations-design.md` for the motion idiom.

## Goal

Every account in the sandbox already wears a picture: `hashicon` draws concentric gradient rings into a canvas, and it is pinned at `0.3.0` so an address looks the same here as it does in the Signum wallets. That property is worth keeping as the default, and it is the whole reason the version is pinned.

But the picture is decoration for the person reading the screen, and the recent launch video made the case by accident: its transaction rows show a completely different treatment — a 5×5 grid of two-shade squares, the 2013 GitHub identicon geometry — hand-written as inline CSS in the composition, matching no library at all. It looked better than what the app ships, to the person watching it.

So: let people choose. Three styles, one button, cycled by clicking, remembered across sessions. The default stays the one that matches the wallets, so nothing a newcomer sees changes until they go looking.

## Verified ground truth

Checked against the working tree and npm, not inferred.

| Fact | Consequence |
|---|---|
| `Identicon` is a single component taking `{ value, size }` (`src/components/console/Identicon.tsx`), and all ten call sites across six files go through it — `Header`, `ContactList`, `AccountRow`, `WatchView`, `TransactionRow`, `forms/fields`. | The seam for this feature already exists. Nothing but the component's internals needs to know a style was chosen. |
| Sizes used at those call sites are 14, 16, 20, 24 and the default 20. | The render path must be size-parametric, and a memo cache has to key on size as well as address. |
| `hashicon@0.3.0` ships only a default export and returns a canvas element, which the component mounts with `replaceChildren`. | The hashicon branch is already a DOM-node branch. DiceBear returns an SVG string, so the two engines need different insertion, not a shared one. |
| `MotionProvider`, `AudioProvider` and `ThemeProvider` all hold a preference in context, persist it to `localStorage`, and read it in a `useState` initialiser rather than an effect. `useBeginner` does the same with pure `read`/`write` helpers in `src/lib/beginner.ts`. | There are two established idioms and they agree: pure parse/serialise in `src/lib`, state in a provider, first read before first paint. |
| The button belongs in `AppHeader` (`src/components/AppHeader.tsx:85-87`) while the identicons render deep inside the console tree. | Shared state has to be context; a local hook would give the button and the rows separate copies. |
| `MotionToggle` and `AudioToggle` are 28px squares (`h-7 w-7`) with `1px solid var(--border)`, `whileHover` border-and-scale, `whileTap` 0.92, `SPRINGS.snap`, and an `AnimatePresence mode="wait"` icon cross-fade. `ThemeSwitcher` and `LanguageSelect` are wider labelled buttons. | The new control copies the square idiom exactly and sits with the other squares, not after the labelled pickers. |
| `AppHeader`'s doc comment describes its right-hand cluster as "the three settings a person changes for themselves — sound, theme, language". | A fourth personal setting belongs there by the file's own stated rule. The comment needs updating to match. |
| `src/VENDORED.md` records `components/controls/` as copied from `signum-node/web`, and asks that local edits stay minimal so re-copying stays practical. | A **new** file in `components/controls/` is free. Editing `AudioToggle`/`ThemeSwitcher` would not be, and this design edits neither. |
| `vitest.config.ts` sets `environment: 'node'`; `find src -name '*.test.tsx'` returns nothing. Every test covers a pure module, mostly under `src/lib`. | No component tests. Whatever deserves a test has to be a pure function. |
| `src/i18n/locales/locales.test.ts` flattens `en` and asserts the other nine locales have an identical key set. | Every new key lands in all ten locale files in the same commit, or the suite fails. |
| `@dicebear/collection` tops out at `9.4.2`, peers `@dicebear/core@^9`, and depends on roughly thirty individual style packages. `@dicebear/core` has since moved to `10.x` with an `11.0.0-rc`. | Install `@dicebear/core@9` plus `@dicebear/identicon@9` and `@dicebear/pixel-art@9`. The collection meta-package would pull in twenty-eight styles nobody renders, and pin core to a line that is two majors behind. |
| Both style packages are MIT; the `pixel-art` style is DiceBear's own work under CC0 1.0. | No attribution obligation, so `VENDORED.md` gains nothing. Verified because that file shows provenance is tracked here. |

## Decisions

1. **The button is its own preview.** It renders a real `<Identicon>` of one fixed seed at 14px in the currently-selected style, and clicking it cycles. A three-state control cannot be read from a single glyph the way its binary neighbours can, and the honest alternative — three hand-drawn icons abstracting "rings", "grid", "pixel face" — would be drawings of a thing we can simply show. The seed is the module constant `SAMPLE_SEED = 'signum-sandbox'` — a fixed string rather than a real account address, so the preview cannot change when accounts come and go, and so the picture only ever changes because the *style* changed.

2. **Silent.** The `title` is one static string, "Change identicon style". Naming each style in the tooltip was considered and rejected: the names are jargon (`hashicon`, `identicon`, `pixel-art`), and the one fact worth telling — that only the default matches the Signum wallets — is not worth teaching on hover to the large majority who will never compare the two. Someone who does compare will find the default already correct.

3. **`hashicon` is the default and the first state of the cycle.** An unset or unparseable stored value resolves to it. The wallet-matching property is therefore never lost by accident — only by a deliberate click, by someone who wanted a different picture more than they wanted the match.

4. **The component moves out of `console/`.** Once `AppHeader` renders one, `components/console/Identicon.tsx` is no longer console-only, and app chrome reaching into `console/` for it is a layering smell. It becomes `src/components/Identicon.tsx`. Its props do not change, so this is six import lines and no call-site logic.

5. **Generated SVG is cached.** DiceBear's `createAvatar(...).toString()` runs per render otherwise, and the console's transaction feed is a long list that re-renders on every block. A module-level `Map` keyed `style:size:value`, bounded at 200 entries and cleared wholesale when it overflows, makes a scroll or a re-render free. The sandbox has a handful of accounts, so the bound will not be reached in practice; it exists so a pathological session cannot grow the map without limit.

## Architecture

### `src/lib/identicon.ts` — pure

```ts
export const IDENTICON_STYLES = ['hashicon', 'identicon', 'pixel-art'] as const
export type IdenticonStyle = (typeof IDENTICON_STYLES)[number]

/** Unknown, absent or malformed input resolves to the wallet-matching default. */
export function readStyle(stored: string | null): IdenticonStyle

/** Steps forward through IDENTICON_STYLES, wrapping at the end. */
export function nextStyle(current: IdenticonStyle): IdenticonStyle
```

Mirrors `src/lib/beginner.ts`. The stored form is the style name itself, so no `writeStyle` is needed — the value is already a string.

### `src/identicon/IdenticonProvider.tsx` — state

Context holding `{ style: IdenticonStyle, cycle: () => void }`. Reads `localStorage['signum-identicon']` through `readStyle` in the `useState` initialiser, so a returning visitor's first paint is already in their style rather than flashing the default. `cycle` advances through `nextStyle` and writes the new value back, `try`/`catch`ed like the neighbouring providers.

Simpler than `MotionProvider` in one way that matters: there is no `data-*` attribute to publish and no second engine to keep in sync. Nothing outside React reads this preference.

`src/identicon/index.ts` re-exports `IdenticonProvider` and `useIdenticon`, so consumers import from `@/identicon` the way they already do from `@/motion` and `@/audio`. The provider goes into `main.tsx` inside `MotionProvider`, wrapping `RouterProvider` — it is the innermost of the four, since nothing else depends on it.

### `src/components/Identicon.tsx` — render

Same public props, `{ value, size = 20 }`. Reads `style` from the provider and dispatches:

- `hashicon` — today's code verbatim: `hashicon(value, { size })` into the host span via `replaceChildren`.
- `identicon` and `pixel-art` — `createAvatar(style, { seed: value, size }).toString()`, taken from the cache in decision 5, injected with `dangerouslySetInnerHTML`.

Both branches keep the existing fixed-size host span, so a style change cannot shift the layout of a row.

The file's existing comment about the `0.3.0` pin is rewritten: it explains the pin *and* that hashicon is the default because of it, so the next reader does not "simplify" the default away.

### `src/components/controls/IdenticonToggle.tsx` — the button

Built from `MotionToggle`'s shape — `h-7 w-7`, `1px solid var(--border)`, `whileHover` border-and-scale, `whileTap: 0.92`, `SPRINGS.snap`, and `AnimatePresence mode="wait"` keyed on the current style so the preview cross-fades at `seconds('instant')` like its neighbours' icons do. Content is `<Identicon value={SAMPLE_SEED} size={14} />`.

`play(sfx.tick)` on every click. `AudioToggle` and `MotionToggle` pair `confirm` with on and `tick` with off; a cycle has no on, so it takes the neutral one three times.

Colour stays `var(--muted)`-bordered throughout rather than going `var(--blue2)` in some states — there is no "enabled" state to signal, and the preview carries the information.

### `AppHeader`

Inserted between `<AudioToggle />` and `<ThemeSwitcher />`: three 28px squares, then the two labelled pickers. The doc comment's "three settings" becomes four, and names identicons among them.

## i18n

One key, `identicon.cycle`, sitting beside the existing `motion.*` pair:

```ts
identicon: { cycle: 'Change identicon style' },
```

Added to `en.ts` and translated into the other nine locales in the same commit. `locales.test.ts` is the guard.

## Testing

`src/lib/identicon.test.ts`, node environment, in the shape of the other `src/lib` tests:

- `nextStyle` advances through each of the three styles and wraps from the last back to the first, so three clicks return to where you started.
- `nextStyle` is total over `IDENTICON_STYLES` — driven off the exported tuple, so adding a fourth style later cannot silently leave it out of the cycle.
- `readStyle` returns each valid stored name unchanged.
- `readStyle` returns `'hashicon'` for `null`, for an empty string, and for an unrecognised name — the three ways a stored value goes bad.

The button, the provider and the two render branches are not unit-tested, consistent with a repo that has no DOM test environment. `npm run build` and `npm run lint` cover the type-level wiring.

## Non-goals

- Per-account style overrides. One choice for the whole app.
- A dropdown panel listing the styles with previews, `ThemeSwitcher`-style. If three states ever becomes six, revisit.
- Lazy-loading the DiceBear bundle while `hashicon` is active. Measurable only if the bundle turns out to matter, and it costs an async boundary in a render path that is currently synchronous.
- Any change to hashicon's pinned version or its rendering.
- Additional DiceBear styles beyond `identicon` and `pixel-art`.
