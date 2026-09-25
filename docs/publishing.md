# Publishing

Every package in this repository is published to JSR at the same version, every time, together.
The owner decided this on 2026-09-25
([issue #230](https://github.com/spy4x/preact-components/issues/230), option A).

## Why one version for every package

`deno publish` writes a sibling import as a caret range: `system` imports `@spy4x/preact-cn`,
and the published `system` asks for `jsr:@spy4x/preact-cn@^0.1.0`. A caret below 1.0 accepts
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

4. Tag that commit `v<version>` and push the tag. Woodpecker's tag build (`.woodpecker.yml`) runs
   `check` and `publish:dry` again; its `publish` step then refuses a tag that is not `v` plus the
   version every package declares (`infra/scripts/release-tag.ts`), and runs `deno publish` with
   the `JSR_TOKEN` secret, which publishes every named workspace member at once:

   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

If a step before the tag fails, fix the cause in a pull request and start again from
step 2; the version is not taken until it is published. Never publish a
subset of the packages: a package published alone at a new version breaks the rule above.

## One-time setup

The `publish` step needs three things that live outside this repository, all set up once by the
owner:

- the ten packages, created on jsr.io in the `spy4x` scope before the first tag — `deno publish`
  with a token does not create a package, it refuses the whole run and names the missing ones:
  `preact-cn`, `preact-icons`, `preact-signals`, `preact-theme`, `preact-charts`,
  `preact-system`, `preact-ui`, `preact-crud`, `preact-map` and `preact-ui-guide`, each at
  `https://jsr.io/new?scope=spy4x&package=<name>`;
- a JSR token that may publish to the `spy4x` scope (the one `spy4x/ts-libs` publishes with will
  do);
- a `JSR_TOKEN` secret holding it on this repository in Woodpecker (repository id 9), allowed for
  the `tag` event only, so no push or pull-request build can read it.

A new package added later is created on jsr.io the same way before the tag that first publishes it.

## When a tag build fails

- **Before any step runs** (`secret "jsr_token" not found`, or `secret "jsr_token" is not allowed
  to be used with pipeline event "tag"`): the secret is missing or not allowed for tags. Add it or
  allow it, then restart the pipeline.
- **The tag has the wrong name** (`release-tag.ts` refuses it): nothing was published. Delete it
  (`git push origin :refs/tags/<tag>`, `git tag -d <tag>`) and push the right one.
- **In `check` or `publish-dry`**, or when `release-tag.ts` refuses the tag: nothing was
  published. Fix the cause in a pull request, then move the tag to the merge commit
  (`git tag -f v<version> <commit>`, `git push -f origin v<version>`).
- **`deno publish` names packages that do not exist:** nothing was published. Create them on
  jsr.io, then restart the pipeline.
- **`deno publish` fails part-way:** the packages published before the failure are on JSR for good.
  A temporary failure (network, registry) is fixed by restarting the pipeline, and JSR skips what it
  already has. A failure in a package's own files is fixed in a pull request, and the tag moves to
  the fix as above; the published packages are skipped and the rest go out at the same version. The
  fix must not change a package that already published, or the same version would mean two things;
  when it has to, bump every package to the next version and release that instead.
