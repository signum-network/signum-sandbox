import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ConsoleButton } from '../ConsoleButton'
import { Term } from '@/components/console/Term'

export const actionButton =
  'border px-2 py-[1px] text-[12px] uppercase tracking-[1px] text-[var(--blue3)]'
export const actionBorder = { borderColor: 'var(--border2)' }

/** One labelled line of an account's detail, so every line lines up. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 py-[2px]">
      <span className="min-w-[132px] text-[var(--muted)]">{label}</span>
      <span>{children}</span>
    </div>
  )
}

export function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <ConsoleButton
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? t('console.accounts.copied') : t('console.accounts.copy')}
    </ConsoleButton>
  )
}

/**
 * Masked by default, on purpose, even though this passphrase is worthless
 * outside the sandbox: masking is what teaches a newcomer that a passphrase
 * is normally a secret worth hiding, and it means a demo or a screenshot
 * doesn't spill it by accident. One click reveals it for anyone who wants to
 * read it; copying never requires revealing it first, since a developer
 * pasting into an .env just wants the string. `console.accounts.fake` sits
 * right next to it so nobody carries it outside believing it protects anything.
 */
export function PassphraseField({ passphrase }: { passphrase: string }) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  return (
    <Row label={<Term id="passphrase">{t('console.accounts.passphrase')}</Term>}>
      <span className="font-mono">{revealed ? passphrase : '•'.repeat(24)}</span>{' '}
      <ConsoleButton onClick={() => setRevealed(!revealed)}>
        {revealed ? t('console.accounts.passphraseHide') : t('console.accounts.passphraseReveal')}
      </ConsoleButton>{' '}
      <CopyButton value={passphrase} />{' '}
      <span className="text-[12px] text-[var(--muted)]">{t('console.accounts.fake')}</span>
    </Row>
  )
}
