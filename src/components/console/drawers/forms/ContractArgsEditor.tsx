import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  encodeContractArgs,
  type AttachmentMode,
  type ContractArg,
  type ContractArgType,
  type EncodedArgs,
} from '@/lib/contractArgs'
import { ConsoleButton } from '@/components/console/ConsoleButton'
import { Select } from '@/components/console/Select'
import { Toggle } from '@/components/console/Toggle'
import { TextInput } from './fields'
import { PayloadEditor, type PayloadState } from './payload'

const TYPES: ContractArgType[] = ['integer', 'address', 'boolean', 'shortString']

const emptyArg = (type: ContractArgType): ContractArg => ({
  type,
  value: type === 'boolean' ? 'false' : '',
})

export interface ContractArgsState {
  args: ContractArg[]
  encoded: EncodedArgs
  add: () => void
  change: (index: number, arg: ContractArg) => void
  remove: (index: number) => void
  reset: () => void
}

/** The rows, and what they come to — kept beside the editor the way usePayload is. */
export function useContractArgs(): ContractArgsState {
  const [args, setArgs] = useState<ContractArg[]>([])
  return {
    args,
    encoded: encodeContractArgs(args),
    add: () => setArgs((previous) => [...previous, emptyArg('integer')]),
    change: (index, arg) =>
      setArgs((previous) => previous.map((existing, i) => (i === index ? arg : existing))),
    remove: (index) => setArgs((previous) => previous.filter((_, i) => i !== index)),
    reset: () => setArgs([]),
  }
}

/**
 * One row per 8-byte block, in the order the contract reads them. The bytes
 * themselves are shown underneath, because a contract author debugging a
 * call wants to see exactly what went out.
 */
function ContractArgsEditor({ state }: { state: ContractArgsState }) {
  const { t } = useTranslation()
  const errors = 'errors' in state.encoded ? state.encoded.errors : {}

  return (
    <div className="mb-2">
      {state.args.length === 0 && (
        <p className="mb-2 text-[12px] text-[var(--muted)]">{t('console.send.contract.noArgs')}</p>
      )}
      {state.args.map((arg, index) => (
        <div key={index} className="mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[11px] text-[var(--muted)]">{index}</span>
            <div className="w-40 shrink-0">
              <Select
                value={arg.type}
                placeholder="—"
                onChange={(type) => state.change(index, emptyArg(type as ContractArgType))}
                options={TYPES.map((type) => ({
                  value: type,
                  label: t(`console.send.contract.types.${type}`),
                }))}
              />
            </div>
            <div className="min-w-0 flex-1">
              {arg.type === 'boolean' ? (
                <Toggle
                  checked={arg.value === 'true'}
                  onChange={(checked) => state.change(index, { ...arg, value: String(checked) })}
                  label={arg.value === 'true' ? 'true · 1' : 'false · 0'}
                />
              ) : (
                <TextInput
                  value={arg.value}
                  onChange={(value) => state.change(index, { ...arg, value })}
                  placeholder={arg.type === 'address' ? 'TS-…' : arg.type === 'integer' ? '0' : 'abc'}
                />
              )}
            </div>
            <ConsoleButton onClick={() => state.remove(index)}>
              {t('console.send.contract.removeArg')}
            </ConsoleButton>
          </div>
          {errors[index] && (
            <p className="ml-7 mt-1 text-[11px]" style={{ color: 'var(--mag)' }}>
              {t(`console.send.contract.errors.${errors[index]}`)}
            </p>
          )}
        </div>
      ))}
      <ConsoleButton onClick={state.add}>{t('console.send.contract.addArg')}</ConsoleButton>
      {'hex' in state.encoded && state.encoded.hex !== '' && (
        <p className="mt-2 break-all font-mono text-[11px] text-[var(--blue3)]">
          {state.encoded.hex}
          <span className="ml-2 text-[var(--muted)]">
            {t('console.send.contract.bytes', { count: state.encoded.hex.length / 2 })}
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * What a contract recipient gets as its attachment: arguments, or text for a
 * contract that reads text. Both halves keep their state while switching, as
 * usePayload does for its own two.
 */
export function ContractAttachment({
  mode,
  onModeChange,
  args,
  payload,
  textLabel,
}: {
  mode: AttachmentMode
  onModeChange: (mode: AttachmentMode) => void
  args: ContractArgsState
  payload: PayloadState
  textLabel: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="mb-2 flex gap-2">
        <ConsoleButton active={mode === 'args'} onClick={() => onModeChange('args')}>
          {t('console.send.contract.args')}
        </ConsoleButton>
        <ConsoleButton active={mode === 'text'} onClick={() => onModeChange('text')}>
          {t('console.send.contract.text')}
        </ConsoleButton>
      </div>
      {mode === 'args' ? (
        <ContractArgsEditor state={args} />
      ) : (
        <PayloadEditor state={payload} label={textLabel} variant="attachment" />
      )}
    </>
  )
}
