import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SandboxAccount } from '@/lib/accounts'
import type { Contacts } from '@/lib/contacts'
import { Identicon } from '../Identicon'
import { Balance } from './Balance'
import { AccountDetail } from './AccountDetail'
import { ConsoleButton, RowButton } from '../ConsoleButton'

/**
 * The collapsed line identifies the account; everything the chain knows about
 * it lives in AccountDetail, which is mounted only while the row is open so
 * its four requests are never made for a row nobody looked at.
 */
export function AccountRow({
  account,
  accounts,
  contacts,
  isForger,
  onSetForger,
  onRemove,
  onSelectTransaction,
}: {
  account: SandboxAccount
  accounts: SandboxAccount[]
  contacts: Contacts
  isForger: boolean
  onSetForger: () => void
  onRemove: () => void
  onSelectTransaction: (transactionId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <li className="border-b" style={{ borderColor: 'var(--border2)' }}>
      <div className="flex items-center gap-3 py-2 text-[11px]">
        <RowButton className="flex flex-1 items-center gap-3 text-left" onClick={() => setOpen(!open)}>
          <span className="text-[var(--muted)]">{open ? '▾' : '▸'}</span>
          <Identicon value={account.address} />
          <span className="font-bold text-[var(--blue3)]">{account.name}</span>
          <span className="text-[var(--muted)]">{account.address}</span>
          <span className="text-[var(--muted)]">
            <Balance id={account.id} />
          </span>
        </RowButton>
        <span className="flex items-center gap-2">
          <ConsoleButton active={isForger} onClick={onSetForger}>
            {isForger ? `★ ${t('console.accounts.forger')}` : t('console.accounts.forger')}
          </ConsoleButton>
          <ConsoleButton onClick={onRemove}>{t('console.accounts.remove')}</ConsoleButton>
        </span>
      </div>

      {open && (
        <AccountDetail
          account={account}
          accounts={accounts}
          contacts={contacts}
          onSelectTransaction={onSelectTransaction}
        />
      )}
    </li>
  )
}
