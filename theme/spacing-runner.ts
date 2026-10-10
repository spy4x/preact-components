/**
 * The spacing guard as a ready test: an app names its repository root and the directories that
 * hold its sources, and {@link registerSpacingTests} registers a test that reads every source file
 * there and fails on a spacing class off the scale `./spacing.ts` owns.
 *
 * The runner imports no test framework. The app passes its own `test` function (`Deno.test`, or
 * `it` from `@std/testing/bdd`), and a failure is a thrown `Error` that lists every finding.
 *
 * {@link guardFiles} is the walk on its own. It throws when a directory is missing or holds no
 * file to check, because a guard that walks nothing passes for ever. The boundary runner in
 * `@spy4x/preact-system/boundary-runner` uses the same walk.
 *
 * @module
 */

import { fromFileUrl } from "@std/path"
import { denoFileSystem } from "@spy4x/platform/server/deno-fs"
import type { FileSystemPort } from "@spy4x/platform/server/ports"
import { findOffScaleSpacing } from "./spacing.ts"

/**
 * Directory names a guard does not descend into by default: installed packages, build output and
 * caches, which hold compiled classes and bundled code rather than source.
 */
export const DEFAULT_SKIPPED_DIRECTORIES: readonly string[] = [
  "node_modules",
  "dist",
  "build",
  ".vite",
  "_fresh",
]

/** The file extensions the spacing guard reads by default. */
export const DEFAULT_SPACING_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".css", ".html"]

/**
 * The file access a guard needs: the three reading methods of `FileSystemPort` from
 * `@spy4x/platform/server/ports`. A test passes an in-memory one.
 */
export interface GuardFileSystem extends Pick<FileSystemPort, "exists" | "readDir" | "readText"> {}

/**
 * The function a runner registers its tests with: `Deno.test`, or `it` from `@std/testing/bdd`.
 * The registered function throws or rejects when the guard fails.
 */
export interface GuardTest {
  (name: string, run: () => void | Promise<void>): unknown
}

/** Where a guard looks for files, and which ones it reads. */
export interface GuardWalkOptions {
  /** The repository root, as a path or a `file:` URL such as `new URL("../", import.meta.url)`. */
  root: string | URL
  /** Directories to walk, relative to `root`, such as `"apps"` or `"libs/ui"`. */
  directories: readonly string[]
  /** File extensions to read, each with its dot. */
  extensions: readonly string[]
  /**
   * Directory names to leave out wherever they appear below a walked directory. Defaults to
   * {@link DEFAULT_SKIPPED_DIRECTORIES}. A directory above `root` with one of these names does not
   * count: a checkout under a folder named `build` is still walked.
   */
  skipDirectories?: readonly string[]
  /**
   * Files the walk must find, relative to `root` with `/` separators, such as
   * `"apps/spa/src/app.tsx"`. The walk throws when one is missing, so a renamed folder or a wrong
   * skip list cannot quietly drop the files that matter most.
   */
  requiredFiles?: readonly string[]
  /** File access. Defaults to Deno's file system. */
  fs?: GuardFileSystem
}

/** What {@link registerSpacingTests} needs: the walk, and the function that registers a test. */
export interface SpacingRunnerOptions extends Omit<GuardWalkOptions, "extensions"> {
  /** The app's test function, such as `Deno.test`. */
  test: GuardTest
  /** File extensions to read. Defaults to {@link DEFAULT_SPACING_EXTENSIONS}. */
  extensions?: readonly string[]
}

/** Test files spell out classes and forbidden imports to assert on, so no guard reads them. */
const TEST_FILE = /\.test\.tsx?$/

/**
 * The root as a path without a trailing separator, so `${guardRoot(root)}/${file}` is a file's
 * absolute path.
 *
 * @param root A path, or a `file:` URL.
 */
export function guardRoot(root: string | URL): string {
  const path = root instanceof URL ? fromFileUrl(root) : root
  return path.replace(/[\\/]+$/, "")
}

/**
 * Every file a guard should read: the files under each of `options.directories` with one of
 * `options.extensions`, test files and skipped directories left out, as sorted paths relative to
 * the root with `/` separators.
 *
 * @throws When a directory does not exist or holds no file to check, or when one of
 *   `options.requiredFiles` was not found.
 */
export async function guardFiles(options: GuardWalkOptions): Promise<string[]> {
  const fs = options.fs ?? denoFileSystem
  const root = guardRoot(options.root)
  const skipped = options.skipDirectories ?? DEFAULT_SKIPPED_DIRECTORIES
  const wanted = (name: string) =>
    !TEST_FILE.test(name) && options.extensions.some((extension) => name.endsWith(extension))

  /** Every wanted file under `directory`, a path relative to the root. */
  async function walk(directory: string): Promise<string[]> {
    const files: string[] = []
    for (const entry of await fs.readDir(`${root}/${directory}`)) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory && !skipped.includes(entry.name)) files.push(...await walk(path))
      else if (entry.isFile && wanted(entry.name)) files.push(path)
    }
    return files
  }

  const files: string[] = []
  for (const listed of options.directories) {
    const directory = listed.replace(/^\.?[\\/]+|[\\/]+$/g, "")
    if (!await fs.exists(`${root}/${directory}`)) {
      throw new Error(`The guard was told to walk "${directory}", which does not exist in ${root}.`)
    }
    const found = await walk(directory)
    if (found.length === 0) {
      throw new Error(
        `The guard was told to walk "${directory}" in ${root}, which holds no ` +
          `${options.extensions.join(", ")} file to check.`,
      )
    }
    files.push(...found)
  }
  const missing = (options.requiredFiles ?? []).filter((file) => !files.includes(file))
  if (missing.length > 0) {
    throw new Error(`The guard did not find ${missing.join(", ")} in ${root}.`)
  }
  return files.sort()
}

/**
 * Register one test that holds every spacing class in the app's sources to the scale: padding,
 * margin, gap, `space-x/y` and scroll spacing use only the steps in `SPACING_STEPS`, never an
 * arbitrary value. The test rejects with every finding, one `file:line:column class — reason` per
 * line, and rejects too when a directory is missing or holds no file to check.
 *
 * @example
 * ```ts
 * import { registerSpacingTests } from "@spy4x/preact-theme/spacing-runner"
 *
 * registerSpacingTests({
 *   test: Deno.test,
 *   root: new URL("../", import.meta.url),
 *   directories: ["apps", "libs"],
 *   requiredFiles: ["apps/spa/src/app.tsx"],
 * })
 * ```
 */
export function registerSpacingTests(options: SpacingRunnerOptions): void {
  const fs = options.fs ?? denoFileSystem
  const root = guardRoot(options.root)
  const extensions = options.extensions ?? DEFAULT_SPACING_EXTENSIONS
  const where = options.directories.join(", ")
  options.test(`every spacing class in ${where} is on the scale`, async () => {
    const found: string[] = []
    for (const file of await guardFiles({ ...options, extensions, fs })) {
      const source = await fs.readText(`${root}/${file}`)
      if (source === null) throw new Error(`The guard could not read ${file} in ${root}.`)
      for (const v of findOffScaleSpacing(source)) {
        found.push(`${file}:${v.line}:${v.column} ${v.className} — ${v.reason}`)
      }
    }
    if (found.length > 0) {
      throw new Error(`Spacing off the scale in ${found.length} place(s):\n${found.join("\n")}`)
    }
  })
}
