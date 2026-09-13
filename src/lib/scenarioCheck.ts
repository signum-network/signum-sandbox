import type { Problem, ScenarioStep } from './scenarioLang'

/**
 * Whether the lines agree with each other, once each of them is well formed.
 *
 * Run before a single transaction is sent, because there is no undo: a
 * scenario that fails at line eleven has already written ten lines' worth of
 * transactions onto a chain the console cannot roll back. Every problem is
 * reported rather than the first, so one pass fixes the file.
 */
export function checkScenario(steps: ScenarioStep[]): Problem[] {
  const problems: Problem[] = []
  const accounts = new Set<string>()
  const tokens = new Set<string>()
  let miner: string | null = null

  const account = (line: number, name: string) => {
    if (!accounts.has(name)) problems.push({ line, message: `unknown account "${name}"` })
  }

  const claim = (line: number, name: string) => {
    if (accounts.has(name)) problems.push({ line, message: `account "${name}" is already taken` })
    accounts.add(name)
  }

  for (const step of steps) {
    switch (step.kind) {
      case 'miner':
        if (miner !== null) {
          problems.push({ line: step.line, message: 'this scenario names a miner twice' })
        }
        miner = step.name
        claim(step.line, step.name)
        break
      case 'account':
        claim(step.line, step.name)
        break
      case 'fund':
        account(step.line, step.account)
        break
      case 'pay':
      case 'msg':
      case 'subscribe':
        account(step.line, step.from)
        account(step.line, step.to)
        break
      case 'multi':
        account(step.line, step.from)
        for (const recipient of step.recipients) account(step.line, recipient.to)
        break
      case 'info':
      case 'alias':
        account(step.line, step.account)
        break
      case 'token':
        account(step.line, step.issuer)
        if (tokens.has(step.token)) {
          problems.push({ line: step.line, message: `token "${step.token}" is already issued` })
        }
        tokens.add(step.token)
        break
      case 'transfer':
        account(step.line, step.from)
        account(step.line, step.to)
        if (!tokens.has(step.token)) {
          problems.push({ line: step.line, message: `unknown token "${step.token}"` })
        }
        break
      case 'forge':
        break
    }
  }

  if (miner === null) {
    problems.unshift({
      line: steps[0]?.line ?? 1,
      message: 'this scenario has no "miner" line, so nothing can forge',
    })
  }

  return problems
}
