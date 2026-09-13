/**
 * One line of scenario source, split into words, quoted strings and the two
 * punctuation marks the language uses.
 *
 * A quoted token keeps its quotes so the parser can tell `"120"` from `120`
 * without a second type — a message that happens to be a number is still a
 * message. There are no escapes inside a string: a scenario is meant to be
 * read at a glance, and a backslash rule earns its keep only in languages
 * people write far more of than this.
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = []
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === '#') break
    if (char === ' ' || char === '\t') {
      i += 1
      continue
    }
    if (char === ',') {
      tokens.push(',')
      i += 1
      continue
    }
    if (line.startsWith('->', i)) {
      tokens.push('->')
      i += 2
      continue
    }
    if (char === '"') {
      const end = line.indexOf('"', i + 1)
      // Unterminated: take the rest of the line and let the parser say so
      // with a line number, which is more use than throwing from here.
      if (end === -1) {
        tokens.push(line.slice(i))
        break
      }
      tokens.push(line.slice(i, end + 1))
      i = end + 1
      continue
    }

    let end = i
    while (end < line.length && !' \t,#"'.includes(line[end]) && !line.startsWith('->', end)) {
      end += 1
    }
    tokens.push(line.slice(i, end))
    i = end
  }

  return tokens
}
