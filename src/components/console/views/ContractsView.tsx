import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Amount } from '@signumjs/util'
import type { Contract } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { contractStatus } from '@/lib/contractData'
import { matchesContract } from '@/lib/contractList'
import { displayName, type Contacts } from '@/lib/contacts'
import type { SandboxAccount } from '@/lib/accounts'
import type { Query } from '@/lib/search'
import { paginate } from '@/lib/paginate'
import { Identicon } from '@/components/Identicon'
import { InspectLink } from '@/components/contracts/InspectLink'
import { STATUS_COLOR } from '@/components/contracts/ContractHeader'
import { useValueFlash } from '@/motion'
import { Pager } from '../Pager'

/**
 * Name, address, creator, block, status, balance, link. Header and rows are
 * separate grids, so every column that is not a share of the rest is fixed.
 */
const COLUMNS =
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_64px_100px_120px_80px] items-center gap-3'

/**
 * One contract. The balance is the account's, under the key the watch view
 * and the inspector share: the list's own is the balance after the last run,
 * and a payment would not show until the contract runs again.
 */
function ContractRow({ contract, creator }: { contract: Contract; creator: string }) {
  const { t } = useTranslation()
  const account = useQuery({
    queryKey: ['account', contract.at],
    queryFn: () => ledger.account.getAccount({ accountId: contract.at }),
    retry: false,
  })
  const balance = `${Amount.fromPlanck(account.data?.balanceNQT ?? contract.balanceNQT).getSigna()} SIGNA`
  const status = contractStatus(contract)
  const balanceFlash = useValueFlash(balance)
  const statusFlash = useValueFlash(status)

  return (
    <li className={`${COLUMNS} border-b py-[6px] text-[13px]`} style={{ borderColor: 'var(--border2)' }}>
      <span className="flex min-w-0 items-center gap-2">
        <Identicon value={contract.atRS} size={16} />
        <span className="truncate font-bold text-[var(--blue3)]">{contract.name}</span>
      </span>
      <span className="truncate text-[var(--muted)]">{contract.atRS}</span>
      <span className="truncate">{creator}</span>
      <span className="tabular-nums">{contract.creationBlock}</span>
      <span ref={statusFlash} style={{ color: STATUS_COLOR[status] }}>
        {t(`inspector.status.${status}`)}
      </span>
      <span ref={balanceFlash} className="tabular-nums">
        {balance}
      </span>
      <span className="whitespace-nowrap">
        <InspectLink contractId={contract.at} />
      </span>
    </li>
  )
}

/** Every contract on the chain, newest first, each a way into the inspector. */
export function ContractsView({
  contracts,
  loading,
  accounts,
  contacts,
  query,
  page,
  onPage,
}: {
  contracts: Contract[]
  loading: boolean
  accounts: SandboxAccount[]
  contacts: Contacts
  query: Query
  page: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const creatorOf = (contract: Contract) => displayName(contract.creatorRS, accounts, contacts)
  const matching = contracts.filter((contract) =>
    matchesContract(contract, query, creatorOf(contract)),
  )
  const shown = paginate(matching, page)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Below 680px the columns would truncate to nothing, so the list scrolls sideways. */}
      <div className="themed-scroll console-scroll flex min-h-0 flex-1 flex-col overflow-auto pr-2">
        <div className="min-w-[680px]">
          <div
            className={`${COLUMNS} border-b pb-1 text-[12px] text-[var(--muted)]`}
            style={{ borderColor: 'var(--border2)' }}
          >
            <span>{t('console.contracts.name')}</span>
            <span>{t('console.accounts.address')}</span>
            <span>{t('inspector.field.creator')}</span>
            <span>{t('console.contracts.created')}</span>
            <span>{t('inspector.field.status')}</span>
            <span>{t('inspector.field.balance')}</span>
            <span />
          </div>
          <ul>
            {shown.items.length === 0 && (
              <li className="p-4 text-[13px] text-[var(--muted)]">
                {loading
                  ? '…'
                  : contracts.length === 0
                    ? t('console.contracts.none')
                    : t('console.contracts.noMatch')}
              </li>
            )}
            {shown.items.map((contract) => (
              <ContractRow key={contract.at} contract={contract} creator={creatorOf(contract)} />
            ))}
          </ul>
        </div>
      </div>
      <Pager {...shown} onPage={onPage} />
    </div>
  )
}
