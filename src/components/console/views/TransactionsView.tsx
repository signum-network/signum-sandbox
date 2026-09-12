import { useTranslation } from 'react-i18next'
import type { FeedItem } from '@/lib/chainFeed'
import type { SandboxAccount } from '@/lib/accounts'
import { matchesTransaction, type Query } from '@/lib/search'
import { TransactionRow } from './TransactionRow'

export function TransactionsView({
  items,
  accounts,
  query,
}: {
  items: FeedItem[]
  accounts: SandboxAccount[]
  query: Query
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[12px] font-bold text-[var(--blue3)]">{t('console.empty.title')}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">{t('console.empty.description')}</p>
      </div>
    )
  }

  const shown = items.filter((item) => matchesTransaction(item.tx, query))

  if (shown.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[11px] text-[var(--muted)]">{t('console.tx.none')}</p>
      </div>
    )
  }

  return (
    <ul>
      {shown.map((item) => (
        <TransactionRow key={item.id} item={item} accounts={accounts} />
      ))}
    </ul>
  )
}
