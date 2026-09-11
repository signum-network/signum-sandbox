# Signum Sandbox UI Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A start page served by the local mock node at `http://localhost:6876/`, showing live node state and linking to the API docs, together with the bootstrap and packaging scripts that make the repository workable for developers and shippable to non-developers.

**Architecture:** The repository holds only the sandbox UI and its packaging. A bootstrap script pulls the node jar, the compiled API docs and the node's default configuration from a pinned `signum-node` GitHub release. Vite builds the UI into `html/sandbox`, which the node serves at `/` via `API.UI_Dir`. The UI is a single React SPA using hash routing, styled with a design system vendored from `signum-node/web`, and talks to the node through SignumJS.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind 4, TanStack Router (hash history) + TanStack Query, framer-motion, i18next, SignumJS 3, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-09-11-sandbox-ui-foundation-design.md`

---

## File Structure

Committed:

| File | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | project scaffold; Vite builds to `html/sandbox` |
| `.signum-node-version` | the pinned node release, single source of truth |
| `scripts/bootstrap.sh` | pulls node artifacts; vendors Bun only if no runtime exists |
| `scripts/start.sh` | starts the node headless from the repo root |
| `scripts/smoke.sh` | starts the node, asserts the mounts respond, shuts down |
| `scripts/package.sh` | assembles and zips the release deliverable |
| `conf/node.properties` | mock network configuration; ours, committed |
| `src/theme/`, `src/audio/`, `src/components/ui/`, `src/lib/utils.ts`, `src/index.css` | vendored design system |
| `src/i18n/` | i18next setup and ten locale files |
| `src/lib/ledger.ts` | SignumJS client, configured once |
| `src/lib/nodeState.ts` | pure derivation of view state from API responses |
| `src/hooks/useNodeState.ts` | wires queries + socket to `nodeState.ts` |
| `src/components/startpage/` | `StatusHeader`, `NodeStatePanel`, `EntryList` |
| `src/routes/`, `src/main.tsx` | hash router and app entry |

