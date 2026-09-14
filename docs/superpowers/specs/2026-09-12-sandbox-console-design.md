# Signum Sandbox — The Console

**Date:** 2026-09-12
**Status:** approved
**Scope:** the sandbox itself — the console behind the start page, where you send transactions, forge blocks and inspect what happened. Builds on `2026-09-11-sandbox-ui-foundation-design.md`.

## Goal

The mock node makes blockchain actions free of cost and consequence. The console turns that into two things at once: an intuitive, playful way to grasp what a blockchain does, and a practical control room for building applications against a local chain.

Those are two audiences, not one. The newcomer needs guidance — few things at a time, every term explained, a reward when something works. The developer needs density — everything visible, nothing hidden, fast to repeat. **One surface serves both:** the console is built for the developer, and the newcomer experience is a layer on top of it — a beginner mode that adds explanation, a tour that asks you to act, and help icons on every term. There is no separate beginner UI to maintain.

## Verified ground truth

Checked against the pinned `signum-node.jar` (v3.9.11) API description and the installed libraries, not inferred.

| Fact | Consequence |
|---|---|
| The node exposes an **admin API**: `fullReset`, `popOff` (`numBlocks` or `height`, up to 1440 blocks), `clearUnconfirmedTransactions`, `backupDB`. All take an `apiKey` query parameter. | Reset and rewind are buttons in the UI, not "stop the node and delete `db/`". |
| `API.adminKeyList` is a node property (a commented example sits in `conf/node-default.properties`), and `conf/node.properties` is ours. | The sandbox pins a known admin key and the UI uses it. |
| Every request type the composer needs exists in v3.9.11: `sendMoney`, `sendMoneyMulti`, `sendMoneyMultiSame`, `sendMessage`, `setAccountInfo`, `issueAsset`, `transferAsset`, `setAlias`, `sendMoneySubscription`, `subscriptionCancel`. | No feature in the catalogue depends on an unreleased node. |
| SignumJS 3.3.4 covers all of them as typed methods: `transaction.sendAmountToSingleRecipient`, `transaction.sendSameAmountToMultipleRecipients`, `transaction.sendAmountToMultipleRecipients`, `message.sendMessage`, `message.sendEncryptedMessage`, `account.setAccountInfo`, `asset.issueAsset`, `asset.transferAsset`, `alias.setAlias`, `transaction.createSubscription`, `transaction.cancelSubscription`. | No hand-written request building. |
| `@signumjs/crypto` is already installed (a transitive dependency of `core`) and carries `encryption`, `sign` and `mnemonic`. | Key derivation from a passphrase and decrypting messages need no new dependency, but the browser crypto adapter has to be initialised explicitly. |
| `@signumjs/standards` exists at the same version (3.3.4) and carries SRC44 `DescriptorData`. | SRC44 is parsed and built by the reference implementation, not by us. |
| `hashicon` is at `0.3.0` — the latest published version. | Pinned exactly, without a caret. |
| `getNetworkInfo` is not an API request type; SignumJS derives it from `getConstants`. | Nothing changes for us — the existing call already works — but the network-name safety rail rides on `getConstants` data. |
| A recipient the chain has never seen is **rejected** — `{"errorCode":4,"errorDescription":"Incorrect \"recipient\""}` — unless the sender passes `recipientPublicKey`, which the node turns into a `PublicKeyAnnouncement` attachment. Verified live, both directions. | Every send announces the recipient's public key: derived from the sandbox's own accounts, otherwise fetched from the node. Multi-out cannot do this at all — `MultioutRecipientAmount` has no room for a key — so it only reaches accounts already on chain. |
| `getAccountsWithName` exists and answers **exact, case-insensitive** name lookups only — verified live: `Carol` and `carol` find the account, `Car` finds nothing. | A local address book is what makes an account findable by a name the user chose; the endpoint covers the case where someone types a full on-chain name. |
| A block reward is credited straight to the forger's balance without emitting a transaction. | The stream will never show a "block reward" row, and the mock-up in this document is wrong about that. The `reward` kind stays in the code for a transaction that genuinely has no sender. |
| Read-only endpoints for the three views all exist: `getUnconfirmedTransactions`, `getAccountTransactions`, `getBlocks`, `getBlock`, `getTransaction`, `getAccount`, `getAliases`, `getAsset`, `getAccountAssets`, `getAccountSubscriptions`. | The inspector needs no node change. |

