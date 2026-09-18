/**
 * Permission gate for the compile suite.
 *
 * `integration/` compiles the shipped CSS with the real Tailwind compiler,
 * which reads the preset, `HOME` and the Deno npm cache. The workspace
 * `deno task check` runs bare `deno test`, which grants neither, so the suite
 * reports itself as skipped there rather than failing a build that has nothing
 * wrong with it. Run it from this package's directory for the real thing:
 *
 *   deno task --cwd theme test
 */

/** Why the compile suite is skipped when it has no grants. */
export const SKIP_REASON =
  "compile suite needs read + env; run `deno task --cwd theme test` instead of bare `deno test`"

/**
 * Report whether this process can read files and environment variables.
 *
 * Queried rather than assumed: the same suite runs under `deno task check`
 * (no grants) and under this package's `test` task (`-A`).
 *
 * @returns `true` when both grants are present.
 */
export async function canCompile(): Promise<boolean> {
  const read = await Deno.permissions.query({ name: "read" })
  const env = await Deno.permissions.query({ name: "env" })
  return read.state === "granted" && env.state === "granted"
}
