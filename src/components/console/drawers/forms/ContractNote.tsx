import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Contract } from '@signumjs/core'
import { activationSigna, isBelowActivation } from '@/lib/contractArgs'
import { Term } from '@/components/console/Term'

/**
 * One line under "To" when the recipient is a contract: that it is one, and
 * what it takes to run it. Below that amount it warns rather than refuses —
 * watching a contract keep the money and do nothing is a lesson too.
 */
export function ContractNote({ contract, signa }: { contract: Contract | null; signa: string }) {
  const { t } = useTranslation()
  const amount = contract ? activationSigna(contract.minActivation) : null
  return (
    <div className="mb-2 -mt-1 text-[11px] leading-relaxed">
      <p className="text-[var(--blue3)]">
        <Term id="contract">{contract?.name || t('console.accounts.contractTag')}</Term>
        {amount && ` · ${t('console.send.contract.activation', { amount })}`}
      </p>
      {contract && amount && isBelowActivation(signa, contract.minActivation) && (
        <p style={{ color: 'var(--mag)' }}>{t('console.send.contract.belowActivation', { amount })}</p>
      )}
    </div>
  )
}

/**
 * Puts the activation amount into an amount field the moment a contract is
 * picked — but only into an empty one. What a person typed is theirs.
 */
export function useActivationPrefill(
  contract: Contract | null,
  value: string,
  setValue: (value: string) => void,
) {
  useEffect(() => {
    if (contract && value === '') setValue(activationSigna(contract.minActivation))
    // Keyed on the contract alone: re-running on every keystroke would refill
    // a field the person just cleared on purpose.
  }, [contract?.at])
}
