import { useTranslation } from 'react-i18next'
import type { FeedItem } from '@/lib/chainFeed'
import type { SandboxAccount } from '@/lib/accounts'
import { TransactionRow } from './TransactionRow'

export function TransactionsView({
  items,
  accounts,
}: {
  items: FeedItem[]
  accounts: SandboxAccount[]
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

  return (
    <ul>
      {items.map((item) => (
        <TransactionRow key={item.id} item={item} accounts={accounts} />
      ))}
    </ul>
  )
}
