import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { resetChain } from '@/lib/chainAdmin'

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
    setNotice(outcome.succeeded ? t('console.chain.resetDone') : t('console.chain.resetManual'))
    void client.invalidateQueries()
  }

  return (
    <div className="mt-2">
      <button
        className="border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]"
        style={{ borderColor: 'var(--border2)' }}
        disabled={busy}
        onClick={() => void reset()}
      >
        {t('console.chain.reset')}
      </button>
      {notice && <p className="mt-2 text-[10px] text-[var(--muted)]">{notice}</p>}
    </div>
  )
}
