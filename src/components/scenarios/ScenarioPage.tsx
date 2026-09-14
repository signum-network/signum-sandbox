import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { SCENARIOS } from '@/scenarios'
import { AppHeader } from '@/components/AppHeader'
import { Unreachable } from '@/components/startpage'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useScenario } from '@/hooks/useScenario'

/**
 * The scenario editor, on a page of its own.
 *
 * It began as a section in the Chain drawer, which was wrong for the obvious
 * reason: a drawer is a third of the width and a scenario is a document. The
 * cost of moving out is that you no longer watch the stream while it runs, so
 * the page keeps its own eye on the chain — the height in the header moves as
 * blocks land, and the run names the line it is on.
 *
 * The built-in scenarios load into this same editor. There is exactly one way
 * to run a scenario — run what is in the box — which is what makes saving and
 * importing a later addition rather than a later rewrite.
 */
export function ScenarioPage() {
  const { t } = useTranslation()
  const { state, nodeAddress } = useNodeState()
  const accounts = useAccounts()
  const scenario = useScenario(accounts)

  if (state.kind === 'unreachable') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-screen max-w-6xl flex-col p-6">
      <AppHeader
        networkName={state.networkName}
        version={state.version}
        connection={state.connection}
        scanning={state.scanning}
        homeLink
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] uppercase tracking-[1px] text-[var(--blue3)]">
          {t('console.scenario.section')}
        </span>
        {/*
          The height, here rather than only in the console: a run is worth
          watching, and this is the number that proves it is happening.
        */}
        <span className="flex items-center gap-3 text-[13px]">
          <span>
            <span className="text-[var(--muted)]">{t('console.chain.height')} </span>
            <span className="font-bold text-[var(--blue3)]">{state.height ?? '—'}</span>
          </span>
          <Link className="text-[13px] text-[var(--blue3)] underline" to="/console">
            {t('console.scenario.toConsole')}
          </Link>
        </span>
      </div>

      <p className="mb-3 shrink-0 text-[13px] leading-relaxed text-[var(--muted)]">
        {t('console.scenario.note')}
      </p>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <textarea
            className="themed-scroll console-scroll min-h-0 w-full flex-1 resize-none
              border bg-transparent p-3 font-mono text-[13px] leading-relaxed
              text-[var(--fg)] outline-none"
            style={{ borderColor: 'var(--border2)' }}
            spellCheck={false}
            value={scenario.source}
            placeholder={t('console.scenario.empty')}
            onChange={(event) => scenario.setSource(event.target.value)}
          />

          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2">
            <ConsoleButton disabled={!scenario.runnable} onClick={() => void scenario.run()}>
              {t('console.scenario.run')}
            </ConsoleButton>
            {scenario.busy && (
              <ConsoleButton onClick={scenario.stop}>{t('console.scenario.stop')}</ConsoleButton>
            )}
            {scenario.busy && scenario.progress && (
              <span className="text-[13px] text-[var(--blue3)]">
                {t('console.scenario.running', {
                  line: scenario.progress.line,
                  index: scenario.progress.index + 1,
                  total: scenario.progress.total,
                })}
              </span>
            )}
            {scenario.outcome?.kind === 'completed' && (
              <span className="text-[13px] text-[var(--blue3)]">
                {t('console.scenario.completed', { count: scenario.progress?.total ?? 0 })}
              </span>
            )}
            {scenario.outcome?.kind === 'failed' && (
              <span className="text-[13px]" style={{ color: 'var(--mag)' }}>
                {t('console.scenario.failed', {
                  line: scenario.outcome.line,
                  message: scenario.outcome.message,
                })}
              </span>
            )}
          </div>

          {/*
            Every problem against its line. The editor is where they get
            fixed, and "something is wrong" is not a fix.
          */}
          {scenario.problems.length > 0 && (
            <ul className="themed-scroll console-scroll mt-2 max-h-32 shrink-0 overflow-y-auto">
              {scenario.problems.map((problem) => (
                <li
                  key={`${problem.line}-${problem.message}`}
                  className="text-[13px]"
                  style={{ color: 'var(--mag)' }}
                >
                  {problem.line}: {problem.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="themed-scroll console-scroll w-[34%] shrink-0 overflow-y-auto border p-3"
          style={{ borderColor: 'var(--border2)' }}
        >
          <p className="mb-2 text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('console.scenario.builtIn')}
          </p>
          {SCENARIOS.map(({ id, source }) => (
            <div key={id} className="mb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-[var(--fg)]">
                  {t(`console.scenario.${id}.title`)}
                </span>
                <RowButton
                  className="shrink-0 text-[12px] text-[var(--blue3)] underline"
                  onClick={() => scenario.setSource(source)}
                >
                  {t('console.scenario.load')}
                </RowButton>
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                {t(`console.scenario.${id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
