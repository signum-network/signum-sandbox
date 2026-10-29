import { useTranslation } from 'react-i18next'
import { Amount } from '@signumjs/util'
import type { Account, Contract } from '@signumjs/core'
import { nodeHost } from '@/lib/ledger'
import { contractStatus, wakeThreshold, type ContractStatus } from '@/lib/contractData'
import { displayName, type Contacts } from '@/lib/contacts'
import type { SandboxAccount } from '@/lib/accounts'
import { Identicon } from '@/components/Identicon'
import { CopyLink } from '@/components/console/DidLink'
import { Row, Holding } from '@/components/console/views/AccountFields'
import { Term } from '@/components/console/Term'
import { useValueFlash } from '@/motion'
import { WatchLink } from './WatchLink'

/**
 * Amber for a run cut off for lack of SIGNA, magenta once nothing will make
 * it run again. Finished is green: the next call starts it from the top.
 */
export const STATUS_COLOR: Record<ContractStatus, string> = {
  running: 'var(--green)',
  stopped: 'var(--green)',
  finished: 'var(--green)',
  idle: 'var(--green)',
  outOfFunds: 'var(--amber)',
  dead: 'var(--mag)',
}

/** The statuses that need a sentence on what happens next. */
const HINTED: ReadonlySet<ContractStatus> = new Set(['outOfFunds', 'finished', 'stopped'])

const signa = (planck: string) => `${Amount.fromPlanck(planck).getSigna()} SIGNA`

/** Who the contract is, what it holds, and whether it runs. */
export function ContractHeader({
  contract,
  account,
  accounts,
  contacts,
}: {
  contract: Contract
  account: Account | undefined
  accounts: SandboxAccount[]
  contacts: Contacts
}) {
  const { t } = useTranslation()
  const status = contractStatus(contract)

  const threshold = wakeThreshold(contract)
  // The account's balance, not getAT's: that one is the balance after the
  // last run, so a payment would not show until the contract runs again.
  const balance = signa(account?.balanceNQT ?? contract.balanceNQT)
  const balanceFlash = useValueFlash(balance)
  const statusFlash = useValueFlash(status)
  // One flash for the whole holdings block, as in the watch view.
  const holdings = account?.assetBalances
    ? account.assetBalances.map((b) => `${b.asset}:${b.balanceQNT}`).join('|')
    : null
  const holdingsFlash = useValueFlash(holdings)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Identicon value={contract.atRS} size={24} />
        <span className="text-[15px] font-bold text-[var(--blue3)]">{contract.name}</span>
        <span className="text-[13px] text-[var(--muted)]">{contract.atRS}</span>
        <CopyLink value={contract.at} />
      </div>

      {/* What the contract is on the left, how it stands on the right. */}
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          {contract.description && (
            <Row label={t('inspector.field.description')}>{contract.description}</Row>
          )}
          <Row label={t('inspector.field.creator')}>
            {displayName(contract.creatorRS, accounts, contacts)}{' '}
            <span className="text-[var(--muted)]">{contract.creatorRS}</span>{' '}
            <WatchLink address={contract.creatorRS} />
          </Row>
          <Row label={t('inspector.field.created')}>{contract.creationBlock}</Row>
          <Row label={t('inspector.field.version')}>{contract.atVersion}</Row>
          <Row label={<Term id="codeHash" />}>
            <span className="font-mono">{contract.machineCodeHashId}</span>
          </Row>
          <Row label={t('console.tx.raw')}>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getAT&at=${contract.at}`}
            >
              ↗ getAT
            </a>
          </Row>
        </div>
        <div>
          <Row label={t('inspector.field.balance')}>
            <span ref={balanceFlash}>{balance}</span>
          </Row>
          <Row label={<Term id="token">{t('console.accounts.holdings')}</Term>}>
            {account?.assetBalances?.length ? (
              <span ref={holdingsFlash} className="flex flex-col gap-[2px]">
                {account.assetBalances.map((b) => (
                  <Holding key={b.asset} assetId={b.asset} quantityQNT={b.balanceQNT} />
                ))}
              </span>
            ) : (
              t('console.accounts.noHoldings')
            )}
          </Row>
          <Row label={<Term id="activation" />}>{signa(contract.minActivation)}</Row>
          <Row label={t('inspector.field.status')}>
            <span ref={statusFlash} style={{ color: STATUS_COLOR[status] }}>
              {t(`inspector.status.${status}`)}
            </span>
            {HINTED.has(status) && (
              <span className="block text-[12px] text-[var(--muted)]">
                {t(`inspector.hint.${status}`)}
              </span>
            )}
            {threshold && status !== 'dead' && (
              <span className="block text-[12px] text-[var(--muted)]">
                {t('inspector.wakesAt', { threshold: Amount.fromPlanck(threshold).getSigna() })}
              </span>
            )}
          </Row>
          <Row label={t('inspector.field.nextBlock')}>{contract.nextBlock}</Row>
        </div>
      </div>
    </div>
  )
}