Gitignored artifacts after bootstrap: `signum-node.jar`, `conf/node-default.properties`, `conf/logging-default.properties`, `html/api-doc/`, `html/sandbox/`, `.tools/`, `LICENSE-signum-node.txt`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.signum-node-version`, `src/vite-env.d.ts`, `src/main.tsx`, `src/index.css`

- [ ] **Step 1: Create `.signum-node-version`**

```
3.9.11
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "signum-sandbox",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "bootstrap": "./scripts/bootstrap.sh",
    "start": "./scripts/start.sh",
    "smoke": "./scripts/smoke.sh",
    "package": "./scripts/package.sh"
  },
  "dependencies": {
    "@signumjs/core": "^3.3.4",
    "@signumjs/util": "^3.3.4",
    "@tanstack/react-query": "^5.80.0",
    "@tanstack/react-router": "^1.120.0",
    "clsx": "^2.1.1",
    "framer-motion": "^11.18.0",
    "i18next": "^26.2.0",
    "i18next-browser-languagedetector": "^8.2.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-i18next": "^17.0.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.8",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.5.0",
    "tailwindcss": "^4.1.8",
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 3: Create `vite.config.ts`**

The build output goes straight into `html/sandbox`, which is what `API.UI_Dir` points at. `base` stays `/` because the node serves the SPA at the root.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const nodeUrl = process.env.VITE_NODE_URL ?? 'http://localhost:6876'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: nodeUrl, changeOrigin: true },
      '/events': { target: nodeUrl, changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'html/sandbox',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Orbitron:wght@400;500;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <title>Signum Sandbox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

Without this, `import.meta.env.VITE_NODE_URL` and `VITE_WS_URL` fail to
type-check under `strict`.

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_URL?: string
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 7: Create a placeholder `src/main.tsx` and `src/index.css`**

`src/index.css`:

```css
@import "tailwindcss";
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p>Signum Sandbox</p>
  </StrictMode>,
)
```

- [ ] **Step 8: Install and verify the build**

Run: `bun install && bun run build`
Expected: build succeeds and `html/sandbox/index.html` exists. Verify with `ls html/sandbox/`.

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lock tsconfig.json vite.config.ts index.html .signum-node-version src/vite-env.d.ts src/main.tsx src/index.css
git commit -m "feat: scaffold the Vite project building into html/sandbox"
```

---

### Task 2: Bootstrap script

Pulls the pinned node release and, only if the machine has neither Bun nor Node, fetches a pinned Bun into `.tools/`.

**Files:**
- Create: `scripts/bootstrap.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Create `scripts/bootstrap.sh`**

```sh
#!/bin/sh
# Pulls the artifacts the sandbox needs from a signum-node release.
# Nothing this script writes belongs in git; see .gitignore.
set -eu

REPO="signum-network/signum-node"
BUN_VERSION="1.2.15"

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(cat .signum-node-version)
if [ "${1:-}" = "--latest" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | sed -n 's/.*"tag_name"[ ]*:[ ]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
  [ -n "$VERSION" ] || { echo "bootstrap: could not resolve the latest release" >&2; exit 1; }
  echo "bootstrap: resolved latest release as $VERSION"
  echo "bootstrap: .signum-node-version still pins $(cat .signum-node-version)"
fi

ZIP="signum-node-v${VERSION}.zip"
URL="https://github.com/$REPO/releases/download/v${VERSION}/${ZIP}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "bootstrap: fetching $URL"
curl -fL --progress-bar -o "$TMP/$ZIP" "$URL" \
  || { echo "bootstrap: download failed: $URL" >&2; exit 1; }
unzip -q "$TMP/$ZIP" -d "$TMP/x"

for required in signum-node.jar conf/node-default.properties conf/logging-default.properties html/api-doc LICENSE.txt; do
  [ -e "$TMP/x/$required" ] || { echo "bootstrap: release is missing $required" >&2; exit 1; }
done

mkdir -p conf html
cp "$TMP/x/signum-node.jar" ./signum-node.jar
cp "$TMP/x/conf/node-default.properties" conf/node-default.properties
cp "$TMP/x/conf/logging-default.properties" conf/logging-default.properties
cp "$TMP/x/LICENSE.txt" ./LICENSE-signum-node.txt
rm -rf html/api-doc
cp -R "$TMP/x/html/api-doc" html/api-doc
echo "bootstrap: node artifacts in place (v$VERSION)"

if command -v bun >/dev/null 2>&1 || command -v node >/dev/null 2>&1; then
  echo "bootstrap: a JavaScript runtime is already installed, not fetching Bun"
else
  ARCH=$(uname -m)
  case "$ARCH" in
    arm64|aarch64) BUN_ARCH="aarch64" ;;
    *)             BUN_ARCH="x64" ;;
  esac
  case "$(uname -s)" in
    Darwin) BUN_OS="darwin" ;;
    Linux)  BUN_OS="linux" ;;
    *)      echo "bootstrap: unsupported platform $(uname -s); install Bun or Node manually" >&2; exit 1 ;;
  esac
  BUN_ZIP="bun-${BUN_OS}-${BUN_ARCH}.zip"
  BUN_URL="https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ZIP}"
  echo "bootstrap: no runtime found, fetching $BUN_URL"
  mkdir -p .tools
  curl -fL --progress-bar -o "$TMP/$BUN_ZIP" "$BUN_URL" \
    || { echo "bootstrap: download failed: $BUN_URL" >&2; exit 1; }
  unzip -q -o "$TMP/$BUN_ZIP" -d .tools
  echo "bootstrap: Bun $BUN_VERSION in .tools/bun-${BUN_OS}-${BUN_ARCH}/bun"
fi

echo "bootstrap: done"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/bootstrap.sh`

- [ ] **Step 3: Add the node licence to `.gitignore`**

Append to `.gitignore` under the artifacts block:

```
LICENSE-signum-node.txt
```

- [ ] **Step 4: Run it and verify every artifact arrived**

Run: `./scripts/bootstrap.sh`
Then: `ls -la signum-node.jar conf/node-default.properties conf/logging-default.properties html/api-doc/index.html LICENSE-signum-node.txt`
Expected: all five exist; the jar is roughly 60 MB.

- [ ] **Step 5: Verify a bad version fails loudly rather than half-writing**

Run: `printf '0.0.0' > /tmp/v && cp .signum-node-version /tmp/keep && cp /tmp/v .signum-node-version && ./scripts/bootstrap.sh; echo "exit=$?"; cp /tmp/keep .signum-node-version`
Expected: prints `bootstrap: download failed: …0.0.0.zip` and `exit=1`.

- [ ] **Step 6: Verify nothing fetched shows up in git**

Run: `git status --short`
Expected: only `scripts/bootstrap.sh` and the modified `.gitignore` appear.

- [ ] **Step 7: Commit**

```bash
git add scripts/bootstrap.sh .gitignore
git commit -m "feat: bootstrap script pulling node artifacts from a pinned release"
```

---

### Task 3: Mock node configuration and start script

**Files:**
- Create: `conf/node.properties`, `scripts/start.sh`

- [ ] **Step 1: Create `conf/node.properties`**

`API.UI_Dir` is what makes the node serve our build at `/`. The rest turns the node into an offline mock chain.

```properties
# Signum Sandbox - mock node configuration.
# Values here override conf/node-default.properties, which comes from the
# node release and is not ours to edit.

# Offline mock network: no peers, and any nonce is accepted as valid.
node.network = signum.net.MockNetwork

# Serve the sandbox UI at /
API.UI_Dir = html/sandbox

# Serve the API docs at /api-doc/
API.DocMode = modern

DB.Url = jdbc:sqlite:file:./db/signum-sandbox.sqlite.db
DB.Optimize = off
```

- [ ] **Step 2: Create `scripts/start.sh`**

```sh
#!/bin/sh
# Starts the sandbox node. Headless by default; pass --gui for the node's
# own Swing window.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ -f signum-node.jar ] || { echo "start: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -f html/sandbox/index.html ] || echo "start: warning - html/sandbox/index.html missing, / will 404 until you run 'bun run build'" >&2

MODE="--headless"
if [ "${1:-}" = "--gui" ]; then
  MODE=""
  shift
fi

echo "start: http://localhost:6876/"
# shellcheck disable=SC2086
exec java -jar signum-node.jar $MODE -c ./conf/
```

- [ ] **Step 3: Make it executable**

Run: `chmod +x scripts/start.sh`

- [ ] **Step 4: Verify the node starts and serves the scaffold**

Run in one terminal: `./scripts/start.sh`
Then in another: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:6876/index.html` and `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:6876/api-doc/index.html`
Expected: `200` for both. The startup log must contain `Running in headless mode` and `Running network: Signum-LOCAL-MOCK`, and must **not** contain `MetricsPanel`.
Stop the node with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add conf/node.properties scripts/start.sh
git commit -m "feat: mock node configuration and headless start script"
```

---

### Task 4: Vendor the design system

Copied verbatim from `signum-node/web` so that later improvements there remain cheap to pick up. Only what the start page needs is taken; the rest of the reference's `components/ui` is left behind until something uses it.

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/themes.ts`, `src/theme/ThemeProvider.tsx`, `src/audio/synth.ts`, `src/audio/sounds.ts`, `src/audio/AudioProvider.tsx`, `src/audio/index.ts`, `src/components/ui/Card.tsx`, `src/components/ui/AnimatedNumber.tsx`, `src/components/ui/InfoTooltip.tsx`, `src/components/ui/index.ts`, `src/components/controls/AudioToggle.tsx`, `src/components/controls/ThemeSwitcher.tsx`, `src/lib/utils.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Copy the files**

```bash
REF=/Users/oliverhager/Code/signum/signum-node/web/src
mkdir -p src/theme src/audio src/components/ui src/lib
cp "$REF"/theme/tokens.ts "$REF"/theme/themes.ts "$REF"/theme/ThemeProvider.tsx src/theme/
cp "$REF"/audio/synth.ts "$REF"/audio/sounds.ts "$REF"/audio/AudioProvider.tsx "$REF"/audio/index.ts src/audio/
cp "$REF"/components/ui/Card.tsx "$REF"/components/ui/AnimatedNumber.tsx "$REF"/components/ui/InfoTooltip.tsx src/components/ui/
mkdir -p src/components/controls
cp "$REF"/components/layout/topbar/components/AudioToggle.tsx src/components/controls/
cp "$REF"/components/layout/topbar/components/ThemeSwitcher.tsx src/components/controls/
cp "$REF"/lib/utils.ts src/lib/
cp "$REF"/index.css src/index.css
```

`AudioToggle` and `ThemeSwitcher` import only `framer-motion`, `@/audio` and
`@/theme/*`, all of which are vendored above, so they compile unchanged.

- [ ] **Step 2: Write `src/components/ui/index.ts`**

The reference's barrel exports primitives we did not copy, so write a fresh one covering only what is here.

```ts
export { Card, CardLabel, CardSub, CardSkeleton } from './Card'
export { AnimatedNumber } from './AnimatedNumber'
export { InfoTooltip } from './InfoTooltip'
```

- [ ] **Step 3: Honour reduced-motion preferences**

The reference CSS does not do this, and the spec requires it. Append to `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: Record where the files came from**

Create `src/VENDORED.md`:

```markdown
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
```

- [ ] **Step 5: Verify it compiles**

Run: `bun run build`
Expected: build succeeds. If `tsc` reports an unused import in a copied file, delete only that import — do not restructure vendored code.

- [ ] **Step 6: Commit**

```bash
git add src/theme src/audio src/components/ui src/components/controls src/lib/utils.ts src/index.css src/VENDORED.md
git commit -m "feat: vendor theme, audio and UI primitives from signum-node/web"
```

---

### Task 5: i18n setup and locales

The setup follows the reference; the strings are ours, because the reference's are about the node dashboard.

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/locales/{en,de,es,pt,uk,ru,zh,ja,ko,hi}.ts`

- [ ] **Step 1: Create `src/i18n/locales/en.ts`**

```ts
export default {
  tagline: 'Your own blockchain. No costs, no risk, no friction.',
  status: {
    live: 'live',
    polling: 'polling',
    offline: 'offline',
    scanning: 'scanning',
  },
  panel: { nodeState: 'Node State' },
  tile: {
    height: 'Block Height',
    lastBlock: 'Last Block',
    difficulty: 'Cumulative Difficulty',
  },
  entry: {
    apiDocs: { title: 'API Docs', description: 'Try the full JSON API interactively' },
    dashboard: { title: 'Mock Node Dashboard', description: 'Forge blocks, explore accounts and transactions' },
    comingSoon: 'coming next',
  },
  unreachable: {
    title: 'No node at {{host}}',
    description: 'Start it with ./scripts/start.sh',
  },
} as const
```

- [ ] **Step 2: Create the nine other locales**

Same key structure throughout. `src/i18n/locales/de.ts`:

```ts
export default {
  tagline: 'Deine eigene Blockchain. Keine Kosten, kein Risiko, keine Reibung.',
  status: { live: 'live', polling: 'Abfrage', offline: 'offline', scanning: 'Scan läuft' },
  panel: { nodeState: 'Node-Zustand' },
  tile: { height: 'Blockhöhe', lastBlock: 'Letzter Block', difficulty: 'Kumulative Schwierigkeit' },
  entry: {
    apiDocs: { title: 'API-Doku', description: 'Die komplette JSON-API interaktiv ausprobieren' },
    dashboard: { title: 'Mock-Node-Dashboard', description: 'Blöcke forgen, Accounts und Transaktionen erkunden' },
    comingSoon: 'kommt als Nächstes',
  },
  unreachable: { title: 'Kein Node auf {{host}}', description: 'Starte ihn mit ./scripts/start.sh' },
} as const
```

`src/i18n/locales/es.ts`:

```ts
export default {
  tagline: 'Tu propia blockchain. Sin costes, sin riesgo, sin fricción.',
  status: { live: 'en vivo', polling: 'consultando', offline: 'sin conexión', scanning: 'escaneando' },
  panel: { nodeState: 'Estado del nodo' },
  tile: { height: 'Altura de bloque', lastBlock: 'Último bloque', difficulty: 'Dificultad acumulada' },
  entry: {
    apiDocs: { title: 'Documentación API', description: 'Prueba toda la API JSON de forma interactiva' },
    dashboard: { title: 'Panel del nodo mock', description: 'Forja bloques, explora cuentas y transacciones' },
    comingSoon: 'próximamente',
  },
  unreachable: { title: 'No hay nodo en {{host}}', description: 'Inícialo con ./scripts/start.sh' },
} as const
```

`src/i18n/locales/pt.ts`:

```ts
export default {
  tagline: 'A sua própria blockchain. Sem custos, sem risco, sem atrito.',
  status: { live: 'ao vivo', polling: 'consultando', offline: 'desligado', scanning: 'a analisar' },
  panel: { nodeState: 'Estado do nó' },
  tile: { height: 'Altura do bloco', lastBlock: 'Último bloco', difficulty: 'Dificuldade acumulada' },
  entry: {
    apiDocs: { title: 'Documentação da API', description: 'Experimente toda a API JSON de forma interativa' },
    dashboard: { title: 'Painel do nó mock', description: 'Forje blocos, explore contas e transações' },
    comingSoon: 'em breve',
  },
  unreachable: { title: 'Nenhum nó em {{host}}', description: 'Inicie-o com ./scripts/start.sh' },
} as const
```

`src/i18n/locales/uk.ts`:

```ts
export default {
  tagline: 'Власний блокчейн. Без витрат, без ризику, без перешкод.',
  status: { live: 'наживо', polling: 'опитування', offline: 'офлайн', scanning: 'сканування' },
  panel: { nodeState: 'Стан вузла' },
  tile: { height: 'Висота блоку', lastBlock: 'Останній блок', difficulty: 'Сукупна складність' },
  entry: {
    apiDocs: { title: 'Документація API', description: 'Інтерактивно спробуйте повний JSON API' },
    dashboard: { title: 'Панель мок-вузла', description: 'Кувати блоки, досліджувати рахунки й транзакції' },
    comingSoon: 'незабаром',
  },
  unreachable: { title: 'Немає вузла на {{host}}', description: 'Запустіть його через ./scripts/start.sh' },
} as const
```

`src/i18n/locales/ru.ts`:

```ts
export default {
  tagline: 'Собственный блокчейн. Без затрат, без риска, без трения.',
  status: { live: 'в эфире', polling: 'опрос', offline: 'офлайн', scanning: 'сканирование' },
  panel: { nodeState: 'Состояние узла' },
  tile: { height: 'Высота блока', lastBlock: 'Последний блок', difficulty: 'Совокупная сложность' },
  entry: {
    apiDocs: { title: 'Документация API', description: 'Интерактивно опробуйте весь JSON API' },
    dashboard: { title: 'Панель мок-узла', description: 'Ковать блоки, изучать счета и транзакции' },
    comingSoon: 'скоро',
  },
  unreachable: { title: 'Нет узла на {{host}}', description: 'Запустите его через ./scripts/start.sh' },
} as const
```

`src/i18n/locales/zh.ts`:

```ts
export default {
  tagline: '你自己的区块链。零成本、零风险、零阻力。',
  status: { live: '实时', polling: '轮询中', offline: '离线', scanning: '扫描中' },
  panel: { nodeState: '节点状态' },
  tile: { height: '区块高度', lastBlock: '最新区块', difficulty: '累计难度' },
  entry: {
    apiDocs: { title: 'API 文档', description: '交互式体验完整的 JSON API' },
    dashboard: { title: '模拟节点面板', description: '铸造区块，浏览账户与交易' },
    comingSoon: '即将推出',
  },
  unreachable: { title: '{{host}} 上没有节点', description: '用 ./scripts/start.sh 启动它' },
} as const
```

`src/i18n/locales/ja.ts`:

```ts
export default {
  tagline: '自分だけのブロックチェーン。コストなし、リスクなし、摩擦なし。',
  status: { live: 'ライブ', polling: 'ポーリング中', offline: 'オフライン', scanning: 'スキャン中' },
  panel: { nodeState: 'ノードの状態' },
  tile: { height: 'ブロック高', lastBlock: '最新ブロック', difficulty: '累積難易度' },
  entry: {
    apiDocs: { title: 'API ドキュメント', description: 'JSON API をインタラクティブに試す' },
    dashboard: { title: 'モックノード ダッシュボード', description: 'ブロックを生成し、アカウントと取引を確認' },
    comingSoon: '近日公開',
  },
  unreachable: { title: '{{host}} にノードがありません', description: './scripts/start.sh で起動してください' },
} as const
```

`src/i18n/locales/ko.ts`:

```ts
export default {
  tagline: '나만의 블록체인. 비용도, 위험도, 마찰도 없이.',
  status: { live: '실시간', polling: '폴링 중', offline: '오프라인', scanning: '스캔 중' },
  panel: { nodeState: '노드 상태' },
  tile: { height: '블록 높이', lastBlock: '마지막 블록', difficulty: '누적 난이도' },
  entry: {
    apiDocs: { title: 'API 문서', description: '전체 JSON API를 대화식으로 사용해 보기' },
    dashboard: { title: '모의 노드 대시보드', description: '블록 생성, 계정과 트랜잭션 탐색' },
    comingSoon: '곧 제공',
  },
  unreachable: { title: '{{host}}에 노드가 없습니다', description: './scripts/start.sh 로 시작하세요' },
} as const
```

`src/i18n/locales/hi.ts`:

```ts
export default {
  tagline: 'आपकी अपनी ब्लॉकचेन। कोई लागत नहीं, कोई जोखिम नहीं, कोई अड़चन नहीं।',
  status: { live: 'लाइव', polling: 'पोलिंग', offline: 'ऑफ़लाइन', scanning: 'स्कैन जारी' },
  panel: { nodeState: 'नोड स्थिति' },
  tile: { height: 'ब्लॉक ऊँचाई', lastBlock: 'अंतिम ब्लॉक', difficulty: 'संचयी कठिनाई' },
  entry: {
    apiDocs: { title: 'API दस्तावेज़', description: 'पूरे JSON API को इंटरैक्टिव रूप से आज़माएँ' },
    dashboard: { title: 'मॉक नोड डैशबोर्ड', description: 'ब्लॉक बनाएँ, खाते और लेनदेन देखें' },
    comingSoon: 'जल्द आ रहा है',
  },
  unreachable: { title: '{{host}} पर कोई नोड नहीं', description: 'इसे ./scripts/start.sh से शुरू करें' },
} as const
```

- [ ] **Step 3: Create `src/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en'
import de from './locales/de'
import es from './locales/es'
import pt from './locales/pt'
import uk from './locales/uk'
import ru from './locales/ru'
import zh from './locales/zh'
import ja from './locales/ja'
import ko from './locales/ko'
import hi from './locales/hi'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }, de: { translation: de }, es: { translation: es },
      pt: { translation: pt }, uk: { translation: uk }, ru: { translation: ru },
      zh: { translation: zh }, ja: { translation: ja }, ko: { translation: ko },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

export default i18n
```

- [ ] **Step 4: Verify every locale carries the same keys**

Create `src/i18n/locales/locales.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import en from './en'
import de from './de'
import es from './es'
import pt from './pt'
import uk from './uk'
import ru from './ru'
import zh from './zh'
import ja from './ja'
import ko from './ko'
import hi from './hi'

const flatten = (o: unknown, prefix = ''): string[] =>
  typeof o === 'object' && o !== null
    ? Object.entries(o).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix]

describe('locales', () => {
  const expected = flatten(en).sort()
  it.each([
    ['de', de], ['es', es], ['pt', pt], ['uk', uk], ['ru', ru],
    ['zh', zh], ['ja', ja], ['ko', ko], ['hi', hi],
  ])('%s has exactly the English key set', (_name, locale) => {
    expect(flatten(locale).sort()).toEqual(expected)
  })
})
```

- [ ] **Step 5: Run the test**

Run: `bun run test src/i18n/locales/locales.test.ts`
Expected: 9 tests pass. If one fails it names the drifting key — fix the locale, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/i18n
git commit -m "feat: i18next setup with ten locales"
```

---

### Task 6: SignumJS ledger client

**Files:**
- Create: `src/lib/ledger.ts`

- [ ] **Step 1: Create `src/lib/ledger.ts`**

The single place that knows the node address. In development Vite proxies `/api` to the node, so the same-origin default works in both modes. Only reads happen in this step, hence the read-only client; swapping in `LedgerClientFactory.createClient` later for signing does not change call sites.

```ts
import { createReadOnlyClient } from '@signumjs/core'

/** Same origin in production (the node serves us); the Vite proxy handles development. */
export const nodeHost = import.meta.env.VITE_NODE_URL ?? window.location.origin

export const ledger = createReadOnlyClient({ nodeHost })
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ledger.ts
git commit -m "feat: SignumJS read-only client"
```

---

### Task 7: Derive view state from the node responses

All the decisions the page makes live here as pure functions, so they are testable without a DOM.

**Files:**
- Create: `src/lib/nodeState.ts`, `src/lib/nodeState.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/nodeState.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveNodeState, relativeParts, type DeriveInput } from './nodeState'

