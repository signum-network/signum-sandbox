import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { createSubscription, resolveRecipientPublicKey } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextInput } from './fields'

export function SubscriptionForm({
  accounts,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('3600')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !to || !amount || !frequency) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await createSubscription(from, to, amount, Number(frequency), recipientPublicKey)
      setTo('')
      setAmount('')
      setFrequency('3600')
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
        <AccountSelect accounts={accounts} value={fromId} onChange={setFromId} />
      </Field>
      <Field label={t('console.send.to')}>
        <TextInput value={to} onChange={setTo} placeholder="TS-…" />
      </Field>
      <Field label={t('console.send.amount')}>
        <TextInput value={amount} onChange={setAmount} placeholder="100" />
      </Field>
      <Field label={t('console.send.frequency')}>
        <TextInput value={frequency} onChange={setFrequency} placeholder="3600" />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
