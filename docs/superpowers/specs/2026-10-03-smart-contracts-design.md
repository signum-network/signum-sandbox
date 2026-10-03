# Signum Sandbox — Smart Contracts as Recipients

**Date:** 2026-10-03
**Status:** approved (design), awaiting spec review
**Scope:** interacting with smart contracts that already exist on the sandbox chain. A contract can be saved as a contact, is recognised as a contract when picked as a recipient, and can be sent SIGNA or a token together with arguments in the binary form a contract reads. Deploying contracts is out of scope.

## Goal

From the sandbox's point of view a contract is an account. Its account id is the id of the transaction that deployed it, so whoever deployed it (SmartC, the testbed, a script against the sandbox node) already holds everything needed to address it.

What makes a contract different as a recipient:

- **It has no keys.** It cannot read an encrypted attachment, so offering encryption towards a contract offers something that can only fail.
- **It wakes up only for enough SIGNA.** Every contract carries a minimum activation amount. A send below it reaches the contract's balance without running it.
- **It reacts to SIGNA and to token transfers alike.** A token transfer can carry SIGNA too, and has to when it should run the contract.
- **It reads arguments as binary.** The attachment is read in 8-byte blocks, each one a little-endian `long`. Typing that by hand as hex is error-prone. A form where a person enters ordinary values (a number, an address, a short word, yes/no) and the sandbox produces the bytes removes the hardest part. The plain text field stays as a fallback, because a contract may just as well read text.

## Verified ground truth

Checked against the working tree and the running sandbox node, not inferred.

| Fact | Consequence |
|---|---|
| `getAccount` for an unknown id answers `{"errorCode":5,"errorDescription":"Unknown account"}`. | Checking that an address exists before saving it as a contact takes one call. |
| `getAccount` for a deployed contract (`13125641130491689178` on the local chain) answers normally and includes `"isAT":true`. `Account.isAT: boolean` is in `@signumjs/core`'s typings. | The same single call answers "does it exist?" and "is it a contract?". No separate `getAT` is needed when a contact is added. |
| The same response reports `"publicKey":"0000…0000"` (64 zeros). | `resolveRecipientPublicKey` would currently hand that string on as a recipient public key. For a contract it must resolve to `undefined`. |
| `getAT` answers `minActivation` in planck (`40000000` for the contract above), along with `name`, `description`, `creator`, `creatorRS`. `ledger.contract.getContract(id)` wraps it and returns `Contract` (re-exported from `@signumjs/contracts`) with `minActivation: string`. | The activation amount is fetched when a contract contact is picked. |
| `@signumjs/contracts@3.3.4` is already in `node_modules` as a transitive dependency of `@signumjs/core`. It exports `generateMethodCall` (each value → `convertDecStringToHexString(v, 16)` → `convertHexEndianess`, concatenated) and `convertShortStringToContractData`. | The reference implementation does the 8-byte, little-endian packing. It becomes a direct dependency, pinned to `3.3.4` like its siblings, and the sandbox does not reimplement it. |
| `convertShortStringToContractData` checks `shortString.length > 8`, which counts UTF-16 code units, not bytes. `"äöüäöü"` passes that check at 12 bytes. | The 8-byte limit is checked on the UTF-8 encoding here, before the reference function is called. |
| In the installed `3.3.4`, `generateMethodCall` takes `{ methodId, methodArgs }`, while the local signumjs sources say `methodHash`. It does no range check: `2^64` comes out as 32 hex characters and `-(2^63)-1` likewise (both run), so one oversized value silently shifts every block after it. | Range checking is this sandbox's job, and it happens before encoding. Verified by running it against the vectors below. |
| `TransferAssetArgs` has an optional `amountPlanck`. | A token transfer can carry the contract's activation amount. |
| `AttachmentMessage({ message, messageIsText: false })` is how signumjs sends a hex payload as binary. `sendPayment` and `transferToken` today only build `messageIsText: true`. | Both functions gain a binary variant. Nothing else in `send.ts` changes shape. |
| Contacts are `Record<string, string>` (numeric id → name) in `localStorage` under `signum-sandbox.contacts.v1`, read by `parseContacts`, which already tolerates malformed entries. Consumers: `useContacts`, `ConsoleShell`, `AccountDetail`, `fields.tsx` (`knownRecipients`), `TransactionRow`, `BlockRow`, `WatchView`, `AccountsView`, `ContactList`, all through `displayName`/`knownRecipients` or direct indexing. | The schema change is contained. `parseContacts` is the one place that has to understand the old shape. |
| `src/i18n/locales/locales.test.ts` asserts that all ten locales (`de en es hi ja ko pt ru uk zh`) have the same key set as `en`. | Every new string lands in all ten files in the same commit. |
| `vitest.config.ts` runs in `node`, and there are no component tests. | Everything that deserves a test is a pure function in `src/lib`. |

