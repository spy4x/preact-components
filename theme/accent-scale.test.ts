import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { accentScaleBlock, REGION_END, REGION_START, withAccentScale } from "./accent-scale.ts"

describe("the accent scale in tokens.css", () => {
  it("is exactly what accent-scale.ts writes", async () => {
    const tokens = await Deno.readTextFile(new URL("./tokens.css", import.meta.url))
    expect(tokens).toContain(REGION_START)
    expect(tokens).toContain(REGION_END)
    expect(tokens).toBe(withAccentScale(tokens))
  })

  it("declares every derived step once, and not step 900", () => {
    const block = accentScaleBlock()
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 950]) {
      expect(block.split(`--color-accent-${step}: oklch(`).length).toBe(2)
    }
    expect(block).not.toContain("--color-accent-900:")
  })
})
