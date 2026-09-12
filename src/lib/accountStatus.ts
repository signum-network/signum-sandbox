import { HttpError } from '@signumjs/http'

/**
 * getBalance's answer for an account id the chain has never seen. Verified
 * against v3.9.11 by querying a well-formed but unused id: the node answers
 * {"errorCode":5,"errorDescription":"Unknown account"} with HTTP 200, and
 * ChainService.query re-throws that body as an HttpError(status 400) whose
 * `data` is the original response — so the code survives the rethrow and is
 * what distinguishes "genuinely absent" from "the request failed for some
 * other reason" (node down, timeout, malformed id, ...). Only the former
 * licenses the "not on chain yet" claim; retry:false means a single transport
 * blip must not be read as the latter.
 */
const UNKNOWN_ACCOUNT_ERROR_CODE = 5

export function isUnknownAccount(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.data as { errorCode?: unknown } | null | undefined)?.errorCode ===
      UNKNOWN_ACCOUNT_ERROR_CODE
  )
}
