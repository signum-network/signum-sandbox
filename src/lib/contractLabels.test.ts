import { describe, expect, it } from 'vitest'
import { parseContractLabels, serializeContractLabels, setSlotMeta } from './contractLabels'

describe('contract labels', () => {
  it('reads nothing as empty', () => {
    expect(parseContractLabels(null)).toEqual({})
    expect(parseContractLabels('not json')).toEqual({})
    expect(parseContractLabels('[1,2]')).toEqual({})
  })

  it('reads a label stored before slots had types as that label', () => {
    expect(parseContractLabels(JSON.stringify({ abc: { '0': 'counter' } }))).toEqual({
      abc: { 0: { label: 'counter' } },
    })
  })

  it('drops malformed entries and keeps the rest', () => {
    const raw = JSON.stringify({
      abc: {
        '0': 'owner',
        '1': 42,
        x: 'nope',
        '-1': 'nope',
        '2': '',
        '3': { label: 'price', type: 'unsigned' },
        '4': { type: 'colour' },
        '5': { label: 7, type: 'bool' },
      },
      def: 'nope',
    })
    expect(parseContractLabels(raw)).toEqual({
      abc: { 0: { label: 'owner' }, 3: { label: 'price', type: 'unsigned' }, 5: { type: 'bool' } },
    })
  })

  it('round-trips', () => {
    const labels = setSlotMeta({}, 'abc', 3, { label: 'counter', type: 'unsigned' })
    expect(parseContractLabels(serializeContractLabels(labels))).toEqual(labels)
  })

  it('sets a type without touching the label, and the other way round', () => {
    let labels = setSlotMeta({}, 'abc', 0, { label: 'owner' })
    labels = setSlotMeta(labels, 'abc', 0, { type: 'address' })
    expect(labels).toEqual({ abc: { 0: { label: 'owner', type: 'address' } } })
    labels = setSlotMeta(labels, 'abc', 0, { label: ' boss ' })
    expect(labels).toEqual({ abc: { 0: { label: 'boss', type: 'address' } } })
  })

  it('clears a label or a type on its own', () => {
    let labels = setSlotMeta({}, 'abc', 0, { label: 'owner', type: 'address' })
    labels = setSlotMeta(labels, 'abc', 0, { type: undefined })
    expect(labels).toEqual({ abc: { 0: { label: 'owner' } } })
  })

  it('keeps code hashes apart, and removes a slot and a hash once nothing is left', () => {
    let labels = setSlotMeta({}, 'abc', 0, { label: 'owner', type: 'address' })
    labels = setSlotMeta(labels, 'def', 0, { label: 'price' })
    labels = setSlotMeta(labels, 'abc', 0, { label: '  ', type: undefined })
    expect(labels).toEqual({ def: { 0: { label: 'price' } } })
  })
})
