# Signum Sandbox — The Launcher and the One-Liner

**Date:** 2026-09-15
**Status:** approved, with three open questions at the end that are not ours to answer
**Scope:** one command that installs and runs the sandbox on macOS and Linux, and the launcher core underneath it. `npx`, Homebrew, scoop/winget, the Windows variant and the release pipeline are each their own later project — see Out of scope.

## Goal

Today the sandbox is a zip. You download it, unpack it, find `scripts/start.sh`, and you need Java 21 already installed. Every one of those steps loses people, and the last one loses the most: Java is the real hurdle, and "install a JDK first" is where a newcomer stops.

After this, there is one command. It installs what is needed — including a private Java that the user never hears about — and starts a chain. The word "Java" does not appear in the instructions.

The sandbox speaks to newcomers and to developers at once, which is the stance the console already takes. So the launcher does too: the plain command runs in the foreground and is over when you close it, and `--daemon` is there for the person who knows they want it.

## Verified ground truth

Checked by running it, not inferred.

| Fact | Consequence |
|---|---|
| All four Adoptium endpoints answer 200: `api.adoptium.net/v3/binary/latest/21/ga/{mac,linux}/{x64,aarch64}/jre/hotspot/normal/eclipse`. They serve `OpenJDK21U-jre_*_21.0.12.1_1.tar.gz`, 42–52 MB. | A private JRE per platform is a one-time download of about 50 MB. No installer, no PATH surgery, no system Java touched. |
| The assets API carries a SHA-256 per binary — `dec50fc6f9fcd4fe3ae8cabf5a5fa68f6afc48841f7698e468e9aa5d54beed84` for mac/aarch64 — and a `.sha256.txt` beside each release asset. | What the installer downloads can be verified. |
| A file fetched with `curl` on macOS carries `com.apple.provenance` but **not** `com.apple.quarantine`; files a browser fetched into `~/Downloads` do carry it. Gatekeeper blocks on quarantine. | An unsigned JRE installed through the one-liner runs. The same JRE downloaded from the Adoptium website in a browser would be blocked with "the developer cannot be verified". This is the strongest argument for the channel. |
| `scripts/package.sh` already assembles a complete deliverable: jar, `conf/`, both HTML mounts, both start scripts, licences, README, `VERSIONS.txt`, zipped as `build/signum-sandbox-<version>.zip`. | The installer assembles nothing. It downloads that zip. |
| There is no `.github` directory. No CI exists. | The first release is built by hand from `package.sh`, and the pipeline is a separate project. |
| The GitHub repository is **private** today: the API answers 404 for `/repos/signum-network/signum-sandbox` while `git ls-remote` resolves `refs/heads/main`. No releases exist. | `raw.githubusercontent.com` and `releases/latest/download` both 404 until the repository is public. It will be; the one-liner cannot ship before then. |
| The node is started as `java -jar signum-node.jar --headless -c ./conf/` and holds its database open while it runs. | The launcher owns the working directory and the conf directory, and `reset` has to know whether a node is running. |
| `conf/node.properties` points at **relative** paths: `DB.Url = jdbc:sqlite:file:./db/signum-sandbox.sqlite.db` and `API.UI_Dir = html/sandbox`. It also pins `API.adminKeyList = sandbox`, which is what lets the console wind the chain back. | The launcher must run with `~/.signum-sandbox` as the working directory, and the active release's `html` has to be reachable from there under that exact name. Neither path may carry a version number, or the user's own conf file would have to be rewritten on every update. |
| `scripts/start.sh --reset` deletes `db/` after a prompt, with no way to know whether a node is running. | With a pidfile this becomes a check instead of a warning in a comment. |
| `package.json` holds the version `package.sh` names the release after, and the UI now shows it beside the wordmark via `__SANDBOX_VERSION__`. | One version number, from one place, visible in three: the page, `VERSIONS.txt`, and the installed directory name. |

## Decisions

