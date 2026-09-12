import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { setAlias } from '@/lib/send'
import { AccountSelect, Field, SubmitButton, TextInput } from './fields'

export function AliasForm({
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
  const [aliasName, setAliasName] = useState('')
  const [aliasContent, setAliasContent] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account || !aliasName) return
    setBusy(true)
    try {
      await setAlias(account, aliasName, aliasContent)
      setAliasName('')
      setAliasContent('')
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
      <Field label={t('console.send.aliasContent')}>
        <TextInput value={aliasContent} onChange={setAliasContent} />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
