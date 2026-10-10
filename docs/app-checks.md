# Checks an app shares with this library

An app built on these packages keeps three checks that used to be copied by hand from app to app:
the spacing guard, the screen boundary guard and the Playwright configuration. Each is now a few
lines of configuration over an export of this library. This page has the lines to copy, and the one
CI step that installs Deno into the Playwright image.

## The spacing guard

`registerSpacingTests` from `@spy4x/preact-theme/spacing-runner` registers one test that reads every
source file in the directories you name and fails on a spacing class off the scale
([spacing.md](./spacing.md)).

```ts
// tests/spacing.test.ts
import { registerSpacingTests } from "@spy4x/preact-theme/spacing-runner"

registerSpacingTests({
  test: Deno.test,
  root: new URL("../", import.meta.url),
  directories: ["apps", "libs"],
  requiredFiles: ["apps/spa/src/app.tsx"],
})
```

## The screen boundary guard

`registerBoundaryTests` from `@spy4x/preact-system/boundary-runner` registers a test that holds
every module in a folder of pure screens to the boundary rule
([`system/README.md`](../system/README.md), "The screen boundary rule"), and a second test that
checks your own lists: every alias and every import under `refusedImports` must be refused, and
every import under `allowedImports` must pass.

```ts
// tests/ui-boundary.test.ts
import { registerBoundaryTests } from "@spy4x/preact-system/boundary-runner"

registerBoundaryTests({
  test: Deno.test,
  root: new URL("../", import.meta.url),
  directories: ["libs/ui"],
  boundary: { appAliases: ["@api/", "@spa/"], appDirectories: ["apps"] },
  requiredFiles: ["libs/ui/auth-screen.tsx"],
  refusedImports: ["../../apps/spa/src/state/auth.ts"],
  allowedImports: ["./progressive.tsx"],
})
```

## What both guards share

- **`test`** is your own test function: `Deno.test`, or `it` from `@std/testing/bdd`. The runners
  import no test framework and no assertion library; a failure is a thrown `Error` that lists every
  finding, one per line.
- **`root`** is the repository root, as a path or a `file:` URL. `directories` are relative to it.
- **A guard that walks nothing fails.** The test fails when a directory does not exist, when it
  holds no file with a checked extension, and when a file under `requiredFiles` was not found. Name
  one file per app under `requiredFiles` that the app cannot lose.
- **A symbolic link fails the test.** A link, or another special file, whose name has a checked
  extension is neither read nor skipped: the test fails and names it. Put the file itself in the
  folder, or leave its folder out with `skipDirectories`. A link with any other name, a test file's
  name included, is passed over like any other file the guard does not read.
- **An unreadable file fails the test** too, and so does an empty `directories` list.
- **Left out:** test files (`*.test.ts`, `*.test.tsx`), which spell out classes and forbidden
  imports to assert on, and the directories `node_modules`, `dist`, `build`, `.vite` and `_fresh`
  wherever they appear below a walked directory. `skipDirectories` replaces that list. A folder
  above the root with one of these names does not count.
- **Extensions:** the spacing guard reads `.ts`, `.tsx`, `.css` and `.html`; the boundary guard
  reads `.ts` and `.tsx`. `extensions` replaces either list.
- **Files are read through Deno** by default, so run the test with `--allow-read`. `fs` takes
  another reader with `exists`, `readDir` and `readText` (the shape of `FileSystemPort` in
  `@spy4x/platform/server/ports`); this library's own tests pass an in-memory one. The boundary
  guard also needs `deno test` itself, because the rule runs on Deno's linter.

## The Playwright configuration

`playwrightBaseConfig` from `@spy4x/preact-system/playwright` returns the options every app shares.
Spread it into `defineConfig` and write the app's own keys after it.

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test"
import { playwrightBaseConfig } from "@spy4x/preact-system/playwright"

export default defineConfig({
  ...playwrightBaseConfig({
    baseURL: "http://app.localhost",
    ci: !!Deno.env.get("CI"),
    chromium: devices["Desktop Chrome"],
  }),
  webServer: {
    command: "deno task start",
    url: "http://app.localhost/health",
    reuseExistingServer: !Deno.env.get("CI"),
    timeout: 60_000,
  },
})
```

| Option                                       | Shared value                                             |
| -------------------------------------------- | -------------------------------------------------------- |
| `testDir`                                    | `./e2e`                                                  |
| `testMatch`                                  | any `*.e2e.ts`                                           |
| `outputDir`                                  | `./e2e/results`                                          |
| `forbidOnly`                                 | `true` in CI: a leftover `test.only` fails the run       |
| `retries`                                    | `2` in CI, `0` elsewhere                                 |
| `fullyParallel`                              | `false`, and `workers` is `1`: the tests share one app   |
| `timeout`                                    | 30 s for a test                                          |
| `reporter`                                   | an HTML report that never opens by itself, and `list`    |
| `use.testIdAttribute`                        | `data-e2e`, so `getByTestId` reads the components' hooks |
| `use.actionTimeout`, `use.navigationTimeout` | 10 s each                                                |
| `use.trace`                                  | `retain-on-failure`                                      |
| `projects`                                   | one, `chromium`, on the device you pass                  |

A key written after the spread replaces the shared one, so a second configuration with other specs
needs only its own `testDir`, `testMatch`, `outputDir` or `reporter`. `use` is nested, so a key
written after the spread would replace all of it: pass extra `use` options as `use` in the call,
where they are laid over the shared ones.

The module imports nothing. `defineConfig` and `devices` come from the app's own `@playwright/test`,
so this library pins no Playwright version, and an app that runs no browser test resolves no
Playwright package.

## Deno in the Playwright image

Run the browser tests in Playwright's own image, which carries the browser and its system
libraries. The image tag must match the app's `@playwright/test` version, because the browser build
inside the image is tied to it. The image has no Deno, so the step installs one pinned release and
checks its checksum before unpacking it. Copy these lines as they are, and change the version and
the checksum together in every app:

```yaml
e2e:
  image: mcr.microsoft.com/playwright:v1.57.0-noble
  commands:
    # Deno 2.9.7. The checksum is the one published beside the release file
    # (deno-x86_64-unknown-linux-gnu.zip.sha256sum).
    - |
        curl -fsSL -o /tmp/deno.zip https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-unknown-linux-gnu.zip
        echo "c6527f24f4b16031d3ae4fa9f658d5f11534c8d84ce7dc8502420280919c3490  /tmp/deno.zip" | sha256sum -c -
        apt-get update -qq && apt-get install -y -qq --no-install-recommends unzip
        unzip -q -o /tmp/deno.zip -d /usr/local/bin
        chmod +x /usr/local/bin/deno
    - deno --version
    - deno install --frozen
    - deno task e2e
```

Take the release file itself, not `npm install --global deno`: the npm package can lag the binary,
and it has no checksum to hold it to. Do not install the browser through Deno (`playwright install`)
in this step either; the image already has it.

To move to a new Deno release, read the new checksum from
`https://github.com/denoland/deno/releases/download/v<version>/deno-x86_64-unknown-linux-gnu.zip.sha256sum`
and change both lines.
