// The judgements behind `bun run new-version` and the release notes. Everything
// here is a function of its arguments: no git, no filesystem, no prompts. That
// split is deliberate — these are the parts whose failure would be invisible by
// hand (a changelog that quietly drops a line, a guard that lets a release out
// of a stale branch), so they are the parts that get tests.

export type Level = 'patch' | 'minor' | 'major'

/** In the order we offer them, and in the order they outrank each other. */
export const LEVELS: readonly Level[] = ['patch', 'minor', 'major']

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/**
 * What the version becomes. Only plain three-part versions are accepted; this
 * project has never published a prerelease, and guessing what `0.1.0-beta.1`
 * should turn into is a decision nobody has made yet.
 */
export function nextVersion(current: string, level: Level): string {
  const parts = SEMVER.exec(current.trim())
  if (!parts) throw new Error(`not a version this script can count up: ${current}`)
  const [major, minor, patch] = parts.slice(1, 4).map(Number)
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export type Guard = 'ok' | 'not-develop' | 'dirty' | 'out-of-sync' | 'already-tagged'

/**
 * Whether the working copy may produce a release. `synced` means develop equals
 * origin/develop exactly, not merely "not behind": a release built from commits
 * that were never pushed is a release from code CI has never seen. `taken` holds
 * those of the candidate versions that already carry a tag.
 *
 * Returns the first thing that is wrong rather than all of them, so the message
 * names one fixable cause instead of a list to triage.
 */
export function guardVerdict(state: {
  branch: string
  dirty: boolean
  synced: boolean
  taken: readonly string[]
}): Guard {
  if (state.branch !== 'develop') return 'not-develop'
  if (state.dirty) return 'dirty'
  if (!state.synced) return 'out-of-sync'
  if (state.taken.length > 0) return 'already-tagged'
  return 'ok'
}

// Work that changes nothing a user can observe. Dropping it here is what makes
// the prefilled changeset readable enough to edit rather than rewrite.
const SILENT = /^(chore|ci|style|refactor|test|build)(\([^)]*\))?!?:/
const PREFIX = /^[a-z]+(\([^)]*\))?!?:\s*/

/**
 * The commit subjects since the last tag, turned into changelog material: the
 * housekeeping removed, the conventional-commit prefix stripped, the order of
 * the work kept. A subject with no prefix is kept, because there is nothing to
 * judge it by — the editor is where you drop what does not belong.
 */
export function changelogLines(subjects: readonly string[]): string[] {
  return subjects
    .map((subject) => subject.trim())
    .filter((subject) => subject.length > 0)
    .filter((subject) => !subject.startsWith('Merge '))
    .filter((subject) => !SILENT.test(subject))
    .map((subject) => subject.replace(PREFIX, '').trim())
    .filter((subject) => subject.length > 0)
}

/**
 * The bump levels of changesets that are already lying in `.changeset`, read
 * from the front matter only. A body that calls something "a major improvement"
 * must not turn a patch into a major.
 */
export function pendingLevels(contents: readonly string[]): Level[] {
  const levels: Level[] = []
  for (const text of contents) {
    const lines = text.split('\n')
    if (lines[0]?.trim() !== '---') continue
    for (const line of lines.slice(1)) {
      if (line.trim() === '---') break
      const match = /:\s*(patch|minor|major)\s*$/.exec(line)
      if (match) levels.push(match[1] as Level)
    }
  }
  return levels
}

/**
 * What the release will actually be. `changeset version` takes the highest level
 * it can find, so a waiting changeset can outrank the answer given at release
 * time; the script says so rather than letting a major arrive as a surprise.
 */
export function effectiveLevel(chosen: Level, pending: readonly Level[]): Level {
  let winner = chosen
  for (const level of pending) {
    if (LEVELS.indexOf(level) > LEVELS.indexOf(winner)) winner = level
  }
  return winner
}

/** A changeset in the shape `changeset version` reads. */
export function changesetBody(pkg: string, level: Level, lines: readonly string[]): string {
  const bullets = lines.map((line) => `- ${line}`).join('\n')
  return `---\n"${pkg}": ${level}\n---\n\n${bullets}\n`
}

/**
 * What the file says below its front matter. Empty means you closed the editor
 * having deleted everything, which is the way to call the release off.
 */
export function changesetSummary(body: string): string {
  const lines = body.split('\n')
  if (lines[0]?.trim() !== '---') return body.trim()
  const end = lines.slice(1).findIndex((line) => line.trim() === '---')
  if (end === -1) return ''
  return lines.slice(end + 2).join('\n').trim()
}

/**
 * Named after the level and the commit rather than by the random word pairs
 * changesets generates, so that running the script twice on the same commit
 * cannot leave two changesets behind.
 */
export function changesetFilename(level: Level, sha: string): string {
  return `${level}-${sha}.md`
}

/**
 * The part of CHANGELOG.md that belongs to one version, for the body of the
 * GitHub release. Sections are delimited by `## `, with the space: `### Minor
 * Changes` is content, not the next version. Returns null when there is no such
 * section — which is the case for a version released before changesets was in
 * use, and the release notes fall back to a sentence.
 */
export function releaseNotesSection(changelog: string, version: string): string | null {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return section.length > 0 ? section : null
}

/**
 * One value out of `scripts/jre.pinned`, which is shell the launcher sources
 * and this script only reads: `JRE_VERSION='21.0.12.1+1'`. Returns null when
 * the key is absent, so a renamed pin fails the release loudly instead of
 * publishing notes that promise Java ''.
 */
export function pinnedValue(text: string, key: string): string | null {
  const match = new RegExp(`^${key}='([^']*)'`, 'm').exec(text)
  return match && match[1].length > 0 ? match[1] : null
}

/**
 * The edited summary, split into one entry per change.
 *
 * changesets treats a whole changeset file as a single changelog entry and puts
 * one `- ` in front of it, so a file holding five bullets comes out as one
 * bullet with a nested list inside. One change per file is how the format is
 * meant to be used — you still edit a single file, and this is what is split
 * out of it afterwards.
 *
 * A line that does not begin a bullet belongs to the one before it, so a
 * sentence may be wrapped, and prose with no bullets at all stays one entry.
 */
export function splitBullets(summary: string): string[] {
  const entries: string[] = []
  for (const raw of summary.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) entries.push(bullet[1].trim())
    else if (entries.length > 0) entries[entries.length - 1] += ` ${line}`
    else entries.push(line)
  }
  return entries.filter((entry) => entry.length > 0)
}
