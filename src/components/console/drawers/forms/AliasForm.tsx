import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { setAlias } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { AccountSelect, Field, SubmitButton, TextInput } from './fields'
import { PayloadEditor, usePayload } from './payload'

export function AliasForm({
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
  const [aliasName, setAliasName] = useState('')
  const payload = usePayload()
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account || !aliasName || payload.value === null) return
    setBusy(true)
    try {
      await setAlias(account, aliasName, payload.value)
      setAliasName('')
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
      <Field label={t('console.send.aliasName')}>
        <TextInput value={aliasName} onChange={setAliasName} />
      </Field>
      <PayloadEditor state={payload} label={t('console.send.aliasContent')} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
