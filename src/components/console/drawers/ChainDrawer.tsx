import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { rewindChain } from '@/lib/chainAdmin'
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

  const rewind = async () => {
    if (!window.confirm(t('console.chain.rewindConfirm'))) return
    setBusy(true)
    const outcome = await rewindChain(height ?? 0)
    setBusy(false)
    setNotice(t(`console.chain.rewind_${outcome.kind}`))
    void client.invalidateQueries()
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        <ConsoleButton disabled={busy} onClick={() => void rewind()}>
          {t('console.chain.rewind')}
        </ConsoleButton>
        <p className="mt-1 text-[10px] text-[var(--muted)]">{t('console.chain.rewindNote')}</p>
        {notice && <p className="mt-1 text-[10px] text-[var(--blue3)]">{notice}</p>}
      </div>

      <div className="border-t pt-3" style={{ borderColor: 'var(--border2)' }}>
        <p className="text-[10px] uppercase tracking-[1px] text-[var(--blue3)]">
          {t('console.chain.fresh')}
        </p>
        <p className="mt-1 text-[10px] text-[var(--muted)]">{t('console.chain.freshNote')}</p>
        <code
          className="mt-1 block border p-2 text-[10px] text-[var(--fg)]"
          style={{ borderColor: 'var(--border2)' }}
        >
          {resetCommand(navigator.userAgent)}
        </code>
      </div>
    </div>
  )
}