## Decisions

1. **Contracts are marked in the contact, not detected per send.** A contact becomes `{ name, kind: 'account' | 'contract' }`. The kind is learned once, when the contact is added, from `getAccount(...).isAT`, and it cannot change: an id that is a contract stays one. A recipient typed freely into a "To" field that is not in the address book is treated as an ordinary account. Saving a contract as a contact is the intended way to work with it.

2. **Adding a contact checks the chain.** An address the node does not know is refused with a message saying so. This applies to every contact, not only to contracts. It changes today's behaviour, where any well-formed id could be saved. The sandbox chain is local, so an account worth naming is one that has appeared on it.

3. **Old address books keep working.** `parseContacts` accepts both the old value shape (a bare string) and the new one (`{ name, kind }`). An old entry becomes `kind: 'account'`. The sandbox had no notion of contracts before this change, so nothing is misclassified that was ever classified, and a contract saved under the old shape is fixed by removing and re-adding it. The storage key stays `…contacts.v1`, because the reader handles both shapes and a key bump would only orphan the old book.

4. **`minActivation` is fetched, not stored.** It is fixed for the life of a contract, but a saved copy would be a second answer that is free to disagree with the chain, the same reasoning `toAddress` gives for deriving rather than storing addresses. It is fetched with `getContract` only when a contract contact is the chosen recipient, and cached by react-query.

5. **The activation amount is a default and a warning, not a lock.** When a contract contact is picked, the SIGNA amount is prefilled with `minActivation` if the person has not typed one yet. An amount below it shows a warning. It does not block the send: watching a contract *not* run is something people come to a sandbox to see.

6. **Four argument types, one `long` each.** Every argument row produces exactly one 8-byte block:
   - **integer:** a decimal integer from −2⁶³ to 2⁶⁴−1. Negative values are packed as two's complement (what `convertDecStringToHexString` already does), and values above 2⁶³−1 are accepted because contracts read ids as unsigned.
   - **address:** a Reed-Solomon address (any case, prefix optional) or a numeric id, folded through `toComparableId` to the numeric id.
   - **boolean:** `1` or `0`.
   - **short string:** at most 8 bytes of UTF-8, packed with `convertShortStringToContractData`.

   Raw hex and multi-block strings are left out. The text fallback covers anything the form does not.

7. **Encoding goes through `generateMethodCall`.** The first argument is passed as `methodId` (the name in 3.3.4, where newer signumjs sources call it `methodHash`) and the rest as `methodArgs`. That function is nothing more than "pack each value and concatenate", so this reuses the reference for byte order instead of copying it. An empty argument list sends no attachment.

8. **Arguments or text, never both.** For a contract recipient the attachment section offers a switch: **Arguments** (the new form, sent with `messageIsText: false`) or **Text** (the existing `PayloadEditor`, sent as text). Each keeps its own state while switching, the same as `usePayload`.

9. **No encryption towards contracts.** In `MessageForm`, the encrypt toggle is disabled when the recipient is a contract contact, with a sentence saying why.

10. **No recipient public key for contracts.** `resolveRecipientPublicKey` treats an all-zero key from the node as "no key" and returns `undefined`.

## Components

### `src/lib/contractArgs.ts` (new, pure, tested first)

```ts
export type ContractArgType = 'integer' | 'address' | 'boolean' | 'shortString'
export interface ContractArg { type: ContractArgType; value: string }

/** One argument as the decimal string generateMethodCall expects, or why it cannot be one. */
export function toContractData(arg: ContractArg): { data: string } | { error: ContractArgError }

/** Hex payload for the whole list, or one error per bad row (index → error). */
export function encodeContractArgs(args: ContractArg[]):
  | { hex: string }
  | { errors: Record<number, ContractArgError> }
```

`ContractArgError` is a small union of codes (`notAnInteger`, `outOfRange`, `notAnAddress`, `tooLong`, `empty`), so the form can translate them. The tests pin known vectors:

- `integer 1` → `0100000000000000`
- `integer -1` → `ffffffffffffffff`
- `integer 2^64-1` → `ffffffffffffffff`, `2^64` → `outOfRange`, `-(2^63)-1` → `outOfRange`
- `address TS-FG8U-4565-CMY2-D7XBE` and `13125641130491689178` and the lowercase, prefix-less spelling → identical output, `dab836c810a527b6`
- `boolean true` → `0100000000000000`
- `shortString "abc"` → `6162630000000000`, `"12345678"` → `3132333435363738`, `"123456789"` is `tooLong`, `"äöüäö"` (10 bytes) is `tooLong`
- three arguments concatenate to 48 hex characters in order
- `[]` → `{ hex: '' }`

