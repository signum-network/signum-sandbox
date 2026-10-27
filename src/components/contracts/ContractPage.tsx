import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { PAGE_WIDTH } from '@/components/pageShell'
import { Unreachable } from '@/components/startpage'
import { BeginnerMode } from '@/components/console/BeginnerMode'
import { useBeginner } from '@/hooks/useBeginner'
import { useNodeState } from '@/hooks/useNodeState'
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
          <p className="text-[13px] text-[var(--muted)]">{contractId}</p>
        )}
      </div>
    </BeginnerMode>
  )
}
