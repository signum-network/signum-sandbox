# Vendored from signum-node

`theme/`, `audio/`, `components/ui/` and `lib/utils.ts` were copied from
`signum-node/web/src` (branch `feat/new-web-ui`), as was `index.css`.
`components/controls/` holds its `AudioToggle` and `ThemeSwitcher`, taken from
`components/layout/topbar/components/`.

The `prefers-reduced-motion` block at the end of `index.css` is ours, not
upstream's — keep it when re-copying that file. It is scoped to
`:root:not([data-motion="on"])`: its declarations use `!important`, and the
app's own motion switch (`src/motion/`) has to be able to turn movement *on*
for someone whose system asks for less. Everything else we animate lives in
`src/motion/motion.css`, which upstream knows nothing about.

`components/ui/InfoTooltip.tsx` has two local changes to re-apply. Its panel
renders through a portal into the document body: absolutely positioned beside
its icon, it was clipped by the first ancestor with a scrollbar, and in the
console that is nearly every one of them. And every size in it moved up one
step with the rest of the app — the tooltip carries beginner mode's
explanations now, not just a hint on a card.

`components/ui/AnimatedNumber.tsx` has one local change to re-apply: it asks
`useMotion()` before animating. It uses Framer's imperative `animate()`, which
— unlike the `motion.*` components — does not read `MotionConfig`, so it is
the one place that would keep moving after the app's motion switch says stop.

`components/ui/Card.tsx` and `components/controls/{AudioToggle,ThemeSwitcher}.tsx`
take their spring settings from `src/motion/tokens.ts` instead of declaring
them inline. The numbers are unchanged — upstream's values are what the tokens
were named after — so re-copying these files means re-applying the import, not
re-deciding anything.

They are vendored rather than shared so that the sandbox cannot be broken by
upstream changes. Keep local edits minimal: the cheaper these files are to
re-copy, the longer picking up upstream improvements stays practical.
