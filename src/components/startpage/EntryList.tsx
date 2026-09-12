import { useTranslation } from 'react-i18next'
import { useAudio, sfx } from '@/audio'

function Entry({
  title, description, href, disabled, badge,
}: {
  title: string
  description: string
  href?: string
  disabled?: boolean
  badge?: string
}) {
  const { play } = useAudio()
  const className =
    'relative block border p-3.5 transition-colors ' +
    (disabled ? 'cursor-default opacity-45' : 'hover:bg-[rgba(0,102,255,.16)]')

  const body = (
    <>
      <div className="text-[12px] font-bold tracking-[1px] text-[var(--blue3)]">
        ▸ {title.toUpperCase()}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
        {description}
        {badge && <> · {badge}</>}
      </div>
    </>
  )

  const style = {
    background: 'rgba(0,102,255,.10)',
    borderColor: 'var(--border2)',
  }

  if (disabled) return <div className={className} style={style}>{body}</div>

  return (
    <a
      className={className}
      style={style}
      href={href}
      onMouseEnter={() => play(sfx.hover)}
      onClick={() => play(sfx.click)}
    >
      {body}
    </a>
  )
}

export function EntryList() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Entry
        title={t('entry.apiDocs.title')}
        description={t('entry.apiDocs.description')}
        href="/api-doc/"
      />
      <Entry
        title={t('entry.dashboard.title')}
        description={t('entry.dashboard.description')}
        badge={t('entry.comingSoon')}
        disabled
      />
    </div>
  )
}
