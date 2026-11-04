import { assertEquals } from "@std/assert"
import { specsByFile } from "./ui.spec.ts"

Deno.test("the ui spec index imports every spec file under e2e/ui/, so none is left out", async () => {
  const files: string[] = []
  for await (const entry of Deno.readDir(new URL(`./ui/`, import.meta.url))) {
    if (entry.isFile && entry.name.endsWith(`.spec.ts`)) files.push(entry.name.slice(0, -8))
  }
  assertEquals(Object.keys(specsByFile).sort(), files.sort())
  for (const [file, specs] of Object.entries(specsByFile)) {
    assertEquals(specs.length > 0, true, file)
  }
})
