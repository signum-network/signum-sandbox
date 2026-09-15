import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Amount } from '@signumjs/util'
import type { ReactNode } from 'react'
import type { Transaction } from '@signumjs/core'
import { ledger, nodeHost } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { src44Fields } from '@/lib/payload'
import { summarize } from '@/lib/txSummary'
import { displayName, type Contacts } from '@/lib/contacts'
import type { SandboxAccount } from '@/lib/accounts'
import { Identicon } from '../Identicon'
import { ConsoleButton, RowButton } from '../ConsoleButton'
import { Row, Holding } from './AccountFields'
import { Term } from '@/components/console/Term'
import { useArrivals, useValueFlash } from '@/motion'
import { cn } from '@/lib/utils'

/** How much of each direction the view shows before it stops being a summary. */
const RECENT = 10

/**
 * A labelled line that flashes when its value becomes a different value.
 *
 * A component rather than a call inside the render, because several of these
 * lines come out of a `map` over the SRC44 fields and a hook cannot be called
 * from a callback.
 */
function ChangingRow({
  label,
  value,
}: {
  label: ReactNode
  /** Nullable because an SRC44 field can carry a label with no value. */
  value: string | null
}) {
  const flash = useValueFlash(value)
  return (
    <Row label={label}>
      <span ref={flash}>{value}</span>
    </Row>
  )
}

function Direction({
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
  onSelectTransaction: (transactionId: string) => void
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
            return (
              <li
                key={tx.transaction}
                className={cn('border-b', arrived.has(tx.transaction) && 'motion-arrive')}
                style={{ borderColor: 'var(--border2)' }}
              >
                <div>
                  <RowButton
                    className="w-full py-1 text-left text-[13px]"
                    onClick={() => onSelectTransaction(tx.transaction)}
                  >
                    <span className="text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
                    <span className="text-[var(--muted)]">
                      {' '}
                      {other ? displayName(other, accounts, contacts) : '—'}
                      {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
                    </span>
                  </RowButton>
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

/**
 * One account, watched.
 *
 * Unlike the accounts tab this makes no assumption that the sandbox owns the
 * subject — there is no passphrase here, and the account may be a contact or
 * a bare address. What it adds instead is direction: what came in and what
 * went out, side by side, which is the question you keep an eye on an account
 * to answer.
 */
export function WatchView({
  accountId,
  accounts,
  contacts,
  onUnwatch,
  onSelectTransaction,
}: {
  accountId: string
  accounts: SandboxAccount[]
  contacts: Contacts
  onUnwatch: () => void
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()

  const details = useQuery({
    queryKey: ['account', accountId],
    queryFn: () => ledger.account.getAccount({ accountId }),
    retry: false,
  })

  const outgoing = useQuery({
    queryKey: ['sentBy', accountId],
    queryFn: () =>
      ledger.account.getAccountTransactionsFromSender({
        senderId: accountId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: details.isSuccess,
    retry: false,
  })

  const incoming = useQuery({
    queryKey: ['receivedBy', accountId],
    queryFn: () =>
      ledger.account.getAccountTransactionsToRecipient({
        recipientId: accountId,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: details.isSuccess,
    retry: false,
  })

  const chain = details.data
  const address = chain?.accountRS ?? accountId
  const description = chain?.description ? src44Fields(chain.description) : null
  const notOnChain = details.isError && isUnknownAccount(details.error)

  const name = displayName(accountId, accounts, contacts, chain?.name)
  const nameFlash = useValueFlash(name)
  const balance = chain ? `${Amount.fromPlanck(chain.balanceNQT).getSigna()} SIGNA` : null
  const balanceFlash = useValueFlash(balance)
  /*
    The whole holdings block is treated as one value, signed by every pair of
    asset and quantity it contains. assetBalances is not ordered by recency, so
    the arrivals rule — the leading run of unfamiliar ids — has nothing to mean
    here; and a token appearing for the first time is as much news as a
    quantity moving, so both should be seen. One flash for "your holdings
    changed" is the honest granularity at the two or three holdings a sandbox
    account carries. At thirty it would be too coarse.
  */
  const holdings = chain?.assetBalances
    ? chain.assetBalances.map((b) => `${b.asset}:${b.balanceQNT}`).join('|')
    : null
  const holdingsFlash = useValueFlash(holdings)

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Identicon value={address} size={24} />
        <span ref={nameFlash} className="text-[15px] font-bold text-[var(--blue3)]">
          {name}
        </span>
        <span className="text-[13px] text-[var(--muted)]">{address}</span>
        <span className="ml-auto">
          <ConsoleButton onClick={onUnwatch}>{t('console.watch.stop')}</ConsoleButton>
        </span>
      </div>

      {notOnChain ? (
        <p className="text-[13px] text-[var(--muted)]">{t('console.accounts.notOnChain')}</p>
      ) : (
        <>
          <Row label={t('console.accounts.balance')}>
            <span ref={balanceFlash}>{balance ?? '…'}</span>
          </Row>
          {chain?.name && (
            <ChangingRow label={t('console.accounts.onChainName')} value={chain.name} />
          )}
          {description?.map((field) => (
            <ChangingRow key={field.label} label={field.label} value={field.value} />
          ))}
          <Row label={<Term id="token">{t('console.accounts.holdings')}</Term>}>
            {chain?.assetBalances?.length ? (
              <span ref={holdingsFlash} className="flex flex-col gap-[2px]">
                {chain.assetBalances.map((b) => (
                  <Holding key={b.asset} assetId={b.asset} quantityQNT={b.balanceQNT} />
                ))}
              </span>
            ) : (
              t('console.accounts.noHoldings')
            )}
          </Row>
          <Row label={t('console.tx.raw')}>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getAccount&account=${accountId}`}
            >
              ↗ getAccount
            </a>
          </Row>

          <div className="mt-4 flex flex-wrap gap-6">
            <Direction
              label={t('console.watch.incoming')}
              transactions={incoming.data?.transactions}
              accounts={accounts}
              contacts={contacts}
              onSelectTransaction={onSelectTransaction}
            />
            <Direction
              label={t('console.watch.outgoing')}
              transactions={outgoing.data?.transactions}
              accounts={accounts}
              contacts={contacts}
              onSelectTransaction={onSelectTransaction}
            />
          </div>
        </>
      )}
    </div>
  )
}
