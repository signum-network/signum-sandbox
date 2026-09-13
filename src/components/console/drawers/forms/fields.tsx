import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sfx, useAudio } from '@/audio'
import { useTranslation } from 'react-i18next'
import { feePresets, type SendAction } from '@/lib/fees'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Identicon } from '@/components/console/Identicon'
import { Select } from '@/components/console/Select'
import { Term } from '@/components/console/Term'
import { formatQuantity } from '@/lib/token'

const border = { borderColor: 'var(--border2)' }

export interface KnownRecipient {
  id: string
  address: string
  name: string
}

/**
 * The parties a "To" field can offer without anyone typing anything: every
 * owned account (by its address, the form a person recognises) and every
 * contact (by numeric id, since a contact is just a name for an id — the
 * sandbox never learned its Reed-Solomon spelling). An id already covered by
 * an owned account is skipped rather than listed twice, mirroring the
 * precedence displayName gives an owned name over a contact name.
 */
export function knownRecipients(accounts: SandboxAccount[], contacts: Contacts): KnownRecipient[] {
  const seen = new Set(accounts.map((a) => a.id))
  const owned = accounts.map((a) => ({ id: a.id, address: a.address, name: a.name }))
  const fromContacts = Object.entries(contacts)
    .filter(([id]) => !seen.has(id))
    .map(([id, name]) => ({ id, address: id, name }))
  return [...owned, ...fromContacts]
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[11px] uppercase tracking-[1px] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * What a raw quantity actually comes to.
 *
 * Signum counts an asset quantity in its smallest unit, so a token with two
 * decimals and a quantity of 1000 is ten tokens, not a thousand. Nothing on
 * screen said so: an author typed 1000, issued the token, and found ten of
 * them in the account — a factor of a hundred, discovered after the fact and
 * unfixable, since an issued token's supply is what it is.
 *
 * Shown only when there are decimals to shift. At zero the raw number and
 * the readable one are the same, and a line restating that is noise.
 */
export function QuantityHint({
  quantity,
  decimals,
  symbol,
}: {
  quantity: string
  decimals: number
  symbol?: string
}) {
  const { t } = useTranslation()
  if (decimals <= 0 || !/^\d+$/.test(quantity)) return null
  return (
    <p className="mb-2 -mt-1 text-[11px] leading-relaxed text-[var(--blue3)]">
      {t('console.send.quantityHint', {
        raw: quantity,
        shown: formatQuantity(quantity, decimals),
        symbol: symbol ?? '',
        decimals,
      })}
    </p>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      className="w-full border bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]"
      style={border}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * A "To" field that can be picked or typed from the same control. A sandbox
 * exists to experiment with addresses the book has never seen, so this stays
 * a plain text input at heart — free typing always works, unconstrained by
 * the option list. A native datalist layers suggestions on top of that: known
 * accounts and contacts show up by name as the field is focused or edited,
 * and choosing one fills in its address, but nothing about the input itself
 * changes shape or mode. That is simpler than a select-with-fallback (no
 * toggling between two widgets, no "other…" option) and more discoverable
 * than a bare text input with a separate dropdown of matches.
 */
/**
 * A "To" field that can be typed or picked, without ever changing shape.
 *
 * It stays a real text input at heart, because a sandbox exists to try
 * addresses the book has never seen. Suggestions are drawn by us rather than
 * by a native datalist: the browser renders that in its own chrome, which is
 * the one thing that still looked borrowed from another program. Matching is
 * a plain case-insensitive contains over the name and the address, since the
 * list is a handful of entries and anything cleverer would be guessing.
 */
export interface Suggestion {
  value: string
  label: string
  sublabel?: string
  icon?: ReactNode
}

/**
 * A text field that suggests without constraining.
 *
 * Two of the console's inputs are the same interaction — a recipient you
 * usually pick but sometimes type, a fee you usually pick but sometimes type —
 * so they are one component rather than two popovers that drift apart. The
 * suggestions are drawn here rather than by a native datalist, which the
 * browser renders in its own chrome.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  filter = true,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: Suggestion[]
  placeholder?: string
  /** Off for a short fixed list, where filtering as you type only hides options. */
  filter?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { play } = useAudio()

  const needle = value.trim().toLowerCase()
  const matches =
    filter && needle !== ''
      ? suggestions.filter(
          (s) =>
            s.label.toLowerCase().includes(needle) ||
            s.value.toLowerCase().includes(needle) ||
            (s.sublabel ?? '').toLowerCase().includes(needle),
        )
      : suggestions

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full border bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]"
        style={border}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />

      <AnimatePresence>
        {open && matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="themed-scroll console-scroll absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              boxShadow: '0 16px 48px rgba(0,0,0,.4)',
            }}
          >
            {matches.map((s) => (
              <motion.button
                key={s.value}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px]"
                style={{ color: 'var(--fg)' }}
                whileHover={{ backgroundColor: 'rgba(255,255,255,.07)', color: 'var(--blue2)' }}
                onHoverStart={() => play(sfx.tick)}
                onClick={() => {
                  play(sfx.click)
                  onChange(s.value)
                  setOpen(false)
                }}
              >
                {s.icon}
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate">{s.label}</span>
                  {s.sublabel && (
                    <span className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                      {s.sublabel}
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * A "To" field: the known parties as suggestions, any address by typing.
 * A sandbox exists to try addresses the book has never seen, so the field
 * never constrains what can be entered.
 */
export function RecipientPicker({
  accounts,
  contacts,
  value,
  onChange,
  placeholder,
}: {
  accounts: SandboxAccount[]
  contacts: Contacts
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <SuggestInput
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? 'TS-…'}
      suggestions={knownRecipients(accounts, contacts).map((p) => ({
        value: p.address,
        label: p.name,
        sublabel: p.address,
        icon: <Identicon value={p.address} size={14} />,
      }))}
    />
  )
}

export function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className="w-full border bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]"
      style={border}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  emptyAccountsLabel,
}: {
  accounts: SandboxAccount[]
  value: string
  onChange: (id: string) => void
  emptyAccountsLabel?: string
}) {
  return (
    <Select
      value={value}
      placeholder="—"
      emptyLabel={emptyAccountsLabel}
      onChange={onChange}
      options={accounts.map((a) => ({
        value: a.id,
        label: a.name,
        sublabel: a.address,
        icon: <Identicon value={a.address} size={14} />,
      }))}
    />
  )
}

export function SubmitButton({
  label,
  busy,
  onClick,
}: {
  label: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <ConsoleButton disabled={busy} onClick={onClick}>
      {label}
    </ConsoleButton>
  )
}

/**
 * The fee, in SIGNA, with the action's own presets to pick from.
 *
 * It defaults to what the action needs rather than to a global number, and it
 * can be raised or lowered by typing: the true minimum depends on the size of
 * the attachment, which nothing here can know in advance. A fee the node
 * refuses comes back naming the minimum it wanted, so the honest design is to
 * let the attempt happen and pass that answer on.
 */
export function FeeField({
  action,
  value,
  onChange,
}: {
  action: SendAction
  value: string
  onChange: (signa: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Field label={<Term id="fee">{t('console.send.fee')}</Term>}>
      <SuggestInput
        value={value}
        onChange={onChange}
        filter={false}
        suggestions={feePresets(action).map((signa) => ({ value: signa, label: `${signa} SIGNA` }))}
      />
    </Field>
  )
}
