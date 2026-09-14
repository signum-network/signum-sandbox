import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseScenario } from '../src/lib/scenarioLang'
import { checkScenario } from '../src/lib/scenarioCheck'

/*
 * Lives outside src/ on purpose: it reads a file with node's fs, and src/ is
 * browser code whose type environment should not know fs exists. See
 * queryKeys.test.ts, which is here for the same reason.
 *
 * What it defends: a reference that has drifted from the parser is worse than
 * no reference, because it teaches a line the language will reject. Every
 * example in the documentation is therefore parsed for real, and the worked
 * example at the end has to check out as a scenario that would actually run.
 */

const doc = readFileSync('public/scenarios_doc.md', 'utf8')
const examples = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((match) => match[1])

describe('scenarios_doc.md', () => {
  it('still has examples to check', () => {
    expect(examples.length).toBeGreaterThan(5)
  })

  it.each(examples.map((source, index) => [index, source] as const))(
    'example %i is a line the language accepts',
    (_index, source) => {
      expect(parseScenario(source).problems).toEqual([])
    },
  )

  it('the worked example is a scenario that would run', () => {
    const { steps, problems } = parseScenario(examples[examples.length - 1])
    expect(problems).toEqual([])
    expect(checkScenario(steps)).toEqual([])
  })
})
