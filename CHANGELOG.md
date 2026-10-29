# signum-sandbox

## 0.3.0

### Minor Changes

- the watched account is called by its name, or by its address, never by its numeric id
- the search counts its hits and steps to the next or previous one
- the slot list moves with the arrow keys, page by page
- a hit can be stepped to from any slot, and a key moves the selection
- inspector navigation spec and plan — two-column header, hit stepping, keys in the slot list
- moving from one contract to another starts the page afresh, with no changes measured across them
- one search finds a value in every part of a contract and marks where it is
- a contract's memory reads as pages of slots, each opened beside the list
- the contract page keeps its header and puts memory, maps and activity under tabs
- a slot's label and type are kept together, and labels set so far survive
- a slot can be read every way, found by any of them, and paged as the AT pages its memory
- every account the inspector knows links to watching it in the console
- the contract inspector's layout, redesigned around tabs, pages and a detail panel
- the inspector's account column says Konto in German, like the rest of the console
- contacts, the watch view and transactions lead to the contract inspector
- text colours name the --text token that exists, not an undefined --fg
- a contract's maps can be looked up by one key or both
- a contract's variables stand apart from its stacks, and a lone character is not text
- a contract's data stack shows every slot, and which ones just changed
- a frozen contract reads as waiting for its next call, with the balance that wakes it
- an incoming transaction names who sent it, not the account it arrived at
- the contract page shows who made it, what it holds and whether it runs
- /console?watch=<address> opens the console watching that account
- a contract has a page of its own, refreshed with every block
- a contract's slots can be named, and the names follow its code
- the sandbox can tell which ids it knows and which parties are contracts
- a contract's data stack reads as slots, short strings the right way round
- a contract inspector, designed and planned
- the console reads which account to watch from its address
- addressable console spec and plan — /console?watch=<address>
- the console lists every contract on the chain, each a link to its inspector
- every contract on the chain can be fetched, ordered and searched
- contract list spec and plan — a console tab of every contract on the chain
- the contract header sits in two columns, leaving the memory more room

## 0.2.2

### Patch Changes

- the transaction list reaches past empty blocks, so the latest transactions always show
- a search for a transaction, block or account finds it anywhere on the chain, and opens it
- turning a page no longer flickers

## 0.2.1

### Patch Changes

- the sandbox starts in the background, and says when it answers

## 0.2.0

### Minor Changes

- Windows installs with one line too, and gets the launcher's commands
- a published checksum is found behind GitHub's redirect

## 0.1.1

### Patch Changes

- a page older than the installed sandbox says so, and offers the reload
- a release publishes its checksum, and the installer checks it

## 0.1.0

### Minor Changes

- Smart Contract (SC) Accounts
- Arguments Form in Send Dialog for SCs
- Copy Tx ID

## 0.0.2

### Patch Changes

- Update README.md
- a slot for the video, and a haiku that is already there
- an account can wear one of three faces
- three identicons behind one cycling button
- 0.0.1 is out, the pipeline did every step of it
