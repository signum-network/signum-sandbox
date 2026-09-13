import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { feeFor } from '@/lib/fees'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { ledger } from '@/lib/ledger'
import { resolveRecipientPublicKey, transferAlias } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { Select } from '@/components/console/Select'
import { AccountSelect, FeeField, Field, RecipientPicker, SubmitButton } from './fields'

export function AliasTransferForm({
  accounts,
  contacts,
  forgerId,
  onSent,
  onError,
}: {
  accounts: SandboxAccount[]
  contacts: Contacts
  forgerId: string | null
  onSent: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useFromAccount(forgerId)
  const [aliasName, setAliasName] = useState('')
  const [to, setTo] = useState('')
  const [fee, setFee] = useState(feeFor('alias').getSigna())
  const [busy, setBusy] = useState(false)

  // Only an alias the sender actually holds can be handed on, so the list is
  // theirs rather than a free-text field that would fail at the node.
  const aliases = useQuery({
    queryKey: ['aliases', fromId],
    queryFn: () => ledger.alias.getAliases({ accountId: fromId }),
    enabled: fromId !== '',
    retry: false,
  })

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from || !aliasName || !to) return
    setBusy(true)
    try {
      const recipientPublicKey = await resolveRecipientPublicKey(to, accounts)
      await transferAlias({ from, aliasName, to, recipientPublicKey, fee: Amount.fromSigna(fee) })
      setAliasName('')
      setTo('')
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
      <Field label={t('console.send.aliasName')}>
        <Select
          value={aliasName}
          placeholder="—"
          emptyLabel={t('console.accounts.noAliases')}
          onChange={setAliasName}
          options={(aliases.data?.aliases ?? []).map((a) => ({
            value: a.aliasName,
            label: a.aliasName,
            sublabel: a.aliasURI,
          }))}
        />
      </Field>
      <Field label={t('console.send.to')}>
        <RecipientPicker accounts={accounts} contacts={contacts} value={to} onChange={setTo} />
      </Field>
      <FeeField action="alias" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
