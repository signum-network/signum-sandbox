# Signum Sandbox — Motion

**Date:** 2026-09-14
**Status:** approved
**Scope:** animation across the sandbox UI — the chain's pulse, navigation transitions, the window's atmosphere, and the answer to a deliberate action. Includes the switch that turns all of it off. Builds on `2026-09-12-sandbox-console-design.md`.

## Goal

The sandbox runs a living chain, and right now you cannot see that. A block arrives, the height changes, rows appear in the feed — all of it instantaneous and therefore invisible unless you happened to be looking at the exact number that changed. The only thing that announces a block today is a sound, and only on the start page.

Motion fixes that, and it has to do so without becoming furniture. The console is a control room whose content is text: dense rows, long addresses, ten languages. Animation that competes with reading makes the tool worse. So every animation in this document exists for one of two reasons — it shows that something happened, or it shows where something went — and anything that is merely decorative is either left out or turned into a whisper.

The chain forges every five seconds by default. That number governs the whole design: whatever greets a new block plays twelve times a minute, forever.

## Verified ground truth

Checked against the working tree, not inferred.

| Fact | Consequence |
|---|---|
| `framer-motion@^11.18.0` is already a dependency and is used in eight files (`Card`, `ConsoleButton`, `Toggle`, `Select`, `ThemeSwitcher`, `AudioToggle`, `AnimatedNumber`, `forms/fields`). | No new dependency. The vocabulary already exists in fragments; this consolidates it. |
| Nothing in `src` calls `useReducedMotion` or renders `MotionConfig` — verified by grep, zero hits. | Every Framer animation in the app today ignores the operating system's reduced-motion preference. |
| `src/index.css:264` carries a `@media (prefers-reduced-motion: reduce)` block that sets `animation-duration`, `transition-duration` and friends with `!important`. | It kills CSS animation only, which is why the Framer gap above went unnoticed. And its `!important` would override a user who explicitly switches motion **on**, making the new toggle useless in exactly the case it is needed. |
| `src/VENDORED.md` records that `theme/`, `audio/`, `components/ui/`, `lib/utils.ts`, `index.css` and `components/controls/` are copied from `signum-node/web`, and asks that local edits stay minimal so re-copying stays practical. The `prefers-reduced-motion` block is documented there as ours. | New code goes in a new `src/motion/`, and the only edit to `index.css` is narrowing a block that is already ours. |
| `<Modal>` has exactly one call site: `src/components/console/DidLink.tsx:55`. | Giving it an `open` prop so it can animate its exit costs one call site, not twenty. |
| The drawer is rendered conditionally at `ConsoleShell:247` (`{drawer && …}`) as a `w-[34%]` sibling of the main panel. | An exit animation needs `AnimatePresence` around that block; the width is a layout animation, paid only on open and close. |
| The console's tabs are `ConsoleButton`s that switch a background colour; there is no indicator element. | A travelling indicator has to be added — a `motion.div` with `layoutId` — rather than animated into place. |
| `useBlockChime` is called in `StartPage.tsx:10` and nowhere else. It owns the only "the height grew" detection in the app. | The console — the one screen built for watching the chain — currently says nothing at all when a block lands. |
| `AnimatedNumber` exists and is used for the height on the start page (`NodeStatePanel.tsx:35`). | The console's height can reuse it instead of growing a second version. |
| `vitest.config.ts` sets `environment: 'node'`, and neither jsdom, happy-dom nor Testing Library is installed. Every existing test covers a pure module under `src/lib`. | No component tests. Judgement has to live in pure functions to be testable at all. |
| Five themes are defined in `index.css`, each with its own `--green`, `--blue2` and `--glow-*`. In `terminal`, `--green` and `--blue2` are both `#00ff00`. | Motion colour must come from theme variables. In the phosphor theme the arrival tint coincides with the accent, which is correct for that theme rather than a defect. |

## Decisions

1. **One register for everything: "an event, not a performance."** An arrival lasts about half a second, moves the rows it affects, leaves a decaying trace, and is over. Sweeps across the whole console, blooms behind numbers and staged reveals are rejected for recurring events — impressive once, tiring after two minutes.
2. **CSS and Framer Motion split by job, not by taste.** One-shot event decoration that must be cheap at twelve times a minute is CSS. Anything that enters, leaves, or needs a spring is Framer, because a leaving element is already out of the DOM as far as CSS is concerned.
3. **One switch, two consumers.** `MotionProvider` writes `data-motion="on"|"off"` onto `<html>` — the same shape `ThemeProvider` uses for `data-theme` — and hands the same decision to Framer as `MotionConfig reducedMotion`. There is no second place where "off" is half true.
4. **The switch is the user's, with the system as its starting value**, stored in `localStorage` like the theme and the mute state. An explicit choice outranks the operating system in both directions.
5. **No information may live only in motion.** The green trace does not say a transaction arrived — the row says that. Turning motion off costs nothing but motion.
6. **Tokens are declared once, in TypeScript, and emitted as CSS variables.** Both halves of the split then compute with the same numbers and cannot drift apart.
7. **"A block arrived" is detected in one place.** `useChainPulse` replaces the detection inside `useBlockChime`; the chime and the motion become two consumers of one observation.
8. **The console gains the chime it never had.** This is the one change in this document that is not purely visual, and it is deliberate: the start page chimes for a chain you are not watching, while the console, which exists to watch it, is silent. Both hang off `useChainPulse`, and the existing mute switch governs it as it governs every other sound.
9. **Arrival highlighting has a ceiling.** Past a handful of simultaneously new rows, per-row highlighting stops informing and becomes a wall of green; beyond the ceiling nothing highlights and the height and the border flash carry the event alone.
10. **No permanent overlays.** Scanlines, breathing glow and particles are out. They are states that mean nothing and they fight the legibility of text, which is the actual content.
11. **One unit test, for the one function whose failure is invisible.** Everything else visual is judged by eye, in all five themes, with the switch in both positions.

