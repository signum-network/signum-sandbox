#!/usr/bin/env bun
// Releases the sandbox. The whole act is: pick a level, read what the commits
// since the last tag did, hand that to changesets, push. Everything after the
// push belongs to .github/workflows/release.yml, which notices that the version
// in package.json has no tag and takes it from there.
//
// The judgements live in ./version.ts, where they have tests. This file only
// carries them out, and is the reason the guards come first: nothing here may
// write anything until every one of them has passed.
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  changelogLines,
  changesetBody,
  changesetFilename,
  changesetSummary,
  effectiveLevel,
  guardVerdict,
  LEVELS,
  nextVersion,
  pendingLevels,
  releaseNotesSection,
  splitBullets,
  type Level,
} from './version'

const CHANGESETS = '.changeset'

const run = (...args: string[]) => {
  const r = Bun.spawnSync(args, { stderr: 'pipe' })
  return { ok: r.exitCode === 0, out: r.stdout.toString().trim(), err: r.stderr.toString().trim() }
}

const git = (...args: string[]) => {
  const r = run('git', ...args)
  if (!r.ok) die(`git ${args.join(' ')} scheiterte:\n${r.err}`)
  return r.out
}

const interactive = (...args: string[]) =>
  Bun.spawnSync(args, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }).exitCode === 0

function die(message: string): never {
  console.error(`\nnew-version: ${message}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { name: string; version: string }

// ── the guards, before anything is written ────────────────────────────────
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const dirty = git('status', '--porcelain').length > 0
// A missing origin/develop counts as out of sync rather than as its own error:
// the cure is the same, push develop first.
const fetched = run('git', 'fetch', '--quiet', 'origin', 'develop')
const synced =
  fetched.ok && git('rev-parse', 'HEAD') === git('rev-parse', 'FETCH_HEAD')
run('git', 'fetch', '--quiet', '--tags', 'origin')
const tags = git('tag', '--list').split('\n').filter(Boolean)

const candidates = LEVELS.map((level) => nextVersion(pkg.version, level))
const taken = candidates.filter((version) => tags.includes(`v${version}`))

const verdict = guardVerdict({ branch, dirty, synced, taken })
if (verdict !== 'ok') {
  const reason = {
    'not-develop': `der Zweig ist ${branch}, releast wird nur aus develop`,
    dirty: 'es liegen uncommittete Änderungen herum',
    'out-of-sync': fetched.ok
      ? 'develop und origin/develop sind nicht gleich — erst pushen, damit CI darauf gelaufen ist'
      : 'origin/develop existiert nicht — erst `git push -u origin develop`',
    'already-tagged': `für ${taken.join(', ')} gibt es schon ein Release`,
  }[verdict]
  die(reason)
}

// ── which level ───────────────────────────────────────────────────────────
const pending = readdirSync(CHANGESETS)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .map((name) => readFileSync(join(CHANGESETS, name), 'utf8'))
const waiting = pendingLevels(pending)

console.log(`\n  ${pkg.name} ${pkg.version}\n`)
LEVELS.forEach((level, i) => console.log(`    ${level.padEnd(6)} → ${candidates[i]}`))
if (waiting.length > 0) console.log(`\n  wartende Changesets: ${waiting.join(', ')}`)

let chosen: Level | undefined
while (!chosen) {
  const answer = (prompt('\n  patch, minor oder major? ') ?? '').trim().toLowerCase()
  if (answer === '') die('abgebrochen, nichts angefasst')
  chosen = LEVELS.find((level) => level === answer || (answer.length >= 2 && level.startsWith(answer)))
  if (!chosen && answer === 'p') chosen = 'patch'
  if (!chosen) console.log('  bitte patch, minor oder major')
}

const level = effectiveLevel(chosen, waiting)
if (level !== chosen) {
  console.log(
    `\n  Ein wartender Changeset ist ${level}, und changeset version nimmt das Maximum.\n` +
      `  Aus ${chosen} wird damit ${level}: ${pkg.version} → ${nextVersion(pkg.version, level)}`,
  )
  if ((prompt('  weiter? [j/N] ') ?? '').trim().toLowerCase() !== 'j') die('abgebrochen, nichts angefasst')
}

// ── the text, out of the commits ──────────────────────────────────────────
const lastTag = run('git', 'describe', '--tags', '--abbrev=0')
const range = lastTag.ok ? `${lastTag.out}..HEAD` : 'HEAD'
// Merges are not filtered out here but in changelogLines, so that one tested
// place decides what belongs in a changelog and this file only passes things on.
const subjects = git('log', range, '--pretty=%s').split('\n')
const lines = changelogLines(subjects)

const sha = git('rev-parse', '--short', 'HEAD')
const file = join(CHANGESETS, changesetFilename(level, sha))
writeFileSync(file, changesetBody(pkg.name, level, lines))

console.log(
  `\n  ${lines.length} Zeile(n) aus ${lastTag.ok ? lastTag.out : 'dem Anfang'}..HEAD, zum Durchsehen.\n` +
    '  Streiche, was niemanden interessiert, und formuliere um, was sich an einen\n' +
    '  Entwickler richtet statt an einen Nutzer. Leer gespeichert bricht ab.\n',
)
const editor = process.env.VISUAL || process.env.EDITOR || 'vi'
if (!interactive(editor, file)) {
  unlinkSync(file)
  die(`${editor} kam mit einem Fehler zurück, der Changeset ist wieder weg`)
}
const edited = changesetSummary(readFileSync(file, 'utf8'))
if (edited === '') {
  unlinkSync(file)
  die('leer gespeichert, der Changeset ist wieder weg — nichts released')
}

// Eine Datei je Änderung. changesets macht aus einer Datei genau einen
// Changelog-Eintrag, also wäre eine Datei mit fünf Stichpunkten ein Stichpunkt
// mit einer Liste darin. Editiert wird trotzdem nur eine.
const entries = splitBullets(edited)
unlinkSync(file)
entries.forEach((entry, i) => {
  writeFileSync(join(CHANGESETS, changesetFilename(level, `${sha}-${i + 1}`)), changesetBody(pkg.name, level, [entry]))
})
console.log(`  ${entries.length} Changeset(s) geschrieben\n`)

// ── changesets rechnet, wir schreiben nichts selbst ───────────────────────
if (!interactive('bunx', 'changeset', 'version')) die('changeset version scheiterte')

const released = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
if (tags.includes(`v${released}`)) die(`changesets kam auf ${released}, und dafür gibt es schon ein Release`)

git('add', '-A')
git('commit', '-m', `chore: release ${released}`)

const changelog = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : ''
console.log(`\n  ${pkg.name} ${released}\n`)
console.log((releaseNotesSection(changelog, released) ?? '(kein Changelog-Abschnitt)').replace(/^/gm, '  '))
console.log(
  '\n  Der Push ist der Punkt ohne Rückkehr: release.yml sieht, dass es für\n' +
    `  ${released} kein Tag gibt, prüft, baut, installiert testweise und veröffentlicht.\n`,
)
if ((prompt('  push origin develop? [j/N] ') ?? '').trim().toLowerCase() !== 'j') {
  console.log(
    `\n  Nicht gepusht. Der Bump liegt als Commit auf develop; weg damit mit\n` +
      '    git reset --hard HEAD~1\n',
  )
  process.exit(0)
}

if (!interactive('git', 'push', 'origin', 'develop')) die('der Push scheiterte, der Commit liegt noch da')
console.log(`\n  ${released} ist unterwegs. Der Lauf: gh run watch\n`)
