/**
 * Refuses a release tag that does not match the packages' versions.
 *
 * Woodpecker runs this before `deno publish` on a `v*` tag. `deno publish` skips a version JSR
 * already has and exits 0, so without this guard a tag pushed without the version bump goes green
 * and publishes nothing, and a bump that missed one package publishes the other nine and silently
 * skips it — which breaks the one-version rule in `docs/publishing.md`.
 *
 * ```bash
 * CI_COMMIT_TAG=v0.1.0 deno run --allow-read --allow-env=CI_COMMIT_TAG infra/scripts/release-tag.ts
 * ```
 *
 * @module
 */
import { fromFileUrl, join } from "@std/path"
import { PUBLISHED_PACKAGES } from "./private-names.ts"

const ROOT = fromFileUrl(new URL("../../", import.meta.url))

/** Reads the `version` field of a package config; some configs carry comments, so no JSON.parse. */
export function readVersion(configText: string): string | undefined {
  return configText.match(/^\s*"version"\s*:\s*"([^"]+)"/m)?.[1]
}

/**
 * Compares a tag with every package's version.
 *
 * @param tag The pushed tag, e.g. `v0.1.0`; empty or missing when the build is not a tag build.
 * @param versions Each published package's declared version, keyed by directory.
 * @returns Every problem found, one sentence each; empty when the tag is `v` + the one version.
 */
export function checkReleaseTag(
  tag: string | undefined,
  versions: Record<string, string | undefined>,
): string[] {
  const problems: string[] = []
  if (!tag) return [`No tag: this guard runs only on a tag build (CI_COMMIT_TAG is empty).`]
  for (const [pkg, version] of Object.entries(versions)) {
    if (!version) problems.push(`${pkg} declares no version.`)
    else if (`v${version}` !== tag) {
      problems.push(`${pkg} is at ${version}, but the tag is ${tag}.`)
    }
  }
  if (Object.keys(versions).length === 0) problems.push(`No published package was found.`)
  return problems
}

if (import.meta.main) {
  const versions: Record<string, string | undefined> = {}
  for (const pkg of PUBLISHED_PACKAGES) {
    versions[pkg] = readVersion(Deno.readTextFileSync(join(ROOT, pkg, "deno.json")))
  }
  const problems = checkReleaseTag(Deno.env.get("CI_COMMIT_TAG"), versions)
  if (problems.length > 0) {
    console.error(`Release tag refused:\n${problems.map((p) => `  ${p}`).join("\n")}`)
    Deno.exit(1)
  }
  console.log(`Release tag matches all ${PUBLISHED_PACKAGES.length} packages.`)
}
