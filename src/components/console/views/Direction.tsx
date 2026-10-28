import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { Transaction } from '@signumjs/core'
import { summarize } from '@/lib/txSummary'
import { displayName, type Contacts } from '@/lib/contacts'
import type { SandboxAccount } from '@/lib/accounts'
import { RowButton } from '../ConsoleButton'
import { useArrivals } from '@/motion'
import { cn } from '@/lib/utils'

/**
 * One direction of an account's traffic — what came in, or what went out.
 *
 * Without onSelectTransaction a row is plain text rather than a button, so a
 * row that cannot open does not pretend to.
 */
export function Direction({
  label,
  transactions,
  accounts,
  contacts,
  onSelectTransaction,
}: {
  label: string
  transactions: Transaction[] | undefined
  accounts: SandboxAccount[]
  contacts: Contacts
  onSelectTransaction?: (transactionId: string) => void
}) {
  const { t } = useTranslation()
  // Ten rows, no pager and no filter, so the snapshot is only ever about what
  // came in since the last one.
  const arrived = useArrivals({
    ids: transactions?.map((tx) => tx.transaction) ?? [],
    page: 0,
    filter: '',
  })

  return (
    <div className="flex-1">
      <div className="mb-1 text-[11px] uppercase tracking-[2px] text-[var(--blue3)]">{label}</div>
      {transactions?.length ? (
        <ul>
          {transactions.map((tx) => {
            const summary = summarize(tx)
            const other = summary.recipientRS ?? summary.senderRS
            const content: ReactNode = (
              <>
                <span className="text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
                <span className="text-[var(--muted)]">
                  {' '}
                  {other ? displayName(other, accounts, contacts) : '—'}
                  {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
                </span>
              </>
            )
            return (
              <li
                key={tx.transaction}
                className={cn('border-b', arrived.has(tx.transaction) && 'motion-arrive')}
                style={{ borderColor: 'var(--border2)' }}
              >
                <div>
                  {onSelectTransaction ? (
                    <RowButton
                      className="w-full py-1 text-left text-[13px]"
                      onClick={() => onSelectTransaction(tx.transaction)}
                    >
                      {content}
                    </RowButton>
                  ) : (
                    <div className="w-full py-1 text-left text-[13px]">{content}</div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--muted)]">{t('console.watch.nothing')}</p>
      )}
    </div>
  )
}