## The switching layer

New directory `src/motion/`, because the existing candidates (`theme/`, `audio/`, `components/ui/`) are all vendored and should stay cheap to re-copy.

### `tokens.ts`

The single declaration of the vocabulary.

| Token | Value | Used for |
|---|---|---|
| `instant` | 120 ms | a state that should not appear to travel: cross-fades between icons |
| `quick` | 200 ms | hover, press, colour changes, the pager's cross-fade |
| `base` | 350 ms | a panel opening, a row unfolding, a tab's content changing |
| `calm` | 550 ms | an arrival: the row entering and its trace decaying |
| `ambient` | 90 s | the background grid's drift — the one continuous motion in the app |

Easings: `ease-out` is `cubic-bezier(.22,1,.36,1)`, which is what the arrival demo was judged on; `ease-inout` is `cubic-bezier(.4,0,.2,1)`. Springs get names for the three settings already scattered through the code: `lift` (stiffness 300, damping 20, from `Card`), `snap` (420/22, from `AudioToggle`), `panel` (420/28, from `ThemeSwitcher`). Those call sites move to the names; the numbers stop being repeated.

### `MotionProvider.tsx`

Holds `'on' | 'off'`, persisted under `signum-motion`, and follows `AudioProvider`'s shape. Its starting value is `resolvePreference(stored, systemPrefersReduce)`: a stored choice wins; otherwise the system's `prefers-reduced-motion` decides.

In an effect it does three things: sets `document.documentElement.dataset.motion`, writes every duration from `tokens.ts` onto the root element as a CSS variable (`--motion-calm` and so on), and renders its children inside `<MotionConfig reducedMotion={enabled ? 'never' : 'always'}>`. `'never'` is deliberate rather than `'user'` — a user who switched motion on despite their system setting has said what they want, and Framer should stop consulting the OS.

It exports `useMotion(): { enabled: boolean; setEnabled: (on: boolean) => void }`. It is mounted in `main.tsx` inside `ThemeProvider`, beside `AudioProvider`.

### `motion.css`

Imported from `main.tsx` next to `./index.css`, never merged into it. Holds the one-shot keyframes — row arrival, border flash, the grid's drift, the theme shimmer — expressed in the `--motion-*` variables. One rule at the top disables all of them under `[data-motion="off"]`.

### `MotionToggle.tsx`

In `components/controls/`, next to `AudioToggle`, and built like it: a 7×7 bordered button, an icon that cross-fades between two states, `sfx.tick` on switching off and `sfx.confirm` on switching on. It goes into `AppHeader` beside the audio, theme and language controls. Its title text is added to all ten locales, which `locales.test.ts` enforces.

### The `index.css` edit

The reduced-motion block's selectors are narrowed from `*, *::before, *::after` to the same three scoped under `:root:not([data-motion="on"])`. It then keeps doing its real job — covering the milliseconds before React mounts and honouring the system preference by default — without overruling an explicit opt-in. The note in `VENDORED.md` is extended to describe the narrowing, so re-copying `index.css` from upstream carries it forward.

### What "off" means

No arrival animation, no drifting grid, no heartbeat, no cross-fade, no unfolding. Framer's `reducedMotion="always"` skips transform and layout animation, so a drawer is simply there instead of arriving and an expanded row is simply open; press and hover states still change, just without a path. `motion.css` disables its own keyframes. Sound is unaffected — it has its own switch.

The drifting grid is the only continuous motion in the design and therefore the first thing "off" must reach: endless background movement is precisely what causes trouble for vestibular sensitivity.

## The catalogue

### A · The chain's pulse (CSS, one-shot)

`useChainPulse(height: number | null)` returns a counter that increments when the height grows. `useBlockChime` is rewritten to consume it, and the console starts consuming it too (decision 8).

| Where | What happens |
|---|---|
| `TransactionsView` rows | A new row enters over `calm`, pushing the rows below it down, with a `--green` tint decaying to transparent. Height is animated as `grid-template-rows: 0fr → 1fr`, because a row's height is unknown and `height: 0 → auto` does not interpolate in CSS. |
| `BlocksView` rows | The same arrival, for a new block row, on the first page only. |
| `Header` height | Uses the existing `AnimatedNumber` instead of plain text. |
| `Header` container | A single border flash in `--green`, decaying over `calm`. |
| `Logomark` | One beat per block over `base` — the sandbox's heartbeat — from the same counter. |

