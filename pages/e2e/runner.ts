/**
 * Runs the Playwright specs under `pages/e2e/` as the `e2e` block of `verify`'s browser phase.
 *
 * Playwright attaches to the Chromium `verify.ts` already launched instead of starting its own, so
 * there is one browser discovery, one set of launch flags and one teardown: `verify` kills the
 * browser on a failure, a deadline and a signal, and every page a spec opened dies with it. Each
 * spec gets a fresh browser context on the page it names, already hydrated, and records exactly one
 * check through the same `check` the DevTools blocks use.
 *
 * @module
 */
import { chromium, type Page } from "playwright-core"
import { type GuidePageId } from "@spy4x/preact-ui-guide/registry"
import { pageHref } from "@spy4x/preact-ui-guide/routes"
import { check, describeError } from "../checks/harness.ts"
import { LOCAL_MAP_TILES_FLAG } from "../src/site.ts"

/** One browser check written with Playwright. */
export interface Spec {
  /** What the spec proves, in the present tense; it is the name of the recorded check. */
  name: string
  /** The guide page the spec starts on. */
  pageId: GuidePageId
  /** The palette the page is drawn in; light when left out. */
  colorScheme?: "light" | "dark"
  /**
   * Drives the page and throws when the behaviour does not hold.
   *
   * @returns Evidence printed next to the check's name, if any.
   */
  run: (page: Page) => Promise<string | void>
}

/** Where the specs run: the browser and the preview server `verify` started. */
export interface E2eTarget {
  /** Absolute URL of the guide on the local preview server. */
  url: string
  /** Chromium's remote debugging port. */
  port: number
  /** `--cpu-throttle`'s rate; 1 when the page runs at full speed. */
  cpuThrottle: number
}

/** How long a locator waits for its element before the spec fails, at full speed. */
const ACTION_TIMEOUT_MS = 10_000
/**
 * How long one spec may take, at full speed. Below `verify`'s 90-second stall limit, so a spec that
 * hangs is reported under its own name rather than as a stalled phase.
 */
const SPEC_TIMEOUT_MS = 60_000

/**
 * Read every spec out of every `*.spec.ts` file in this directory, in file-name order.
 *
 * The directory is the list: a spec file cannot exist and be left out of a run. A spec file that
 * does not export a `specs` list with at least one spec is an error rather than an empty file,
 * because it would otherwise look covered and run nothing.
 *
 * @returns The specs of every file, in file-name order and each file's own order.
 * @throws When a spec file exports no `specs` list, or an empty one.
 */
export async function loadSpecs(): Promise<Spec[]> {
  const directory = new URL("./", import.meta.url)
  const files: string[] = []
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isFile && entry.name.endsWith(".spec.ts")) files.push(entry.name)
  }
  const specs: Spec[] = []
  for (const file of files.sort()) {
    const module: { specs?: unknown } = await import(new URL(file, directory).href)
    if (!Array.isArray(module.specs) || module.specs.length === 0) {
      throw new Error(`pages/e2e/${file} exports no \`specs\` list with a spec in it`)
    }
    specs.push(...module.specs as Spec[])
  }
  return specs
}

/**
 * Run every spec in its own browser context and record one check for each.
 *
 * A spec that throws or outlives its deadline is one failed check; the specs after it still run.
 * Closing the context is what ends a spec that hangs: every call still waiting on it rejects.
 *
 * @param target The browser and server to run against.
 * @param specs The specs, in run order.
 * @throws When Playwright cannot attach to the browser; `verify` reports the block as stopped.
 */
export async function runSpecs(target: E2eTarget, specs: readonly Spec[]): Promise<void> {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${target.port}`, {
    timeout: ACTION_TIMEOUT_MS,
  })
  try {
    for (const spec of specs) {
      const context = await browser.newContext({ colorScheme: spec.colorScheme ?? "light" })
      context.setDefaultTimeout(ACTION_TIMEOUT_MS * target.cpuThrottle)
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        const detail = await Promise.race([
          (async () => {
            // The same switch `verify` sets for its own page: the Map card draws a local tile.
            await context.addInitScript(`globalThis.${LOCAL_MAP_TILES_FLAG} = true`)
            const page = await context.newPage()
            if (target.cpuThrottle > 1) {
              const session = await context.newCDPSession(page)
              await session.send("Emulation.setCPUThrottlingRate", { rate: target.cpuThrottle })
            }
            await page.goto(target.url + pageHref(spec.pageId))
            await page.locator(`html[data-hydrated="true"]`).waitFor()
            await page.locator(`[data-guide-page="${spec.pageId}"]`).waitFor()
            return await spec.run(page)
          })(),
          new Promise<never>((_, reject) => {
            const ms = SPEC_TIMEOUT_MS * target.cpuThrottle
            deadline = setTimeout(() => reject(new Error(`no result after ${ms}ms`)), ms)
          }),
        ])
        check(spec.name, true, detail ?? "")
      } catch (error) {
        // Playwright's message carries its call log on further lines; the report is one line each.
        check(spec.name, false, describeError(error).replace(/\s+/g, " ").trim())
      } finally {
        clearTimeout(deadline)
        await context.close().catch((error) =>
          console.error(
            `e2e: closing the context of "${spec.name}" failed: ${describeError(error)}`,
          )
        )
      }
    }
  } finally {
    // Detaches Playwright; the browser itself is `verify`'s to stop.
    await browser.close().catch((error) =>
      console.error(`e2e: detaching Playwright failed: ${describeError(error)}`)
    )
  }
}
