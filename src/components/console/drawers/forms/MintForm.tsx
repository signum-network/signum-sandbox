import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import { ledger } from '@/lib/ledger'
import { mintAsset } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Select } from '@/components/console/Select'
import { AccountSelect, Field, SubmitButton, TextInput } from './fields'

export function MintForm({
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
  const [assetId, setAssetId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)

  // Same call TokenTransferForm uses to list an owner's tokens; the Asset
  // record does carry a `mintable` flag, so the list here is filtered down
  // to only the tokens minting can actually succeed on. If the node's
  // notion of mintable ever drifts from what it reports here, the mint call
  // itself still fails loudly with "this asset is not mintable" — this
  // filter is a convenience, not the enforcement.
  const tokens = useQuery({
    queryKey: ['assetsByOwner', issuerId],
    queryFn: () => ledger.asset.getAssetsByOwner({ accountId: issuerId }),
    enabled: issuerId !== '',
    retry: false,
  })
  const mintableTokens = (tokens.data?.assets ?? []).filter((asset) => asset.mintable)

  const submit = async () => {
    const issuer = accounts.find((a) => a.id === issuerId)
    if (!issuer || !assetId || !quantity) return
    setBusy(true)
    try {
      await mintAsset(issuer, assetId, quantity)
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
        <AccountSelect accounts={accounts} value={issuerId} onChange={setIssuerId} />
      </Field>
      <Field label={t('console.send.token')}>
        <Select
          value={assetId}
          placeholder="—"
          emptyLabel={t('console.send.noMintableTokens')}
          onChange={setAssetId}
          options={mintableTokens.map((asset) => ({
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
