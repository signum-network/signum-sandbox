import { describe, expect, it } from 'vitest'
import en from './en'
import de from './de'
import es from './es'
import pt from './pt'
import uk from './uk'
import ru from './ru'
import zh from './zh'
import ja from './ja'
import ko from './ko'
import hi from './hi'

const flatten = (o: unknown, prefix = ''): string[] =>
  typeof o === 'object' && o !== null
    ? Object.entries(o).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix]

describe('locales', () => {
  const expected = flatten(en).sort()
  it.each([
    ['de', de], ['es', es], ['pt', pt], ['uk', uk], ['ru', ru],
    ['zh', zh], ['ja', ja], ['ko', ko], ['hi', hi],
  ])('%s has exactly the English key set', (_name, locale) => {
    expect(flatten(locale).sort()).toEqual(expected)
  })
})
