/// <reference lib="deno.unstable" />
// `boundary.ts` declares its own slice of Deno's lint types, because a published module may not
// reference the unstable library. This file is not published, so it may, and `deno check` holds
// that slice to Deno's real `Deno.lint.Plugin`.
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { boundaryPlugin } from "./boundary.ts"

describe("boundaryPlugin", () => {
  it("builds a plugin Deno.lint.runPlugin accepts as it is", () => {
    const plugin = boundaryPlugin({ appAliases: ["@api/"] }) satisfies Deno.lint.Plugin
    const found = Deno.lint.runPlugin(plugin, "/screen.tsx", `import { a } from "@api/a"`)

    expect(found.map((diagnostic) => diagnostic.id)).toEqual(["ui/boundary"])
  })
})
