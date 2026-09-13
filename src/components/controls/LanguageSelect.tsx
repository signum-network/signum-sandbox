import { useTranslation } from 'react-i18next'
import { Select } from '@/components/console/Select'

/**
 * Each language in its own name, never translated: someone looking for their
 * language scans for the word they would write, not for what the current
 * language calls it. The list is the ten locales the app ships.
 */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'hi', label: 'हिन्दी' },
]

export function LanguageSelect() {
  const { i18n } = useTranslation()
  // resolvedLanguage is the one actually in use after detection and fallback;
  // i18n.language can still carry a region ("de-AT") the list does not hold.
  const current = i18n.resolvedLanguage ?? 'en'

  return (
    <div className="w-[112px]">
      <Select
        value={current}
        placeholder={current}
        options={LANGUAGES}
        onChange={(code) => void i18n.changeLanguage(code)}
      />
    </div>
  )
}
