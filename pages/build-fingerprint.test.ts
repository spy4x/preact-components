import { assertEquals, assertNotEquals } from "@std/assert"
import { workspaceMembers } from "../infra/scripts/workspace.ts"
import { hashEntries, isCovered, isVerifyOnly, WORKSPACE_DIRECTORIES } from "./build-fingerprint.ts"

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

Deno.test("isCovered accepts a server package source", () => {
  assertEquals(isCovered("server/app.ts"), true)
})

Deno.test("WORKSPACE_DIRECTORIES matches the workspace in deno.jsonc", async () => {
  assertEquals([...WORKSPACE_DIRECTORIES].sort(), (await workspaceMembers()).sort())
})

Deno.test("isCovered accepts the root lockfile", () => {
  assertEquals(isCovered("deno.lock"), true)
})

Deno.test("isCovered accepts the static fixture directories build.ts copies verbatim", () => {
  assertEquals(isCovered("pages/sw-demo/sw.js"), true)
  assertEquals(isCovered("pages/form-demo/index.html"), true)
  assertEquals(isCovered("pages/map-demo/tile.png"), true)
  assertEquals(isCovered("pages/video-demo/clip.webm"), true)
  assertEquals(isCovered("pages/fonts/noto-sans-arabic-arabic-wght-normal.woff2"), true)
})

Deno.test("isCovered rejects anything under a dist/ directory", () => {
  assertEquals(isCovered("pages/dist/index.html"), false)
  assertEquals(isCovered("pages/dist/assets/main.abcdef01.css"), false)
})

Deno.test("isCovered rejects a Markdown file", () => {
  assertEquals(isCovered("README.md"), false)
  assertEquals(isCovered("ui/README.md"), false)
})

Deno.test("isCovered rejects a Playwright spec under pages/e2e", () => {
  assertEquals(isCovered("pages/e2e/x.spec.ts"), false)
})

Deno.test("isCovered rejects a browser check under pages/checks", () => {
  assertEquals(isCovered("pages/checks/ui.ts"), false)
})

Deno.test("isCovered rejects pages/verify.ts", () => {
  assertEquals(isCovered("pages/verify.ts"), false)
})

Deno.test("isCovered rejects the playwright helper package", () => {
  assertEquals(isCovered("playwright/+index.ts"), false)
})

Deno.test("isCovered still accepts the build's own sources and package tests", () => {
  assertEquals(isCovered("pages/src/document.tsx"), true)
  assertEquals(isCovered("pages/build.ts"), true)
  assertEquals(isCovered("ui/button.test.tsx"), true)
})

/** The modules `build.ts` bundles, prerenders or runs, relative to `pages/`. */
const BUILD_ENTRIES = ["build.ts", "src/+main.tsx", "src/map-page/+main.tsx", "src/prerender.tsx"]

Deno.test("no file the build reads is excluded from the fingerprint as verify-only", async () => {
  const repoRoot = new URL("../", import.meta.url).href
  const pagesDirectory = new URL("./", import.meta.url)
  const reached = new Set<string>()

  for (const entry of BUILD_ENTRIES) {
    const { success, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", entry],
      cwd: pagesDirectory,
      stdout: "piped",
      stderr: "piped",
    }).output()
    if (!success) throw new Error(`deno info ${entry} failed: ${new TextDecoder().decode(stderr)}`)

    const { modules } = JSON.parse(new TextDecoder().decode(stdout)) as {
      modules: { specifier: string }[]
    }
    for (const { specifier } of modules) {
      if (specifier.startsWith(repoRoot)) reached.add(specifier.slice(repoRoot.length))
    }
  }

  // An empty graph would pass the check below without proving anything.
  assertEquals(reached.has("pages/src/document.tsx"), true)
  assertEquals([...reached].filter(isVerifyOnly), [])
})
