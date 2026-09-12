import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { issueToken } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { AccountSelect, Field, SubmitButton, TextArea, TextInput } from './fields'

export function TokenIssueForm({
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
  const [issuerId, setIssuerId] = useFromAccount(forgerId)
  const [tokenName, setTokenName] = useState('')
  const [tokenQuantity, setTokenQuantity] = useState('1000')
  const [tokenDecimals, setTokenDecimals] = useState('0')
  const [tokenDescription, setTokenDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const issuer = accounts.find((a) => a.id === issuerId)
    if (!issuer || !tokenName || !tokenQuantity) return
    setBusy(true)
    try {
      await issueToken(issuer, tokenName, tokenQuantity, Number(tokenDecimals), tokenDescription)
      setTokenName('')
      setTokenQuantity('1000')
      setTokenDecimals('0')
      setTokenDescription('')
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
        <AccountSelect accounts={accounts} value={issuerId} onChange={setIssuerId} />
      </Field>
      <Field label={t('console.send.tokenName')}>
        <TextInput value={tokenName} onChange={setTokenName} />
      </Field>
      <Field label={t('console.send.tokenQuantity')}>
        <TextInput value={tokenQuantity} onChange={setTokenQuantity} placeholder="1000" />
      </Field>
      <Field label={t('console.send.tokenDecimals')}>
        <TextInput value={tokenDecimals} onChange={setTokenDecimals} placeholder="0" />
      </Field>
      <Field label={t('console.send.tokenDescription')}>
        <TextArea value={tokenDescription} onChange={setTokenDescription} />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