Both reset calls have since been run against the live mock node, and only one of them does anything:

| Call | What actually happens on v3.9.11 |
|---|---|
| `popOff` | Works, but **cannot reach an empty chain**. `height=0` is refused outright (`invalid numBlocks or height`), so the floor is height 1: block 1 survives, along with the 10,000 SIGNA its forger was paid for it. Its reach is a further limit — 1440 blocks — but the floor is the binding one. |
| `fullReset` | **Silent no-op.** Answers `{"done":true}` and leaves the database byte-identical, because Flyway's clean is disabled inside the node. Passing `-Dflyway.cleanDisabled=false` to the JVM does not lift it either: the node sets the flag in code. |

So the console cannot empty the chain, and no amount of API can make it. Emptying means deleting the database, the node holds that file open while it runs, and there is no shutdown endpoint — nor should a web page have one.

The two are therefore presented as the two different things they are. **Winding back** is what the console does: `popOff` to block 1, verified by reading the height afterwards rather than trusting the answer, with the drawer saying plainly what survives. **An empty chain** is `start.sh --reset` (`start.cmd --reset`), which asks for confirmation and deletes `db/` before launching. The drawer names that command, spelled for the platform the browser reports.

The prompt is on the flag rather than on every start: a question asked at each launch would be answered "keep it" almost every time, and a question always answered the same way stops being read. `fullReset` was removed rather than kept as a fallback — a stage that always lies is worse than no stage.

## Decisions

