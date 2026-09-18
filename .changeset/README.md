# Changesets

This directory holds the pending changelog entries. Normally nobody writes them by
hand here: `bun run new-version` collects the commit subjects since the last tag,
lets you edit them, and drops the result in as a changeset before running
`changeset version`.

Writing one by hand is still allowed — `changeset version` picks up everything it
finds, and its bump level raises the release if it is higher than the one chosen at
release time. `bun run new-version` says so before it writes anything.

`changeset publish` is never used. This package is private and is delivered as a
GitHub release, not to a registry.
