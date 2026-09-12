import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { SandboxAccount } from '@/lib/accounts'
import { ledger } from '@/lib/ledger'
import { isUnknownAccount } from '@/lib/accountStatus'
import { Identicon } from '../Identicon'
import { Balance } from './Balance'

const actionButton = 'border px-2 py-[1px] text-[10px] uppercase tracking-[1px] text-[var(--blue3)]'
const actionBorder = { borderColor: 'var(--border2)' }
const detailRow = 'flex flex-wrap items-center gap-3 py-[2px]'
const detailLabel = 'min-w-[100px] text-[var(--muted)]'

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={actionButton}
      style={actionBorder}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? t('console.accounts.copied') : t('console.accounts.copy')}
    </button>
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
function PassphraseField({ passphrase }: { passphrase: string }) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className={detailRow}>
      <span className={detailLabel}>{t('console.accounts.passphrase')}</span>
      <span className="font-mono">{revealed ? passphrase : '•'.repeat(24)}</span>
      <button
        className={actionButton}
        style={actionBorder}
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? t('console.accounts.passphraseHide') : t('console.accounts.passphraseReveal')}
      </button>
      <CopyButton value={passphrase} />
      <span className="text-[10px] text-[var(--muted)]">{t('console.accounts.fake')}</span>
    </div>
  )
}

export function AccountRow({
  account,
  isForger,
  onSetForger,
  onRemove,
}: {
  account: SandboxAccount
  isForger: boolean
  onSetForger: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // getAccount carries name, description and token holdings in one response,
  // so opening a row costs one request for all three rather than one per
  // field. It only fires once the row is open. Balance is deliberately left
  // out of this query and read from the shared Balance component instead
  // (below, and again inline): that query is already running for the
  // collapsed summary, so reusing it here means expanding a row adds no
  // second, competing source of truth for the same number.
  const details = useQuery({
    queryKey: ['account', account.id],
    queryFn: () => ledger.account.getAccount({ accountId: account.id }),
    enabled: open,
    retry: false,
  })

  // Aliases are a distinct on-chain entity from the account record — getAccount
  // has no field for them — so resolving them is unavoidably a second request.
  // Gated on the account query having succeeded: an account absent from the
  // chain cannot hold an alias either, so there is nothing to ask for yet.
  const aliases = useQuery({
    queryKey: ['aliases', account.id],
    queryFn: () => ledger.alias.getAliases({ accountId: account.id }),
    enabled: open && details.isSuccess,
    retry: false,
  })

  const notOnChain = details.isError && isUnknownAccount(details.error)

  return (
    <li className="border-b" style={{ borderColor: 'var(--border2)' }}>
      <div className="flex items-center gap-3 py-2 text-[11px]">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={() => setOpen(!open)}
        >
          <span className="text-[var(--muted)]">{open ? '▾' : '▸'}</span>
          <Identicon value={account.address} />
          <span className="font-bold text-[var(--blue3)]">{account.name}</span>
          <span className="text-[var(--muted)]">{account.address}</span>
          <span className="text-[var(--muted)]">
            <Balance id={account.id} />
          </span>
        </button>
        <span className="flex items-center gap-2">
          <button className={actionButton} style={actionBorder} onClick={onSetForger}>
            {isForger ? `★ ${t('console.accounts.forger')}` : t('console.accounts.forger')}
          </button>
          <button className={actionButton} style={actionBorder} onClick={onRemove}>
            {t('console.accounts.remove')}
          </button>
        </span>
      </div>

      {open && (
        <div
          className="mb-2 border-l-2 py-2 pl-3 text-[11px]"
          style={{ borderColor: 'var(--blue2)', background: 'rgba(0,102,255,.06)' }}
        >
          <PassphraseField passphrase={account.passphrase} />

          <div className={detailRow}>
            <span className={detailLabel}>{t('console.accounts.id')}</span>
            <span>{account.id}</span>
          </div>
          <div className={detailRow}>
            <span className={detailLabel}>{t('console.accounts.address')}</span>
            <span>{account.address}</span>
          </div>
          <div className={detailRow}>
            <span className={detailLabel}>{t('console.accounts.balance')}</span>
            <span>
              <Balance id={account.id} />
            </span>
          </div>

          {notOnChain ? (
            <p className="mt-1 text-[var(--muted)]">{t('console.accounts.notOnChain')}</p>
          ) : (
            <>
              {details.data?.name && (
                <div className={detailRow}>
                  <span className={detailLabel}>{t('console.accounts.onChainName')}</span>
                  <span>{details.data.name}</span>
                </div>
              )}
              {details.data?.description && (
                <div className={detailRow}>
                  <span className={detailLabel}>{t('console.accounts.description')}</span>
                  <span>{details.data.description}</span>
                </div>
              )}

              <div className={detailRow}>
                <span className={detailLabel}>{t('console.accounts.holdings')}</span>
                <span>
                  {details.data?.assetBalances?.length
                    ? details.data.assetBalances
                        .map((b) => `${b.balanceQNT} × ${b.asset}`)
                        .join(', ')
                    : t('console.accounts.noHoldings')}
                </span>
              </div>

              <div className={detailRow}>
                <span className={detailLabel}>{t('console.accounts.aliases')}</span>
                <span>
                  {aliases.data?.aliases.length
                    ? aliases.data.aliases.map((a) => a.aliasName).join(', ')
                    : t('console.accounts.noAliases')}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}