const status = {
  numberOfBlocks: 1284,
  version: 'v3.9.11',
  cumulativeDifficulty: '1006632960',
  isScanning: false,
}

const base: DeriveInput = {
  status,
  lastBlockMs: 1_000_000,
  networkName: 'Signum-LOCAL-MOCK',
  statusFailed: false,
  socketConnected: true,
  now: 1_012_000,
}

describe('deriveNodeState', () => {
  it('reports the node as unreachable when the status call failed and nothing is cached', () => {
    expect(deriveNodeState({ ...base, status: undefined, statusFailed: true }))
      .toEqual({ kind: 'unreachable' })
  })

  it('keeps showing the last known status when a later call fails', () => {
    const state = deriveNodeState({ ...base, statusFailed: true })
    expect(state.kind).toBe('ready')
    if (state.kind !== 'ready') return
    expect(state.height).toBe(1284)
    expect(state.connection).toBe('live')
  })

  it('maps a healthy response onto the tiles', () => {
    const state = deriveNodeState(base)
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state).toMatchObject({
      networkName: 'Signum-LOCAL-MOCK',
      version: 'v3.9.11',
      height: 1284,
      cumulativeDifficulty: '1006632960',
      lastBlockAgeMs: 12_000,
      connection: 'live',
      scanning: false,
    })
  })

  it('falls back to polling when the socket is down', () => {
    const state = deriveNodeState({ ...base, socketConnected: false })
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state.connection).toBe('polling')
  })

  it('yields null values rather than throwing while the first response is in flight', () => {
    const state = deriveNodeState({
      statusFailed: false, socketConnected: false, now: 0,
    })
    expect(state).toEqual({
      kind: 'ready', networkName: null, version: null, height: null,
      cumulativeDifficulty: null, lastBlockAgeMs: null,
      connection: 'polling', scanning: false,
    })
  })

  it('does not report a negative age when the node clock runs ahead', () => {
    const state = deriveNodeState({ ...base, now: base.lastBlockMs! - 5_000 })
    if (state.kind !== 'ready') throw new Error('expected ready')
    expect(state.lastBlockAgeMs).toBe(0)
  })
})

