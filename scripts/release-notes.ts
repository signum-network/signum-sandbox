#!/usr/bin/env bun
// Prints the body of a GitHub release to stdout, for
// `gh release create --notes-file`. It lives here rather than in the workflow
// because a release note is text with decisions in it — which changelog
// section, which fallback, which versions are inside — and the workflow is the
// one file in this repository nobody can run locally.
//
//   bun scripts/release-notes.ts > notes.md
import { existsSync, readFileSync } from 'node:fs'
import { pinnedValue, releaseNotesSection } from './version'

const REPO = 'signum-network/signum-sandbox'

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '')

const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
const node = read('.signum-node-version').trim()
const jre = pinnedValue(read('scripts/jre.pinned'), 'JRE_VERSION')

if (!node) {
  console.error('release-notes: .signum-node-version is empty')
  process.exit(1)
}
if (!jre) {
  // Worth failing the release over: a note that promises "Java" and names no
  // version is worse than no release, and it cannot be corrected once people
  // have read it.
  console.error('release-notes: scripts/jre.pinned has no JRE_VERSION')
  process.exit(1)
}

// Missing for anything released before changesets was in use — 0.0.1 is the
// only such release, and saying so is better than an empty heading.
const changed =
  releaseNotesSection(read('CHANGELOG.md'), version) ??
  'The sandbox to start building cool blockchain apps with Signum — no costs, no risk,\nno friction. The changelog starts with the next release.'

console.log(`${changed}

## Install

\`\`\`sh
curl -fsSL https://github.com/${REPO}/releases/latest/download/install.sh | sh
\`\`\`

Then run \`signum-sandbox\` and open <http://localhost:6876/>. It brings its own Java,
so there is nothing to install first.

An installation that already exists takes this release with \`signum-sandbox update\`,
and can go back with \`signum-sandbox rollback\`.

On Windows, download the zip below, unpack it and run \`scripts\\start.cmd\`; you need a
Java 21 runtime of your own there.

## Inside

| | |
|---|---|
| signum-node | ${node} |
| Java | Temurin ${jre}, fetched while installing |
`)
