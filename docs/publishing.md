# Publishing

Every package in this repository is published to JSR at the same version, every time, together.
The owner decided this on 2026-09-25
([issue #230](https://github.com/spy4x/preact-components/issues/230), option A).

## Why one version for every package

`deno publish` writes a sibling import as a caret range: `system` imports `@preact-components/cn`,
and the published `system` asks for `jsr:@preact-components/cn@^0.1.0`. A caret below 1.0 accepts
every later `0.1.x`. If the packages were published at different versions, a consumer's lockfile
could combine a `ui` with a `cn` that nobody tested together.

Publishing every package at one version, every time, removes that gap: `^0.1.N` always resolves to
the set published with it. The rule is a publishing discipline, not something a check enforces, so
the steps below are the whole mechanism.

A JSR version cannot be changed or deleted after it is published. Anything wrong in a published
file stays wrong in that version for good.

## Steps

1. In one pull request, bump `"version"` to the same new version in every package's `deno.json`
   — `charts`, `cn`, `crud`, `icons`, `map`, `signals`, `system`, `theme`, `ui` and `ui-guide` —
   and merge it. `pages/` has no `name` and is never published. This command lists the versions
   the packages declare, and must print exactly one line:

   ```bash
   grep -h '"version"' */deno.json | sort -u
   ```

2. Check out that merge on `main`, clean, and run the rest from the repository root.
   `publish:dry` refuses a tree with uncommitted changes. Both checks must exit 0:

   ```bash
   deno task check
   deno task publish:dry
   ```

3. Search the published files for private application names, with the names file kept outside
   this repository — [`pre-publish-checks.md`](./pre-publish-checks.md) says how. The script
   narrows the candidates; it does not decide. Read every match it prints: fix each one that names
   a private application, and publish only when every match left is a word that merely shares a
   name, such as `GB` as a file-size unit in `ui/file-input.tsx`:

   ```bash
   deno task private-names /path/to/names.txt
   ```

4. Publish every package at once. From the root, `deno publish` publishes every named workspace
   member:

   ```bash
   deno publish
   ```

5. Tag the published commit `v<version>` and push the tag.

If a step before `deno publish` fails, fix the cause in a pull request and start again from
step 2; the version is not taken until it is published. Never publish a
subset of the packages: a package published alone at a new version breaks the rule above.
