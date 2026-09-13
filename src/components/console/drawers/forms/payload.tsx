import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMPTY_SRC44, buildSrc44, type Src44Fields } from '@/lib/src44'
import { Toggle } from '@/components/console/Toggle'
import { Field, TextArea } from './fields'
import { Src44Form } from './Src44Form'

export interface PayloadState {
  structured: boolean
  setStructured: (structured: boolean) => void
  plain: string
  setPlain: (text: string) => void
  fields: Src44Fields
  setFields: (fields: Src44Fields) => void
  /** What to put on chain, or null while the structured form is invalid. */
  value: string | null
  reset: () => void
}

/**
 * A payload that is either something someone wrote or something a machine can
 * read.
 *
 * Four different transactions carry free text that SRC44 gives a shape to — a
 * token's description, an alias's content, an account's info, a message — and
 * each of them is sometimes just text. So the choice lives here once, with
 * both halves keeping their own state: switching to structured and back does
 * not throw away what was typed.
 */
export function usePayload(initiallyStructured = false): PayloadState {
  const [structured, setStructured] = useState(initiallyStructured)
  const [plain, setPlain] = useState('')
  const [fields, setFields] = useState<Src44Fields>(EMPTY_SRC44)

  const built = structured ? buildSrc44(fields) : null
  return {
    structured,
    setStructured,
    plain,
    setPlain,
    fields,
    setFields,
    value: built === null ? plain : 'json' in built ? built.json : null,
    reset: () => {
      setPlain('')
      setFields(EMPTY_SRC44)
    },
  }
}

export function PayloadEditor({ state, label }: { state: PayloadState; label: string }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="mb-2">
        <Toggle
          checked={state.structured}
          onChange={state.setStructured}
          label={t('console.src44.structured')}
        />
      </div>
      {state.structured ? (
        <Src44Form fields={state.fields} onChange={state.setFields} />
      ) : (
        <Field label={label}>
          <TextArea value={state.plain} onChange={state.setPlain} />
        </Field>
      )}
    </>
  )
}
