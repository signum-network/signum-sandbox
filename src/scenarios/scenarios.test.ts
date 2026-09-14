import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import { SCENARIOS } from './index'
import { parseScenario } from '@/lib/scenarioLang'
import { checkScenario } from '@/lib/scenarioCheck'

describe('the scenarios that ship', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s parses and checks clean', (_id, s) => {
    const { steps, problems } = parseScenario(s.source)
    expect(problems).toEqual([])
    expect(checkScenario(steps)).toEqual([])
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s is named in English', (id) => {
    const copy = (
      en as unknown as {
        console: { scenario: Record<string, { title?: string; description?: string }> }
      }
    ).console.scenario
    expect(copy[id]?.title, `${id}.title`).toBeTruthy()
    expect(copy[id]?.description, `${id}.description`).toBeTruthy()
  })
})
