import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parseScenario } from '@/lib/scenarioLang'
import { checkScenario } from '@/lib/scenarioCheck'
import { createScenarioOps } from '@/lib/scenarioOps'
import { runScenario, type Outcome, type Progress } from '@/lib/scenarioRunner'
import type { AccountStore } from '@/hooks/useAccounts'

/**
 * The scenario being edited: what it says, what is wrong with it, and how far
 * a run of it has got.
 *
 * Parsing and checking happen on every keystroke rather than behind a button,
 * because a language nobody has written before has to answer "is this right?"
 * while it is being typed.
 */
export function useScenario(accounts: AccountStore) {
  const client = useQueryClient()
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const abort = useRef<AbortController | null>(null)

  const { steps, problems } = useMemo(() => {
    const parsed = parseScenario(source)
    // Reference problems only mean anything once the lines they refer to
    // parsed, so a file with syntax errors reports those alone rather than
    // burying them under complaints about names it could not read.
    if (parsed.problems.length > 0) return parsed
    return { steps: parsed.steps, problems: checkScenario(parsed.steps) }
  }, [source])

  const run = useCallback(async () => {
    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setOutcome(null)
    setProgress(null)
    const ops = createScenarioOps({
      addressPrefix: accounts.addressPrefix,
      onAccount: (account) => accounts.importPassphrase(account.name, account.passphrase),
    })
    setOutcome(await runScenario(steps, ops, setProgress, controller.signal))
    setBusy(false)
    abort.current = null
    // Height, accounts and the feed are all out of date now.
    void client.invalidateQueries()
  }, [accounts, client, steps])

  return {
    source,
    setSource,
    steps,
    problems,
    busy,
    progress,
    outcome,
    runnable: steps.length > 0 && problems.length === 0 && !busy,
    run,
    stop: () => abort.current?.abort(),
  }
}