describe('relativeParts', () => {
  it.each([
    [0, { value: 0, unit: 'second' }],
    [5_000, { value: -5, unit: 'second' }],
    [90_000, { value: -1, unit: 'minute' }],
    [3 * 3_600_000, { value: -3, unit: 'hour' }],
    [50 * 3_600_000, { value: -2, unit: 'day' }],
  ])('renders %ims as %o', (ageMs, expected) => {
    expect(relativeParts(ageMs)).toEqual(expected)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run test src/lib/nodeState.test.ts`
Expected: FAIL — `Failed to resolve import "./nodeState"`.

- [ ] **Step 3: Write `src/lib/nodeState.ts`**

```ts
export type Connection = 'live' | 'polling'

export interface DeriveInput {
  /** Last successful getBlockchainStatus, if one has arrived. */
  status?: {
    numberOfBlocks: number
    version: string
    cumulativeDifficulty: string
    isScanning: boolean
  }
  /** Timestamp of the last block in epoch milliseconds. */
  lastBlockMs?: number
  networkName?: string
  statusFailed: boolean
  socketConnected: boolean
  now: number
}

export type NodeState =
  | { kind: 'unreachable' }
  | {
      kind: 'ready'
      networkName: string | null
      version: string | null
      height: number | null
      cumulativeDifficulty: string | null
      lastBlockAgeMs: number | null
      connection: Connection
      scanning: boolean
    }

/**
 * A failed call only means "unreachable" while we have never had an answer.
 * Once a status is known we keep showing it: a mock node gets restarted often,
 * and blanking the page on every restart would be noise, not information.
 */
export function deriveNodeState(input: DeriveInput): NodeState {
  if (input.statusFailed && !input.status) return { kind: 'unreachable' }

  return {
    kind: 'ready',
    networkName: input.networkName ?? null,
    version: input.status?.version ?? null,
    height: input.status?.numberOfBlocks ?? null,
    cumulativeDifficulty: input.status?.cumulativeDifficulty ?? null,
    lastBlockAgeMs:
      input.lastBlockMs === undefined ? null : Math.max(0, input.now - input.lastBlockMs),
    connection: input.socketConnected ? 'live' : 'polling',
    scanning: input.status?.isScanning ?? false,
  }
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * Picks the coarsest unit that still reads naturally, for Intl.RelativeTimeFormat.
 * Returns negative values because every age is in the past.
 */
export function relativeParts(ageMs: number): {
  value: number
  unit: Intl.RelativeTimeFormatUnit
} {
  const age = Math.max(0, ageMs)
  if (age < MINUTE) return { value: -Math.floor(age / 1000), unit: 'second' }
  if (age < HOUR) return { value: -Math.floor(age / MINUTE), unit: 'minute' }
  if (age < DAY) return { value: -Math.floor(age / HOUR), unit: 'hour' }
  return { value: -Math.floor(age / DAY), unit: 'day' }
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test src/lib/nodeState.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nodeState.ts src/lib/nodeState.test.ts
git commit -m "feat: pure derivation of the start page view state"
```

---

### Task 8: Node state hook

Connects SignumJS and the node's WebSocket to the pure functions from Task 7.

**Files:**
- Create: `src/lib/socketEvents.ts`, `src/lib/socketEvents.test.ts`, `src/hooks/useNodeSocket.ts`, `src/hooks/useNodeState.ts`, `src/hooks/useBlockChime.ts`

- [ ] **Step 1: Write the failing test for the event filter**

The node emits exactly four events, verified from `WebsocketEventNames.java`:
`CONNECTED`, `BLOCK_PUSHED`, `PENDING_TRANSACTIONS_ADDED`, `HEARTBEAT`. Only two
of them change chain state. Refetching on `HEARTBEAT` would reintroduce the very
polling the socket is meant to replace, at the heartbeat interval.

`src/lib/socketEvents.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isRefetchTrigger, parseEvent } from './socketEvents'

describe('parseEvent', () => {
  it('reads the event name out of the envelope', () => {
    expect(parseEvent('{"e":"BLOCK_PUSHED","p":{"localHeight":7}}')).toBe('BLOCK_PUSHED')
  })

  it('returns null for anything unparseable', () => {
    expect(parseEvent('not json')).toBeNull()
    expect(parseEvent('{"noEventField":1}')).toBeNull()
  })
})

describe('isRefetchTrigger', () => {
  it.each([
    ['BLOCK_PUSHED', true],
    ['PENDING_TRANSACTIONS_ADDED', true],
    ['HEARTBEAT', false],
    ['CONNECTED', false],
    [null, false],
    ['SOMETHING_NEW', false],
  ])('%s -> %s', (event, expected) => {
    expect(isRefetchTrigger(event)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run test src/lib/socketEvents.test.ts`
Expected: FAIL — `Failed to resolve import "./socketEvents"`.

- [ ] **Step 3: Create `src/lib/socketEvents.ts`**

```ts
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
```

- [ ] **Step 4: Run the test**

Run: `bun run test src/lib/socketEvents.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Create `src/hooks/useNodeSocket.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isRefetchTrigger, parseEvent } from '@/lib/socketEvents'

/**
 * SIP-50 event socket.
 *
 * The node exposes /events on its dedicated WebSocket port (6877 here) and, as
 * a side effect of both connectors sharing one servlet context, on the API port
 * as well - verified against v3.9.11: both deliver byte-identical events. We
 * follow the page origin, which keeps the socket same-origin in production and
 * lets the Vite proxy handle development, with VITE_WS_URL as an escape hatch.
 *
 * No subscription message is needed; events arrive on connect.
 */
export function useNodeSocket() {
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let socket: WebSocket | undefined
    let disposed = false

    const open = () => {
      if (disposed) return
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = import.meta.env.VITE_WS_URL ?? `${scheme}://${window.location.host}/events`
      socket = new WebSocket(url)
      socket.onopen = () => setConnected(true)
      socket.onmessage = (event) => {
        if (isRefetchTrigger(parseEvent(String(event.data)))) {
          void queryClient.invalidateQueries({ queryKey: ['blockchainStatus'] })
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!disposed) retry.current = setTimeout(open, 3000)
      }
      socket.onerror = () => socket?.close()
    }

    open()
    return () => {
      disposed = true
      if (retry.current) clearTimeout(retry.current)
      socket?.close()
    }
  }, [queryClient])

  return { connected }
}
```

- [ ] **Step 6: Create `src/hooks/useNodeState.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { ChainTime } from '@signumjs/util'
import type { BlockchainStatus } from '@signumjs/core'
import { ledger, nodeHost } from '@/lib/ledger'
import { deriveNodeState, type NodeState } from '@/lib/nodeState'
import { useNodeSocket } from './useNodeSocket'

/**
 * The node returns lastBlockTimestamp - verified against v3.9.11 - but the
 * SignumJS BlockchainStatus type omits it. This is the one place that knows,
 * so the cast does not spread through the codebase.
 */
type StatusWithTimestamp = BlockchainStatus & { lastBlockTimestamp: number }
const asStatus = (s: BlockchainStatus) => s as StatusWithTimestamp

export function useNodeState(): { state: NodeState; nodeHost: string } {
  const { connected } = useNodeSocket()

  const status = useQuery({
    queryKey: ['blockchainStatus'],
    queryFn: () => ledger.network.getBlockchainStatus(),
    refetchInterval: connected ? false : 10_000,
    retry: false,
  })

  const network = useQuery({
    queryKey: ['networkInfo'],
    queryFn: () => ledger.network.getNetworkInfo(),
    staleTime: Infinity,
    retry: false,
  })

  const lastBlockMs = status.data
    ? ChainTime.fromChainTimestamp(asStatus(status.data).lastBlockTimestamp).getDate().getTime()
    : undefined

  return {
    nodeHost,
    state: deriveNodeState({
      status: status.data
        ? {
            numberOfBlocks: status.data.numberOfBlocks,
            version: status.data.version,
            cumulativeDifficulty: status.data.cumulativeDifficulty,
            isScanning: status.data.isScanning,
          }
        : undefined,
      lastBlockMs,
      networkName: network.data?.networkName,
      statusFailed: status.isError,
      socketConnected: connected,
      now: Date.now(),
    }),
  }
}
```

- [ ] **Step 7: Create `src/hooks/useBlockChime.ts`**

The spec asks for a chime on every new block. It belongs in its own hook rather
than in the socket, which must stay a transport concern — and it must not fire
on the first render, when the height merely became known.

```ts
import { useEffect, useRef } from 'react'
import { useAudio, sfx } from '@/audio'

export function useBlockChime(height: number | null) {
  const { play } = useAudio()
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (height === null) return
    if (previous.current !== null && height > previous.current) play(sfx.chime)
    previous.current = height
  }, [height, play])
}
```

- [ ] **Step 8: Verify it type-checks and that the field really arrives**

Run: `bun run build`
Expected: build succeeds.

Then, with the node running, confirm the field the cast relies on is present:
Run: `curl -s "http://localhost:6876/api?requestType=getBlockchainStatus" | grep -o 'lastBlockTimestamp'`
Expected: prints `lastBlockTimestamp`. If it does not, the cast is wrong and the
value must come from `ledger.network.getMiningInfo().timestamp` instead.

- [ ] **Step 9: Verify the heartbeat does not cause refetches**

Run: `bun run test src/lib/socketEvents.test.ts`
Expected: pass — this is the guard. Additionally, with the page open and the
socket connected, watch the browser's network panel for longer than the
heartbeat interval (30s by default): no `getBlockchainStatus` request may fire
until a block is actually forged.

- [ ] **Step 10: Commit**

```bash
git add src/lib/socketEvents.ts src/lib/socketEvents.test.ts src/hooks
git commit -m "feat: node state hook over SignumJS and the filtered event socket"
```

---

### Task 9: Start page components

Layout B: node state on the left, entry points on the right.

**Files:**
- Create: `src/components/startpage/StatusHeader.tsx`, `src/components/startpage/NodeStatePanel.tsx`, `src/components/startpage/EntryList.tsx`, `src/components/startpage/Unreachable.tsx`, `src/components/startpage/StartPage.tsx`, `src/components/startpage/index.ts`

- [ ] **Step 1: Create `src/components/startpage/StatusHeader.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import type { Connection } from '@/lib/nodeState'
import { AudioToggle } from '@/components/controls/AudioToggle'
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher'

interface Props {
  networkName: string | null
  version: string | null
  connection: Connection
  scanning: boolean
}

export function StatusHeader({ networkName, version, connection, scanning }: Props) {
  const { t } = useTranslation()
  const colour = connection === 'live' ? 'var(--green)' : 'var(--amber)'

  return (
    <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h1
          className="text-[22px] font-black tracking-[3px] text-[var(--blue3)]"
          style={{ fontFamily: 'Orbitron, ui-monospace, monospace' }}
        >
          SIGNUM SANDBOX
        </h1>
        <p className="mt-1 text-[11px] tracking-[1px] text-[var(--muted)]">{t('tagline')}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] tracking-[1px] text-[var(--muted)]">
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: colour, boxShadow: `0 0 6px ${colour}` }}
          />
          <span>{t(`status.${connection}`)}</span>
          {networkName && <span>· {networkName}</span>}
          {version && <span>· {version}</span>}
          {scanning && <span>· {t('status.scanning')}</span>}
        </div>
        <AudioToggle />
        <ThemeSwitcher />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create `src/components/startpage/NodeStatePanel.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Card, CardLabel, AnimatedNumber } from '@/components/ui'
import { relativeParts } from '@/lib/nodeState'

interface Props {
  height: number | null
  lastBlockAgeMs: number | null
  cumulativeDifficulty: string | null
}

const PLACEHOLDER = '—'

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <div className="text-[20px] font-bold tracking-[-.5px] text-[var(--text)]">{children}</div>
    </div>
  )
}

export function NodeStatePanel({ height, lastBlockAgeMs, cumulativeDifficulty }: Props) {
  const { t, i18n } = useTranslation()

  const lastBlock = () => {
    if (lastBlockAgeMs === null) return PLACEHOLDER
    const { value, unit } = relativeParts(lastBlockAgeMs)
    return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(value, unit)
  }

  return (
    <Card>
      <CardLabel>{t('panel.nodeState')}</CardLabel>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
        <Metric label={t('tile.height')}>
          {height === null ? PLACEHOLDER : <AnimatedNumber value={height} />}
        </Metric>
        <Metric label={t('tile.lastBlock')}>{lastBlock()}</Metric>
        <Metric label={t('tile.difficulty')}>
          {cumulativeDifficulty === null
            ? PLACEHOLDER
            : BigInt(cumulativeDifficulty).toLocaleString(i18n.language)}
        </Metric>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Create `src/components/startpage/EntryList.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { useAudio, sfx } from '@/audio'

function Entry({
  title, description, href, disabled, badge,
}: {
  title: string
  description: string
  href?: string
  disabled?: boolean
  badge?: string
}) {
  const { play } = useAudio()
  const className =
    'relative block border p-3.5 transition-colors ' +
    (disabled
      ? 'cursor-default opacity-45'
      : 'hover:bg-[rgba(0,102,255,.16)]')

  const body = (
    <>
      <div className="text-[12px] font-bold tracking-[1px] text-[var(--blue3)]">
        ▸ {title.toUpperCase()}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
        {description}
        {badge && <> · {badge}</>}
      </div>
    </>
  )

  const style = {
    background: 'rgba(0,102,255,.10)',
    borderColor: 'var(--border2)',
  }

  if (disabled) return <div className={className} style={style}>{body}</div>

  return (
    <a
      className={className}
      style={style}
      href={href}
      onMouseEnter={() => play(sfx.hover)}
      onClick={() => play(sfx.click)}
    >
      {body}
    </a>
  )
}

export function EntryList() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Entry
        title={t('entry.apiDocs.title')}
        description={t('entry.apiDocs.description')}
        href="/api-doc/"
      />
      <Entry
        title={t('entry.dashboard.title')}
        description={t('entry.dashboard.description')}
        badge={t('entry.comingSoon')}
        disabled
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/startpage/Unreachable.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Card, CardLabel } from '@/components/ui'

export function Unreachable({ nodeHost }: { nodeHost: string }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardLabel>{t('unreachable.title', { host: nodeHost })}</CardLabel>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{t('unreachable.description')}</p>
    </Card>
  )
}
```

- [ ] **Step 5: Create `src/components/startpage/StartPage.tsx`**

```tsx
import { useNodeState } from '@/hooks/useNodeState'
import { useBlockChime } from '@/hooks/useBlockChime'
import { StatusHeader } from './StatusHeader'
import { NodeStatePanel } from './NodeStatePanel'
import { EntryList } from './EntryList'
import { Unreachable } from './Unreachable'

export function StartPage() {
  const { state, nodeHost } = useNodeState()
  useBlockChime(state.kind === 'ready' ? state.height : null)

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Unreachable nodeHost={nodeHost} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <StatusHeader
        networkName={state.networkName}
        version={state.version}
        connection={state.connection}
        scanning={state.scanning}
      />
      <div className="grid gap-3 md:grid-cols-[1.1fr_.9fr]">
        <NodeStatePanel
          height={state.height}
          lastBlockAgeMs={state.lastBlockAgeMs}
          cumulativeDifficulty={state.cumulativeDifficulty}
        />
        <EntryList />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/startpage/index.ts`**

```ts
export { StartPage } from './StartPage'
```

- [ ] **Step 7: Verify against the vendored audio module**

`src/audio/index.ts` exports `useAudio` and the sound palette as `sfx`, and
`play` takes a `SoundFn` — not a string. The code above follows that. Confirm:

Run: `grep -nE "play:|export" src/audio/index.ts src/audio/AudioProvider.tsx | grep -E "play:|useAudio|sfx"`
Expected: `play: (sound: SoundFn) => void` and the `useAudio` / `sfx` exports.
If `AudioToggle` or `ThemeSwitcher` fail to compile, fix the import paths in
*our* files, never the vendored ones.

- [ ] **Step 8: Commit**

```bash
git add src/components/startpage
git commit -m "feat: start page components in the split-console layout"
```

---

### Task 10: Router, providers and app entry

**Files:**
- Create: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/router.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  ),
})
```

- [ ] **Step 2: Create `src/routes/index.tsx`**

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { StartPage } from '@/components/startpage'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StartPage,
})
```

- [ ] **Step 3: Create `src/router.tsx`**

Hash history is what keeps a reloaded deep link working: the node's static servlet has no SPA fallback, so `/dashboard` would 404 while `/#/dashboard` never leaves `/`.