1. **`--daemon` is a detached process with a pidfile, not a system service.** No launchd, no `systemd --user`, no autostart. The node does not survive a logout or a reboot, and that is deliberate: a sandbox should not run unnoticed for three weeks. One mechanism, identical on macOS and Linux, about twenty lines of `sh`.
2. **Foreground is the default.** It is what `start.sh` does today, it is the same on every platform, and for something you start in order to try things out, "runs while I am watching" is a feature.
3. **`reset` refuses while the node is running.** The pidfile makes the check possible; pulling an open database out from under the node was previously only discouraged by a comment.
4. **The JRE version and its four checksums are pinned in the repository**, not queried at run time. Parsing JSON in POSIX `sh` without being able to assume `jq` is a class of failure that cannot be debugged on someone else's machine. This mirrors `.signum-node-version`, which the repo already pins this way.
5. **The private JRE is always used, even when a system Java exists.** One variable fewer when something breaks for a user. `SIGNUM_SANDBOX_JAVA` overrides it for the developer who insists, and says so in `--help`.
6. **The chain and the configuration live outside the versioned directory.** An update replaces `app/<version>/` and touches neither. The opposite arrangement would throw away someone's chain on every update, and on a sandbox the annoyance is small enough that nobody would report it and it would go unnoticed for a long time.
7. **Nothing in the layout is a symlink.** The active version is a text file: it works in the later Windows variant where symlinks need privileges, it can be read without interpreting `ls -l`, and a rollback is one line because the previous tree is still there. The `html` the node serves is a copy of the active release's, for the same reason — 2 MB and 84 ms, against a special case on every platform that handles links differently.
8. **Installing and updating are the same code path.** Installing is an update from nothing. A rarely-run second path is a path that rots.
9. **The installer assembles nothing.** It downloads the zip `package.sh` produces. The part that is hardest to debug remotely stays the dumbest part.
10. **No update check from the page, ever, in the background.** The sandbox's promise is an offline mock network, and a page that calls `api.github.com` on every load breaks that promise quietly — for exactly the people who wanted an isolated environment. The check happens when someone types `signum-sandbox update`. If the console is ever to mention updates, it is a button that is pressed.
11. **No silent edits to shell startup files.** If `~/.local/bin` is not on `PATH`, the installer prints the one line to add. An installer that writes to `.zshrc` unannounced is one nobody trusts the second time.

## The command surface

```
signum-sandbox                  start in the foreground, until Ctrl-C
signum-sandbox start --daemon   start detached, remember the pid
signum-sandbox stop             stop the detached node
signum-sandbox status           running or not, port, chain height
signum-sandbox logs             follow the log
signum-sandbox update           fetch the newest release, switch to it
signum-sandbox rollback         switch back to the previous release
signum-sandbox reset            delete the chain; refuses while running
signum-sandbox --help
```

`status` asks the node itself for the height rather than reporting only the pid: a process that is alive but not answering is the failure worth seeing, and `getBlockchainStatus` is one request away.

## On disk

```
~/.signum-sandbox/
  app/0.1.0/           the unpacked release: jar, html/, default conf
  app/0.2.0/           the next one, unpacked beside it
  installed            a text file: "0.2.0"
  jre/21.0.12.1+1/     the extracted Temurin JRE
  conf/node.properties ours, created once, never overwritten
  db/                  the chain
  html/                copied from the active release, see below
  html/.version        which release it was copied from
  logs/node.log
  run/node.pid
~/.local/bin/signum-sandbox
```

The node is started with `~/.signum-sandbox` as its working directory, which is what makes `DB.Url`'s `./db/…` land on the chain that survives updates. The same relative-path style forces the second half: `API.UI_Dir = html/sandbox` has to resolve from there too.

So `html/` is **copied** out of the active release, not linked to it, and `html/.version` records which release it came from. On start the launcher compares that against `installed` and re-copies only when they differ. The whole tree is 2 MB and copying it takes about 84 ms, measured — so this costs nothing that can be felt, and only on a version change.

A symlink would have done the same job on macOS and Linux, and was the first draft. Copying is better for the reason decision 7 already gives: it leaves no link anywhere in the design, so the later Windows variant is the same code rather than a special case with a junction and a question about privileges. It is also a state you can understand by looking at it — a directory with a version marker in it, rather than a link someone has to interpret.

Either way, what matters is that no version number ends up in the user's own configuration file. The alternative — rewriting `API.UI_Dir` in `conf/node.properties` on every update — would mean the launcher editing a file it promised never to overwrite.

`conf/node-default.properties` is copied out of the active `app/<version>/` on every start, because those are the node's own defaults and they belong to the release. `conf/node.properties` is seeded from the release's copy the first time and never touched again, so a user who changes a port keeps it across updates. That split is the one the node itself defines.

