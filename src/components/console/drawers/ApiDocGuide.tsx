import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Modal } from '@/components/console/Modal'
import { CopyButton } from '@/components/console/views/AccountFields'
import { Balance } from '@/components/console/views/Balance'
import { apiDocRecipe, SEND_MONEY_URL } from '@/lib/apiDocRecipe'
import type { SandboxAccount } from '@/lib/accounts'

/** One parameter of the form, its value, and the button that copies it. */
function Field({
  name,
  value,
  note,
}: {
  name: string
  value: string
  note?: string
}) {
  return (
    <div className="border-b py-2" style={{ borderColor: 'var(--border2)' }}>
      {/*
        A grid rather than a wrapping flex row: a passphrase is twelve words
        and wraps, and in a flex row that pushed the copy button onto a line of
        its own, under the value it belongs to.
      */}
      <div className="grid grid-cols-[110px_1fr_auto] items-start gap-2">
        <code className="text-[13px] text-[var(--blue3)]">{name}</code>
        <span className="min-w-0 break-all font-mono text-[13px]">{value}</span>
        <CopyButton value={value} />
      </div>
      {note && (
        <p className="mt-1 pl-[118px] text-[12px] leading-relaxed text-[var(--muted)]">{note}</p>
      )}
    </div>
  )
}

/**
 * The bridge out of the sandbox: the same payment, made by hand against the
 * node's own API.
 *
 * It is the answer to the question a newcomer has once the concepts have
 * landed and the console has stopped being surprising — how do I go on? The
 * console is a lid on the API, and lifting it is the next step, so this hands
 * over the exact values the documentation's form wants rather than describing
 * them. The documentation itself is vendored from the node release and wiped
 * on every bootstrap, so everything here lives on our side and links in.
 */
export function ApiDocGuide({
  accounts,
  forger,
}: {
  accounts: SandboxAccount[]
  forger: SandboxAccount | undefined
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const recipe = apiDocRecipe(accounts, forger)

  return (
    <div>
      <ConsoleButton onClick={() => setOpen(true)}>{t('console.apiDoc.open')}</ConsoleButton>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
        {t('console.apiDoc.note')}
      </p>

      <Modal open={open} title={t('console.apiDoc.title')} onClose={() => setOpen(false)}>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--muted)]">
          {t('console.apiDoc.lead')}
        </p>

        {recipe === null ? (
          <p className="text-[13px] text-[var(--muted)]">{t('console.apiDoc.needAccounts')}</p>
        ) : (
          <>
            <a
              className="inline-block border px-3 py-1 text-[13px] uppercase tracking-[1px] text-[var(--blue3)]"
              style={{ borderColor: 'var(--blue2)' }}
              href={SEND_MONEY_URL}
              target="_blank"
              rel="noreferrer"
            >
              ↗ {t('console.apiDoc.goto')}
            </a>

            <p className="mt-4 text-[11px] uppercase tracking-[2px] text-[var(--blue2)]">
              {t('console.apiDoc.fields', {
                sender: recipe.senderName,
                recipient: recipe.recipientName,
              })}
            </p>

            {/*
              What the sender has, said by the component that says it
              everywhere else — including its "not on chain yet" answer, which
              is exactly the warning needed here: a brand new account cannot
              pay for this, and finding that out from the node's error message
              is a poor way to learn it. No new sentence to translate either;
              the label already exists in all ten locales.
            */}
            <p className="mb-2 text-[13px] text-[var(--muted)]">
              {t('console.accounts.balance')} · {recipe.senderName}:{' '}
              <span className="text-[var(--fg)]">
                <Balance id={recipe.sender} />
              </span>
            </p>

            <Field name="recipient" value={recipe.recipient} />
            <Field
              name="amountNQT"
              value={recipe.amountNQT}
              note={t('console.apiDoc.amountNote')}
            />
            <Field name="feeNQT" value={recipe.feeNQT} />
            <Field name="deadline" value={recipe.deadline} />
            <Field
              name="secretPhrase"
              value={recipe.secretPhrase}
              note={t('console.apiDoc.passphraseNote')}
            />

            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              {t('console.apiDoc.thenWhat')}
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
