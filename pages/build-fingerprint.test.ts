import { assertEquals, assertNotEquals } from "@std/assert"
import { join } from "node:path"
import { computeBuildFingerprint } from "./build-fingerprint.ts"

/** A minimal tree shaped like the real workspace: one covered package, one root config file. */
async function makeTree(root: string): Promise<void> {
  await Deno.mkdir(join(root, "ui"), { recursive: true })
  await Deno.writeTextFile(join(root, "ui", "button.tsx"), "export const Button = 1\n")
  await Deno.writeTextFile(join(root, "deno.jsonc"), "{}\n")
}

Deno.test("the same tree produces the same fingerprint", async () => {
  const dir = await Deno.makeTempDir()
  try {
    await makeTree(dir)
    const first = await computeBuildFingerprint(dir)
    const second = await computeBuildFingerprint(dir)
    assertEquals(first, second)
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test("a changed byte in a covered source changes the fingerprint", async () => {
  const dir = await Deno.makeTempDir()
  try {
    await makeTree(dir)
    const before = await computeBuildFingerprint(dir)
    await Deno.writeTextFile(join(dir, "ui", "button.tsx"), "export const Button = 2\n")
    const after = await computeBuildFingerprint(dir)
    assertNotEquals(before, after)
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test("a file outside the covered set does not change the fingerprint", async () => {
  const dir = await Deno.makeTempDir()
  try {
    await makeTree(dir)
    const before = await computeBuildFingerprint(dir)

    // dist/ is build output, never a source, and .md is not one of the covered extensions.
    await Deno.mkdir(join(dir, "pages", "dist"), { recursive: true })
    await Deno.writeTextFile(join(dir, "pages", "dist", "index.html"), "<html></html>\n")
    await Deno.writeTextFile(join(dir, "README.md"), "# notes\n")

    const after = await computeBuildFingerprint(dir)
    assertEquals(before, after)
  } finally {
    await Deno.remove(dir, { recursive: true })
  }
})
