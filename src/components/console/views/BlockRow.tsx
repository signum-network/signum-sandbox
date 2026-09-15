import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Block, Transaction } from '@signumjs/core'
import { nodeHost } from '@/lib/ledger'
import type { SandboxAccount } from '@/lib/accounts'
import { displayName, type Contacts } from '@/lib/contacts'
import { isTransaction } from '@/lib/chainFeed'
import { summarize } from '@/lib/txSummary'
import { RowButton } from '../ConsoleButton'
import { cn } from '@/lib/utils'

/**
 * A block only ever quotes a name it can already resolve locally (owned
 * account, contact, or a shortened address) — the same restraint
 * TransactionRow takes, and for the same reason: this list can hold dozens
 * of rows on every render, and a per-row getAccount call for the on-chain
 * name would turn that into an N+1 against the node.
 */
function TransactionSummaryLine({
  transaction,
  accounts,
  contacts,
}: {
  transaction: Transaction
  accounts: SandboxAccount[]
  contacts: Contacts
}) {
  const { t } = useTranslation()
  const summary = summarize(transaction)
  const senderName = summary.senderRS ? displayName(summary.senderRS, accounts, contacts) : null
  const recipientName = summary.recipientRS
    ? displayName(summary.recipientRS, accounts, contacts)
    : null

  return (
    <span>
      <span className="font-bold text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
      <span className="text-[var(--muted)]">
        {' '}
        {senderName ?? '—'}
        {recipientName ? ` → ${recipientName}` : ''}
        {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
      </span>
    </span>
  )
}

/**
 * A block row expands in place to show what it contains — the same pattern
 * TransactionRow uses for a transaction's own detail — rather than jumping
 * the whole console to another tab the moment the row is clicked. Only a
 * click on one of the transactions inside leaves this tab, because that is
 * the point where "show me more about this one thing" actually needs the
 * transaction view's decoding, contact-saving and raw-response tooling that
 * a block row has no reason to duplicate.
 */
export function BlockRow({
  block,
  arriving,
  accounts,
  contacts,
  onSelectTransaction,
}: {
  block: Block
  /** True for the one render on which this block is new at the tip. */
  arriving?: boolean
  accounts: SandboxAccount[]
  contacts: Contacts
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const count = block.numberOfTransactions
  const transactions = (block.transactions ?? []).filter(isTransaction)

  return (
    <li
      className={cn('border-b', arriving && 'motion-arrive')}
      style={{ borderColor: 'var(--border2)' }}
    >
      <div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <RowButton
            className="flex-1 text-left"
            onClick={() => setOpen(!open)}
            disabled={count === 0}
          >
            <span className="text-[var(--muted)]">{count > 0 ? (open ? '▾' : '▸') : ' '} </span>
            <span className="font-bold text-[var(--blue3)]">#{block.height}</span>
            <span className="text-[var(--muted)]">
              {' '}
              · {count === 0 ? t('console.blocks.empty') : t('console.blocks.count', { count })}
              {' '}
              · {t('console.blocks.forger')}{' '}
              {displayName(block.generatorRS, accounts, contacts)}
            </span>
          </RowButton>
          <a
            className="text-[var(--muted)] underline"
            target="_blank"
            rel="noreferrer"
            href={`${nodeHost}/api?requestType=getBlock&height=${block.height}`}
          >
            ↗
          </a>
        </div>

        {open && transactions.length > 0 && (
          <ul
            className="mb-2 border-l-2 pl-3 text-[13px]"
            style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
          >
            {transactions.map((tx) => (
              <li key={tx.transaction} className="border-b last:border-b-0" style={{ borderColor: 'var(--border2)' }}>
                {/*
                  The stream already knows how to decode a payload, save a
                  contact and link to the raw response, so a click hands this
                  one transaction over to it rather than rebuilding a thinner
                  copy of all that here. It filters to the transaction itself,
                  not to its block: you asked about this one.
                */}
                <RowButton
                  className="flex w-full items-center py-1 text-left"
                  onClick={() => onSelectTransaction(tx.transaction)}
                >
                  <TransactionSummaryLine transaction={tx} accounts={accounts} contacts={contacts} />
                </RowButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
