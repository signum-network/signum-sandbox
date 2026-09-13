import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { rewindBy, rewindChain } from '@/lib/chainAdmin'
import { REWIND_STEPS, canRewindBy, rewindProblem } from '@/lib/rewind'
import { resetCommand } from '@/lib/platform'
import { ConsoleButton } from '@/components/console/ConsoleButton'

/**
 * Two different things, said as two different things.
 *
 * Winding back is what the console can do by itself, and it is what you
 * usually want: it needs no restart and clears everything you did. It cannot
 * produce an empty chain, though — `popOff` refuses to go below block 1, so
 * that block and the 10,000 SIGNA its forger earned always survive.
 *
 * A genuinely empty chain means deleting the database, and the node holds
 * that file open while it runs. No web page can stop a process, so this names
 * the command instead of pretending to be able to run it.
 */
export function ChainDrawer({ height }: { height: number | null }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<{ kind: string }>) => {
    setBusy(true)
    const outcome = await action()
    setBusy(false)
    setNotice(t(`console.chain.rewind_${outcome.kind}`))
    void client.invalidateQueries()
  }

  const rewind = async () => {
    if (!window.confirm(t('console.chain.rewindConfirm'))) return
    await run(() => rewindChain(height ?? 0))
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        {/*
          Steps first: undoing the last block or the last ten is the everyday
          use, and winding all the way back is the rare one. A step the node
          would refuse is disabled rather than attempted — it answers a count
          larger than the chain with a flat rejection and changes nothing.
        */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {REWIND_STEPS.map((blocks) => (
            <ConsoleButton
              key={blocks}
              disabled={busy || !canRewindBy(height ?? 0, blocks)}
              onClick={() => void run(() => rewindBy(blocks))}
            >
              −{blocks}
            </ConsoleButton>
          ))}
          <ConsoleButton disabled={busy} onClick={() => void rewind()}>
            {t('console.chain.rewind')}
          </ConsoleButton>
        </div>

        <p className="text-[12px] text-[var(--muted)]">{t('console.chain.rewindNote')}</p>

        {/*
          Said before the attempt rather than after it: on a long chain the
          full wind-back is simply not on offer, and finding that out by
          pressing the button is finding it out too late.
        */}
        {rewindProblem(height ?? 0) === 'outOfReach' && (
          <p className="mt-1 text-[12px]" style={{ color: 'var(--amber)' }}>
            {t('console.chain.rewind_outOfReach')}
          </p>
        )}

        {notice && <p className="mt-1 text-[12px] text-[var(--blue3)]">{notice}</p>}
      </div>

      <div className="border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
        <p className="text-[12px] uppercase tracking-[1px] text-[var(--blue3)]">
          {t('console.chain.fresh')}
        </p>
        <p className="mt-1 text-[12px] text-[var(--muted)]">{t('console.chain.freshNote')}</p>
        <code
          className="mt-1 block border p-2 text-[12px] text-[var(--fg)]"
          style={{ borderColor: 'var(--border2)' }}
        >
          {resetCommand(navigator.userAgent)}
        </code>
      </div>
    </div>
  )
}
