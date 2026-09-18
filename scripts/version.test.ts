import { describe, expect, it } from 'vitest'
import {
  changelogLines,
  changesetBody,
  changesetFilename,
  changesetSummary,
  effectiveLevel,
  guardVerdict,
  nextVersion,
  pendingLevels,
  releaseNotesSection,
} from './version'

describe('nextVersion', () => {
  it('counts up the part that was chosen', () => {
    expect(nextVersion('0.0.1', 'patch')).toBe('0.0.2')
    expect(nextVersion('0.0.1', 'minor')).toBe('0.1.0')
    expect(nextVersion('0.0.1', 'major')).toBe('1.0.0')
  })

  it('clears the parts below it', () => {
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('refuses a version it cannot read', () => {
    expect(() => nextVersion('1.2', 'patch')).toThrow()
    expect(() => nextVersion('0.1.0-beta.1', 'patch')).toThrow()
  })
})

describe('guardVerdict', () => {
  const clean = { branch: 'develop', dirty: false, synced: true, taken: [] as string[] }

  it('lets a clean, synced develop through', () => {
    expect(guardVerdict(clean)).toBe('ok')
  })

  it('names the first thing that is wrong, not all of them', () => {
    expect(guardVerdict({ ...clean, branch: 'main', dirty: true, synced: false })).toBe('not-develop')
    expect(guardVerdict({ ...clean, dirty: true, synced: false })).toBe('dirty')
    expect(guardVerdict({ ...clean, synced: false })).toBe('out-of-sync')
  })

  it('refuses when a version it could produce is already released', () => {
    expect(guardVerdict({ ...clean, taken: ['0.1.0'] })).toBe('already-tagged')
  })
})

describe('changelogLines', () => {
  it('keeps what a user would notice and drops the housekeeping', () => {
    expect(
      changelogLines([
        'feat: the sandbox brings its own Java, once',
        'chore: bump lockfile',
        'fix: say which home directory is empty',
        'ci: cache bun',
        'build: changesets, configured for a package that is never published',
        'refactor(console): pull the drawer apart',
        'test: cover the prune',
        'style: reindent',
        'docs: the way in is one command',
        'perf: stop re-rendering the feed',
      ]),
    ).toEqual([
      'the sandbox brings its own Java, once',
      'say which home directory is empty',
      'the way in is one command',
      'stop re-rendering the feed',
    ])
  })

  it('strips the scope with the prefix', () => {
    expect(changelogLines(['feat(launcher): pin the Java'])).toEqual(['pin the Java'])
  })

  it('keeps a subject that carries no prefix, because it cannot judge it', () => {
    expect(changelogLines(['the console gained a chime'])).toEqual(['the console gained a chime'])
  })

  it('drops merges and blank subjects', () => {
    expect(changelogLines(['Merge branch feat/motion into develop', '   ', 'fix: a real one'])).toEqual([
      'a real one',
    ])
  })
})

describe('pendingLevels and effectiveLevel', () => {
  const changeset = (level: string) => `---\n"signum-sandbox": ${level}\n---\n\nsomething happened\n`

  it('reads the level out of the front matter', () => {
    expect(pendingLevels([changeset('minor'), changeset('patch')])).toEqual(['minor', 'patch'])
  })

  it('ignores a body that talks about minor versions', () => {
    expect(pendingLevels([`---\n"signum-sandbox": patch\n---\n\nthis is a major improvement\n`])).toEqual([
      'patch',
    ])
  })

  it('takes the largest, because that is what changesets will do', () => {
    expect(effectiveLevel('patch', ['minor'])).toBe('minor')
    expect(effectiveLevel('major', ['patch'])).toBe('major')
    expect(effectiveLevel('minor', [])).toBe('minor')
  })
})

describe('changesetBody', () => {
  it('writes the front matter changesets expects and one bullet per line', () => {
    expect(changesetBody('signum-sandbox', 'minor', ['a thing', 'another thing'])).toBe(
      '---\n"signum-sandbox": minor\n---\n\n- a thing\n- another thing\n',
    )
  })

  it('round-trips through the summary reader', () => {
    const body = changesetBody('signum-sandbox', 'patch', ['a thing'])
    expect(changesetSummary(body)).toBe('- a thing')
    expect(pendingLevels([body])).toEqual(['patch'])
  })

  it('reports an emptied file as having nothing to say', () => {
    expect(changesetSummary('---\n"signum-sandbox": patch\n---\n\n\n')).toBe('')
  })

  it('names the file after the level and the commit, so the name is never random', () => {
    expect(changesetFilename('minor', '5fffa34')).toBe('minor-5fffa34.md')
  })
})

describe('releaseNotesSection', () => {
  const changelog = [
    '# signum-sandbox',
    '',
    '## 0.2.0',
    '',
    '### Minor Changes',
    '',
    '- the newest thing',
    '',
    '## 0.1.0',
    '',
    '### Patch Changes',
    '',
    '- the older thing',
    '',
  ].join('\n')

  it('cuts out the asked-for version and stops at the next one', () => {
    expect(releaseNotesSection(changelog, '0.2.0')).toBe('### Minor Changes\n\n- the newest thing')
    expect(releaseNotesSection(changelog, '0.1.0')).toBe('### Patch Changes\n\n- the older thing')
  })

  it('has nothing for a version the changelog never heard of', () => {
    expect(releaseNotesSection(changelog, '0.0.1')).toBeNull()
    expect(releaseNotesSection('', '0.0.1')).toBeNull()
  })
})
