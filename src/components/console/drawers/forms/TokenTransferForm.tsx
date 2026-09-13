import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { resolveRecipientPublicKey, transferToken } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Select } from '@/components/console/Select'
import { Toggle } from '@/components/console/Toggle'
import { AccountSelect, FeeField, Field, RecipientPicker, SubmitButton, TextInput } from './fields'
import { PayloadEditor, usePayload } from './payload'
import { Term } from '@/components/console/Term'

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
  // A transfer can carry a message beside the asset, and that message can be
  // an SRC44 descriptor — what the transfer was for, in a form another
  // application can read.
  const [attach, setAttach] = useState(false)
  const payload = usePayload()
  const [fee, setFee] = useState(feeFor('transferAsset').getSigna())
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
    const attached = payload.value ?? undefined
    if (!from || !to || !assetId || !quantity) return
    if (attach && attached === undefined) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await transferToken({
        from,
        to,
        assetId,
        quantity,
        recipientPublicKey,
        message: attach ? attached : undefined,
        fee: Amount.fromSigna(fee),
      })
      setTo('')
      setAssetId('')
      setQuantity('')
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
      <label className="mb-2 flex items-center gap-2">
        <Toggle
          checked={attach}
          onChange={setAttach}
          label={<Term id="payload">{t('console.send.attach')}</Term>}
        />
      </label>
      {attach && (
        <PayloadEditor state={payload} label={t('console.send.message')} variant="attachment" />
      )}
      <FeeField action="transferAsset" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
