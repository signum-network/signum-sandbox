import { useTranslation } from 'react-i18next'
import type { FeedItem } from '@/lib/chainFeed'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { matchesTransaction, type ResolvedQuery } from '@/lib/search'
import { paginate } from '@/lib/paginate'
import { Pager } from '../Pager'
import { TransactionRow } from './TransactionRow'

export function TransactionsView({
  items,
  accounts,
  contacts,
  onAddContact,
  query,
  page,
  onPage,
}: {
  items: FeedItem[]
  accounts: SandboxAccount[]
  contacts: Contacts
  onAddContact: (accountIdOrAddress: string, name: string) => void
  query: ResolvedQuery
  page: number
  onPage: (page: number) => void
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

  const matching = items.filter((item) => matchesTransaction(item.tx, query))
  const shown = paginate(matching, page)

  if (matching.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[11px] text-[var(--muted)]">{t('console.tx.none')}</p>
      </div>
    )
  }

  return (
    <>
      <ul>
        {shown.items.map((item) => (
          <TransactionRow
            key={item.id}
            item={item}
            accounts={accounts}
            contacts={contacts}
            onAddContact={onAddContact}
          />
        ))}
      </ul>
      <Pager {...shown} onPage={onPage} />
    </>
  )
}
