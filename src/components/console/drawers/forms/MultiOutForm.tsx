import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { resolveRecipientPublicKey, sendMultiOut } from '@/lib/send'
import { AccountSelect, Field, knownRecipients, SubmitButton, TextArea } from './fields'

export function MultiOutForm({
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
  const [recipients, setRecipients] = useState('')
  const [busy, setBusy] = useState(false)
  const parties = knownRecipients(accounts, contacts)

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
      {/*
        A textarea of "address, amount" lines has no field to pick from, so
        the picker itself does not fit here. Listing known parties as plain
        text is the simplest honest substitute: it makes names and addresses
        discoverable to copy into a line without pretending the control does
        more than it does.
      */}
      {parties.length > 0 && (
        <p className="mb-2 text-[9px] text-[var(--muted)]">
          {t('console.send.knownParties')} {parties.map((p) => `${p.name} (${p.address})`).join(', ')}
        </p>
      )}
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
