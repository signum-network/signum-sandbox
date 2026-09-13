/**
 * Whether the console has asked "new here, or an old hand?", and what the
 * answer was.
 *
 * `answered` is stored rather than inferred from `beginner`, because the two
 * false cases are different: nobody has been asked yet, and someone answered
 * that they know their way around. Inferring would ask the second person the
 * same question on every visit.
 */
export interface BeginnerState {
  answered: boolean
  beginner: boolean
}

export const NOT_ASKED: BeginnerState = { answered: false, beginner: false }

export function readBeginner(raw: string | null): BeginnerState {
  if (!raw) return NOT_ASKED
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return NOT_ASKED
    return { answered: true, beginner: (parsed as { beginner?: unknown }).beginner === true }
  } catch {
    return NOT_ASKED
  }
}

export const writeBeginner = (beginner: boolean) => JSON.stringify({ beginner })