1. **One console for both audiences.** Beginner mode adds explanation; the advanced section adds tools. The surface in between is the same for everyone.
2. **The start page stays.** It remains the deliberate fork between the sandbox and the API documentation. Its disabled "Mock Node Dashboard" entry becomes the live "Sandbox" entry pointing at `#/console`.
3. **Layout: a stage with tabs.** One persistent header, one large surface that switches between three views, drawers for everything transient.
4. **Detail expands inline**, in the list, rather than occupying a panel. Otherwise the composer and the detail view compete for the same space and one of them is always gone when you need it.
5. **Raw data is a link, not a payload dump.** Every detail view links to the node endpoint that produced it — `/api?requestType=getTransaction&transaction=…` — opening in a new tab. Inside the sandbox everything is rendered properly.
6. **The composer covers the features that make Signum worth showing**, and nothing else: payment, multi-out, plain and encrypted message, account info with SRC44, token issuance and transfer, alias, subscription. Contracts, reward recipient, marketplace and asset trading are out; the interactive API documentation covers the rest of the protocol better than a form ever would.
7. **One search field per view**, interpreting the same input by context rather than by syntax.
8. **Scenarios are declarative files run by a single runner**, shared between the UI and a terminal script.
9. **Identicons via pinned `hashicon@0.3.0`**, so an address looks the same here as in the wallets. SRC44 avatars are optional and fall back to the identicon.
10. **The tour drives real actions and waits for real chain state**, rather than narrating over the UI.
11. **The passphrase safety rail:** passphrases live in plain `localStorage` because they are worthless on a mock chain — and the account store refuses to operate when the connected node is not the mock network.
12. **Scenario accounts use obviously fake passphrases** (`sandbox-alice`, `sandbox-miner`); accounts created in the console get real generated mnemonics.
13. **Winding back and emptying are separate.** The console winds back with `popOff` and verifies the height; emptying the chain is `start.sh --reset`, because it needs the node stopped. `fullReset` is not used at all.
14. **A local address book.** Contacts are accounts the user does not own, given a name, kept as `accountId → name`. One resolution rule names an account everywhere: owned account, then contact, then on-chain name, then a shortened address.
15. **Reset names the right script per platform.** The deliverable carries `start`/`reset` in both `.sh` and `.cmd` form, and the console names whichever matches the browser's platform.
16. **Delivery in two layers:** the developer core first, the newcomer layer on top.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Signum-LOCAL-MOCK · v3.9.11 ●   height 128 · block 4s ago                │
│                      [⛏ FORGE] [forger ▾] [auto ○]  [+ Send] [Chain ▾] [?]│
├──────────────────────────────────────────────────────────────────────────┤
│ ( Transactions ) ( Blocks ) ( Accounts )          [🔍 id, address, name ] │
├────────────────────────────────────────────────┬─────────────────────────┤
│  Alice → Bob · 100 SIGNA            unconfirmed│ ▸ Send              ✕   │
│ ▾ Alice → Carol · message 🔒               #127│  (Payment) (Multi-Out)  │
│   ┌──────────────────────────────────────────┐ │  (Message) (Token) …    │
│   │ plaintext  "shall we meet at six?"       │ │  From  …                │
│   │ raw        ↗ /api?requestType=getTrans…  │ │  To    …                │
│   └──────────────────────────────────────────┘ │  Amount …               │
│   Bob · issued token PIZZA                 #128│  [ Send ]               │
│   Miner · block reward 10,000 SIGNA        #126│                         │
└────────────────────────────────────────────────┴─────────────────────────┘
```

**Header, always present:** network name, node version, connection dot, block height, age of the last block. On the right the forge button with its forger selector and the auto-forge switch, then the drawer triggers — Send, Chain, and help.

**Stage:** the three views share the surface. Switching is instant and keeps no per-view scroll position — a sandbox chain is short.

**Drawers** open over the right third of the stage: **Send** (the composer), **Chain** (load a scenario, reset, advanced tools) and **?** (beginner mode, tour, language, theme, sound, link to the API docs). One drawer at a time. The Send drawer **stays open after sending, with fields cleared** — in a sandbox you rarely send just once.

**The empty chain is a state, not a page.** On a chain with no blocks the stage has nothing to stream, so it carries the welcome instead: the question "first time here?", the scenario picker, and the note that you can also start empty with your own accounts. As soon as the first block exists, the same surface is the stream. A reset therefore lands back in the welcome without anything extra being built for it.

## The views

**Transactions** is the default and the reason the console exists. Newest first, unconfirmed ones marked distinctly, and when a block arrives they visibly move to confirmed. Each row states in one line who did what: `Alice → Bob · 100 SIGNA`, `Bob · issued token PIZZA`, `Carol · registered alias "shop"`. Clicking expands the row in place.

The expanded detail decodes the payload rather than restating the JSON: a plain message as text, an encrypted message decrypted when the sandbox holds one of the two keys, SRC44 as named fields, a token with its metadata and quantity, a multi-out with its recipient list, a subscription with its interval. The last line is the link to the node endpoint.

**Blocks** lists height, transaction count, forger and age. Expanding shows the contained transactions; clicking one returns to the transaction view filtered to that block. This view is what makes "a block is a container that closes when you forge" visible.

**Accounts** lists every account the sandbox knows plus every account seen on chain, with balance, token holdings and aliases, the configured forger marked. Expanding shows the details and, for accounts the sandbox owns, the passphrase. This is also where accounts are created and imported. It is a view rather than a permanent column precisely because it can grow to dozens of entries.

**Search** is one input per view. An address filters to that account, a numeric height jumps to that block, a transaction or token id resolves directly, and anything else is matched against names — account names, alias names, token names. No query syntax to learn.

## Chain control

**Forge** is one click. It calls `submitNonce` with the selected forger's passphrase and without `accountId`, as the foundation spec established. The forger is chosen from the sandbox's accounts and persists as a setting. The scenarios' dedicated miner account is the default.

**Auto-forge** produces a block on a fixed interval, **off by default**. It is what a developer switches on so their application's transactions confirm without switching windows; leaving it off by default preserves the newcomer's cause-and-effect between pressing a button and seeing a block.

**Winding back** sits behind a confirmation, calls `popOff` to block 1 and checks the height afterwards. It says what it cannot do — block 1 and its reward remain — and names the command that can.

**Advanced tools** are hidden behind a switch in the Chain drawer. It currently holds `popOff` with −1, −10 and −100 blocks. The same switch is the place for any later tool that would confuse more than it helps.

## The composer

| Action | SignumJS call |
|---|---|
| Payment, optionally with an attached message | `transaction.sendAmountToSingleRecipient` |
| Multi-out, same or individual amounts | `transaction.sendSameAmountToMultipleRecipients`, `transaction.sendAmountToMultipleRecipients` |
| Message, plain | `message.sendMessage` |
| Message, encrypted | `message.sendEncryptedMessage` |
| Account info with SRC44 | `account.setAccountInfo` |
| Issue token | `asset.issueAsset` |
| Transfer token | `asset.transferAsset` |
| Alias | `alias.setAlias` |
| Subscription | `transaction.createSubscription` |

Every form shares the same frame: a sender picked from the sandbox's accounts, the action's own fields, a fee, and a send button. Recipients are picked from known accounts or typed as an address — the picker is what keeps the sandbox playful, because `Alice → Bob` is a story and two 20-digit numbers are not.

Messages get first-class treatment because attaching real payload to a transaction is the point that surprises people: a text area, a switch between plain and encrypted, and the resulting transaction shows the payload back in the stream. SRC44 gets a structured form — name, description, avatar, links — built through `DescriptorData` rather than a free-text JSON field, so what lands on chain is valid by construction.

## Accounts

An account is a name, a passphrase, and everything derived from it. Accounts are stored in `localStorage` under a versioned key.

**Two kinds of passphrase, on purpose.** Scenario accounts carry deliberately fake ones — `sandbox-alice`, `sandbox-bob`, `sandbox-miner`. They are deterministic, short enough to type into an `.env` without copying, published in the documentation, and their worthlessness is self-evident: a passphrase anyone can guess is emptied within seconds of touching a real chain, which is precisely why it is safe here and nowhere else. Hardhat and Ganache use the same trick with their published mnemonics. The console labels them as such wherever they appear.

Accounts **created in the console** get a real generated mnemonic from `@signumjs/crypto`'s dictionary instead. This is where the tour teaches something, and a toy passphrase would teach the wrong thing: you should see once what a real seed looks like, that it *is* the account rather than a password guarding it, that nobody can restore it for you, and that it sits here in plain text in your browser only because here it is worth nothing. Import accepts any existing passphrase.

An account only exists on chain once it has received something, so a freshly created account shows as *not yet on chain* until it does — this is a fact about Signum worth surfacing rather than hiding, and beginner mode explains it.

**The address book.** Beside the accounts it owns, the console keeps contacts: accounts it does not own, each given a local name, stored as `accountId → name` without any key. They hold no secrets, so unlike the account store they are not gated by the network rail. A contact is added by hand in the Accounts tab, or straight from a transaction row when an unfamiliar address turns up in the stream.

One rule names an account everywhere — the feed, the block list, the recipient picker: an account the sandbox **owns** uses its own name, otherwise a **contact** name, otherwise the **on-chain name**, otherwise a **shortened address** that keeps both ends so two accounts still look different. The feed deliberately stops before the on-chain name: resolving it per row would mean a `getAccount` for every line of a live stream.

**The safety rail:** on startup the console compares the connected node's network name against the mock network. If they differ, the account store is unavailable, no passphrase is read or written, no transaction is signed, and the console shows why. A convenient wallet that keeps passphrases in plain text must never be one keystroke away from a real network.

## Scenarios

A scenario is a JSON file — a list of steps in a small vocabulary:

```
createAccount   name, [passphrase]
forge           [count]
fund            account, amount        (miner forges until it can cover it, then pays)
payment         from, to, amount, [message]
multiOut        from, recipients[]
message         from, to, text, [encrypted]
accountInfo     account, src44{}
issueToken      issuer, name, quantity, decimals, src44{}
transferToken   from, to, token, quantity
alias           account, name, [src44{}]
subscription    from, to, amount, frequency
```

One runner executes that list; both the UI and a terminal script call it. In the UI it runs with visible progress — each step named as it happens, blocks appearing in the stream while you watch. That watching is half the explanation for a newcomer. From the terminal it runs unattended, so a deliverable can arrive with the chain already populated and a developer never waits.

The vocabulary is the limit: anything not expressible in it is not a scenario. That is accepted — the trade is that a scenario stays a data file anyone can write without touching the UI, including a developer capturing their own application's starting state.

Two scenarios ship:

**First Steps** — three accounts, a handful of payments, one plain message, four or five blocks. The starting point for someone who wants to see what a block is, and for a developer who just needs funded accounts.

**Full House** — a chain that looks lived-in: SRC44 profiles on every account, a token with metadata distributed across several holders, two or three aliases, encrypted messages between two accounts, a payroll multi-out, and a running subscription. Roughly twenty transactions. This is the chain on which every view has something to show, and it doubles as the feature demonstration.

Both use a fixed miner account and the deliberately fake passphrases described above, published in the documentation, so addresses survive a reset and can be written into an application's configuration and test fixtures.

Avatars: SRC44's avatar field references IPFS, which an offline sandbox cannot rely on. Scenarios leave it empty everywhere and the UI renders a `hashicon` identicon from the address. An earlier draft had one account carry a real pinned CID to demonstrate the field; that is dropped, because a single account behaving differently from the rest buys one demonstrated field at the cost of a fetch path, a timeout and a fallback.

**Scenarios load cumulatively.** They add to whatever chain is already there rather than requiring an empty one — the console cannot empty a chain anyway, and winding back is a decision the user makes deliberately in the Chain drawer. Running the same scenario twice is therefore not an error: the accounts are derived from fixed passphrases, so they are the same accounts, and the second run simply adds more transactions between them.

## Beginner mode and the tour

The console asks once, on first entry: new here, or an old hand? The answer sets beginner mode, and it is a switch in the help drawer afterwards — nothing is locked in.

**Beginner mode on** adds help icons next to every domain term (the vendored `InfoTooltip` already exists for this), adds a sentence of context to each view, and offers the tour on entry. It changes what is explained, not what is reachable — every tab and every drawer stays available, because a beginner who wanders off should find a working console, not a locked one.

**The tour asks you to act and waits for the chain to answer.** It highlights the forge button and says "press it"; the step completes when the height actually increases. It opens the Send drawer with fields pre-filled and says "send Alice 100 SIGNA to Bob"; the step completes when the transaction appears in the stream. Then: "it is unconfirmed — forge again and watch what happens to it." Nothing is simulated; every step is a real transaction on a real chain that costs nothing.

**Creating an account is its own chapter**, and the one that carries the most weight, because it is where a newcomer meets the concepts that matter outside the sandbox too. The tour walks through creating a real account and explains, at the moment each becomes visible: what a passphrase is and that it *is* the account rather than a password protecting it; that the address is derived from it, so the same passphrase always yields the same account; that nobody can restore it — no reset link, no support; that the sandbox keeps it in plain text in the browser because here it is worthless, and that this is exactly what a real wallet must not do; and finally that the account does not exist on chain until it has received something. The chapter ends by funding the new account from the miner and watching it appear.

This couples the tour to the rest of the UI, and that coupling is designed in from the start rather than bolted on: components that the tour needs to highlight or pre-fill expose that capability, and steps complete against observed state rather than against clicks. The tour content itself belongs to the second delivery layer, but the hooks are built with the components.

## Decentralised identifiers

Signum entities are W3C DID conformant, which is the feature that makes the
chain interesting for verification: an account, a transaction or an alias can
be named by a `did:signum:…` identifier and resolved to a DID document. The
console links these alongside the raw JSON response it already offers.

**The resolver lives in the console, not beside it.** `signum-did-resolver`
exists as a hosted Vercel service, and self-hosting it would mean a Node
runtime next to the JVM, a second process, a second port and a second thing to
package — for a project whose deliverable is one jar and one script. It also
recognises exactly two networks — its parser's regex admits `mainnet` and
`testnet` and nothing else, the README's mention of `stagenet`
notwithstanding — with no mechanism for registering another, so running it
against a mock chain would mean maintaining a fork. Resolution is a pure transformation of data the
console has already loaded — account id, public key, SRC44 profile — so it is
a function in `src/lib/`, tested the way everything else there is, and it works
offline.

**The network segment is `sandbox`.** A DID printed without one claims mainnet,
and someone could reasonably paste it into the real resolver and get nothing;
`did:signum:sandbox:acc:…` says where it resolves and where it does not.
`sandbox` rather than `mocknet` because it names the thing a reader is holding.
This extends the method by one network, which is a change worth making
upstream in the resolver rather than only here.

The documents the console produces match the shape the real resolver returns —
`didResolutionMetadata`, a `didDocument` carrying `@context`,
`verificationMethod` and `src44`, and `didDocumentMetadata` — so what a
newcomer learns here is what they will meet outside.

The console resolves accounts, transactions and aliases. Tokens and contracts
are types the method defines and the console has no page for, so they are left
until there is somewhere to put them.

## Architecture

```
src/
  routes/console.tsx            the console route
  components/console/
    ConsoleShell.tsx            header + tabs + stage + drawer host
    Header.tsx                  status, forge controls, drawer triggers
    views/
      TransactionsView.tsx      the stream
      BlocksView.tsx
      AccountsView.tsx
      SearchField.tsx           one input, context-dependent interpretation
      TransactionDetail.tsx     inline expansion, payload decoding
    drawers/
      SendDrawer.tsx            frame + per-action forms
      ChainDrawer.tsx           scenarios, reset, advanced
      HelpDrawer.tsx            beginner mode, tour, settings
  lib/
    ledger.ts                   extended: signing client alongside the read-only one
    accounts.ts                 the account store, incl. the network rail
    transactions.ts             one typed function per composer action
    chainAdmin.ts               forge, auto-forge, the staged reset, popOff
    scenario/
      types.ts                  the step vocabulary
      runner.ts                 executes a step list, reports progress
      scenarios/*.json          First Steps, Full House
    payload.ts                  decoding: message, SRC44, token, multi-out
    search.ts                   pure: input → interpretation per view
  hooks/
    useChainFeed.ts             the merged confirmed/unconfirmed stream
    useAccounts.ts
    useTour.ts                  step state, completion against chain state
  tour/steps.ts                 the tour as data
scripts/seed.sh                 runs a scenario from the terminal
scripts/reset.sh                last-resort reset: stop, remove db/, start
```

Files stay under 500 lines, per the repository's own rule. The split above is drawn so that each unit answers one question: `payload.ts` knows how to read an attachment, `runner.ts` knows how to execute a step, `search.ts` knows what an input means, and none of them knows anything about React.

## Data flow

The foundation's pattern continues: the WebSocket drives invalidation, polling is the fallback when it drops. `BLOCK_PUSHED` invalidates blocks, the stream and the balances of known accounts; `PENDING_TRANSACTIONS_ADDED` invalidates only the unconfirmed part of the stream; `CONNECTED` and `HEARTBEAT` are still ignored.

The stream merges two sources — `getUnconfirmedTransactions` and the recent blocks' transactions — into one list sorted newest first, with the unconfirmed ones on top. That merge is a pure function and therefore testable: given a set of unconfirmed transactions and a set of blocks, produce the stream.

Sending goes through the full SignumJS client: build, sign locally with the sender's keys, broadcast. The transaction appears in the stream as unconfirmed on the next invalidation, without the composer having to insert it optimistically.

## Error handling

- **A transaction is rejected** — insufficient balance, malformed field — the form keeps its input and states the node's error message. Nothing is lost to a failed send.
- **The forged block does not arrive.** `submitNonce` reports success even when several calls collapse into one block, so the forge button reports "block requested" and lets the height speak, rather than promising a block per click.
- **A scenario step fails** mid-run. The run stops at that step, names it, and leaves the chain as it is. A half-populated chain is confusing but recoverable; silently continuing past a failure is worse.
- **Reset fails.** Each stage falls through to the next, and if all of them fail the console names `scripts/reset.sh` as the manual path rather than leaving the user guessing.
- **The node is not the mock network.** The safety rail engages; the console renders in read-only mode with an explanation instead of half-working.
- **An encrypted message cannot be decrypted** because the sandbox holds neither key. The detail says exactly that instead of showing an error.

## Testing

Vitest over pure functions, as before, with `environment: 'node'`:

- the stream merge — unconfirmed plus blocks to one ordered list, including a chain reset where the height goes backwards
- search interpretation — which input means what in which view
- payload decoding — plain message, SRC44, token metadata, multi-out, subscription, and the undecryptable case
- the scenario runner's step sequencing and its behaviour when a step fails, against a mocked ledger
- the account store's network rail — the store must refuse on a foreign network

The smoke script gains one assertion: the console route responds and the admin API answers with the configured key.

Component rendering remains untested, consistent with the foundation. The tour is the one place where that hurts, since it is defined by interaction — its step definitions are therefore data, and the logic deciding whether a step is complete is a pure function over chain state, tested as such.

## Delivery in two layers

**Layer one — the developer core.** Console shell, header with forge and auto-forge, the three views with search and inline detail, account management with the safety rail, and the full composer. On its own this is a finished tool: someone can develop an application against it from day one, starting on an empty chain and forging their own funds.

**Layer two — the newcomer.** Scenarios and their runner, the terminal seed script, help icons, beginner mode, the tour, and the advanced section with `popOff`.

This order follows the dependencies: a tour can only be led through a UI that exists, and a scenario is a sequence of actions the composer must be able to perform anyway. The reverse order would mean building scenarios against a composer that does not exist yet, in exchange for having something to show sooner.

## Out of scope

Smart contracts, reward recipient, marketplace, asset trading, the faucet, distribution channels, and any UI for the node's own configuration. Multi-language coverage follows the foundation's rule — every new string gets its ten translations — but no new locale is added.

## Open risks

The console cannot empty the chain by itself and never will: `popOff` refuses to go below block 1 and `fullReset` does nothing. That is a limit of the node, now stated in the drawer rather than worked around.
