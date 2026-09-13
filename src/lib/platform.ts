/**
 * The console cannot run scripts/reset.sh or scripts/reset.cmd itself — see
 * chainAdmin.ts for why — so once neither reset call has worked, its only
 * honest move is to name the right script for the user's platform. Sniffing
 * lives here as a pure function so it is tested without a DOM; the component
 * just hands it navigator.userAgent.
 */
export type Platform = 'windows' | 'posix'

/**
 * Anything not recognisably Windows is treated as posix. That is the safe
 * default: the overwhelming majority of users are on macOS or Linux, and an
 * unrecognised or missing user agent should default to what most people
 * actually have rather than to Windows.
 */
export function detectPlatform(userAgent: string | undefined): Platform {
  return userAgent !== undefined && /windows/i.test(userAgent) ? 'windows' : 'posix'
}

/** The reset script to name, spelled exactly as a user on that platform would type it. */
export function resetCommand(userAgent: string | undefined): string {
  return detectPlatform(userAgent) === 'windows' ? '.\\scripts\\start.cmd --reset' : './scripts/start.sh --reset'
}
