import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { nodeHost } from '@/lib/ledger'
import { useQuery } from '@tanstack/react-query'
import { decodePayload, decryptFor } from '@/lib/payload'
import type { SandboxAccount } from '@/lib/accounts'
import { ConsoleButton, RowButton } from '../ConsoleButton'
import { displayName, type Contacts } from '@/lib/contacts'
import { toComparableId } from '@/lib/recipient'
import { summarize } from '@/lib/txSummary'
import type { FeedItem } from '@/lib/chainFeed'
import { Amount } from '@signumjs/util'
import { Identicon } from '@/components/console/Identicon'

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
        className="border bg-transparent px-2 py-[2px] text-[13px] text-[var(--fg)]"
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

/** One labelled line of the opened row, so every line lines up with the rest. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="min-w-[100px] shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  )
}

/**
 * An account on one of those lines: the picture, the address, and the name if
 * the console has one for it.
 */
function Party({
  label,
  address,
  name,
}: {
  label: string
  address: string
  name: string | null
}) {
  return (
    <Detail label={label}>
      <span className="flex items-center gap-2">
        <Identicon value={address} size={16} />
        <span className="break-all">{address}</span>
        {name && name !== address && <span className="text-[var(--muted)]">· {name}</span>}
      </span>
    </Detail>
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
        className="flex w-full items-center justify-between py-2 text-left text-[13px]"
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
            ? t('console.tx.block', { height: item.tx.height ?? '—' })
            : t('console.tx.unconfirmed')}
        </span>
      </RowButton>

      {open && (
        <div
          className="mb-2 border-l-2 py-2 pl-3 text-[13px]"
          style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
        >
          {/*
            The basics first, and named rather than abbreviated: the summary
            line above has to fit on one row and squeezes the parties into
            whatever space is left, which is exactly what makes opening a row
            worth doing. Here there is room to say who, to whom and how much
            in full, with the identicon that tells two accounts apart at a
            glance — the one place it fits, since a stream of fifty rows
            cannot carry two pictures each.
          */}
          {summary.senderRS && (
            <Party label={t('console.send.from')} address={summary.senderRS} name={senderName} />
          )}
          {summary.recipientRS && (
            <Party
              label={t('console.send.to')}
              address={summary.recipientRS}
              name={recipientName}
            />
          )}
          {summary.amountSigna && (
            <Detail label={t('console.send.amount')}>{summary.amountSigna} SIGNA</Detail>
          )}
          <Detail label={t('console.tx.fee')}>
            {Amount.fromPlanck(item.tx.feeNQT ?? '0').getSigna()} SIGNA
          </Detail>

          {fields.map((field) => (
            <Detail key={field.label} label={field.label}>
              {field.value ??
                (field.label === 'encrypted' && decrypted.data
                  ? decrypted.data
                  : t('console.tx.undecryptable'))}
            </Detail>
          ))}

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

          {/*
            Last, because it leads off the page. Everything above answers the
            question the row was opened to ask; this is for when the answer
            was not enough.
          */}
          <Detail label={t('console.tx.raw')}>
            <a
              className="text-[var(--blue3)] underline"
              target="_blank"
              rel="noreferrer"
              href={`${nodeHost}/api?requestType=getTransaction&transaction=${item.tx.transaction}`}
            >
              ↗ getTransaction
            </a>
          </Detail>
        </div>
      )}
    </li>
  )
}
