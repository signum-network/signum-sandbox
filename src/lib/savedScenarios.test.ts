import { describe, expect, it } from 'vitest'
import {
  parseScenarios,
  removeScenario,
  saveScenario,
  scenarioFilename,
  serializeScenarios,
} from './savedScenarios'

const one = { name: 'mine', source: 'miner M' }

describe('saveScenario', () => {
  it('adds a scenario', () => {
    expect(saveScenario([], 'mine', 'miner M')).toEqual([one])
  })

  // Saving again after an edit is the commonest thing anyone will do here,
  // and it must not leave two entries with the same name.
  it('replaces a scenario saved under the same name, where it stands', () => {
    const list = [one, { name: 'other', source: 'forge' }]
    expect(saveScenario(list, 'mine', 'miner N')).toEqual([
      { name: 'mine', source: 'miner N' },
      { name: 'other', source: 'forge' },
    ])
  })

  it('trims the name, so "mine" and " mine " are one scenario', () => {
    expect(saveScenario([one], ' mine ', 'forge')).toEqual([{ name: 'mine', source: 'forge' }])
  })
})

describe('removeScenario', () => {
  it('removes by name and leaves the rest', () => {
    expect(removeScenario([one, { name: 'other', source: 'forge' }], 'mine')).toEqual([
      { name: 'other', source: 'forge' },
    ])
  })
})

describe('parseScenarios', () => {
  it('round-trips', () => {
    expect(parseScenarios(serializeScenarios([one]))).toEqual([one])
  })

  it('treats unreadable storage as nothing saved', () => {
    expect(parseScenarios(null)).toEqual([])
    expect(parseScenarios('not json')).toEqual([])
    expect(parseScenarios('{"not":"an array"}')).toEqual([])
  })

  it('drops a broken entry rather than the whole list', () => {
    expect(parseScenarios('[{"name":"ok","source":"forge"},{"name":5},null,{"name":""}]')).toEqual([
      { name: 'ok', source: 'forge' },
    ])
  })
})

describe('scenarioFilename', () => {
  it('names the file after the scenario', () => {
    expect(scenarioFilename('First steps')).toBe('first-steps.scenario')
  })

  // A name typed into a text box is not a path, and a scenario should
  // download rather than fail because somebody used a slash.
  it('replaces anything a filesystem might object to', () => {
    expect(scenarioFilename('Alice / Bob')).toBe('alice-bob.scenario')
    expect(scenarioFilename('../../etc/passwd')).toBe('etc-passwd.scenario')
  })

  it('falls back rather than producing a hidden dotfile', () => {
    expect(scenarioFilename('   ')).toBe('scenario.scenario')
    expect(scenarioFilename('...')).toBe('scenario.scenario')
  })
})
