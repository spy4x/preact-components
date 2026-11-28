/**
 * Sets one new version in every published package's `deno.json`, the first step of a release
 * (`docs/publishing.md`). The background lead runs it from `.ringmaster/release.json`.
 *
 * ```bash
 * deno task release:bump 16.7.0
 * ```
 *
 * @module
 */
import { greaterThan, parse } from "@std/semver"
import { PUBLISHED_PACKAGES } from "./private-names.ts"
import { checkReleaseTag } from "./release-tag.ts"
import { memberConfig, readConfig } from "./workspace.ts"

/** A plain `X.Y.Z` version: no prefix, pre-release or build part, no leading zeros. */
const PLAIN_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
/** A config's `"version"` line, its value captured. */
const VERSION_LINE = /^(\s*"version"\s*:\s*")([^"]*)(")/gm

/** Throws unless `version` is a plain `X.Y.Z`. */
function assertPlainVersion(version: string): void {
  if (!PLAIN_VERSION.test(version)) {
    throw new Error(`"${version}" is not a plain X.Y.Z version, e.g. 16.7.0`)
  }
}

/**
 * Rewrites the one `"version"` line of a config's text, leaving every other byte as it was.
 *
 * @param text The config file's text.
 * @param version The new version, a plain `X.Y.Z`.
 * @returns The new text.
 * @throws When the version is not a plain `X.Y.Z`, the text has no `"version"` line or more than
 *   one, or the new version is not greater than the current one.
 */
export function setVersion(text: string, version: string): string {
  assertPlainVersion(version)
  const lines = [...text.matchAll(VERSION_LINE)]
  if (lines.length !== 1) {
    throw new Error(`expected one "version" line, found ${lines.length}`)
  }
  const current = lines[0][2]
  if (!greaterThan(parse(version), parse(current))) {
    throw new Error(`${version} is not greater than the current version ${current}`)
  }
  return text.replace(VERSION_LINE, (_, start, _old, end) => `${start}${version}${end}`)
}

/**
 * The new text of every published package's config for a version, without writing anything.
 *
 * @param version The new version, a plain `X.Y.Z`.
 * @returns Each config URL with its new text, one per package in `PUBLISHED_PACKAGES`.
 * @throws When a config refuses the version (see {@link setVersion}), naming its file.
 */
export async function plannedBumps(version: string): Promise<Map<URL, string>> {
  assertPlainVersion(version)
  const planned = new Map<URL, string>()
  for (const pkg of PUBLISHED_PACKAGES) {
    const url = await memberConfig(pkg)
    try {
      planned.set(url, setVersion(await Deno.readTextFile(url), version))
    } catch (error) {
      throw new Error(`${pkg}/: ${(error as Error).message}`)
    }
  }
  return planned
}

if (import.meta.main) {
  if (Deno.args.length !== 1) {
    console.error(`Usage: deno task release:bump <X.Y.Z>`)
    Deno.exit(1)
  }
  const version = Deno.args[0]
  let planned: Map<URL, string>
  try {
    planned = await plannedBumps(version)
  } catch (error) {
    console.error(`Version bump refused: ${(error as Error).message}`)
    Deno.exit(1)
  }
  for (const [url, text] of planned) await Deno.writeTextFile(url, text)
  const versions: Record<string, string | undefined> = {}
  for (const pkg of PUBLISHED_PACKAGES) {
    versions[pkg] = (await readConfig(await memberConfig(pkg))).version
  }
  const problems = checkReleaseTag(`v${version}`, versions)
  if (problems.length > 0) {
    console.error(`Version bump incomplete:\n${problems.map((p) => `  ${p}`).join("\n")}`)
    Deno.exit(1)
  }
  console.log(`Set ${version} in all ${PUBLISHED_PACKAGES.length} packages.`)
}
