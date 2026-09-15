import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { isEmptyBlock, matchesBlock, type ResolvedQuery } from '@/lib/search'
import { Toggle } from '../Toggle'
import { PAGE_SIZE, pageCount } from '@/lib/paginate'
import { useArrivals } from '@/motion'
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
  hideEmpty,
  onHideEmpty,
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
  hideEmpty: boolean
  onHideEmpty: (hide: boolean) => void
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()

  const matching = blocks.filter((block) => matchesBlock(block, query))
  const shown = hideEmpty ? matching.filter((b) => !isEmptyBlock(b)) : matching
  const hidden = matching.length - shown.length
  // The hide-empty switch changes the displayed set as much as a search does,
  // so it belongs in the filter key: flipping it must not flare a page.
  const arrived = useArrivals({
    ids: shown.map((block) => block.block),
    page,
    filter: `${JSON.stringify(query.query)}|${hideEmpty}`,
  })

  const first = page * PAGE_SIZE

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-3">
        <Toggle checked={hideEmpty} onChange={onHideEmpty} label={t('console.blocks.hideEmpty')} />
        {hidden > 0 && (
          <span className="text-[12px] text-[var(--muted)]">
            {t('console.blocks.hidden', { count: hidden })}
          </span>
        )}
      </div>
      {/*
        The empty message lives inside the list rather than replacing the whole
        view: hiding empty blocks can empty a page, and a view that swallowed
        its own switch would leave no way back.

        A filter that matched nothing is also not an empty chain, and saying so
        would be the same small lie the transaction stream avoids.
      */}
      <ul className="themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto pr-2">
        {shown.length === 0 && (
          <li className="p-4 text-[13px] text-[var(--muted)]">
            {blocks.length === 0 ? t('console.blocks.none') : t('console.blocks.noMatch')}
          </li>
        )}
        {shown.map((block) => (
        <BlockRow
          key={block.block}
          block={block}
          arriving={arrived.has(block.block)}
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
    </div>
  )
}
