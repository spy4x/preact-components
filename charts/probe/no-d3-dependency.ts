/**
 * Prove the SVG half of `charts/` reaches no `d3` specifier, with `d3` made unresolvable.
 *
 * This repo has no bundler and no bundle-size tool, so a byte figure cannot be reproduced here; what
 * *can* be reproduced is the stronger, structural claim the issue asks for — that a consumer of only
 * the SVG charts has no d3 in their dependency graph. Byte counts in the PR body are the issue's,
 * measured outside this repo, and are cited as such rather than re-derived.
 *
 * The probe runs each entry point under a scratch import map that remaps the `d3` specifier to a file
 * that does not exist, so anything that reaches `d3` fails to resolve instead of quietly passing:
 *
 * 1. `deno check` + `deno test` over the zero-dependency modules and their suites — must pass.
 * 2. The d3 islands (`d3-line-chart.tsx`, `compare-chart.tsx`, `+index.ts`) and their suites — must
 *    fail, which is the control that shows the probe is not vacuously green.
 * 3. The d3 path under a map with no `d3` entry at all — must fail with Deno's actionable message.
 *
 * The scratch map is built from this repo's own root import map, so preact, the stdlib pins and the
 * renderer resolve to the versions the rest of the repo uses and no version is restated here. `d3`,
 * which the root map no longer carries, is not the only specifier the probe adds: the JSR and npm
 * specifiers the root map holds plus the one subpath it does not (`@std/testing/bdd`) are listed in
 * `HARNESS_IMPORTS`.
 *
 * The difference from a normal run is confined to the scratch directory: `charts/deno.json`, which
 * declares the real `d3` and the workspace member that would publish it, is not copied, so nothing
 * under `scratch/charts` is a workspace member of anything. The check runs with `--config` pointed
 * at the real root `deno.jsonc` — not a rebuilt one — so the JSX/`lib` `compilerOptions` never drift
 * from the repo's own settings.
 *
 * **What actually keeps this read-only is `--frozen`, not just where `--config` points.** Deno finds
 * `deno.lock` next to any config at the repo root, real or not, but a config only satisfies `--frozen`
 * against that lock when every dependency it resolves — including the ones `--import-map` layers on
 * top — matches what the lock already recorded. `HARNESS_IMPORTS` restates a handful of the root
 * map's own pins by hand (see below), and the moment one of those copies drifts from the root's, the
 * merged map resolves a version the lock has never seen; without `--frozen` that would make Deno
 * write the difference into the repo's own `deno.lock`, silently, rather than fail the probe.
 * `--frozen` is on every `deno check`/`deno test` call the probe makes, so a drifted pin is a loud
 * failure instead, with `deno.lock` left byte-identical. The same real-config trick also sidesteps a
 * dependency published inside Deno's 24-hour minimum-dependency-age window
 * (spy4x/ts-libs#70's `@spy4x/platform` release, the first non-local dependency this package took
 * on): a config with no matching lock next to it makes every `jsr:`/`npm:` specifier a fresh
 * resolution, which such a version fails outright, while the real, already-resolved lock accepts it.
 * `--import-map` still layers the `d3` remap and the harness specifiers over the real map's
 * `imports`, exactly as before; with `--frozen`, nothing is ever written to the repo.
 *
 * Run it from anywhere in the worktree — `deno task --cwd charts probe:no-d3`, or
 * `deno run --allow-run --allow-read --allow-write --allow-env charts/probe/no-d3-dependency.ts`.
 * `--allow-read`/`--allow-write` cover the scratch tree the probe writes and removes; `--allow-env`
 * is forwarded to `deno test` so the suites behave as they do under the root `test` task.
 */

const WORKSPACE_ROOT = new URL("../../", import.meta.url)
const PROBE_DIR = new URL(".", import.meta.url)

/** Present in the root map only; it is the specifier this probe removes. */
const D3_SPECIFIER = "d3"

/** The remapped `d3` target. Never created — that is the point. */
const ABSENT_D3 = "/tmp/__preact_components_d3_is_absent__.js"

/**
 * Entry points that must resolve, type-check and test with `d3` absent. Every module the issue lists
 * as zero-dependency, reached through the subpath a consumer would import — plus the d3-free barrel
 * `+svg.ts`, which is the entry point that makes the split explicit at the import site.
 */
const ZERO_DEPENDENCY_MODULES = [
  "charts/bars.tsx",
  "charts/colors.ts",
  "charts/donut-chart.tsx",
  "charts/kpi.tsx",
  "charts/line-chart.tsx",
  "charts/metric-panel.tsx",
  "charts/payload.ts",
  "charts/scales.ts",
  "charts/time-series.ts",
  "charts/use-in-view.ts",
  "charts/+svg.ts",
]

/** Suites for the modules above. `d3-line-chart.test.tsx` is deliberately absent — see the control. */
const ZERO_DEPENDENCY_TESTS = [
  "charts/bars.test.tsx",
  "charts/donut-chart.test.tsx",
  "charts/kpi.test.tsx",
  "charts/line-chart.test.tsx",
  "charts/metric-panel.test.tsx",
  "charts/payload.test.ts",
  "charts/scales.test.ts",
  "charts/use-in-view.test.tsx",
]