Which rows count as new is decided by `arrivals`, below.

### B · Navigation and unfolding (Framer Motion)

| Where | What happens |
|---|---|
| Console tabs | A `motion.div` with `layoutId` travels behind the active tab instead of the background jumping between buttons. |
| Tab content | Cross-fade over `instant`, keyed on the tab. |
| Drawer (`ConsoleShell:247`) | Enters from the right over `base` (width and opacity) and leaves the same way, wrapped in `AnimatePresence`. |
| `Modal` | Backdrop fades; the dialog scales in from 0.96 with the `panel` spring, and animates out. Gains an `open` prop; `DidLink` is the only caller. |
| `TransactionRow`, `BlockRow` | The expanded detail unfolds over `base` rather than snapping open. |
| Paging (`TransactionsView`, `BlocksView`) | The list cross-fades over `quick` when `Pager` changes the page. |

### C · The window's atmosphere (CSS)

| Where | What happens |
|---|---|
| The grid in `__root.tsx` | Drifts 40 px — one cell — over `ambient`, linear and endless, on `transform` alone, so it is compositor work with no layout cost. |
| Theme change | A shimmer in the new accent colour over `quick`. CSS custom properties do not interpolate without `@property`, so the colours still swap instantly; the shimmer is what covers that swap, and it gives `sfx.themeChange` something to accompany. |

Left out: scanlines, breathing glow, particles (decision 10).

### D · The answer to an action

| Where | What happens |
|---|---|
| Forge button | The `requested` label fades in over `quick` instead of appearing. |
| Forge error | The message nudges 2 px sideways, once, over `quick`, alongside the `sfx.warn` already played there. |
| `Countdown` | In its final three seconds the number pulses gently over `quick` with each tick, so the auto-forge rhythm is visible and not merely countable. |
| `Balance` | Flashes once over `quick` when the value differs from the one it last showed. |

## `arrivals`

`src/motion/arrivals.ts`. The only function in this design that carries judgement, and the only one with a test.

```ts
interface FeedSnapshot {
  ids: string[]   // in display order, newest first
  page: number
  query: string
}

function arrivals(previous: FeedSnapshot | null, next: FeedSnapshot): Set<string>
```

It returns the ids that should animate, and it returns nothing at all when:

- `previous` is `null` — the first render is not an arrival
- `next.page !== 0` — arrivals happen at the tip; other pages are history
- `next.query !== previous.query` — a changed filter rebuilt the list, it did not receive anything
- `previous.ids` is empty — the first fill of an empty list is not an arrival either
- the leading run of new ids exceeds **8** — past that, highlighting is a wall of green, and the height and border flash carry the block on their own (decision 9)

Otherwise it returns the leading run: ids present in `next.ids` but not in `previous.ids`, counted from the top and stopping at the first id the previous snapshot also had. The cap on the leading run matters because the feed mixes unconfirmed with confirmed transactions, so an existing transaction can move position when it confirms; only genuinely new material at the tip may flare.

Its failure mode is why it is tested: a wrong answer does not look like a bug, it looks like thirty rows flaring at once, and it happens while paging or searching — not in the minute anyone spends admiring the animation.

## Testing

`arrivals.test.ts` beside it, covering each silent case and the leading-run boundary. It follows the convention every judgement-bearing module in `src/lib` already keeps, from `paginate` to `txSummary`.

Nothing else is tested automatically. `vitest` runs on `environment: 'node'` with no DOM, the project has no component tests, and animation is the worst possible subject for one. The visual result is judged by hand under `bun run dev`, in all five themes, with the motion switch in both positions and with the operating system's reduced-motion preference both set and unset.

## Files

New: `src/motion/tokens.ts`, `MotionProvider.tsx`, `motion.css`, `arrivals.ts`, `arrivals.test.ts`, `useChainPulse.ts`, `index.ts`; `src/components/controls/MotionToggle.tsx`.

Changed: `src/main.tsx`, `src/index.css` (narrowing the reduced-motion block), `src/VENDORED.md`, `src/routes/__root.tsx`, `src/components/AppHeader.tsx`, `src/components/console/Header.tsx`, `ConsoleShell.tsx`, `Modal.tsx`, `DidLink.tsx`, `Countdown.tsx`, `Pager.tsx`, `views/TransactionsView.tsx`, `views/TransactionRow.tsx`, `views/BlocksView.tsx`, `views/BlockRow.tsx`, `views/Balance.tsx`, `src/hooks/useBlockChime.ts`, `src/components/Logomark.tsx`, `src/components/controls/ThemeSwitcher.tsx` (token names), `src/components/ui/Card.tsx` and `src/components/console/{ConsoleButton,Toggle,Select}.tsx` (token names), and the ten files under `src/i18n/locales/`.

## Out of scope

Page transitions between the start page, the console and the scenario editor. Animation inside the scenario editor and the tour overlay. Any change to the sound palette beyond giving the console the chime that already exists.
