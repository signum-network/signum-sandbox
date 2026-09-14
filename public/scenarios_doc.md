# The scenario language

A scenario describes a chain: accounts, payments, tokens, aliases, messages,
standing orders. It is plain text, one instruction per line, and it runs
against the sandbox node in the order it is written.

Scenarios **add to** the chain you already have. Nothing is removed, and
running the same one twice is not an error — the accounts derive from fixed
passphrases, so they are the same accounts, and the second run simply adds
more transactions between them.

There is no undo. A scenario that fails halfway leaves what it already wrote,
which is why every line is parsed and cross-checked before the first
transaction is sent.

---

## Shape of a line

```
# a comment, to the end of the line
fund Alice 1000
msg Bob -> Alice "text with spaces needs quotes"
```

Blank lines and comments are ignored. A word runs until a space; a quoted
string may contain spaces and runs to the closing `"`. There are no escape
characters — a scenario is meant to be read at a glance, and a backslash rule
earns its keep only in languages people write far more of than this.

A name cannot contain a space, a comma, a `#` or a quote. Those are the
characters the reader uses to tell the parts of a line apart.

---

## Instructions

### `miner <Name>`

The account that forges every block and pays for every `fund` line. One per
scenario, and required: without it nothing can forge, and without forging
nothing settles.

```
miner Miner
```

### `account <Name> ["passphrase"]`

Creates an account. The passphrase is derived from the name — `account Alice`
uses `sandbox-alice` — so the same scenario always produces the same
addresses, on every machine, which is what makes them worth writing into an
application's configuration and test fixtures.

Give a passphrase in quotes to override that.

```
account Alice
account Treasury "correct horse battery staple"
```

Creating an account writes nothing to the chain. It appears on chain the
moment it first receives something.

### `fund <Name> <signa>`

Gives an account SIGNA out of the miner's earnings. The miner forges until it
can cover the amount, then pays it.

```
fund Alice 1000
```

This is the instruction that decides how long a scenario takes and how tall
the chain gets. A large amount means many blocks.

### `pay <From> -> <To> <signa> ["message"]`

A payment, with an optional message attached to it.

```
pay Alice -> Bob 120
pay Alice -> Bob 10 "Thanks for lunch"
```

### `msg <From> -> <To> "text"` and `secret <From> -> <To> "text"`

A message on the chain — `msg` readable by everyone, `secret` encrypted so
only the recipient can read it.

```
msg    Bob   -> Alice "Any time. Same again Friday?"
secret Alice -> Bob   "The keys are under the mat."
```

### `multi <From> -> <To> <signa>, <To> <signa>, …`

Pays several accounts in one transaction, for one fee.

```
multi Alice -> Bob 250, Carol 250, Pizzeria 60
```

Up to 64 recipients, which is the protocol's limit for individual amounts.

### `info <Name> "display name" ["description"]`

Sets the account's name and description on the chain — what other
applications will see when they look it up.

```
info Pizzeria "Pizzeria Vesuvio" "Wood-fired since 1998"
```

### `token <Issuer> <SYMBOL> <quantity> <decimals> ["description"]`

Issues a token. Signum does this natively: no smart contract, no deployment.

```
token Pizzeria SLICE 10000 0 "One SLICE, one slice."
token Treasury ORBIT 10000 2 "Governance token"
```

**Quantities are written the way you read them.** `10000` with 2 decimals is
ten thousand tokens. The chain counts in the token's smallest unit
underneath — hundredths, here — and the runner converts before it speaks to
the node, so the number in the file is the number you meant.

Issuing costs **150 SIGNA**, so the issuer must be funded well above that.

### `transfer <From> -> <To> <SYMBOL> <quantity>`

Sends some of a token. The quantity is read the same way as above, and an
amount finer than the token can hold is refused before anything runs.

```
transfer Pizzeria -> Alice SLICE 40
transfer Ana      -> Ben   ORBIT 125.5
```

### `alias <Owner> <name> "content"`

Registers a name on the chain that points at something — an account, a link,
or any content you choose. Each name exists only once, what it points at can
be changed later, and the alias itself can be handed to another account.

```
alias Pizzeria vesuvio "https://example.invalid/vesuvio"
```

### `subscribe <From> -> <To> <signa> every <seconds>`

A payment that repeats on its own, carried out by the chain until cancelled.

```
subscribe Alice -> Pizzeria 12 every 3600
```

### `forge [count]`

Makes empty blocks. Every instruction that writes to the chain already forges
one to settle itself, so this is for adding blocks with nothing in them.

```
forge
forge 20
```

At most 1000 per line.

---

## What is checked before anything runs

The whole file is read first, and every problem is reported against its line:

- an instruction that does not exist
- a missing or surplus argument, including text that forgot its quotes
- a fractional count where only whole numbers make sense
- an account or token named before the line that creates it
- a name used twice
- an amount finer than its token's decimals allow

What is **not** checked is money. Whether an account can afford what it is
about to do is the node's judgement, not a guess made here — a second,
approximate model of fees and block rewards sitting beside the real one would
be worse than none at all. If a transaction cannot be made, the node says so
and the scenario stops on that line with what the node said.

---

## A worked example

```
# Two accounts, some money moving, and a token.

miner   Miner
account Alice
account Bob

fund Alice 5000
fund Bob   1000

info Alice "Alice" "Builds things on Signum"

token    Alice CAKE 100 0 "Redeemable for one cake"
transfer Alice -> Bob CAKE 3

pay    Bob   -> Alice 40 "Three cakes, thanks"
secret Alice -> Bob   "The recipe stays in the family"

subscribe Bob -> Alice 5 every 3600

forge 2
```

Alice is funded 5000 because issuing a token costs 150 SIGNA; 1000 would
fail on the `token` line, and the node's complaint would name neither that
line nor the `fund` line above it.
