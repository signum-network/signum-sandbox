import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Amount } from '@signumjs/util'
import { ledger } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { useValueFlash } from '@/motion'

/**
 * Its own file because both the collapsed account row and the expanded
 * detail underneath it show a balance, and both should show the exact same
 * one — including the same "not on chain yet" discrimination — rather than
 * two components that could quietly drift apart.
 */
export function Balance({ id }: { id: string }) {
  const { t } = useTranslation()
  const balance = useQuery({
    queryKey: ['balance', id],
    queryFn: () => ledger.account.getAccountBalance(id),
    retry: false,
  })
  const value = balance.data ? Amount.fromPlanck(balance.data.balanceNQT).getSigna() : null
  const amount = useValueFlash(value)

  // An account that has never received anything does not exist on chain yet,
  // and the node answers with errorCode 5 rather than a zero balance — but
  // with retry:false, any other failure (the node restarting, a timeout) also
  // lands here, and that is not evidence the account is absent. Only the
  // node's own "unknown account" answer earns the claim; anything else says
  // nothing rather than a false one.
  if (balance.isError) {
    return isUnknownAccount(balance.error) ? (
      <span className="text-[var(--muted)]">{t('console.accounts.notOnChain')}</span>
    ) : null
  }
  if (value === null) return null
  return <span ref={amount}>{value} SIGNA</span>
}
