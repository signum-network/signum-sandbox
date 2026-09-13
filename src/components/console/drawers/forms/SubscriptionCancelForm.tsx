import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Amount } from '@signumjs/util'
import type { SandboxAccount } from '@/lib/accounts'
import { ledger } from '@/lib/ledger'
import { cancelSubscription } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Select } from '@/components/console/Select'
import { AccountSelect, Field, SubmitButton } from './fields'

export function SubscriptionCancelForm({
  accounts,
  forgerId,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  forgerId: string | null
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [accountId, setAccountId] = useFromAccount(forgerId)
  const [subscriptionId, setSubscriptionId] = useState('')
  const [busy, setBusy] = useState(false)

  // getAccountSubscriptions is documented as "subscriptions for this account
  // (sender)", but checked live against this node it actually returns a
  // subscription for either party — querying with the *recipient's* id
  // returned the same row as querying with the sender's. The node was
  // equally unpicky about who may cancel: a SubscriptionCancel signed by the
  // recipient, not the sender, was accepted and confirmed. Given both ends
  // are lax, the sender filter below is this form's own doing, not something
  // either the query or the node enforces — without it, the account could
  // pick and "cancel" a subscription it only receives, which is not a thing
  // it should be able to do even if the node currently lets it.
  const subscriptions = useQuery({
    queryKey: ['accountSubscriptions', accountId],
    queryFn: () => ledger.account.getAccountSubscriptions(accountId),
    enabled: accountId !== '',
    retry: false,
  })
  const cancellable = (subscriptions.data?.subscriptions ?? []).filter(
    (sub) => sub.sender === accountId,
  )

  const submit = async () => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account || !subscriptionId) return
    setBusy(true)
    try {
      await cancelSubscription(account, subscriptionId)
      setSubscriptionId('')
      onSent()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Field label={t('console.send.from')}>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>
      <Field label={t('console.send.subscription')}>
        <Select
          value={subscriptionId}
          placeholder="—"
          emptyLabel={t('console.send.noSubscriptions')}
          onChange={setSubscriptionId}
          options={cancellable.map((sub) => ({
            value: sub.id,
            label: t('console.send.subscriptionOption', {
              amount: Amount.fromPlanck(sub.amountNQT).getSigna(),
              seconds: sub.frequency,
              recipient: sub.recipientRS,
            }),
          }))}
        />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