Each `app/<version>/` is about 64 MB, almost all of it the node jar. Two are kept; older ones are removed on update, or `~/.signum-sandbox` grows into the gigabytes without anyone noticing.

## The JRE

`uname -s` and `uname -m` decide the platform: `Darwin`/`Linux` and `arm64`/`aarch64`/`x86_64` map to Adoptium's `{mac,linux}` and `{aarch64,x64}`. Anything else is an error that names what was found, rather than a download that fails later for a reason nobody can read.

The pinned version and the four checksums live in one file in the repository. The download is verified with `shasum -a 256` where it exists and `sha256sum` otherwise — macOS has the former, most Linux distributions the latter, and checking for both is two lines.

The tarball is extracted into `jre/<version>/`, and the launcher runs `jre/<version>/Contents/Home/bin/java` on macOS and `jre/<version>/bin/java` on Linux. The layout difference is Temurin's, not ours.

## Versioning and updates

`package.json` is the single source. It names the release, it is baked into the page as `__SANDBOX_VERSION__`, and it becomes the directory name under `app/`. A dev server shows `-dev` appended, because it is almost always ahead of the release whose number it would otherwise claim.

`update` asks GitHub for the newest release, downloads its zip and its checksum, verifies, unpacks to `app/<new>/`, and only then writes `installed`. An interrupted download leaves a partial directory nobody uses rather than a broken installation. `rollback` writes the previous version back into `installed`.

## The one-liner

```sh
curl -fsSL https://github.com/signum-network/signum-sandbox/releases/latest/download/install.sh | sh
```

`releases/latest/download` rather than `raw.githubusercontent.com/.../main`: both are permanent addresses that can be printed in a README, but this one serves the installer from the newest *release* rather than from whatever is on `main` at that second — which matters exactly when someone runs it while a half-finished commit sits on the branch. That `install.sh` can install the newest release is the script's job, not the address's.

Until the first release exists, `releases/latest/download` points at nothing, so the transitional address is:

```sh
curl -fsSL https://raw.githubusercontent.com/signum-network/signum-sandbox/main/install.sh | sh
```

**This has to be switched over once a release exists**, and it is written down here because that is the kind of change that is otherwise never made.

Neither address answers while the repository is private.

The installer detects the platform, fetches and verifies the JRE, fetches and verifies the release zip, unpacks both, writes `installed`, places the launcher, and prints how to start. It opens no browser, starts nothing, and changes no shell files.

## Testing

Installer projects usually cheat here, so this says plainly what is real.

**Testable as pure decisions**, in a small `sh` test script beside the launcher: the platform mapping out of `uname`, the URL built from it, whether an existing installation means update or fresh install, whether `reset` must refuse, and which versions get pruned. Not Vitest — this is a different language, and pretending otherwise would put a second test runner in the repo for five functions.

**Real only in a container:** the whole run on Linux. `docker run` against a bare Debian, one-liner in, `signum-sandbox status` out. This uses Docker as a **test harness**, which does not touch the 2026-09-11 decision — what was ruled out is Docker as a *distribution channel*.

**Answerable only on a real Mac:** macOS, where the quarantine question lives. That run is done by hand, and on a fresh user account, so that "there was already a Java here" cannot fake the result.

## Out of scope

Each of these is its own project, in roughly this order:

- **The release pipeline.** Build the zip, attach it and `install.sh` to a GitHub release, publish checksums. Needed for repeatability; the first release can be built by hand from `package.sh`.
- **`npx signum-sandbox`.** A thin wrapper over the same launcher core.
- **Homebrew and scoop/winget.** Manifests that the pipeline updates on release.
- **Windows.** A PowerShell installer and the `.cmd` side of the launcher. The text-file version pointer and the pinned-checksum approach were both chosen with this in mind.
- **A background service.** Deliberately not built (decision 1). If it is ever wanted, it is an addition, not a change.

## Open questions

Three things this design depends on and cannot decide:

1. **When does the repository become public?** Nothing in the one-liner works before that. It is planned, so this is a sequencing question, not a blocker.
2. **Who pushes?** `origin/main` is at `7e3ee5e`, which predates this session; the work since then is on a local branch.
3. **Is the first release built by hand or after the pipeline exists?** By hand is fine — `package.sh` already produces exactly the artefact the installer wants — and it would let the one-liner be tested before there is any CI to debug at the same time.