```tsx
import { createRouter, createHashHistory } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 4: Rewrite `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { AudioProvider } from '@/audio'
import { router } from './router'
import './i18n'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AudioProvider>
          <RouterProvider router={router} />
        </AudioProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Confirm the provider signatures**

`ThemeProvider` takes only `{ children }`, and `AudioProvider` is re-exported
from `@/audio` — the code above matches. Confirm:

Run: `grep -nE "export function (ThemeProvider|AudioProvider)" src/theme/ThemeProvider.tsx src/audio/AudioProvider.tsx`
Expected: both found, `ThemeProvider` with a `children` prop only.

- [ ] **Step 6: Build and look at it**

Run: `bun run build && ./scripts/start.sh`
Open `http://localhost:6876/`.
Expected: the split layout renders; the header shows `Signum-LOCAL-MOCK`, `v3.9.11` and a green `live` dot; Block Height reads 1.
Then run `curl -s -X POST "http://localhost:6876/api?requestType=submitNonce&secretPhrase=sandbox&nonce=0&accountId=0"` and confirm the height rises and `Last Block` resets without a page reload, and that a chime plays. Note that browsers keep audio muted until the page has had a click, so click somewhere first.
Stop the node.

- [ ] **Step 7: Commit**

```bash
git add src/routes src/router.tsx src/main.tsx
git commit -m "feat: hash router, providers and app entry"
```

