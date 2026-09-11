import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en'
import de from './locales/de'
import es from './locales/es'
import pt from './locales/pt'
import uk from './locales/uk'
import ru from './locales/ru'
import zh from './locales/zh'
import ja from './locales/ja'
import ko from './locales/ko'
import hi from './locales/hi'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }, de: { translation: de }, es: { translation: es },
      pt: { translation: pt }, uk: { translation: uk }, ru: { translation: ru },
      zh: { translation: zh }, ja: { translation: ja }, ko: { translation: ko },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

export default i18n
