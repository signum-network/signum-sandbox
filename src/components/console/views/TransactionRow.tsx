import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { nodeHost } from '@/lib/ledger'
import { useQuery } from '@tanstack/react-query'
import { decryptFor } from '@/lib/payload'
import { detailFields } from '@/lib/txDetail'
import type { SandboxAccount } from '@/lib/accounts'
import { ConsoleButton, RowButton } from '../ConsoleButton'
import { displayName, type Contacts } from '@/lib/contacts'
import { addressPrefixOf, toAddress, toComparableId } from '@/lib/recipient'
import { summarize } from '@/lib/txSummary'
import { transactionDid } from '@/lib/did'
import { DidLink } from '@/components/console/DidLink'
import { Term } from '@/components/console/Term'
import type { Payee } from '@/lib/txDetail'
import type { FeedItem } from '@/lib/chainFeed'
import { Amount } from '@signumjs/util'
import { Identicon } from '@/components/Identicon'
import { cn } from '@/lib/utils'
import { seconds, EASINGS } from '@/motion'

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
function Detail({ label, children }: { label: ReactNode; children: ReactNode }) {
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

/**
 * How many payees of a multi-out are drawn before the rest become a count.
 *
 * Multi-out reaches sixty-four recipients, and sixty-four identicons in an
 * opened row is a wall rather than a list. Five is enough to see who is being
 * paid and what the amounts look like; the raw response at the foot of the
 * row still has every one of them.
 */
const PAYEES_SHOWN = 5

/**
 * The recipients of a multi-out, each shown the way every other account in
 * this console is shown.
 *
 * They arrive as numeric ids, because that is what the attachment carries, so
 * the address is derived here — the same derivation the contact list and the
 * recipient picker use, for the same reason: an account has to look like the
 * same account wherever you meet it, and the identicon is hashed from the
 * address rather than the id.
 */
function Payees({
  label,
  payees,
  accounts,
  contacts,
}: {
  label: string
  payees: Payee[]
  accounts: SandboxAccount[]
  contacts: Contacts
}) {
  const { t } = useTranslation()
  const prefix = addressPrefixOf(accounts)
  const shown = payees.slice(0, PAYEES_SHOWN)
  const rest = payees.length - shown.length

  return (
    <Detail label={label}>
      <span className="flex flex-col gap-[2px]">
        {shown.map(({ id, signa }) => {
          const address = toAddress(id, prefix)
          const name = displayName(address, accounts, contacts)
          return (
            <span key={id} className="flex flex-wrap items-center gap-2">
              <Identicon value={address} size={14} />
              <span className="break-all">{address}</span>
              {name !== address && <span className="text-[var(--muted)]">· {name}</span>}
              <span className="shrink-0">· {signa} SIGNA</span>
            </span>
          )
        })}
        {rest > 0 && (
          <span className="text-[var(--muted)]">{t('console.tx.andMore', { count: rest })}</span>
        )}
      </span>
    </Detail>
  )
}

export function TransactionRow({
  item,
  arriving,
  accounts,
  contacts,
  onAddContact,
}: {
  item: FeedItem
  /** True for the one render on which this row is new at the tip of the feed. */
  arriving?: boolean
  accounts: SandboxAccount[]
  contacts: Contacts
  onAddContact: (accountIdOrAddress: string, name: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const summary = summarize(item.tx)
  const fields = detailFields(item.tx)

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
    <li
      className={cn('border-b', arriving && 'motion-arrive')}
      style={{ borderColor: 'var(--border2)' }}
    >
      <div>
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

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              className="mb-2 border-l-2 py-2 pl-3 text-[13px]"
              style={{
                borderColor: 'var(--blue2)',
                background: 'rgba(0,102,255,.06)',
                overflow: 'hidden',
              }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: seconds('base'), ease: EASINGS.out }}
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

              {/*
                The label is a translation key where the console knows the field
                and the attachment's own key where it does not, and i18next's
                second argument is the default — so a field nobody has ever named
                renders as itself rather than as a missing-key marker. Two fields
                can share a label (an alias arrives under `alias` or under `uri`),
                so the position is what identifies a line, not the name.
              */}
              {fields.map((field, index) =>
                field.payees ? (
                  <Payees
                    key={`${field.label}-${index}`}
                    label={t(`console.field.${field.label}`, field.label)}
                    payees={field.payees}
                    accounts={accounts}
                    contacts={contacts}
                  />
                ) : (
                  <Detail
                    key={`${field.label}-${index}`}
                    label={t(`console.field.${field.label}`, field.label)}
                  >
                    {field.value ??
                      (field.label === 'encrypted' && decrypted.data
                        ? decrypted.data
                        : t('console.tx.undecryptable'))}
                  </Detail>
                ),
              )}

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
                The same transaction named the way a verification application
                names things, derived from what the node already said rather than
                fetched from anywhere. Immutable is the interesting line in it:
                that is the property anything built on this chain is relying on.
              */}
              <Detail label={<Term id="did" />}>
                <DidLink resolution={transactionDid(item.tx)} />
              </Detail>

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}
