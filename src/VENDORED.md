# Vendored from signum-node

`theme/`, `audio/`, `components/ui/` and `lib/utils.ts` were copied from
`signum-node/web/src` (branch `feat/new-web-ui`), as was `index.css`.
`components/controls/` holds its `AudioToggle` and `ThemeSwitcher`, taken from
`components/layout/topbar/components/`.

The `prefers-reduced-motion` block at the end of `index.css` is ours, not
upstream's — keep it when re-copying that file.

They are vendored rather than shared so that the sandbox cannot be broken by
upstream changes. Keep local edits minimal: the cheaper these files are to
re-copy, the longer picking up upstream improvements stays practical.
