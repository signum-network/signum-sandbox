import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { resolveRecipientPublicKey, transferToken } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Select } from '@/components/console/Select'
import { AccountSelect, Field, RecipientPicker, SubmitButton, TextInput } from './fields'

export function TokenTransferForm({
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
  const [assetId, setAssetId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)

  // SignumJS names this getAssetsByOwner, not getAccountAssets — the client
  // method and the API request type differ here.
  const tokens = useQuery({
    queryKey: ['assetsByOwner', fromId],
    queryFn: () => ledger.asset.getAssetsByOwner({ accountId: fromId }),
    enabled: fromId !== '',
    retry: false,
  })

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !to || !assetId || !quantity) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await transferToken(from, to, assetId, quantity, recipientPublicKey)
      setTo('')
      setAssetId('')
      setQuantity('')
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
      <Field label={t('console.send.token')}>
        <Select
          value={assetId}
          placeholder="—"
          onChange={setAssetId}
          options={(tokens.data?.assets ?? []).map((asset) => ({
            value: asset.asset,
            label: asset.name,
          }))}
        />
      </Field>
      <Field label={t('console.send.amount')}>
        <TextInput value={quantity} onChange={setQuantity} placeholder="1" />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