/** Both d3 islands and the suites that cover them, used as the control that the probe can fail. */
const D3_MODULES = [
  "charts/d3-line-chart.tsx",
  "charts/compare-chart.tsx",
  "charts/+index.ts",
]
const D3_TESTS = ["charts/d3-line-chart.test.tsx", "charts/compare-chart.test.tsx"]

/** Specifiers the copied suites and modules need, without d3. */
const HARNESS_IMPORTS: Record<string, string> = {
  "@std/assert": "jsr:@std/assert@1.0.19",
  "@std/expect": "jsr:@std/expect@1.0.20",
  "@std/testing": "jsr:@std/testing@1.0.20",
  // The root map's `@std/testing` entry does not cover the subpath the suites import.
  "@std/testing/bdd": "jsr:@std/testing@1.0.20/bdd",
  "preact": "npm:preact@10.29.8",
  "preact/": "npm:/preact@10.29.8/",
  "preact-render-to-string": "npm:preact-render-to-string@6.7.0",
}

/**
 * The `imports` object of the root map, with `d3` pointed at a path that does not exist.
 *
 * The root map is not imported as JSON — it is JSONC with comments — so the object is sliced out
 * textually and parsed here rather than pulling in a JSONC parser the repo does not have. The slice
 * keeps the comments inside the object, so those are stripped first.
 */
export function importMapWithoutD3(rootConfig: string): Record<string, string> {
  const parsed = JSON.parse(objectLiteral(rootConfig, '"imports": {')) as Record<string, string>

  delete parsed[D3_SPECIFIER]

  return { ...parsed, ...HARNESS_IMPORTS, [D3_SPECIFIER]: ABSENT_D3 }
}

/**
 * The same map with no `d3` entry at all, which is the import map a consumer who never added the
 * dependency actually has. Used to capture the message they are given.
 */
export function bareImportMap(rootConfig: string): Record<string, string> {
  const parsed = JSON.parse(objectLiteral(rootConfig, '"imports": {')) as Record<string, string>

  delete parsed[D3_SPECIFIER]

  return { ...parsed, ...HARNESS_IMPORTS }
}

/**
 * Slice one top-level object out of a JSONC object body by brace depth, then drop its comment lines.
 *
 * Every comment in the root config is on a line of its own and no comment line holds a mapping, so a
 * line filter is enough — and a `//` inside a JSON string (an `npm:` URL, say) never sits on a line
 * that starts with one.
 */
