# `@spy4x/preact-playwright`

The Playwright options every app shares, so an app's `playwright.config.ts` holds only its own
values: where the app is served, how to start it, and anything it does differently. A development
tool: nothing here reaches a browser bundle.

- `playwrightBaseConfig(options)` takes the app's `baseURL`, whether the run is in CI (`ci`), the
  device from the app's own Playwright (`chromium: devices["Desktop Chrome"]`) and optional extra
  `use` options. It returns `testDir` (`./e2e`), `testMatch` (any `*.e2e.ts`), `outputDir`, the CI
  switches (`forbidOnly`, two `retries`), one worker, the timeouts, the HTML and list reporters, a
  trace kept for each failed test, `data-e2e` as the test id attribute and one `chromium` project.
- `PlaywrightBaseOptions`, `PlaywrightBaseConfig`, `PlaywrightBaseUse` and `PlaywrightReporter` type
  what goes in and what comes out.

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test"
import { playwrightBaseConfig } from "@jsr/spy4x__preact-playwright"

export default defineConfig({
  ...playwrightBaseConfig({
    baseURL: "http://app.localhost",
    ci: !!Deno.env.get("CI"),
    chromium: devices["Desktop Chrome"],
  }),
  webServer: { command: "deno task start", url: "http://app.localhost/health" },
})
```

A key written after the spread replaces the shared one. `use` is nested, so pass extra `use`
options in the call instead, where they are laid over the shared ones.

The import is the package's npm name, `@jsr/spy4x__preact-playwright`: Playwright loads its
configuration file itself and finds only packages in `node_modules`, so the JSR name fails there
with `Cannot find module`. [`docs/app-checks.md`](../docs/app-checks.md) has the one-time setup,
lists every shared value and has the CI step that installs Deno into the Playwright image.

The package imports nothing, `@playwright/test` included, and has no dependencies: it pins no
Playwright version, and installing it under its npm name adds this one package to an app's lock
file. `@spy4x/preact-system/playwright` re-exports it for apps that import it from there.
