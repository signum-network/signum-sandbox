import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { PAGE_WIDTH } from '@/components/pageShell'
import { Unreachable } from '@/components/startpage'
import { BeginnerMode } from '@/components/console/BeginnerMode'
import { useBeginner } from '@/hooks/useBeginner'
import { useNodeState } from '@/hooks/useNodeState'
import { useAccounts } from '@/hooks/useAccounts'
import { useContacts } from '@/hooks/useContacts'
import { useContractInspector } from '@/hooks/useContractInspector'
import { useContractLabels } from '@/hooks/useContractLabels'
import { ViewNote } from '@/components/console/ViewNote'
import { Direction } from '@/components/console/views/Direction'
import { ContractHeader } from './ContractHeader'
import { DataStackTable } from './DataStackTable'
import { knownIds, type KnownId } from '@/lib/contractData'
import { displayName } from '@/lib/contacts'
import { toAccountId } from '@/lib/recipient'
import { cn } from '@/lib/utils'

/** The contract id a URL names, or null when it names none. */
function parseContractId(param: string): string | null {
  try {
    return toAccountId(param)
  } catch {
    return null
  }
}

/**
 * Everything below the page's own header, for an id that parses. A component
 * of its own so the queries never run for one that does not.
 */
function ContractBody({ contractId, height }: { contractId: string; height: number | null }) {
  const { t } = useTranslation()
  const { accounts, addressPrefix } = useAccounts()
  const { contacts } = useContacts()
  const inspector = useContractInspector(contractId, height)
  const contract = inspector.contract
  const { labels, setLabel } = useContractLabels(contract?.machineCodeHashId ?? null)
  // The contract itself and its creator, on top of what the console knows.
  const known = useMemo(
    () =>
      contract
        ? knownIds(accounts, contacts, [
            { id: contract.at, name: contract.name, contract: true },
            {
              id: contract.creator,
              name: displayName(contract.creatorRS, accounts, contacts),
              contract: false,
            },
          ])
        : new Map<string, KnownId>(),
    [contract, accounts, contacts],
  )

  if (inspector.notFound) {
    return <p className="text-[13px] text-[var(--muted)]">{t('inspector.notFound')}</p>
  }
  if (!contract) {
    return <p className="text-[13px] text-[var(--muted)]">…</p>
  }

  return (
    <div className="text-[13px]">
      <ViewNote id="contract" terms={['contract', 'activation', 'codeHash']} />
      <ContractHeader
        contract={contract}
        account={inspector.account}
        accounts={accounts}
        contacts={contacts}
      />
      <div className="mt-4">
        <ViewNote id="contractData" terms={['dataStack']} />
      </div>
      <DataStackTable
        slots={inspector.slots}
        layout={inspector.layout}
        changed={inspector.changed}
        labels={labels}
        onLabel={setLabel}
        known={known}
        addressPrefix={addressPrefix}
        codeHash={contract.machineCodeHashId}
      />
      <div className="mt-4 flex flex-wrap gap-6">
        <Direction
          direction="incoming"
          label={t('console.watch.incoming')}
          transactions={inspector.incoming}
          accounts={accounts}
          contacts={contacts}
        />
        <Direction
          direction="outgoing"
          label={t('console.watch.outgoing')}
          transactions={inspector.outgoing}
          accounts={accounts}
          contacts={contacts}
        />
      </div>
    </div>
  )
}

/**
 * One contract, on a page of its own.
 *
 * A route rather than a console tab: the tabs are state inside the console,
 * and a contract is something worth a link. The page keeps its own eye on
 * the chain through useNodeState, so everything below refreshes on a block
 * the same way the console does.
 */
export function ContractPage({ param }: { param: string }) {
  const { t } = useTranslation()
  const { state, nodeAddress } = useNodeState()
  const beginner = useBeginner()
  const contractId = parseContractId(param)

  if (state.kind === 'unreachable') {
    return (
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <Unreachable nodeAddress={nodeAddress} />
      </div>
    )
  }

  return (
    <BeginnerMode on={beginner.beginner}>
      <div className={cn('mx-auto p-6', PAGE_WIDTH)}>
        <AppHeader
          networkName={state.networkName}
          version={state.version}
          connection={state.connection}
          scanning={state.scanning}
          homeLink
        />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] uppercase tracking-[1px] text-[var(--blue3)]">
            {t('inspector.title')}
          </span>
          <span className="flex items-center gap-3 text-[13px]">
            <span>
              <span className="text-[var(--muted)]">{t('console.chain.height')} </span>
              <span className="font-bold text-[var(--blue3)]">{state.height ?? '—'}</span>
            </span>
            <Link className="text-[var(--blue3)] underline" to="/console">
              {t('inspector.back')}
            </Link>
          </span>
        </div>
        {contractId === null ? (
          <p className="text-[13px] text-[var(--muted)]">{t('inspector.notFound')}</p>
        ) : (
          <ContractBody contractId={contractId} height={state.height ?? null} />
        )}
      </div>
    </BeginnerMode>
  )
}
