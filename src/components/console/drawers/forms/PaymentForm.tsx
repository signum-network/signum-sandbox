import { useEffect, useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { resolveRecipientPublicKey, sendPayment } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Toggle } from '@/components/console/Toggle'
import { AccountSelect, FeeField, Field, RecipientPicker, SubmitButton, TextInput } from './fields'
import { PayloadEditor, usePayload } from './payload'
import { Term } from '@/components/console/Term'

export function PaymentForm({
  accounts,
  forgerId,
  contacts,
  initialSigna,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  forgerId: string | null
  contacts: Contacts
  /** A starting amount, for the tour. The field stays fully editable. */
  initialSigna?: string
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useFromAccount(forgerId)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState(initialSigna ?? '')

  // The tour opens this drawer one step before it suggests an amount, so by
  // the time the suggestion exists the field has long since been initialised
  // and useState ignores it. Filled on arrival instead, and only on arrival:
  // the tour proposes a number, it does not hold the field.
  useEffect(() => {
    if (initialSigna) setAmount(initialSigna)
  }, [initialSigna])
  const [attach, setAttach] = useState(false)
  const payload = usePayload()
  const [fee, setFee] = useState(feeFor('payment').getSigna())
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    const attached = payload.value ?? undefined
    if (!from || !to || !amount) return
    if (attach && attached === undefined) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await sendPayment({
        from,
        to,
        signa: amount,
        recipientPublicKey,
        message: attach ? attached : undefined,
        fee: Amount.fromSigna(fee),
      })
      setTo('')
      setAmount('')
      payload.reset()
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
        <RecipientPicker accounts={accounts} contacts={contacts} value={to} onChange={setTo} />
      </Field>
      <Field label={t('console.send.amount')}>
        <TextInput value={amount} onChange={setAmount} placeholder="100" />
      </Field>
      <div className="mb-2">
        <Toggle
          checked={attach}
          onChange={setAttach}
          label={<Term id="payload">{t('console.send.attach')}</Term>}
        />
      </div>
      {attach && (
        <PayloadEditor state={payload} label={t('console.send.message')} variant="attachment" />
      )}
      <FeeField action="payment" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
