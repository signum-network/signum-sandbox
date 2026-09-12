import type { ReactNode } from 'react'
import type { SandboxAccount } from '@/lib/accounts'

const border = { borderColor: 'var(--border2)' }

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
}: {
  accounts: SandboxAccount[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <select
      className="w-full border bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      style={border}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name} · {a.address}</option>
      ))}
    </select>
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
