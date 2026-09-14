import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { INSTRUCTIONS, instructionAt } from '@/lib/scenarioHelp'
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
  const editor = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const here = instructionAt(scenario.source, caret)

  /**
   * Drops a line in at the caret, on a line of its own, and leaves the caret
   * after it. Clicking a reference entry is the cheap half of what
   * autocompletion does, and it needs no cursor geometry to do it.
   */
  const insert = (skeleton: string) => {
    const box = editor.current
    const at = box ? box.selectionStart : scenario.source.length
    const before = scenario.source.slice(0, at)
    const after = scenario.source.slice(at)
    const lead = before === '' || before.endsWith('\n') ? '' : '\n'
    const line = `${lead}${skeleton}\n`
    scenario.setSource(before + line + after)
    // After the state lands, so the caret is set on the rendered value.
    requestAnimationFrame(() => {
      const position = at + line.length
      box?.focus()
      box?.setSelectionRange(position, position)
      setCaret(position)
    })
  }

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
            ref={editor}
            className="themed-scroll console-scroll min-h-0 w-full flex-1 resize-none
              border bg-transparent p-3 font-mono text-[13px] leading-relaxed
              text-[var(--fg)] outline-none"
            style={{ borderColor: 'var(--border2)' }}
            spellCheck={false}
            value={scenario.source}
            placeholder={t('console.scenario.empty')}
            onChange={(event) => {
              scenario.setSource(event.target.value)
              setCaret(event.target.selectionStart)
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          />

          {/*
            The signature of the line the caret is in. This is what a writer
            actually needs from autocompletion — not which verb, the list
            beside the editor answers that, but what comes after `subscribe`.
            Reading it from the caret takes a character offset; a dropdown at
            the caret would take pixel coordinates a textarea does not give.

            The row keeps its height when there is nothing to say, so typing
            past the end of a line does not shift the editor under the cursor.
          */}
          <p className="mt-1 h-4 shrink-0 font-mono text-[12px] text-[var(--blue2)]">
            {here?.signature ?? ''}
          </p>

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

          {/*
            The whole vocabulary, always visible. Thirteen instructions is
            small enough to list and too many to remember, and a language
            nobody has written before has no other way of being discovered.
          */}
          <p
            className="mt-4 mb-2 border-t pt-3 text-[12px] uppercase tracking-[1px]
              text-[var(--blue3)]"
            style={{ borderColor: 'var(--border2)' }}
          >
            {t('console.scenario.reference')}
          </p>
          {INSTRUCTIONS.map((instruction) => (
            <RowButton
              key={instruction.verb}
              className="block w-full break-words text-left font-mono text-[12px]
                leading-relaxed text-[var(--muted)] hover:text-[var(--blue3)]"
              onClick={() => insert(instruction.skeleton)}
            >
              {instruction.signature}
            </RowButton>
          ))}
        </div>
      </div>
    </div>
  )
}
