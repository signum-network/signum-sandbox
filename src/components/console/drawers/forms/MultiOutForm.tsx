import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { resolveRecipientPublicKey, sendMultiOut } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextArea } from './fields'

export function MultiOutForm({
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
  const [recipients, setRecipients] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from) return
    const parsed = recipients
      .split('\n')
      .map((line) => line.split(',').map((part) => part.trim()))
      .filter((parts) => parts.length === 2 && parts[0] && parts[1])
      .map(([address, signa]) => ({ address, signa }))
    if (parsed.length === 0) return
    setBusy(true)
    try {
      // Multi-out has no field to announce a recipient's public key, so an
      // account the chain has never seen cannot be paid this way — a protocol
      // limit, not something the code can route around. Checking first turns
      // the node's raw "Incorrect recipient" into the one honest sentence we
      // already have translated for it.
      const resolutions = await Promise.all(
        parsed.map((r) => resolveRecipientPublicKey(r.address, accounts)),
      )
      if (resolutions.some((key) => key === undefined)) {
        onError(t('console.send.needsPublicKey'))
        return
      }
      await sendMultiOut(from, parsed)
      setRecipients('')
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
      <Field label={t('console.send.recipients')}>
        <TextArea value={recipients} onChange={setRecipients} />
      </Field>
      <p className="mb-2 text-[9px] text-[var(--muted)]">{t('console.send.recipientHint')}</p>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
