import { useTranslation } from 'react-i18next'
import type { Block } from '@signumjs/core'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { matchesBlock, type ResolvedQuery } from '@/lib/search'
import { BlockRow } from './BlockRow'

export function BlocksView({
  blocks,
  accounts,
  contacts,
  query,
  onSelectTransaction,
}: {
  blocks: Block[]
  accounts: SandboxAccount[]
  contacts: Contacts
  query: ResolvedQuery
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

  return (
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
  )
}
