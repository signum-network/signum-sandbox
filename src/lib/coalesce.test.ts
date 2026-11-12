import { describe, expect, it } from 'vitest'
import { coalesce } from './coalesce'

/** A task whose runs finish only when the test says so. */
const controlled = () => {
  const runs: string[] = []
  const finishers: Array<() => void> = []
  const task = (key: string) => {
    runs.push(key)
    return new Promise<void>((resolve) => finishers.push(resolve))
  }
  const finishNext = async () => {
    finishers.shift()?.()
    // let the finally handler run
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { task, runs, finishNext }
}

describe('coalesce', () => {
  it('runs the task for a key right away', () => {
    const { task, runs } = controlled()
    coalesce(task)('blocks')
    expect(runs).toEqual(['blocks'])
  })

  it('does not start a second run while the first is still going', () => {
    const { task, runs } = controlled()
    const trigger = coalesce(task)
    trigger('blocks')
    trigger('blocks')
    trigger('blocks')
    expect(runs).toEqual(['blocks'])
  })

  it('runs exactly once more after the current run when triggered meanwhile', async () => {
    const { task, runs, finishNext } = controlled()
    const trigger = coalesce(task)
    trigger('blocks')
    trigger('blocks')
    trigger('blocks')
    await finishNext()
    expect(runs).toEqual(['blocks', 'blocks'])
    await finishNext()
    expect(runs).toEqual(['blocks', 'blocks'])
  })

  it('does not run again when nothing was triggered meanwhile', async () => {
    const { task, runs, finishNext } = controlled()
    coalesce(task)('blocks')
    await finishNext()
    expect(runs).toEqual(['blocks'])
  })

  it('keeps keys independent of each other', () => {
    const { task, runs } = controlled()
    const trigger = coalesce(task)
    trigger('blocks')
    trigger('balance')
    expect(runs).toEqual(['blocks', 'balance'])
  })

  it('runs again after a run that failed', async () => {
    const runs: number[] = []
    const trigger = coalesce(async () => {
      runs.push(runs.length)
      if (runs.length === 1) throw new Error('node went away')
    })
    trigger('blocks')
    await new Promise((resolve) => setTimeout(resolve, 0))
    trigger('blocks')
    expect(runs).toEqual([0, 1])
  })
})