### `src/lib/contacts.ts` (changed)

- `Contact = { name: string; kind: 'account' | 'contract' }`, `Contacts = Record<string, Contact>`.
- `addContact(contacts, idOrAddress, contact)`, `removeContact` unchanged in meaning.
- `parseContacts` reads both shapes and drops entries that are neither.
- `displayName` reads `contacts[id]?.name`.
- New `isContract(contacts, idOrAddress): boolean` folds through `toComparableId`, so any spelling in a "To" field matches.
- New `resolveContact(idOrAddress): Promise<{ id: string; kind } | { error: 'invalidAddress' | 'unknownAccount' | 'unreachable' }>`. It parses, calls `ledger.account.getAccount`, and maps `isAT` to `kind`. Node error code 5 maps to `unknownAccount`, anything else to `unreachable`. The parsing and mapping are tested with the ledger call injected.

### `src/hooks/useContacts.ts` (changed)

`add` becomes `async (idOrAddress, name) => Promise<error | null>`. It calls `resolveContact` and persists only on success.

### `src/hooks/useContract.ts` (new)

`useContract(to, contacts)` returns `Contract | null`, enabled only when `isContract(contacts, to)`. Query key goes into `queryKeys.ts`.

### `src/lib/send.ts` (changed)

- `PaymentArgs` and `TransferTokenArgs` gain `binaryMessage?: string` (hex). When set it is sent as `AttachmentMessage({ message: binaryMessage, messageIsText: false })`, and `message` and `binaryMessage` are mutually exclusive.
- `TransferTokenArgs` gains `signa?: string`, sent as `amountPlanck`.
- `resolveRecipientPublicKey` returns `undefined` for an all-zero key.

### UI

- **`ContactList`:** "Add" shows a busy state while resolving, and errors appear inline under the inputs ("not a valid address", "this address does not exist on the chain yet", "node not reachable"). Contract contacts get a small "contract" tag next to the name.
- **`RecipientPicker` / `knownRecipients`:** contract contacts get the same tag as sublabel decoration.
- **`ContractArgsEditor` (new, `drawers/forms/ContractArgsEditor.tsx`):** a list of rows with a type `Select`, an input that fits the type (a toggle for boolean), and a remove button, plus "+ Argument". Below it: the live hex preview, the byte count, and per-row errors. State lives in a `useContractArgs()` hook next to it, mirroring `usePayload`.
- **`PaymentForm` and `TokenTransferForm`:** when `isContract(contacts, to)`:
  - a line under "To": "Contract · activates at ≥ X SIGNA" (from `useContract`)
  - the amount is prefilled with `minActivation` if still empty, and a warning appears if below it. `TokenTransferForm` gains a SIGNA amount field, shown only for contract recipients.
  - the attachment toggle opens an **Arguments | Text** switch instead of `PayloadEditor` alone.
  - submit is blocked while the argument form has errors, as with an invalid SRC44 form today.
- **`MessageForm`:** the encrypt toggle is disabled for contract recipients, with an explanation.
- **i18n:** all new strings in all ten locales. **Glossary:** a `contract` entry for `<Term>`, explaining activation amount and argument blocks in two sentences.

## Error handling

- Node unreachable while adding a contact: the contact is not saved, and the message says the node could not be asked. Nothing is saved on a guess.
- `getContract` fails for a contact marked as contract: no activation line and no prefill, but the argument form still works and the send goes through. The node remains the final word.
- An invalid argument row blocks the send, and the row says why.

## Testing

- `contractArgs.test.ts`: the vectors above.
- `contacts.test.ts`: old-shape and new-shape parsing, mixed books, `isContract` across spellings, `displayName` with the new shape, and `resolveContact`'s mapping with an injected lookup (unknown account, `isAT` true/false, network error).
- `send` stays without unit tests, as today. The zero-key rule in `resolveRecipientPublicKey` is pulled into a small pure helper and tested.
- `locales.test.ts` covers the new keys.
- Manual check against the local node: add the existing contract `TS-FG8U-4565-CMY2-D7XBE` as a contact (it is tagged as a contract), add a random unknown id (refused), send a payment with arguments `integer 42, address <own account>, shortString "hello", boolean true`, and confirm in the transaction detail that the attachment is the expected 64 hex characters and non-text.

## Out of scope

Deploying contracts. Method-hash helpers or per-contract ABIs and named signatures. Reading contract memory or maps. Showing decoded arguments in the transaction detail view. Detecting contracts typed freely into a "To" field without a contact.
