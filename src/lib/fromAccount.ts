/**
 * The "From" field's effective value. Forging is how money enters a sandbox
 * chain, so the forger is the one account guaranteed to have any — leaving
 * "From" blank until someone hunts for it in a list is the opposite of
 * effortless. This only fills the gap: once a user has chosen anyone
 * (including the forger itself) that choice sticks even if the configured
 * forger later changes, because `chosenId` is then non-empty.
 */
export function resolveFromAccount(chosenId: string, forgerId: string | null | undefined): string {
  return chosenId || forgerId || ''
}
