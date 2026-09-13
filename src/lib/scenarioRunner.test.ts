import { describe, expect, it, vi } from 'vitest'
import { parseScenario } from './scenarioLang'
import { runScenario, type ScenarioOps } from './scenarioRunner'
import type { SandboxAccount } from './accounts'

const asAccount = (name: string): SandboxAccount => ({
  id: `id-${name}`,
  address: `TS-${name.toUpperCase()}`,
  name,
  passphrase: `sandbox-${name.toLowerCase()}`,
})

const fakeOps = (overrides: Partial<ScenarioOps> = {}) => {
  const calls: string[] = []
  const ops: ScenarioOps = {
    createAccount: vi.fn(async (name: string) => {
      calls.push(`account:${name}`)
      return asAccount(name)
    }),
    setMiner: vi.fn(() => {
      calls.push('miner')
    }),
    forge: vi.fn(async () => {
      calls.push('forge')
    }),
    balanceSigna: vi.fn(async () => '100000'),
    pay: vi.fn(async () => {
      calls.push('pay')
    }),
    multi: vi.fn(async () => {
      calls.push('multi')
    }),
    message: vi.fn(async () => {
      calls.push('message')
    }),
    info: vi.fn(async () => {
      calls.push('info')
    }),
    issueToken: vi.fn(async () => {
      calls.push('token')
      return 'asset-1'
    }),
    transferToken: vi.fn(async () => {
      calls.push('transfer')
    }),
    alias: vi.fn(async () => {
      calls.push('alias')
    }),
    subscribe: vi.fn(async () => {
      calls.push('subscribe')
    }),
    ...overrides,
  }
  return { ops, calls }
}

const run = (source: string, ops: ScenarioOps, onProgress?: Parameters<typeof runScenario>[2]) =>
  runScenario(parseScenario(source).steps, ops, onProgress)

describe('runScenario', () => {
  it('runs the steps in order and settles each one', async () => {
    const { ops, calls } = fakeOps()
    await run('miner M\naccount Alice\npay Alice -> M 5', ops)
    expect(calls).toEqual(['account:M', 'miner', 'account:Alice', 'pay', 'forge'])
  })

  // Creating an account writes nothing to the chain, so there is nothing to
  // settle and no block to waste on it.
  it('does not forge for a step that writes nothing', async () => {
    const { ops } = fakeOps()
    await run('miner M\naccount Alice', ops)
    expect(ops.forge).not.toHaveBeenCalled()
  })

  it('reports each step as it starts and finishes', async () => {
    const { ops } = fakeOps()
    const progress = vi.fn()
    await run('miner M\nforge\nforge', ops, progress)
    expect(progress).toHaveBeenCalledWith({ index: 0, total: 3, line: 1, state: 'running' })
    expect(progress).toHaveBeenCalledWith({ index: 2, total: 3, line: 3, state: 'done' })
  })

  // There is no rollback. The one thing that must not happen is carrying on
  // and burying the failure under later steps.
  it('stops at the first failing step and says which line', async () => {
    const { ops, calls } = fakeOps({
      pay: vi.fn(async () => {
        throw new Error('Incorrect "recipient"')
      }),
    })
    const outcome = await run('miner M\npay M -> M 1\nalias M x "y"', ops)
    expect(outcome).toEqual({ kind: 'failed', line: 2, message: 'Incorrect "recipient"' })
    expect(calls).not.toContain('alias')
  })

  it('resolves a token by the symbol the scenario gave it', async () => {
    const { ops } = fakeOps()
    await run('miner M\ntoken M SLICE 100 0\ntransfer M -> M SLICE 5', ops)
    expect(ops.transferToken).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1', quantity: '5' }),
    )
  })

  // The miner earns its funds by forging, so funding is forge-and-check.
  it('forges until the miner can cover a funding step', async () => {
    let balance = 0
    const { ops } = fakeOps({
      balanceSigna: vi.fn(async () => String(balance)),
      forge: vi.fn(async () => {
        balance += 100
      }),
    })
    await run('miner M\nfund M 250', ops)
    expect(ops.forge).toHaveBeenCalledTimes(3)
  })

  it('gives up funding rather than forging forever', async () => {
    const { ops } = fakeOps({ balanceSigna: vi.fn(async () => '0') })
    const outcome = await run('miner M\nfund M 1', ops)
    expect(outcome.kind).toBe('failed')
  })
})
