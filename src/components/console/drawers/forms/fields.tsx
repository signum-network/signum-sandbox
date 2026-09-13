import { useId, type ReactNode } from 'react'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { Select } from '@/components/console/Select'

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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
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
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
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
  const listId = useId()
  const parties = knownRecipients(accounts, contacts)

  return (
    <>
      <input
        className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
        style={border}
        list={listId}
        value={value}
        placeholder={placeholder ?? 'TS-…'}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {parties.map((p) => (
          <option key={p.id} value={p.address}>{p.name}</option>
        ))}
      </datalist>
    </>
  )
}

export function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
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
      options={accounts.map((a) => ({ value: a.id, label: a.name, sublabel: a.address }))}
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
    <button
      className="border px-3 py-1 text-[10px] uppercase tracking-[1px] text-[var(--blue3)]"
      style={border}
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
