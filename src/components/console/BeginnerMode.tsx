import { createContext, useContext, type ReactNode } from 'react'

/**
 * Beginner mode as ambient state.
 *
 * The explanations appear in the header, in all four views and in a dozen
 * forms. A prop would have to cross every component signature in the console
 * to reach them, for a value none of those components act on — they only read
 * it to decide whether to say more.
 */
const BeginnerContext = createContext(false)

export const BeginnerMode = ({ on, children }: { on: boolean; children: ReactNode }) => (
  <BeginnerContext.Provider value={on}>{children}</BeginnerContext.Provider>
)

export const useBeginnerMode = () => useContext(BeginnerContext)
