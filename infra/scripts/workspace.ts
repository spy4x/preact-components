/**
 * The one reader of this repository's Deno configs and package exports. Every script and check
 * that needs a package list, a `deno.json` field or a package's exports reads them here, so two
 * copies cannot disagree about comments in a config or about which targets count.
 *
 * @module
 */

import { parse } from "@std/jsonc"

/** The repository root: the parent of every package directory. */
export const ROOT = new URL("../../", import.meta.url)

/** The fields of a `deno.json` or `deno.jsonc` these scripts read. */
export interface DenoConfig {
  name?: string
  version?: string
  /** A string is Deno's short form for the barrel alone. */
  exports?: string | Record<string, unknown>
  workspace?: string[]
  publish?: { exclude?: string[] }
}

/** One entry point a package publishes: `"."` for the barrel, `"./avatar"` for a subpath. */
export interface EntryPoint {
  subpath: string
  /** The module's file URL. */
  href: string
}

/**
 * Reads a Deno config. Configs here carry comments and trailing commas, so this parses JSONC.
 *
 * @param url The config file.
 * @throws When the file is missing or is not a JSON object.
 */
export async function readConfig(url: URL): Promise<DenoConfig> {
  const config = parse(await Deno.readTextFile(url))
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error(`${url.href} is not a JSON object`)
  }
  return config as DenoConfig
}

/** A package directory's own config, `deno.json`, or `deno.jsonc` when that is the one present. */
export async function packageConfigUrl(directory: string, root: URL = ROOT): Promise<URL | null> {
  for (const file of ["deno.json", "deno.jsonc"]) {
    const url = new URL(`${directory}/${file}`, root)
    try {
      if ((await Deno.stat(url)).isFile) return url
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
  }
  return null
}

/**
 * A package directory's config URL.
 *
 * @throws When the directory has neither `deno.json` nor `deno.jsonc`.
 */
export async function memberConfig(directory: string, root: URL = ROOT): Promise<URL> {
  const url = await packageConfigUrl(directory, root)
  if (!url) throw new Error(`${directory}/ has no deno.json`)
  return url
}

/** Top-level directories that carry a package config, read from the tree, sorted. */
export async function packageDirectories(root: URL = ROOT): Promise<string[]> {
  const directories: string[] = []
  for await (const entry of Deno.readDir(root)) {
    if (entry.isDirectory && await packageConfigUrl(entry.name, root)) {
      directories.push(entry.name)
    }
  }
  return directories.sort()
}

/**
 * The workspace members named in the root `deno.jsonc`, as directory names in their listed order.
 *
 * @param root The repository root; a test passes a fixture tree.
 * @throws When a top-level directory carries a package config and is not a member, or a member has
 *   no package config. Deno skips both with at most a warning, so a check that walks the members
 *   would skip such a package silently.
 */
export async function workspaceMembers(root: URL = ROOT): Promise<string[]> {
  const config = await readConfig(new URL("deno.jsonc", root))
  const members = (config.workspace ?? []).map((member) => member.replace(/^\.\/|\/$/g, ""))
  const problems = memberProblems(members, await packageDirectories(root))
  if (problems.length > 0) throw new Error(problems.join("\n"))
  return members
}

/**
 * Where the workspace list and the package directories disagree, one sentence per problem.
 *
 * @param members The directories `deno.jsonc` lists in `workspace`.
 * @param directories The top-level directories that carry a package config.
 */
export function memberProblems(members: string[], directories: string[]): string[] {
  return [
    ...directories.filter((directory) => !members.includes(directory)).map((directory) =>
      `${directory}/ carries a deno.json and is not in the workspace in deno.jsonc: add it ` +
      `there, or remove its deno.json`
    ),
    ...members.filter((member) => !directories.includes(member)).map((member) =>
      `deno.jsonc lists ${member} in the workspace, and ${member}/ has no deno.json`
    ),
  ]
}

/**
 * Every entry point a package config publishes, the barrel first when it has one.
 *
 * @param config URL of the package's config; each target resolves against it.
 * @throws When a target is not a string or not a TypeScript module: a consumer can reach every
 *   subpath, so one this reader cannot import must fail loudly rather than be skipped.
 */
export async function entryPoints(config: URL): Promise<EntryPoint[]> {
  const { exports } = await readConfig(config)
  if (exports === undefined) throw new Error(`${config.href} declares no exports`)
  const map: Record<string, unknown> = typeof exports === "string" ? { ".": exports } : exports
  const points: EntryPoint[] = []
  for (const [subpath, target] of Object.entries(map)) {
    if (typeof target !== "string") {
      throw new Error(`${config.href} declares ${subpath} with a non-string target`)
    }
    if (!/\.tsx?$/.test(target)) {
      throw new Error(`${config.href} declares ${subpath} with ${target}, not a TypeScript module`)
    }
    points.push({ subpath, href: new URL(target, config).href })
  }
  return points.sort((a, b) => Number(b.subpath === ".") - Number(a.subpath === "."))
}

/**
 * Every value export of a package config's entry points, module by module, by importing each one.
 *
 * @param config URL of the package's config.
 */
export async function readEntryPoints(
  config: URL,
): Promise<Array<EntryPoint & { namespace: Record<string, unknown> }>> {
  const read = []
  for (const point of await entryPoints(config)) {
    read.push({ ...point, namespace: await import(point.href) as Record<string, unknown> })
  }
  return read
}
