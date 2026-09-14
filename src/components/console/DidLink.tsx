import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DidResolution } from '@/lib/did'
import { RowButton } from './ConsoleButton'

/**
 * The decentralised identifier for whatever is on screen, and its document.
 *
 * Shown beside the raw JSON response rather than instead of it: the raw
 * answer is what the node said, and this is the same facts in the shape a
 * verification application expects. Seeing both is the point — the whole
 * reason a chain is interesting for verification is that the second can be
 * derived from the first by anyone, without asking permission.
 *
 * Resolved here rather than fetched. The public resolver knows mainnet and
 * testnet; a sandbox chain is neither, so a document built from what the
 * console already holds is the only one that can exist — and it works with
 * the network cable pulled out.
 */
export function DidLink({ resolution }: { resolution: DidResolution }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const did = resolution.didDocument.id

  const copy = () => {
    void navigator.clipboard.writeText(did).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <code className="break-all text-[var(--fg)]">{did}</code>
        <RowButton className="shrink-0 text-[12px] text-[var(--blue3)] underline" onClick={copy}>
          {copied ? t('console.accounts.copied') : t('console.accounts.copy')}
        </RowButton>
        <RowButton
          className="shrink-0 text-[12px] text-[var(--blue3)] underline"
          onClick={() => setOpen(!open)}
        >
          {open ? t('console.did.hide') : t('console.did.show')}
        </RowButton>
      </span>
      {open && (
        <pre
          className="themed-scroll console-scroll max-h-64 overflow-auto border p-2 text-[11px]
            leading-relaxed text-[var(--muted)]"
          style={{ borderColor: 'var(--border2)' }}
        >
          {JSON.stringify(resolution, null, 2)}
        </pre>
      )}
    </span>
  )
}
