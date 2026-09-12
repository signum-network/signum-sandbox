import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { resolveRecipientPublicKey, sendEncryptedMessage, sendPlainMessage } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextArea, TextInput } from './fields'

export function MessageForm({
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
  const [message, setMessage] = useState('')
  const [encrypt, setEncrypt] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
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
        await sendEncryptedMessage(from, to, recipientPublicKey, message)
      } else {
        await sendPlainMessage(from, to, message, recipientPublicKey)
      }
      setTo('')
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
        <TextInput value={to} onChange={setTo} placeholder="TS-…" />
      </Field>
      <Field label={t('console.send.message')}>
        <TextArea value={message} onChange={setMessage} />
      </Field>
      <label className="mb-2 flex items-center gap-2 text-[10px] text-[var(--muted)]">
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
        {t('console.send.encrypt')}
      </label>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
