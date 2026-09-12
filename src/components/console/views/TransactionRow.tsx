import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nodeHost } from '@/lib/ledger'
import { useQuery } from '@tanstack/react-query'
import { decodePayload, decryptFor } from '@/lib/payload'
import type { SandboxAccount } from '@/lib/accounts'
import { summarize } from '@/lib/txSummary'
import type { FeedItem } from '@/lib/chainFeed'

export function TransactionRow({
  item,
  accounts,
}: {
  item: FeedItem
  accounts: SandboxAccount[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const summary = summarize(item.tx)
  const fields = decodePayload(item.tx)

  // Decryption is asynchronous and only attempted once the row is open, so a
  // long stream does not do crypto work for rows nobody looked at.
  const decrypted = useQuery({
    queryKey: ['decrypt', item.id, accounts.length],
    queryFn: () => decryptFor(item.tx, accounts),
    enabled: open,
    retry: false,
  })

  return (
    <li className="border-b" style={{ borderColor: 'var(--border2)' }}>
      <button
        className="flex w-full items-center justify-between py-2 text-left text-[11px]"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="text-[var(--muted)]">{open ? '▾' : '▸'} </span>
          <span className="font-bold text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
          <span className="text-[var(--muted)]">
            {' '}{summary.senderRS ?? '—'}
            {summary.recipientRS ? ` → ${summary.recipientRS}` : ''}
            {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
          </span>
        </span>
        <span className={item.confirmed ? 'text-[var(--muted)]' : 'text-[var(--blue3)]'}>
          {item.confirmed
            ? t('console.tx.block', { height: item.tx.height ?? '—' })
            : t('console.tx.unconfirmed')}
        </span>
      </button>

      {open && (
        <div
          className="mb-2 border-l-2 py-2 pl-3 text-[11px]"
          style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
        >
          {fields.map((field) => (
            <div key={field.label} className="flex gap-3">
              <span className="min-w-[100px] text-[var(--muted)]">{field.label}</span>
              <span>
                {field.value ??
                  (field.label === 'encrypted' && decrypted.data
                    ? decrypted.data
                    : t('console.tx.undecryptable'))}
              </span>
            </div>
          ))}
          <div className="flex gap-3">
            <span className="min-w-[100px] text-[var(--muted)]">{t('console.tx.raw')}</span>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getTransaction&transaction=${item.tx.transaction}`}
            >
              ↗ getTransaction
            </a>
          </div>
        </div>
      )}
    </li>
  )
}
