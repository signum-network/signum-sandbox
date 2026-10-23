import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { isEmptyBlock, matchesBlock, type Query, type ResolvedQuery } from '@/lib/search'
import { Toggle } from '../Toggle'
import { PAGE_SIZE, pageCount } from '@/lib/paginate'
import { motion } from 'framer-motion'
import { useArrivals, seconds } from '@/motion'
import { Pager } from '../Pager'
import { BlockRow } from './BlockRow'

/** A search that points at one block rather than filtering by its forger. */
const names = (block: Block, query: Query) =>
  (query.kind === 'height' && query.height === block.height) ||
  (query.kind === 'id' && query.value === block.block)

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
  // A height or an id asks for one block by name, so hiding it for being
  // empty would answer a question nobody asked. Only a list gets thinned.
  const pointed = query.query.kind === 'height' || query.query.kind === 'id'
  const shown = hideEmpty && !pointed ? matching.filter((b) => !isEmptyBlock(b)) : matching
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
      <motion.ul
        key={page}
        className="themed-scroll console-scroll min-h-0 flex-1 overflow-y-auto pr-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: seconds('quick') }}
      >
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
          expand={names(block, query.query)}
          accounts={accounts}
          contacts={contacts}
          onSelectTransaction={onSelectTransaction}
        />
        ))}
      </motion.ul>
      {/*
        A block found by name is the whole result, not a slice of the chain's
        pages, so the pager counts it alone instead of "1–1 of 1068" with
        twenty-one other pages that would not contain it.
      */}
      {pointed ? (
        <Pager
          page={0}
          pages={1}
          from={shown.length === 0 ? 0 : 1}
          to={shown.length}
          total={shown.length}
          onPage={onPage}
        />
      ) : (
        <Pager
          page={page}
          pages={pageCount(chainLength)}
          from={first + 1}
          to={first + shown.length}
          total={chainLength}
          onPage={onPage}
        />
      )}
    </div>
  )
}
