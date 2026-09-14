import { finerThanToken } from './token'
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
  const tokens = new Map<string, number>()
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
        if (finerThanToken(step.quantity, step.decimals)) {
          problems.push({
            line: step.line,
            message: `${step.quantity} is finer than ${step.decimals} decimals can hold`,
          })
        }
        tokens.set(step.token, step.decimals)
        break
      case 'transfer':
        account(step.line, step.from)
        account(step.line, step.to)
        {
          const decimals = tokens.get(step.token)
          if (decimals === undefined) {
            problems.push({ line: step.line, message: `unknown token "${step.token}"` })
          } else if (finerThanToken(step.quantity, decimals)) {
            // Amounts are written the way people read them, so this is the
            // one place that can tell a hundredth from a thousandth — the
            // token line is in the same file, a few lines up.
            problems.push({
              line: step.line,
              message: `${step.token} has ${decimals} decimals, so ${step.quantity} is too fine`,
            })
          }
        }
        break
      case 'forge':
        break
    }
  }

  // Not on a file that did not parse. An empty step list means the parser
  // already has something to say, and "no miner line" on top of a syntax
  // error is a second complaint about the same missing text.
  if (miner === null && steps.length > 0) {
    problems.unshift({
      line: steps[0]?.line ?? 1,
      message: 'this scenario has no "miner" line, so nothing can forge',
    })
  }

  return problems
}
