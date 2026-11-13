/**
 * Runs `task` for a key at most once at a time.
 *
 * A trigger that arrives while the key's task is running neither starts a second run
 * nor gets lost: it marks the key, and exactly one more run follows when the current
 * one ends, however many triggers arrived in between.
 *
 * The node sends BLOCK_PUSHED up to once a second, but on a busy chain a refetch can
 * take longer than that. Starting a new fetch on every event piled the requests up on
 * the node, which keeps building each one even after the page abandoned it (#9).
 */
export function coalesce(task: (key: string) => Promise<unknown>): (key: string) => void {
  const running = new Set<string>()
  const pending = new Set<string>()

  const start = (key: string) => {
    running.add(key)
    void task(key)
      .catch(() => undefined)
      .finally(() => {
        running.delete(key)
        if (pending.delete(key)) start(key)
      })
  }

  return (key) => {
    if (running.has(key)) {
      pending.add(key)
      return
    }
    start(key)
  }
}
