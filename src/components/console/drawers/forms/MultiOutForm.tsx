import { useState } from 'react'
import { Amount } from '@signumjs/util'
import { useTranslation } from 'react-i18next'
import { feeFor } from '@/lib/fees'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import {
  EMPTY_RECIPIENT,
  MULTI_OUT_LIMITS,
  checkRecipients,
  filledRecipients,
  parseRecipients,
  type MultiOutVariant,
  type Recipient,
} from '@/lib/multiOut'
import { resolveRecipientPublicKey, sendMultiOut, sendMultiOutSame } from '@/lib/send'
import { useFromAccount } from '@/hooks/useFromAccount'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { Select } from '@/components/console/Select'
import {
  AccountSelect,
  FeeField,
  Field,
  RecipientPicker,
  SubmitButton,
  TextArea,
  TextInput,
} from './fields'
import { Term } from '@/components/console/Term'

export function MultiOutForm({
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
  const [variant, setVariant] = useState<MultiOutVariant>('individual')
  const [rows, setRows] = useState<Recipient[]>([EMPTY_RECIPIENT])
  const [sameAmount, setSameAmount] = useState('')
  const [paste, setPaste] = useState('')
  const [pasting, setPasting] = useState(false)
  const [fee, setFee] = useState(feeFor('multiOut').getSigna())
  const [busy, setBusy] = useState(false)

  const filled = filledRecipients(rows)
  const problem = checkRecipients(rows, variant)
  const limit = MULTI_OUT_LIMITS[variant]

  const setRow = (index: number, field: Partial<Recipient>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...field } : r)))

  const submit = async () => {
    const from = accounts.find((a) => a.id === fromId)
    if (!from) return
    if (problem !== 'none') {
      onError(t(`console.send.multiOut.${problem}`, { limit }))
      return
    }
    if (variant === 'same' && sameAmount.trim() === '') {
      onError(t('console.send.multiOut.missingAmount'))
      return
    }
    setBusy(true)
    try {
      // Multi-out has no field to announce a recipient's public key — neither
      // variant does — so an account the chain has never seen cannot be paid
      // this way. That is a protocol limit rather than something the code can
      // route around, and checking first turns the node's flat "Incorrect
      // recipient" into the sentence we already have for it.
      const resolutions = await Promise.all(
        filled.map((r) => resolveRecipientPublicKey(r.address, accounts)),
      )
      if (resolutions.some((key) => key === undefined)) {
        onError(t('console.send.needsPublicKey'))
        return
      }

      if (variant === 'same') {
        await sendMultiOutSame({
          from,
          addresses: filled.map((r) => r.address),
          signa: sameAmount,
          fee: Amount.fromSigna(fee),
        })
      } else {
        await sendMultiOut({ from, recipients: filled, fee: Amount.fromSigna(fee) })
      }
      setRows([EMPTY_RECIPIENT])
      setSameAmount('')
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

      {/*
        The two variants are different transaction types, not a convenience:
        one amount for the whole list instead of one per recipient is what
        lets the same-amount variant carry twice as many.
      */}
      <Field label={t('console.send.multiOut.variant')}>
        <Select
          value={variant}
          placeholder="—"
          onChange={(v) => setVariant(v as MultiOutVariant)}
          options={(['individual', 'same'] as const).map((v) => ({
            value: v,
            label: t(`console.send.multiOut.${v}`),
            sublabel: t('console.send.multiOut.upTo', { limit: MULTI_OUT_LIMITS[v] }),
          }))}
        />
      </Field>

      {variant === 'same' && (
        <Field label={t('console.send.amount')}>
          <TextInput value={sameAmount} onChange={setSameAmount} placeholder="100" />
        </Field>
      )}

      <span className="mb-1 block text-[11px] uppercase tracking-[1px] text-[var(--muted)]">
        <Term id="multiOut">{t('console.send.recipients')}</Term> · {filled.length}/{limit}
      </span>

      {rows.map((row, index) => (
        <div key={index} className="mb-1 flex items-start gap-2">
          <span className="flex-1">
            <RecipientPicker
              accounts={accounts}
              contacts={contacts}
              value={row.address}
              onChange={(v) => setRow(index, { address: v })}
            />
          </span>
          {variant === 'individual' && (
            <span className="w-[30%]">
              <TextInput
                value={row.signa}
                onChange={(v) => setRow(index, { signa: v })}
                placeholder="100"
              />
            </span>
          )}
          <RowButton
            className="mt-1 text-[13px] leading-none text-[var(--muted)] hover:text-[var(--mag)]"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            ✕
          </RowButton>
        </div>
      ))}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ConsoleButton
          disabled={filled.length >= limit}
          onClick={() => setRows([...rows, { ...EMPTY_RECIPIENT }])}
        >
          {t('console.send.multiOut.addRow')}
        </ConsoleButton>
        <ConsoleButton onClick={() => setPasting(!pasting)}>
          {t('console.send.multiOut.paste')}
        </ConsoleButton>
        {problem === 'tooMany' && (
          <span className="text-[12px]" style={{ color: 'var(--mag)' }}>
            {t('console.send.multiOut.tooMany', { limit })}
          </span>
        )}
      </div>

      {/*
        Filling twenty rows by hand would be worse than the textarea this
        replaced, so pasting stays — as a way to fill the rows rather than as
        the way to enter them.
      */}
      {pasting && (
        <div className="mb-2">
          <Field label={t('console.send.recipientHint')}>
            <TextArea value={paste} onChange={setPaste} />
          </Field>
          <ConsoleButton
            onClick={() => {
              const parsed = parseRecipients(paste)
              if (parsed.length === 0) return
              setRows([...filled, ...parsed])
              setPaste('')
              setPasting(false)
            }}
          >
            {t('console.send.multiOut.addRow')}
          </ConsoleButton>
        </div>
      )}

      <FeeField action="multiOut" value={fee} onChange={setFee} />
      <SubmitButton label={t('console.send.submit')} busy={busy} onClick={() => void submit()} />
    </div>
  )
}
