import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { setAccountInfo } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { AccountSelect, FeeField, Field, SubmitButton, TextInput } from './fields'
import { PayloadEditor, usePayload } from './payload'

export function AccountInfoForm({
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
  const [name, setName] = useState('')
  // Account info is what SRC44 was written for, so the structured form is the
  // starting point here rather than an option to discover.
  const payload = usePayload(true)
  const [fee, setFee] = useState(feeFor('accountInfo').getSigna())
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account || !name || payload.value === null) return
    setBusy(true)
    try {
      await setAccountInfo({ account, name, description: payload.value, fee: Amount.fromSigna(fee) })
      setName('')
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
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>
      <Field label={t('console.send.infoName')}>
        <TextInput value={name} onChange={setName} />
      </Field>
      <PayloadEditor state={payload} label={t('console.send.infoDescription')} />
      <FeeField action="accountInfo" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
