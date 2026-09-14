import { Amount } from '@signumjs/util'
import { deriveAccount, type SandboxAccount } from './accounts'
import { ledger } from './ledger'
import { forge as submitNonce } from './chainAdmin'
import {
  createSubscription,
  issueToken,
  resolveRecipientPublicKey,
  sendEncryptedMessage,
  sendMultiOut,
  sendPayment,
  sendPlainMessage,
  setAccountInfo,
  setAlias,
  transferToken,
} from './send'
import type { ScenarioOps } from './scenarioRunner'

/** How long to wait between asking the node whether the block arrived. */
const FORGE_POLL_MS = 250

/** Give up after this many, so a node that stops forging fails rather than hangs. */
const FORGE_ATTEMPTS = 40

const height = async () => (await ledger.network.getBlockchainStatus()).numberOfBlocks

/**
 * `ScenarioOps` against the node the console is already talking to.
 *
 * This is the one file in the feature with no test, and deliberately so:
 * everything that could be decided wrongly lives in the runner, which is
 * tested against a fake. What is left here is the mapping onto `send.ts`,
 * which a test could only restate.
 *
 * `onAccount` is where a derived account goes — into the account store the
 * Accounts tab reads, so a loaded scenario leaves you holding its passphrases
 * rather than looking at a chain full of strangers. Deriving is deterministic
 * and `addAccount` replaces by id, so running the same scenario twice yields
 * the same accounts rather than duplicates.
 *
 * Fees are not passed: `send.ts` defaults each action to `feeFor(action)`,
 * which is the measured per-type minimum. Naming them again here would be a
 * second copy of a table that already exists, free to drift from it.
 */
export function createScenarioOps({
  addressPrefix,
  onAccount,
}: {
  addressPrefix: string
  onAccount: (account: SandboxAccount) => void
}): ScenarioOps {
  let minerPassphrase = ''

  return {
    async createAccount(name, passphrase) {
      const account = deriveAccount(name, passphrase, addressPrefix)
      onAccount(account)
      return account
    },

    setMiner(account) {
      minerPassphrase = account.passphrase
    },

    async forge() {
      // Submitting is not forging. `submitNonce` answers success for the
      // request, not for a block — two calls close together compete for the
      // same height and the node answers both while producing one. The runner
      // forges back to back with no delay, so without this wait a transaction
      // would be broadcast before its predecessor settled: `token` then
      // `transfer` would fail with "Unknown asset" on the transfer line, which
      // is not the guilty one.
      const before = await height()
      await submitNonce(minerPassphrase)
      for (let attempt = 0; attempt < FORGE_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, FORGE_POLL_MS))
        if ((await height()) > before) return
      }
      throw new Error('the node accepted the request but produced no block')
    },

    async balanceSigna(accountId) {
      try {
        const account = await ledger.account.getAccount({ accountId })
        return Amount.fromPlanck(account.balanceNQT ?? '0').getSigna()
      } catch {
        // An account the chain has never seen has no balance rather than an
        // error worth propagating — the ordinary state of a freshly derived
        // account, and the caller's next move is to forge anyway.
        return '0'
      }
    },

    async pay({ from, to, signa, message }) {
      await sendPayment({
        from,
        to: to.address,
        signa,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
        message,
      })
    },

    async multi({ from, recipients }) {
      await sendMultiOut({
        from,
        recipients: recipients.map((r) => ({ address: r.to.address, signa: r.signa })),
      })
    },

    async message({ from, to, text, encrypted }) {
      const recipientPublicKey = await resolveRecipientPublicKey(to.address, [from, to])
      if (encrypted) {
        // Encryption needs the key itself, not the possibility of one: there
        // is nothing to encrypt against otherwise. Every scenario account is
        // one the sandbox holds, so this is resolved from the passphrase and
        // works even for an account that has never spent anything.
        if (!recipientPublicKey) {
          throw new Error(`no public key for ${to.name}, so nothing can be encrypted to it`)
        }
        await sendEncryptedMessage({ from, to: to.address, message: text, recipientPublicKey })
        return
      }
      await sendPlainMessage({ from, to: to.address, message: text, recipientPublicKey })
    },

    async info({ account, name, description }) {
      // The chain stores a description either way; an absent one is empty
      // rather than missing, and setAccountInfo takes it as such.
      await setAccountInfo({ account, name, description: description ?? '' })
    },

    async issueToken({ issuer, symbol, quantity, decimals, description }) {
      // Mintable, always. The language has no instruction for minting, so
      // nothing in a scenario can use it — but a token issued unmintable can
      // never become mintable, and someone who loads a scenario and then goes
      // to the Send drawer to mint more should find it possible.
      return await issueToken({
        issuer,
        name: symbol,
        quantity,
        decimals,
        description: description ?? '',
        mintable: true,
      })
      // The returned id is the issuance transaction's id, which is what the
      // asset is addressed by. It is not usable until that transaction is in
      // a block — hence the wait in forge() above.
    },

    async transferToken({ from, to, assetId, quantity }) {
      await transferToken({
        from,
        to: to.address,
        assetId,
        quantity,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
      })
    },

    async alias({ account, aliasName, content }) {
      await setAlias({ account, aliasName, content })
    },

    async subscribe({ from, to, signa, frequencyS }) {
      await createSubscription({
        from,
        to: to.address,
        signa,
        frequency: frequencyS,
        recipientPublicKey: await resolveRecipientPublicKey(to.address, [from, to]),
      })
    },
  }
}
