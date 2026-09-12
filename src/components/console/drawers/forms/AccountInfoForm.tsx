import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { setAccountInfo } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextArea, TextInput } from './fields'

export function AccountInfoForm({
  accounts,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [accountId, setAccountId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account || !name) return
    setBusy(true)
    try {
      await setAccountInfo(account, name, description)
      setName('')
      setDescription('')
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
      <Field label={t('console.send.infoDescription')}>
        <TextArea value={description} onChange={setDescription} />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
