/**
 * The Playwright options every app shares, so an app's `playwright.config.ts` holds only its own
 * values: where the app is served, how to start it, and anything it does differently.
 *
 * This module imports nothing, `@playwright/test` included. The app passes the one value that
 * comes from Playwright (`devices["Desktop Chrome"]`) and wraps the result in its own
 * `defineConfig`, so the library never pins a Playwright version and an app that runs no browser
 * test resolves no Playwright package.
 *
 * @module
 */

/** One reporter: its name, then its options when it takes any. */
export type PlaywrightReporter = readonly [string] | readonly [string, Record<string, unknown>]

/** The `use` options {@link playwrightBaseConfig} sets for every app. */
export interface PlaywrightBaseUse {
  /** The address `page.goto("/")` resolves against. */
  baseURL: string
  /** The attribute `getByTestId` reads: `data-e2e`, the hook every component here carries. */
  testIdAttribute: string
  /** Milliseconds one action, such as a click, may take. */
  actionTimeout: number
  /** Milliseconds one navigation may take. */
  navigationTimeout: number
  /** A trace is kept for every failed test and for no other. */
  trace: "retain-on-failure"
}

/** What an app tells {@link playwrightBaseConfig}. */
export interface PlaywrightBaseOptions<Device extends object, Use extends object> {
  /** The address the app is served at, such as `"http://app.localhost"`. */
  baseURL: string
  /**
   * Whether this run is in CI, such as `!!Deno.env.get("CI")`. In CI a leftover `test.only` fails
   * the run and a failed test is retried twice.
   */
  ci: boolean
  /** The browser to run in: `devices["Desktop Chrome"]` from `@playwright/test`. */
  chromium: Device
  /** More `use` options, laid over the shared ones; a key given here replaces the shared value. */
  use?: Use
}

/** What {@link playwrightBaseConfig} returns: a value for Playwright's `defineConfig`. */
export interface PlaywrightBaseConfig<Device extends object, Use extends object> {
  /** Where the specs are: `./e2e`. */
  testDir: string
  /** Which files are specs: any `*.e2e.ts`. */
  testMatch: RegExp
  /** Where traces and other test output go: `./e2e/results`. */
  outputDir: string
  /** Whether a leftover `test.only` fails the run: in CI only. */
  forbidOnly: boolean
  /** How often a failed test is retried: twice in CI, never elsewhere. */
  retries: number
  /** Tests in one file run in order, because they share one server and its data. */
  fullyParallel: boolean
  /** One worker, for the same reason. */
  workers: number
  /** Milliseconds one test may take. */
  timeout: number
  /** An HTML report that never opens by itself, and a line per test in the terminal. */
  reporter: PlaywrightReporter[]
  /** The shared `use` options with the app's laid over them. */
  use: Omit<PlaywrightBaseUse, keyof Use> & Use
  /** One project, `chromium`, on the device the app passed. */
  projects: { name: string; use: Device }[]
}

/**
 * Build the Playwright configuration every app shares. Spread the result into `defineConfig` and
 * add the app's own keys after it (`webServer`, or a different `testMatch` or `reporter`): a key
 * written after the spread replaces the shared one. `use` is the exception, because it is nested;
 * pass extra `use` options in `options.use` instead, where they are merged.
 *
 * @example In `playwright.config.ts`, by the package's npm name: Playwright loads that file itself
 * and finds only packages in `node_modules` (`docs/app-checks.md` has the one-time setup).
 * ```ts
 * import { defineConfig, devices } from "@playwright/test"
 * import { playwrightBaseConfig } from "@jsr/spy4x__preact-system/playwright"
 *
 * export default defineConfig({
 *   ...playwrightBaseConfig({
 *     baseURL: "http://app.localhost",
 *     ci: !!Deno.env.get("CI"),
 *     chromium: devices["Desktop Chrome"],
 *   }),
 *   webServer: { command: "deno task start", url: "http://app.localhost/health" },
 * })
 * ```
 */
export function playwrightBaseConfig<
  Device extends object,
  Use extends object = Record<never, never>,
>(options: PlaywrightBaseOptions<Device, Use>): PlaywrightBaseConfig<Device, Use> {
  const shared: PlaywrightBaseUse = {
    baseURL: options.baseURL,
    testIdAttribute: "data-e2e",
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
  }
  // TypeScript types a spread of a generic as an intersection, which is wrong for a key the app
  // replaces with another type (`trace: "on"`), so the result is stated instead.
  const use = { ...shared, ...options.use } as unknown as Omit<PlaywrightBaseUse, keyof Use> & Use
  return {
    testDir: "./e2e",
    testMatch: /.*\.e2e\.ts/,
    outputDir: "./e2e/results",
    forbidOnly: options.ci,
    retries: options.ci ? 2 : 0,
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    reporter: [["html", { open: "never" }], ["list"]],
    use,
    projects: [{ name: "chromium", use: { ...options.chromium } }],
  }
}
