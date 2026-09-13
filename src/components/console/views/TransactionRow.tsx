import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nodeHost } from '@/lib/ledger'
import { useQuery } from '@tanstack/react-query'
import { decodePayload, decryptFor } from '@/lib/payload'
import type { SandboxAccount } from '@/lib/accounts'
import { ConsoleButton, RowButton } from '../ConsoleButton'
import { Term } from '../Term'
import { displayName, type Contacts } from '@/lib/contacts'
import { toComparableId } from '@/lib/recipient'
import { summarize } from '@/lib/txSummary'
import type { FeedItem } from '@/lib/chainFeed'

// Whether an address already resolves to something other than a shortened
// form of itself — an owned account or a contact — which is exactly the
// condition under which offering "save as contact" would be pointless.
function isKnownParty(address: string, accounts: SandboxAccount[], contacts: Contacts): boolean {
  const id = toComparableId(address)
  if (accounts.some((a) => a.id === id || a.address === address)) return true
  return Boolean(contacts[id])
}

function SaveContactField({
  address,
  label,
  onSave,
}: {
  address: string
  label: string
  onSave: (accountIdOrAddress: string, name: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="min-w-[100px] text-[var(--muted)]">{label}</span>
      <span>{address}</span>
      <input
        className="border bg-transparent px-2 py-[2px] text-[11px] text-[var(--fg)]"
        style={{ borderColor: 'var(--border2)' }}
        value={name}
        placeholder={t('console.accounts.localLabel')}
        onChange={(e) => setName(e.target.value)}
      />
      <ConsoleButton
        disabled={!name.trim()}
        onClick={() => {
          onSave(address, name.trim())
          setName('')
        }}
      >
        {t('console.tx.saveContact')}
      </ConsoleButton>
    </div>
  )
}

export function TransactionRow({
  item,
  accounts,
  contacts,
  onAddContact,
}: {
  item: FeedItem
  accounts: SandboxAccount[]
  contacts: Contacts
  onAddContact: (accountIdOrAddress: string, name: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const summary = summarize(item.tx)
  const fields = decodePayload(item.tx)

  // Resolution stops at owned-account → contact → shortened address here,
  // deliberately: a per-row getAccount for the on-chain name would be an N+1
  // against a feed that can hold dozens of rows on every render.
  const senderName = summary.senderRS ? displayName(summary.senderRS, accounts, contacts) : null
  const recipientName = summary.recipientRS
    ? displayName(summary.recipientRS, accounts, contacts)
    : null

  // Decryption is asynchronous and only attempted once the row is open, so a
  // long stream does not do crypto work for rows nobody looked at.
  const decrypted = useQuery({
    queryKey: ['decrypt', item.id, accounts.length],
    queryFn: () => decryptFor(item.tx, accounts),
    enabled: open,
    retry: false,
  })

  return (
    <li className="border-b" style={{ borderColor: 'var(--border2)' }}>
      <RowButton
        className="flex w-full items-center justify-between py-2 text-left text-[11px]"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="text-[var(--muted)]">{open ? '▾' : '▸'} </span>
          <span className="font-bold text-[var(--blue3)]">{t(`console.kind.${summary.kind}`)}</span>
          <span className="text-[var(--muted)]">
            {' '}{senderName ?? '—'}
            {recipientName ? ` → ${recipientName}` : ''}
            {summary.amountSigna ? ` · ${summary.amountSigna} SIGNA` : ''}
          </span>
        </span>
        <span className={item.confirmed ? 'text-[var(--muted)]' : 'text-[var(--blue3)]'}>
          {item.confirmed
            ? (
                <Term id="block">
                  {t('console.tx.block', { height: item.tx.height ?? '—' })}
                </Term>
              )
            : <Term id="unconfirmed">{t('console.tx.unconfirmed')}</Term>}
        </span>
      </RowButton>

      {open && (
        <div
          className="mb-2 border-l-2 py-2 pl-3 text-[11px]"
          style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
        >
          {fields.map((field) => (
            <div key={field.label} className="flex gap-3">
              <span className="min-w-[100px] text-[var(--muted)]">{field.label}</span>
              <span>
                {field.value ??
                  (field.label === 'encrypted' && decrypted.data
                    ? decrypted.data
                    : t('console.tx.undecryptable'))}
              </span>
            </div>
          ))}
          <div className="flex gap-3">
            <span className="min-w-[100px] text-[var(--muted)]">{t('console.tx.raw')}</span>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getTransaction&transaction=${item.tx.transaction}`}
            >
              ↗ getTransaction
            </a>
          </div>

          {/*
            Offered only for a party the console cannot already name: an
            owned account or an existing contact needs no introduction, and
            the summary line above is already showing its name.
          */}
          {summary.recipientRS && !isKnownParty(summary.recipientRS, accounts, contacts) && (
            <SaveContactField
              address={summary.recipientRS}
              label={t('console.send.to')}
              onSave={onAddContact}
            />
          )}
          {summary.senderRS && !isKnownParty(summary.senderRS, accounts, contacts) && (
            <SaveContactField
              address={summary.senderRS}
              label={t('console.send.from')}
              onSave={onAddContact}
            />
          )}
        </div>
      )}
    </li>
  )
}
