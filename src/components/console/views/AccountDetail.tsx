import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Amount } from '@signumjs/util'
import type { SandboxAccount } from '@/lib/accounts'
import { ledger, nodeHost } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { src44Fields } from '@/lib/payload'
import { summarize } from '@/lib/txSummary'
import { displayName, type Contacts } from '@/lib/contacts'
import { PassphraseField, Row, Holding } from './AccountFields'
import { RowButton } from '../ConsoleButton'
import { Term } from '@/components/console/Term'

/** How much of an account's history the detail shows before it stops being a summary. */
const RECENT = 5

/**
 * A holding is only readable once the asset itself is fetched: the account
 * record carries an id and an integer quantity, and the name and the decimal
 * place live on the asset. One request per distinct holding is affordable
 * here because a row is open only when someone is looking at it.
 */

/**
 * The whole account in one place: what the sandbox knows about it, what the
 * chain knows about it, and what it has been doing. Anything the chain has
 * not heard of yet is simply absent rather than shown as empty.
 */
export function AccountDetail({
  account,
  accounts,
  contacts,
  onSelectTransaction,
}: {
  account: SandboxAccount
  accounts: SandboxAccount[]
  contacts: Contacts
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()

  // getAccount answers name, description, balance and holdings together, so
  // the bulk of this view costs a single request.
  const details = useQuery({
    queryKey: ['account', account.id],
    queryFn: () => ledger.account.getAccount({ accountId: account.id }),
    retry: false,
  })

  // Aliases and history are separate on-chain entities with their own
  // endpoints; both wait until the account is known to exist, since an
  // account absent from the chain can hold neither.
  const aliases = useQuery({
    queryKey: ['aliases', account.id],
    queryFn: () => ledger.alias.getAliases({ accountId: account.id }),
    enabled: details.isSuccess,
    retry: false,
  })

  const history = useQuery({
    queryKey: ['accountTransactions', account.id],
    queryFn: () =>
      ledger.account.getAccountTransactions({
        accountId: account.id,
        firstIndex: 0,
        lastIndex: RECENT - 1,
      }),
    enabled: details.isSuccess,
    retry: false,
  })

  const notOnChain = details.isError && isUnknownAccount(details.error)
  const chain = details.data
  const description = chain?.description ? src44Fields(chain.description) : null
  const unconfirmed = chain && chain.unconfirmedBalanceNQT !== chain.balanceNQT

  return (
    <div
      className="mb-2 border-l-2 py-2 pl-3 text-[13px]"
      style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
    >
      <PassphraseField passphrase={account.passphrase} />
      <Row label={<Term id="accountId">{t('console.accounts.id')}</Term>}>{account.id}</Row>
      <Row label={<Term id="address">{t('console.accounts.address')}</Term>}>{account.address}</Row>

      {notOnChain ? (
        <p className="mt-1 text-[var(--muted)]">{t('console.accounts.notOnChain')}</p>
      ) : (
        <>
          <Row label={t('console.accounts.balance')}>
            {chain ? `${Amount.fromPlanck(chain.balanceNQT).getSigna()} SIGNA` : '…'}
            {unconfirmed && (
              <span className="text-[var(--muted)]">
                {' '}
                · {t('console.accounts.unconfirmed')}{' '}
                {Amount.fromPlanck(chain.unconfirmedBalanceNQT).getSigna()}
              </span>
            )}
          </Row>

          {chain?.publicKey && (
            <Row label={<Term id="publicKey">{t('console.accounts.publicKey')}</Term>}>
              <span className="font-mono break-all">{chain.publicKey}</span>
            </Row>
          )}

          {chain?.name && <Row label={t('console.accounts.onChainName')}>{chain.name}</Row>}

          {description
            ? description.map((field) => (
                <Row key={field.label} label={field.label}>
                  {field.value}
                </Row>
              ))
            : chain?.description && (
                <Row label={t('console.accounts.description')}>{chain.description}</Row>
              )}

          <Row label={<Term id="token">{t('console.accounts.holdings')}</Term>}>
            {chain?.assetBalances?.length ? (
              <span className="flex flex-col gap-[2px]">
                {chain.assetBalances.map((b) => (
                  <Holding key={b.asset} assetId={b.asset} quantityQNT={b.balanceQNT} />
                ))}
              </span>
            ) : (
              t('console.accounts.noHoldings')
            )}
          </Row>

          <Row label={<Term id="alias">{t('console.accounts.aliases')}</Term>}>
            {aliases.data?.aliases.length
              ? aliases.data.aliases
                  .map((a) => (a.aliasURI ? `${a.aliasName} → ${a.aliasURI}` : a.aliasName))
                  .join(', ')
              : t('console.accounts.noAliases')}
          </Row>

          <Row label={t('console.accounts.recent')}>
            {history.data?.transactions.length ? (
              <span className="flex flex-col items-start gap-[2px]">
                {history.data.transactions.map((tx) => {
                  const summary = summarize(tx)
                  return (
                    <RowButton
                      key={tx.transaction}
                      className="text-left"
                      onClick={() => onSelectTransaction(tx.transaction)}
                    >
                      <span className="text-[var(--blue3)]">
                        {t(`console.kind.${summary.kind}`)}
                      </span>
                      <span className="text-[var(--muted)]">
                        {' '}
                        {summary.senderRS
                          ? displayName(summary.senderRS, accounts, contacts)
                          : '—'}
                        {summary.recipientRS
                          ? ` → ${displayName(summary.recipientRS, accounts, contacts)}`
                          : ''}
                        {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
                      </span>
                    </RowButton>
                  )
                })}
              </span>
            ) : (
              t('console.accounts.noRecent')
            )}
          </Row>
        </>
      )}

      <Row label={t('console.tx.raw')}>
        <a
          className="text-[var(--blue3)] underline"
          target="_blank"
          rel="noreferrer"
          href={`${nodeHost}/api?requestType=getAccount&account=${account.id}`}
        >
          ↗ getAccount
        </a>
      </Row>
    </div>
  )
}
