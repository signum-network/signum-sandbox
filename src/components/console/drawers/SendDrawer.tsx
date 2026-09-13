import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { sfx, useAudio } from '@/audio'
import { Select } from '@/components/console/Select'
import { AliasTransferForm } from './forms/AliasTransferForm'
import type { AccountStore } from '@/hooks/useAccounts'
import type { Contacts } from '@/lib/contacts'
import { PaymentForm } from './forms/PaymentForm'
import { MultiOutForm } from './forms/MultiOutForm'
import { MessageForm } from './forms/MessageForm'
import { AccountInfoForm } from './forms/AccountInfoForm'
import { TokenIssueForm } from './forms/TokenIssueForm'
import { TokenTransferForm } from './forms/TokenTransferForm'
import { MintForm } from './forms/MintForm'
import { AliasForm } from './forms/AliasForm'
import { SubscriptionForm } from './forms/SubscriptionForm'
import { SubscriptionCancelForm } from './forms/SubscriptionCancelForm'

export type SendKind =
  | 'payment'
  | 'multiOut'
  | 'message'
  | 'accountInfo'
  | 'tokenIssue'
  | 'tokenTransfer'
  | 'mintAsset'
  | 'alias'
  | 'aliasTransfer'
  | 'subscription'
  | 'cancelSubscription'

/**
 * Ordered so related actions sit together — money, words, names, tokens,
 * standing orders. The list outgrew a row of pills at a dozen entries, and a
 * dropdown that keeps its neighbours adjacent is the cheapest grouping there
 * is without teaching Select about groups it would use exactly once.
 */
const KINDS: SendKind[] = [
  'payment',
  'multiOut',
  'message',
  'accountInfo',
  'alias',
  'aliasTransfer',
  'tokenIssue',
  'tokenTransfer',
  'mintAsset',
  'subscription',
  'cancelSubscription',
]

export interface SendPrefill {
  signa: string
}

export function SendDrawer({
  store,
  contacts,
  prefill,
}: {
  store: AccountStore
  contacts: Contacts
  prefill?: SendPrefill
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [kind, setKind] = useState<SendKind>('payment')
  const { play } = useAudio()
  // Success and failure used to share one line in one colour, so a rejection
  // read exactly like a send. They now differ in what they say, how they look
  // and how they sound.
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  if (!store.available) {
    return <p className="mt-2 text-[13px] text-[var(--muted)]">{t('console.guard.title')}</p>
  }

  // A fresh transaction shows up as unconfirmed only after the feed refetches;
  // the socket will do it too, but not before the user looks.
  const onSent = () => {
    play(sfx.confirm)
    setNotice({ ok: true, text: t('console.send.sent') })
    void client.invalidateQueries({ queryKey: ['unconfirmed'] })
  }

  const onError = (text: string) => {
    play(sfx.warn)
    setNotice({ ok: false, text })
  }

  return (
    <div className="mt-2">
      <div className="mb-3">
        <Select
          value={kind}
          placeholder="—"
          onChange={(v) => {
            setKind(v as SendKind)
            setNotice(null)
          }}
          options={KINDS.map((name) => ({ value: name, label: t(`console.kind.${name}`) }))}
        />
        {/*
          One plain sentence about the chosen action, right under the choice.
          Signum can do things most chains cannot — native tokens, a name
          registry, standing orders — and a dropdown of eleven verbs explains
          none of that to someone meeting it for the first time.
        */}
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
          {t(`console.kindHelp.${kind}`)}
        </p>
      </div>

      {kind === 'payment' && (
        <PaymentForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          initialSigna={prefill?.signa}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'multiOut' && (
        <MultiOutForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'message' && (
        <MessageForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'accountInfo' && (
        <AccountInfoForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'tokenIssue' && (
        <TokenIssueForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'tokenTransfer' && (
        <TokenTransferForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'mintAsset' && (
        <MintForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'aliasTransfer' && (
        <AliasTransferForm
          accounts={store.accounts}
          contacts={contacts}
          forgerId={store.forgerId}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'alias' && (
        <AliasForm accounts={store.accounts} forgerId={store.forgerId} onSent={onSent} onError={onError} />
      )}
      {kind === 'subscription' && (
        <SubscriptionForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          contacts={contacts}
          onSent={onSent}
          onError={onError}
        />
      )}
      {kind === 'cancelSubscription' && (
        <SubscriptionCancelForm
          accounts={store.accounts}
          forgerId={store.forgerId}
          onSent={onSent}
          onError={onError}
        />
      )}

      {notice && (
        <p
          className="mt-2 text-[12px]"
          style={{ color: notice.ok ? 'var(--green)' : 'var(--mag)' }}
        >
          {notice.ok ? '✓' : '✕'} {notice.text}
        </p>
      )}
    </div>
  )
}
