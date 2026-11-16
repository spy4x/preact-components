import { expect } from "@std/expect"
import { parse } from "@std/jsonc"
import { describe, it } from "@std/testing/bdd"
import { playwrightBaseConfig } from "./+index.ts"

const DEVICE = { viewport: { width: 1280, height: 720 }, userAgent: "Chrome" }

describe("playwrightBaseConfig", () => {
  it("returns the options every app shares, with the app's address and device", () => {
    const config = playwrightBaseConfig({
      baseURL: "http://app.localhost",
      ci: false,
      chromium: DEVICE,
    })
    expect(config).toEqual({
      testDir: "./e2e",
      testMatch: /.*\.e2e\.ts/,
      outputDir: "./e2e/results",
      forbidOnly: false,
      retries: 0,
      fullyParallel: false,
      workers: 1,
      timeout: 30_000,
      reporter: [["html", { open: "never" }], ["list"]],
      use: {
        baseURL: "http://app.localhost",
        testIdAttribute: "data-e2e",
        actionTimeout: 10_000,
        navigationTimeout: 10_000,
        trace: "retain-on-failure",
      },
      projects: [{ name: "chromium", use: DEVICE }],
    })
  })

  it("matches spec files by their .e2e.ts ending and nothing else", () => {
    const { testMatch } = playwrightBaseConfig({
      baseURL: "http://x.test",
      ci: false,
      chromium: {},
    })
    expect(testMatch.test("e2e/auth.e2e.ts")).toBe(true)
    expect(testMatch.test("e2e/env.ts")).toBe(false)
    expect(testMatch.test("libs/ui/notes.test.tsx")).toBe(false)
  })

  it("forbids a leftover test.only and retries twice in CI", () => {
    const config = playwrightBaseConfig({ baseURL: "http://x.test", ci: true, chromium: {} })
    expect(config.forbidOnly).toBe(true)
    expect(config.retries).toBe(2)
  })

  it("lays the app's use options over the shared ones", () => {
    const config = playwrightBaseConfig({
      baseURL: "http://x.test",
      ci: false,
      chromium: {},
      use: { testIdAttribute: "data-testid", locale: "en-GB" },
    })
    expect(config.use).toEqual({
      baseURL: "http://x.test",
      testIdAttribute: "data-testid",
      locale: "en-GB",
      actionTimeout: 10_000,
      navigationTimeout: 10_000,
      trace: "retain-on-failure",
    })
  })

  it("gives each call its own device copy, so one config cannot change another", () => {
    const first = playwrightBaseConfig({ baseURL: "http://x.test", ci: false, chromium: DEVICE })
    expect(first.projects[0].use).not.toBe(DEVICE)
    expect(first.projects[0].use).toEqual(DEVICE)
  })
})

describe("@spy4x/preact-playwright", () => {
  it("has no dependencies: no import map and no import in any published file", async () => {
    const config = parse(await Deno.readTextFile(new URL("./deno.json", import.meta.url)))
    expect(config).not.toHaveProperty("imports")
    const published: string[] = []
    for await (const entry of Deno.readDir(new URL(".", import.meta.url))) {
      if (entry.isFile && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        published.push(entry.name)
      }
    }
    expect(published).toContain("+index.ts")
    for (const name of published) {
      const source = await Deno.readTextFile(new URL(`./${name}`, import.meta.url))
      // Comment lines are dropped first: the JSDoc example imports `@playwright/test` on purpose.
      const code = source.split("\n").filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join("\n")
      expect(code, name).not.toMatch(/^\s*import\b|\bimport\s*\(|\bfrom\s+["']/m)
    }
  })
})
