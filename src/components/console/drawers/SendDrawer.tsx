import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { AccountStore } from '@/hooks/useAccounts'
import { PaymentForm } from './forms/PaymentForm'

export type SendKind =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'accountInfo'
  | 'tokenIssue'
  | 'tokenTransfer'
  | 'alias'
  | 'subscription'

const KINDS: SendKind[] = [
  'payment', 'multiOut', 'message', 'accountInfo',
  'tokenIssue', 'tokenTransfer', 'alias', 'subscription',
]

export function SendDrawer({ store }: { store: AccountStore }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [kind, setKind] = useState<SendKind>('payment')
  const [notice, setNotice] = useState<string | null>(null)

  if (!store.available) {
    return <p className="mt-2 text-[11px] text-[var(--muted)]">{t('console.guard.title')}</p>
  }

  // A fresh transaction shows up as unconfirmed only after the feed refetches;
  // the socket will do it too, but not before the user looks.
  const onSent = () => {
    setNotice(t('console.send.sent'))
    void client.invalidateQueries({ queryKey: ['unconfirmed'] })
  }

  return (
    <div className="mt-2">
      <div className="mb-3 flex flex-wrap gap-1">
        {KINDS.map((name) => (
          <button
            key={name}
            onClick={() => { setKind(name); setNotice(null) }}
            className="border px-2 py-[2px] text-[9px] uppercase tracking-[1px]"
            style={{
              borderColor: kind === name ? 'var(--blue2)' : 'var(--border2)',
              color: kind === name ? 'var(--blue3)' : 'var(--muted)',
            }}
          >
            {t(`console.kind.${name === 'message' ? 'message' : name}`)}
          </button>
        ))}
      </div>

      {kind === 'payment' && (
        <PaymentForm accounts={store.accounts} onSent={onSent} onError={setNotice} />
      )}

      {notice && <p className="mt-2 text-[10px] text-[var(--blue3)]">{notice}</p>}
    </div>
  )
}
