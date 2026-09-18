# Release-Pipeline — Arbeitsplan

**Ziel:** `bun run new-version` auf sauberem `develop` bumpt via changesets, pusht, und
`release.yml` prüft, baut, installiert testweise, zieht `main` nach und veröffentlicht.

**Form:** Im YAML steckt kein Urteil. Jede Entscheidung liegt in einem Skript mit Tests.
Begründungen stehen als Kommentar in der Datei, die sie betrifft — keine Spec.

**Auslöser:** „für die Version in `package.json` existiert kein Tag". Idempotent: jeder
gewöhnliche Push prüft nur, jeder Push mit neuer Version veröffentlicht. Der erste Lauf
gibt darum `0.0.1` heraus, ohne dass `new-version` gelaufen ist.

---

## Aufgaben

- [x] **1. changesets** — `@changesets/cli` als devDependency, `.changeset/config.json`.
      Prüfen, ob `privatePackages: { version: true, tag: false }` nötig ist (Paket ist
      `private: true`). `changeset publish` kommt nirgends vor, nur `version`.

- [x] **2. `scripts/version.ts` + `scripts/version.test.ts`** — die Urteile, rein:
      `nextVersion`, `guardVerdict`, `changelogLines`, `pendingLevels`, `effectiveLevel`,
      `changesetBody`, `changesetFilename`, `releaseNotesSection`.
      `tsconfig.json` → `"include": ["src", "scripts/version.ts"]`.

- [ ] **3. `scripts/new-version.ts`** — Wirkung: Wächter, Frage patch/minor/major,
      Changeset aus `git log <tag>..HEAD` im `$EDITOR`, `bunx changeset version`,
      Commit `chore: release <v>`, letzte Rückfrage, Push. `package.json` → `new-version`.

- [ ] **4. `scripts/release-notes.ts`** — Changelog-Abschnitt + Installationsanleitung +
      Node-/JRE-Version aus `.signum-node-version` und `scripts/jre.pinned`.
      Fallback, wenn es keinen Abschnitt gibt (Fall `0.0.1`).

- [ ] **5. `scripts/e2e-install.sh`** — eine Datei, zwei Modi: `<zip>` installiert das
      gebaute Zip im `debian:stable-slim` (CI-Tor), `--released` führt den echten
      Einzeiler aus (Handprüfung). Behauptungen wie in `launcher.test.sh`.
      Lokal gegen ein selbst gebautes Zip verifizieren, bevor CI es anfasst.

- [ ] **6. `.github/workflows/ci.yml`** — PRs nach `develop`/`main`: install, test,
      test:launcher, build. Kein bootstrap.

- [ ] **7. `.github/workflows/release.yml`** — Push auf `develop`. Immer: install, test,
      test:launcher, build, Tor. Wenn kein Tag: bootstrap, package, e2e, `main`
      fast-forward, `gh release create`. `main`-Push **vor** dem Release.

- [ ] **8. `develop` anlegen**, README (Zweigmodell, `new-version`, e2e), erster Lauf
      veröffentlicht `0.0.1`, danach `--released` von Hand.

## Nicht dabei
Hotfix-Pfad auf `main` (ein Patch-Release aus `develop` genügt), `npx`, Paketmanager,
Windows, Signieren, CI-Caches.
