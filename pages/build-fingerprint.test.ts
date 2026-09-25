import { assertEquals, assertNotEquals } from "@std/assert"
import { hashEntries, isCovered } from "./build-fingerprint.ts"

const encoder = new TextEncoder()

Deno.test("the same entries produce the same fingerprint", async () => {
  const entries = [
    { path: "ui/badge.tsx", bytes: encoder.encode("export const Badge = 1\n") },
    { path: "deno.jsonc", bytes: encoder.encode("{}\n") },
  ]

  const first = await hashEntries(entries)
  const second = await hashEntries(entries)
  assertEquals(first, second)
})

Deno.test("a changed byte in an entry's content changes the fingerprint", async () => {
  const before = await hashEntries([
    { path: "ui/badge.tsx", bytes: encoder.encode("export const Badge = 1\n") },
  ])
  const after = await hashEntries([
    { path: "ui/badge.tsx", bytes: encoder.encode("export const Badge = 2\n") },
  ])
  assertNotEquals(before, after)
})

Deno.test("the order of entries does not change the fingerprint", async () => {
  const a = { path: "ui/badge.tsx", bytes: encoder.encode("export const Badge = 1\n") }
  const b = { path: "cn/mod.ts", bytes: encoder.encode("export const cn = 1\n") }

  const forward = await hashEntries([a, b])
  const backward = await hashEntries([b, a])
  assertEquals(forward, backward)
})

Deno.test("isCovered accepts a workspace package source", () => {
  assertEquals(isCovered("ui/badge.tsx"), true)
})

Deno.test("isCovered accepts the root lockfile", () => {
  assertEquals(isCovered("deno.lock"), true)
})

Deno.test("isCovered accepts the static fixture directories build.ts copies verbatim", () => {
  assertEquals(isCovered("pages/sw-demo/sw.js"), true)
  assertEquals(isCovered("pages/form-demo/index.html"), true)
  assertEquals(isCovered("pages/map-demo/tile.png"), true)
})

Deno.test("isCovered rejects anything under a dist/ directory", () => {
  assertEquals(isCovered("pages/dist/index.html"), false)
  assertEquals(isCovered("pages/dist/assets/main.abcdef01.css"), false)
})

Deno.test("isCovered rejects a Markdown file", () => {
  assertEquals(isCovered("README.md"), false)
  assertEquals(isCovered("ui/README.md"), false)
})
