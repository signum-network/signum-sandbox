import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAnimate } from 'framer-motion'
import { Amount } from '@signumjs/util'
import { ledger } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { useMotion, seconds } from '@/motion'

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
  const [amount, animate] = useAnimate<HTMLSpanElement>()
  const { enabled } = useMotion()
  const shown = useRef<string | null>(null)
  const value = balance.data ? Amount.fromPlanck(balance.data.balanceNQT).getSigna() : null

  // Only a change earns the flash. The query refetches on its own schedule and
  // mostly answers with the number that is already on screen; flashing for
  // those would make a still balance look busy.
  useEffect(() => {
    if (value === null) return
    const previous = shown.current
    shown.current = value
    if (previous === null || previous === value) return
    if (!enabled || !amount.current) return
    void animate(amount.current, { opacity: [0.3, 1] }, { duration: seconds('quick') })
  }, [value, enabled, animate, amount])

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
