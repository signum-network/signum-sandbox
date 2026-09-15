import { useTranslation } from 'react-i18next'
import type { FeedItem } from '@/lib/chainFeed'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { matchesTransaction, type ResolvedQuery } from '@/lib/search'
import { paginate } from '@/lib/paginate'
import { motion } from 'framer-motion'
import { useArrivals, seconds } from '@/motion'
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

  const matching = items.filter((item) => matchesTransaction(item.tx, query))
  const shown = paginate(matching, page)
  // What the eye should be told about. The ids come from the page actually on
  // screen, because a row that is not rendered cannot arrive. The filter key
  // is the resolved query serialised: it is compared, never read.
  const arrived = useArrivals({
    ids: shown.items.map((item) => item.id),
    page,
    filter: JSON.stringify(query.query),
  })

  if (items.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[14px] font-bold text-[var(--blue3)]">{t('console.empty.title')}</p>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{t('console.empty.description')}</p>
      </div>
    )
  }

  if (matching.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[13px] text-[var(--muted)]">{t('console.tx.none')}</p>
      </div>
    )
  }

  return (
    // A column so the list can take the space that is left and scroll inside
    // it, while the pager stays where the eye last saw it.
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        Keyed on the page so a page turn fades rather than swapping, and so the
        new page starts at the top instead of inheriting the last one's scroll
        offset. No AnimatePresence: the outgoing page is gone in the same
        frame, and a wait-mode presence would cost 200ms per turn for nothing
        anyone can see.
      */}
      <motion.ul
        key={page}
        className="themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto pr-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: seconds('quick') }}
      >
        {shown.items.map((item) => (
          <TransactionRow
            key={item.id}
            item={item}
            arriving={arrived.has(item.id)}
            accounts={accounts}
            contacts={contacts}
            onAddContact={onAddContact}
          />
        ))}
      </motion.ul>
      <Pager {...shown} onPage={onPage} />
    </div>
  )
}
