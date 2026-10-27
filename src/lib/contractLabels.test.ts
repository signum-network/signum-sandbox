import { describe, expect, it } from 'vitest'
import { parseContractLabels, serializeContractLabels, setSlotLabel } from './contractLabels'

describe('contract labels', () => {
  it('reads nothing as empty', () => {
    expect(parseContractLabels(null)).toEqual({})
    expect(parseContractLabels('not json')).toEqual({})
    expect(parseContractLabels('[1,2]')).toEqual({})
  })

  it('drops malformed entries and keeps the rest', () => {
    const raw = JSON.stringify({
      abc: { '0': 'owner', '1': 42, x: 'nope', '-1': 'nope', '2': '' },
      def: 'nope',
    })
    expect(parseContractLabels(raw)).toEqual({ abc: { 0: 'owner' } })
  })

  it('round-trips', () => {
    const labels = setSlotLabel({}, 'abc', 3, 'counter')
    expect(parseContractLabels(serializeContractLabels(labels))).toEqual(labels)
  })

  it('keeps code hashes apart, trims, and removes on an empty label', () => {
    let labels = setSlotLabel({}, 'abc', 0, ' owner ')
    labels = setSlotLabel(labels, 'def', 0, 'price')
    expect(labels).toEqual({ abc: { 0: 'owner' }, def: { 0: 'price' } })
    labels = setSlotLabel(labels, 'abc', 0, '  ')
    expect(labels).toEqual({ def: { 0: 'price' } })
  })
})
