# `@spy4x/preact-playwright`

The Playwright options every app shares, so an app's `playwright.config.ts` holds only its own
values, and two layout checks for an app's specs that fail on UI a person cannot reach or read. A
development tool: nothing here reaches a browser bundle.

## Shared options

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

## Layout checks

Each check throws an `Error` that says what to fix.

- `expectNotCovered(locator)` scrolls the element to the middle of the viewport, then fails unless
  the element or something inside it is what the browser hits at its centre and just inside its four
  corners. Playwright's `toBeInViewport` is true for a button under a fixed bar; this check is not.
  A box that hides its overflow, the page included, stays where it is, because a person cannot
  scroll it. The corner points follow the border radius, so a pill or a circle is tested on its own
  surface, and the check works inside a shadow root. The error names each failing point and what
  covers it, or says it is outside the viewport. An overlay with `pointer-events: none` lets taps
  through, so it does not count as cover.
- `expectFitsInLanguages(page, options)` sets the viewport to 390 px wide (`width` changes that) and
  calls `open(language)` for each of `languages`. In each one the element from `target(page)` must
  stay inside its container, which is `container(page)` or else its parent, and inside the
  viewport's width. Inside a box a person can scroll, a position past that box's edge is no overflow
  on that axis. No text in the element may be clipped: text counts as clipped when the element or
  something inside it hides overflow and has more content than room, or when an `<input>` or
  `<textarea>` has a value or placeholder wider or taller than its content box. Content must not
  spill out of an element with `overflow: visible` either; `auto` and `scroll` are exempt, because a
  person can scroll them. One pixel of rounding is allowed. Every language is checked before the
  error lists each failure with its pixels, and the original viewport always comes back. An empty
  `languages` list throws, and so does a page with no viewport size.
- `LayoutPage`, `LayoutLocator` and `FitsInLanguagesOptions` type the arguments. A real Playwright
  `Page` and `Locator` satisfy them.

```ts
import { expectFitsInLanguages, expectNotCovered } from "@jsr/spy4x__preact-playwright"

await expectNotCovered(page.getByTestId("save"))

await expectFitsInLanguages(page, {
  languages: ["en", "de", "fr"],
  open: async (language) => {
    await page.goto(`/${language}/settings`)
  },
  target: (page) => page.getByTestId("save"),
})
```

The package imports nothing, `@playwright/test` included, and has no dependencies: it pins no
Playwright version, and installing it under its npm name adds this one package to an app's lock
file. `@spy4x/preact-system/playwright` re-exports the shared options for apps that import them from
there.
