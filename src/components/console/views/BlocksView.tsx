import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { matchesBlock, type ResolvedQuery } from '@/lib/search'
import { PAGE_SIZE, pageCount } from '@/lib/paginate'
import { Pager } from '../Pager'
import { BlockRow } from './BlockRow'

export function BlocksView({
  blocks,
  accounts,
  contacts,
  query,
  page,
  onPage,
  chainLength,
  onSelectTransaction,
}: {
  blocks: Block[]
  accounts: SandboxAccount[]
  contacts: Contacts
  query: ResolvedQuery
  page: number
  onPage: (page: number) => void
  /** numberOfBlocks, so the pager can say how much chain there is. */
  chainLength: number
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()

  const shown = blocks.filter((block) => matchesBlock(block, query))

  // A filter that matched nothing is not an empty chain, and saying so would be
  // the same small lie the transaction stream is careful to avoid.
  if (shown.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[11px] text-[var(--muted)]">
          {blocks.length === 0 ? t('console.blocks.none') : t('console.blocks.noMatch')}
        </p>
      </div>
    )
  }

  const first = page * PAGE_SIZE

  return (
    <>
      <ul>
        {shown.map((block) => (
        <BlockRow
          key={block.block}
          block={block}
          accounts={accounts}
          contacts={contacts}
          onSelectTransaction={onSelectTransaction}
        />
        ))}
      </ul>
      <Pager
        page={page}
        pages={pageCount(chainLength)}
        from={first + 1}
        to={first + shown.length}
        total={chainLength}
        onPage={onPage}
      />
    </>
  )
}
