import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { resetChain } from '@/lib/chainAdmin'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { resetScriptCommand } from '@/lib/platform'

export function ChainDrawer({ height }: { height: number | null }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    if (!window.confirm(t('console.chain.resetConfirm'))) return
    setBusy(true)
    const outcome = await resetChain(height ?? 0)
    setBusy(false)
    setNotice(
      outcome.kind === 'succeeded'
        ? t('console.chain.resetDone')
        : outcome.kind === 'alreadyAtStart'
          ? t('console.chain.resetAlreadyAtStart')
          : t('console.chain.resetManual', { command: resetScriptCommand(navigator.userAgent) }),
    )
    void client.invalidateQueries()
  }

  return (
    <div className="mt-2">
      <ConsoleButton disabled={busy} onClick={() => void reset()}>
        {t('console.chain.reset')}
      </ConsoleButton>
      {notice && <p className="mt-2 text-[10px] text-[var(--muted)]">{notice}</p>}
    </div>
  )
}
