import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { resolveRecipientPublicKey, transferToken } from '@/lib/send'
import { AccountSelect, Field, RecipientPicker, SubmitButton, TextInput } from './fields'

export function TokenTransferForm({
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
        <select
          className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
          style={{ borderColor: 'var(--border2)' }}
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
        >
          <option value="">—</option>
          {(tokens.data?.assets ?? []).map((asset) => (
            <option key={asset.asset} value={asset.asset}>
              {asset.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('console.send.amount')}>
        <TextInput value={quantity} onChange={setQuantity} placeholder="1" />
      </Field>
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
