import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { resolveRecipientPublicKey, sendEncryptedMessage, sendPlainMessage } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Toggle } from '@/components/console/Toggle'
import { AccountSelect, FeeField, Field, RecipientPicker, SubmitButton } from './fields'
import { PayloadEditor, usePayload } from './payload'

export function MessageForm({
  accounts,
  forgerId,
  contacts,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  forgerId: string | null
  contacts: Contacts
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useFromAccount(forgerId)
  const [to, setTo] = useState('')
  // A message is text far more often than it is a descriptor, so structured
  // is the option here rather than the default.
  const payload = usePayload()
  const [encrypt, setEncrypt] = useState(false)
  const [fee, setFee] = useState(feeFor('message').getSigna())
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    const message = payload.value
    if (!from || !to || !message) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      if (encrypt) {
        // Encryption has no undefined case — without a key there is nothing
        // to encrypt with, and silently sending it plain would be a lie about
        // what was actually sent.
        if (!recipientPublicKey) {
          onError(t('console.send.needsPublicKey'))
          return
        }
        await sendEncryptedMessage({
          from,
          to,
          recipientPublicKey,
          message,
          fee: Amount.fromSigna(fee),
        })
      } else {
        await sendPlainMessage({ from, to, message, recipientPublicKey, fee: Amount.fromSigna(fee) })
      }
      setTo('')
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
      <PayloadEditor state={payload} label={t('console.send.message')} variant="attachment" />
      <div className="mb-2">
        <Toggle checked={encrypt} onChange={setEncrypt} label={t('console.send.encrypt')} />
      </div>
      <FeeField action="message" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