---

### Task 11: Smoke script

Catches the failures unit tests cannot see: a wrong `API.UI_Dir`, a missing build, a broken docs mount.

**Files:**
- Create: `scripts/smoke.sh`

- [ ] **Step 1: Create `scripts/smoke.sh`**

```sh
#!/bin/sh
# Starts the node against a throwaway database, checks every mount, shuts down.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

[ -f signum-node.jar ] || { echo "smoke: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -f html/sandbox/index.html ] || { echo "smoke: html/sandbox/index.html missing - run 'bun run build'" >&2; exit 1; }
[ -f html/api-doc/index.html ] || { echo "smoke: html/api-doc missing - run ./scripts/bootstrap.sh" >&2; exit 1; }

LOG=$(mktemp)
java -jar signum-node.jar --headless -c ./conf/ > "$LOG" 2>&1 &
NODE_PID=$!
# shellcheck disable=SC2064
trap "kill $NODE_PID 2>/dev/null || true; rm -f '$LOG'" EXIT

echo "smoke: waiting for the node"
i=0
until curl -fsS "http://localhost:6876/api?requestType=getBlockchainStatus" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "smoke: node did not come up within 60s" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  sleep 1
done

FAILED=0
check() {
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:6876$1")
  if [ "$code" = "200" ]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1 -> $code"
    FAILED=1
  fi
}

check "/index.html"
check "/api-doc/index.html"
check "/api?requestType=getBlockchainStatus"

if ! grep -q "Running in headless mode" "$LOG"; then
  echo "  FAIL node did not start headless"
  FAILED=1
fi
if ! grep -q "Signum-LOCAL-MOCK" "$LOG"; then
  echo "  FAIL node is not on the mock network"
  FAILED=1
fi

[ "$FAILED" -eq 0 ] && echo "smoke: passed" || echo "smoke: failed" >&2
exit "$FAILED"
```

