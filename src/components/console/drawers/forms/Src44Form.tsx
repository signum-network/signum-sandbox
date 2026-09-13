import { useTranslation } from 'react-i18next'
import {
  SRC44_MAX_BYTES,
  SRC44_TYPES,
  buildSrc44,
  byteLength,
  type Src44Fields,
} from '@/lib/src44'
import { Select } from '@/components/console/Select'
import { Field, TextArea, TextInput } from './fields'

/**
 * The structured payload editor, shared by everything that can carry one:
 * a token's description, an alias's content, an account's info, a message.
 *
 * It shows the JSON it produces, live. That is the whole point of putting
 * SRC44 in a sandbox — you can read what will land on chain, and see the byte
 * count against the limit before the node counts it for you.
 */
export function Src44Form({
  fields,
  onChange,
}: {
  fields: Src44Fields
  onChange: (fields: Src44Fields) => void
}) {
  const { t } = useTranslation()
  const set = <K extends keyof Src44Fields>(key: K, value: Src44Fields[K]) =>
    onChange({ ...fields, [key]: value })

  const result = buildSrc44(fields)
  const json = 'json' in result ? result.json : null
  const size = json ? byteLength(json) : 0

  return (
    <div>
      <Field label={t('console.src44.name')}>
        <TextInput value={fields.name} onChange={(v) => set('name', v)} />
      </Field>
      <Field label={t('console.src44.description')}>
        <TextArea value={fields.description} onChange={(v) => set('description', v)} />
      </Field>
      <Field label={t('console.src44.type')}>
        <Select
          value={fields.type}
          placeholder="—"
          onChange={(v) => set('type', v as Src44Fields['type'])}
          options={SRC44_TYPES.map((type) => ({
            value: type,
            label: type,
            sublabel: t(`console.src44.types.${type}`),
          }))}
        />
      </Field>
      <Field label={t('console.src44.avatar')}>
        <TextInput
          value={fields.avatarCid}
          onChange={(v) => set('avatarCid', v)}
          placeholder="Qm…"
        />
      </Field>
      {fields.avatarCid !== '' && (
        <Field label={t('console.src44.avatarMime')}>
          <TextInput value={fields.avatarMime} onChange={(v) => set('avatarMime', v)} />
        </Field>
      )}
      <Field label={t('console.src44.homePage')}>
        <TextInput value={fields.homePage} onChange={(v) => set('homePage', v)} />
      </Field>
      <Field label={t('console.src44.social')}>
        <TextArea value={fields.socialLinks} onChange={(v) => set('socialLinks', v)} />
      </Field>
      <Field label={t('console.src44.custom')}>
        <TextArea value={fields.custom} onChange={(v) => set('custom', v)} />
      </Field>

      <div className="mb-2 text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
        {t('console.src44.preview')}{' '}
        <span style={{ color: size > SRC44_MAX_BYTES ? 'var(--mag)' : 'var(--muted)' }}>
          · {t('console.src44.bytes', { size, max: SRC44_MAX_BYTES })}
        </span>
      </div>
      <pre
        className="themed-scroll console-scroll mb-2 max-h-32 overflow-auto border p-2 text-[10px]"
        style={{
          borderColor: json ? 'var(--border2)' : 'var(--mag)',
          color: json ? 'var(--fg)' : 'var(--mag)',
        }}
      >
        {json ?? ('error' in result ? result.error : '')}
      </pre>
    </div>
  )
}
