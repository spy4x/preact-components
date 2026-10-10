/**
 * The screen boundary as ready tests: an app names its repository root, the folders of pure
 * screens and its own aliases, and {@link registerBoundaryTests} registers the tests that hold
 * every module there to the rule in `./boundary.ts`.
 *
 * The runner imports no test framework. The app passes its own `test` function (`Deno.test`, or
 * `it` from `@std/testing/bdd`), and a failure is a thrown `Error` that lists every finding. Like
 * `checkModule`, it works only under `deno test`.
 *
 * @module
 */

import {
  DEFAULT_SKIPPED_DIRECTORIES,
  guardFiles,
  type GuardFileSystem,
  guardRoot,
  type GuardTest,
} from "@spy4x/preact-theme/spacing-runner"
import { denoFileSystem } from "@spy4x/platform/server/deno-fs"
import { type BoundaryOptions, checkModule } from "./boundary.ts"

/** The file extensions the boundary guard reads by default: modules only. */
export const DEFAULT_BOUNDARY_EXTENSIONS: readonly string[] = [".ts", ".tsx"]

/** What {@link registerBoundaryTests} needs: where the screens are, and what they must not use. */
export interface BoundaryRunnerOptions {
  /** The app's test function, such as `Deno.test`. */
  test: GuardTest
  /** The repository root, as a path or a `file:` URL such as `new URL("../", import.meta.url)`. */
  root: string | URL
  /** Folders of pure screens, relative to `root`, such as `"libs/ui"`. */
  directories: readonly string[]
  /** What a screen must not import or read; the app adds its aliases and app directories here. */
  boundary?: BoundaryOptions
  /** File extensions to read. Defaults to {@link DEFAULT_BOUNDARY_EXTENSIONS}. */
  extensions?: readonly string[]
  /**
   * Directory names to leave out wherever they appear below a walked directory. Defaults to
   * `DEFAULT_SKIPPED_DIRECTORIES` from `@spy4x/preact-theme/spacing-runner`.
   */
  skipDirectories?: readonly string[]
  /** Files the walk must find, relative to `root`, such as `"libs/ui/auth-screen.tsx"`. */
  requiredFiles?: readonly string[]
  /**
   * Import specifiers the rule must refuse for a module in the first of `directories`, beyond one
   * per entry of `boundary.appAliases`, which is always tried. A relative import into an app, such
   * as `"../../apps/spa/src/state/auth.ts"`, proves `boundary.appDirectories` is set right.
   */
  refusedImports?: readonly string[]
  /**
   * Import specifiers the rule must allow for a module in the first of `directories`, such as a
   * sibling screen module. It proves the lists do not refuse everything.
   */
  allowedImports?: readonly string[]
  /** File access. Defaults to Deno's file system. */
  fs?: GuardFileSystem
}

/**
 * Register the boundary tests for an app's folders of pure screens.
 *
 * The first test reads every module in `options.directories` and rejects with every violation, one
 * `file: message` per line. It rejects too when a directory is missing or holds no module.
 *
 * The second test checks the app's own configuration: an import through each of
 * `boundary.appAliases` and each of `refusedImports` must be refused, and each of `allowedImports`
 * must pass. It is registered only when there is at least one such import to try.
 *
 * @example
 * ```ts
 * import { registerBoundaryTests } from "@spy4x/preact-system/boundary-runner"
 *
 * registerBoundaryTests({
 *   test: Deno.test,
 *   root: new URL("../", import.meta.url),
 *   directories: ["libs/ui"],
 *   boundary: { appAliases: ["@api/", "@spa/"], appDirectories: ["apps"] },
 *   requiredFiles: ["libs/ui/auth-screen.tsx"],
 *   refusedImports: ["../../apps/spa/src/state/auth.ts"],
 *   allowedImports: ["./progressive.tsx"],
 * })
 * ```
 */
export function registerBoundaryTests(options: BoundaryRunnerOptions): void {
  const fs = options.fs ?? denoFileSystem
  const root = guardRoot(options.root)
  const boundary = options.boundary ?? {}
  const where = options.directories.join(", ")

  options.test(
    `no module in ${where} imports a store, router or app code or touches fetch or a page global`,
    async () => {
      const files = await guardFiles({
        root,
        directories: options.directories,
        extensions: options.extensions ?? DEFAULT_BOUNDARY_EXTENSIONS,
        skipDirectories: options.skipDirectories ?? DEFAULT_SKIPPED_DIRECTORIES,
        requiredFiles: options.requiredFiles,
        fs,
      })
      const found: string[] = []
      for (const file of files) {
        const filename = `${root}/${file}`
        const source = await fs.readText(filename)
        if (source === null) throw new Error(`The guard could not read ${file} in ${root}.`)
        for (const violation of checkModule(source, { ...boundary, filename })) {
          found.push(`${file}: ${violation.message}`)
        }
      }
      if (found.length > 0) {
        throw new Error(`The boundary is broken in ${found.length} place(s):\n${found.join("\n")}`)
      }
    },
  )

  const refused = [
    ...(boundary.appAliases ?? []).map((alias) => `${alias}x.ts`),
    ...(options.refusedImports ?? []),
  ]
  const allowed = options.allowedImports ?? []
  if (refused.length + allowed.length === 0) return

  options.test(`the boundary refuses app imports from ${where} and allows the listed ones`, () => {
    const filename = `${root}/${options.directories[0]}/screen.tsx`
    const violations = (specifier: string) =>
      checkModule(`import { x } from "${specifier}"\nexport const y = x`, { ...boundary, filename })
    const wrong = [
      ...refused.filter((specifier) => violations(specifier).length === 0)
        .map((specifier) => `"${specifier}" should be refused, and is allowed`),
      ...allowed.flatMap((specifier) =>
        violations(specifier).map((v) => `"${specifier}" should be allowed: ${v.message}`)
      ),
    ]
    if (wrong.length > 0) throw new Error(wrong.join("\n"))
  })
}