- [ ] **Step 2: Make it executable and run it**

Run: `chmod +x scripts/smoke.sh && ./scripts/smoke.sh`
Expected: three `ok` lines and `smoke: passed`, exit code 0.

- [ ] **Step 3: Verify it actually fails when the build is missing**

Run: `mv html/sandbox /tmp/sandbox-build && ./scripts/smoke.sh; echo "exit=$?"; mv /tmp/sandbox-build html/sandbox`
Expected: `smoke: html/sandbox/index.html missing` and `exit=1`.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.sh
git commit -m "feat: smoke script asserting the served mounts"
```

---

### Task 12: Packaging script

**Files:**
- Create: `scripts/package.sh`

- [ ] **Step 1: Create `scripts/package.sh`**

```sh
#!/bin/sh
# Assembles the deliverable a non-developer downloads from GitHub Releases.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
NODE_VERSION=$(cat .signum-node-version)
NAME="signum-sandbox-${VERSION}"
OUT="build/$NAME"

[ -f signum-node.jar ] || { echo "package: signum-node.jar missing - run ./scripts/bootstrap.sh" >&2; exit 1; }
[ -d html/api-doc ] || { echo "package: html/api-doc missing - run ./scripts/bootstrap.sh" >&2; exit 1; }

echo "package: building the UI"
bun run build

