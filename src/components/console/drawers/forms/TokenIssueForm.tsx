import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import { issueToken } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Toggle } from '@/components/console/Toggle'
import { AccountSelect, FeeField, Field, SubmitButton, TextInput } from './fields'
import { PayloadEditor, usePayload } from './payload'

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
  const payload = usePayload()
  const [mintable, setMintable] = useState(false)
  const [fee, setFee] = useState(feeFor('issueAsset').getSigna())
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const issuer = accounts.find((a) => a.id === issuerId)
    if (!issuer || !tokenName || !tokenQuantity || payload.value === null) return
    setBusy(true)
    try {
      await issueToken({
        issuer,
        name: tokenName,
        quantity: tokenQuantity,
        decimals: Number(tokenDecimals),
        description: payload.value,
        mintable,
        fee: Amount.fromSigna(fee),
      })
      setTokenName('')
      setTokenQuantity('1000')
      setTokenDecimals('0')
      payload.reset()
      setMintable(false)
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
      <PayloadEditor state={payload} label={t('console.send.tokenDescription')} />
      <div className="mb-2">
        <Toggle checked={mintable} onChange={setMintable} label={t('console.send.mintable')} />
      </div>
      <FeeField action="issueAsset" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