function objectLiteral(config: string, key: string): string {
  const start = config.indexOf(key)
  if (start < 0) throw new Error(`root deno.jsonc has no \`${key}\``)

  const open = config.indexOf("{", start)
  let depth = 0
  let end = -1

  for (let index = open; index < config.length; index++) {
    if (config[index] === "{") depth++
    if (config[index] === "}") {
      depth--
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  if (end < 0) throw new Error(`unbalanced braces after \`${key}\` in the root deno.jsonc`)

  return config
    .slice(open, end + 1)
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
}

/** Run `deno` and capture everything, instead of letting a failure abort the probe. */
async function runDeno(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; output: string }> {
  const command = new Deno.Command(Deno.execPath(), {
    args,
    cwd: options.cwd ?? new URL(".", WORKSPACE_ROOT).pathname,
    env: { ...Deno.env.toObject(), ...options.env },
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  })

  const { code, stdout, stderr } = await command.output()
  return { code, output: `${new TextDecoder().decode(stdout)}${new TextDecoder().decode(stderr)}` }
}

/** Keep the tail of a failure readable in a CI log. */
function tail(text: string, lines = 8): string {
  return text.trim().split("\n").slice(-lines).join("\n")
}

/**
 * Copy `charts/` into the scratch directory, minus its `deno.json`.
 *
 * The copy is a consumer that has no d3 declared: the suites and the harness keep their relative
 * specifiers, the scratch config replaces the package's own, and the only `d3` on the map is the
 * absent one. `Deno.cp` does not exist in this Deno, and the stdlib copy module is a dependency this
 * probe must not add, so the tree is walked directly.
 */
async function copyCharts(source: string, target: string): Promise<void> {
  await Deno.mkdir(target, { recursive: true })

  for await (const entry of Deno.readDir(source)) {
    if (entry.name === "deno.json") continue

    const from = `${source}/${entry.name}`
    const to = `${target}/${entry.name}`
    if (entry.isDirectory) await copyCharts(from, to)
    else await Deno.copyFile(from, to)
  }
}

/** Report a line and, when `ok` is false, exit non-zero once the whole probe has run. */
const failures: string[] = []

function record(ok: boolean, line: string, detail = ""): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`)
  if (!ok) {
    failures.push(line)
    if (detail) console.log(`     ${tail(detail, 6).replaceAll("\n", "\n     ")}`)
  }
}

async function main(): Promise<void> {
  const scratch = await Deno.makeTempDir({ prefix: "charts-no-d3-" })

  try {
    const rootConfig = await Deno.readTextFile(new URL("deno.jsonc", WORKSPACE_ROOT))
    const importMapPath = `${scratch}/import-map.json`
    await Deno.writeTextFile(
      importMapPath,
      `${JSON.stringify({ imports: importMapWithoutD3(rootConfig) }, null, 2)}\n`,
    )

    // The real root config, not a rebuilt one — see the module doc for why: it carries the repo's
    // own `compilerOptions`, and, more importantly, has `deno.lock` sitting next to it, which is
    // what keeps a freshly-published dependency version out of the minimum-dependency-age gate.
    const configPath = new URL("deno.jsonc", WORKSPACE_ROOT).pathname

    // `PROBE_DIR` is `charts/probe/`; the tree to copy is its parent.
    const chartsRoot = new URL("../", PROBE_DIR).pathname.replace(/\/$/, "")
    await copyCharts(chartsRoot, `${scratch}/charts`)

    // `--frozen` is what makes "nothing is written to the repo" true: without it, a `HARNESS_IMPORTS`
    // pin that has drifted from the root map's own would make Deno resolve a version the checked-in
    // `deno.lock` has never seen and silently write it in, right next to the real config.
    const shared = [`--config=${configPath}`, `--import-map=${importMapPath}`, "--frozen"]
    const allowEnv = "--allow-env"
    const allowRead = ["--allow-read", "--allow-write"]

    console.log(`charts copied to ${scratch}/charts, d3 remapped to ${ABSENT_D3} (absent)\n`)

    // The modules the issue names, reached the way a consumer would import them. `deno check`
    // resolves each one's graph, so a d3 import anywhere behind these fails here.
    const check = await runDeno([
      "check",
      ...shared,
      ...ZERO_DEPENDENCY_MODULES,
    ], { cwd: scratch })
    record(
      check.code === 0,
      `deno check: ${ZERO_DEPENDENCY_MODULES.length} d3-free modules`,
      check.output,
    )

    const test = await runDeno(
      [
        "test",
        ...shared,
        allowEnv,
        ...allowRead,
        ZERO_DEPENDENCY_TESTS.map((file) => `charts/${file.slice("charts/".length)}`),
        "charts/probe/no-d3-path.test.ts",
      ].flat(),
      { cwd: scratch },
    )
    const d3FreeSteps = /ok \| (\d+) passed \(([\d]+) steps\) \| 0 failed/.exec(test.output)
    record(
      test.code === 0 && d3FreeSteps !== null,
      `deno test: d3-free suites + in-graph assertion${
        d3FreeSteps ? ` — ${d3FreeSteps[1]} passed (${d3FreeSteps[2]} steps)` : ""
      }`,
      test.output,
    )

    // 2. The control: the same invocation must fail for the modules that do import d3, otherwise the
    //    poisoned map is not doing anything and step 1 proves nothing.
    const d3Check = await runDeno([
      "check",
      ...shared,
      ...D3_MODULES,
    ], { cwd: scratch })
    record(
      d3Check.code !== 0 && d3Check.output.includes(ABSENT_D3),
      `control: d3 islands fail to type-check without d3 (${D3_MODULES.length} modules)`,
      d3Check.output,
    )

    const d3Test = await runDeno([
      "test",
      ...shared,
      allowEnv,
      ...allowRead,
      ...D3_TESTS,
    ], { cwd: scratch })
    record(
      d3Test.code !== 0 && d3Test.output.includes(ABSENT_D3),
      `control: d3 suites fail to resolve without d3 (${D3_TESTS.length} suites)`,
      d3Test.output,
    )

    // 3. The error a consumer who never added d3 actually gets, captured rather than described: the
    //    same map with no `d3` entry at all, which cannot be satisfied by any package that happens to
    //    be installed under that name.
    const bareMapPath = `${scratch}/import-map-no-entry.json`
    await Deno.writeTextFile(
      bareMapPath,
      `${JSON.stringify({ imports: bareImportMap(rootConfig) }, null, 2)}\n`,
    )

    const missing = await runDeno([
      "check",
      `--config=${configPath}`,
      `--import-map=${bareMapPath}`,
      "--frozen",
      "charts/d3-line-chart.tsx",
    ], { cwd: scratch })
    record(
      missing.code !== 0 &&
        missing.output.includes(`Import "${D3_SPECIFIER}" not a dependency`) &&
        missing.output.includes("deno add npm:d3"),
      "the d3 path fails with Deno's own actionable message, naming the file and the fix",
      missing.output,
    )
    console.log(`\nwhat a d3-less consumer is told:\n${tail(missing.output, 4)}`)
  } finally {
    await Deno.remove(scratch, { recursive: true })
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} probe assertion(s) failed`)
    Deno.exit(1)
  }

  console.log("\nno d3 in the SVG path: probed clean, with the islands as the failing control")
}

if (import.meta.main) await main()