# Without this the deliverable would serve a bare 404 at / with no explanation.
[ -f html/sandbox/index.html ] || { echo "package: the UI build produced no html/sandbox/index.html" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/conf" "$OUT/html" "$OUT/scripts"

cp signum-node.jar "$OUT/"
cp conf/node.properties conf/node-default.properties conf/logging-default.properties "$OUT/conf/"
cp -R html/sandbox "$OUT/html/sandbox"
cp -R html/api-doc "$OUT/html/api-doc"
cp scripts/start.sh "$OUT/scripts/start.sh"
cp LICENSE "$OUT/LICENSE"
cp LICENSE-signum-node.txt "$OUT/LICENSE-signum-node.txt"
cp README.md "$OUT/README.md"

cat > "$OUT/VERSIONS.txt" <<EOF
signum-sandbox $VERSION
signum-node    $NODE_VERSION
EOF

( cd build && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME" )
echo "package: build/$NAME.zip"
```

- [ ] **Step 2: Make it executable and run it**

Run: `chmod +x scripts/package.sh && ./scripts/package.sh`
Expected: prints `package: build/signum-sandbox-0.1.0.zip`.

- [ ] **Step 3: Verify the deliverable runs standalone**

```bash
rm -rf /tmp/deliv && mkdir -p /tmp/deliv
unzip -q build/signum-sandbox-0.1.0.zip -d /tmp/deliv
cd /tmp/deliv/signum-sandbox-0.1.0 && ./scripts/start.sh &
sleep 45
curl -s -o /dev/null -w 'start page: %{http_code}\n' http://localhost:6876/index.html
curl -s -o /dev/null -w 'api docs:   %{http_code}\n' http://localhost:6876/api-doc/index.html
pkill -f signum-node.jar
```

Expected: `200` for both, from a directory that contains no repository and no build tooling.

- [ ] **Step 4: Commit**

```bash
git add scripts/package.sh
git commit -m "feat: packaging script assembling the release deliverable"
```

---

### Task 13: README and removal of the leftover copied files

The repository still carries files copied from the old `er1p/infra/dev-node` before the fetch-and-assemble model was decided. They are now either produced by the bootstrap or obsolete.

**Files:**
- Modify: `README.md`
- Delete: `LICENSE.txt`, `start-dev-node.sh`, `html/mock-dashboard/`

- [ ] **Step 1: Remove what the bootstrap now provides or what is obsolete**

`LICENSE.txt` is the node's GPL text and arrives as `LICENSE-signum-node.txt`. `start-dev-node.sh` is replaced by `scripts/start.sh`. `html/mock-dashboard` is the old vanilla UI, which the spec decided not to carry over; it remains in the `er1p` repository if it is ever needed again.

```bash
rm -f LICENSE.txt start-dev-node.sh
rm -rf html/mock-dashboard
```

- [ ] **Step 2: Rewrite `README.md`**

````markdown
# Signum Sandbox

The sandbox to start building cool blockchain apps with Signum — no costs, no risk, no friction.

A local Signum node running an offline mock network, with a UI built for getting started.

## For users

Download the latest release, unpack it, and run:

```bash
./scripts/start.sh
```

Then open **http://localhost:6876/**. You need Java 21 or newer.

## For developers

```bash
./scripts/bootstrap.sh   # pulls the node jar and API docs from a pinned release
bun install
bun run build            # builds the UI into html/sandbox
./scripts/start.sh       # serves it at http://localhost:6876/
```

For UI work, `bun run dev` serves the UI on http://localhost:5173 with `/api` and
`/events` proxied to the node, so changes reload without rebuilding.

| Command | Does |
|---|---|
| `./scripts/bootstrap.sh` | fetches node artifacts; `--latest` resolves the newest release |
| `./scripts/start.sh` | starts the node headless; `--gui` for the node's own window |
| `bun run test` | unit tests |
| `./scripts/smoke.sh` | starts the node and checks every mount responds |
| `./scripts/package.sh` | assembles the release deliverable |

The node version is pinned in `.signum-node-version`. Nothing the bootstrap
downloads is committed.

## What is served

| URL | |
|---|---|
| `/` | the sandbox UI |
| `/api-doc/` | the node's API documentation |
| `/api` | the node's JSON API |
| `/events` | the node's WebSocket event stream |

## Licence

This repository is MIT licensed. Released deliverables additionally contain the
Signum node, which is GPLv3; its licence ships alongside it as
`LICENSE-signum-node.txt`.
````

- [ ] **Step 3: Verify the developer path works from scratch**

```bash
git status --short
./scripts/smoke.sh
```

Expected: `git status` lists only the README change and the two deletions; smoke passes.

- [ ] **Step 4: Commit**

```bash
git add -A README.md LICENSE.txt start-dev-node.sh html
git commit -m "docs: rewrite the README and drop the copied dev-node leftovers"
```

---

## Verification checklist

Run after the last task:

- [ ] `bun run test` — all unit tests pass
- [ ] `bun run build` — clean build into `html/sandbox`
- [ ] `./scripts/smoke.sh` — every mount answers, node headless, mock network
- [ ] `./scripts/package.sh` then run the unpacked zip from `/tmp` — start page and API docs load with no repository present
- [ ] `git status --short` — clean; no jar, no `html/`, no `.tools/`
- [ ] Forge a block via `submitNonce` with the page open — height and `Last Block` update without a reload, and a chime plays after the page has been clicked once
- [ ] Toggle sound and switch theme from the header — both persist across a reload
- [ ] With `prefers-reduced-motion` enabled in the OS, reload — no animated transitions
- [ ] Switch the browser language to German and reload — the page is translated
