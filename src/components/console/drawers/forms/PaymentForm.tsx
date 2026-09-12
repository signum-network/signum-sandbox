import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { resolveRecipientPublicKey, sendPayment } from '@/lib/send'
import { AccountSelect, Field, RecipientPicker, SubmitButton, TextArea, TextInput } from './fields'

export function PaymentForm({
  accounts,
  contacts,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  contacts: Contacts
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [attach, setAttach] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !to || !amount) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await sendPayment(from, to, amount, recipientPublicKey, attach ? message : undefined)
      setTo('')
      setAmount('')
      setMessage('')
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
      <label className="mb-2 flex items-center gap-2 text-[10px] text-[var(--muted)]">
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        {t('console.send.attach')}
      </label>
      {attach && (
        <Field label={t('console.send.message')}>
          <TextArea value={message} onChange={setMessage} />
        </Field>
      )}
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
