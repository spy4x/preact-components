import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { playwrightBaseConfig as fromPlaywright } from "@spy4x/preact-playwright"
import { playwrightBaseConfig, type PlaywrightBaseOptions } from "./playwright.ts"

describe("@spy4x/preact-system/playwright", () => {
  it("re-exports playwrightBaseConfig from @spy4x/preact-playwright, so old imports keep working", () => {
    expect(playwrightBaseConfig).toBe(fromPlaywright)
    const options: PlaywrightBaseOptions<object, Record<never, never>> = {
      baseURL: "http://x.test",
      ci: false,
      chromium: {},
    }
    expect(playwrightBaseConfig(options).use.baseURL).toBe("http://x.test")
  })
})
