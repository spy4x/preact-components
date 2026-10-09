import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { ViteMiddleware } from "./vite.ts"
import { buildWebManifest, webManifest, type WebManifestInput } from "./web-manifest.ts"

const icons: WebManifestInput["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
]

describe("buildWebManifest", () => {
  it("fills in what an installable app needs", () => {
    const manifest = buildWebManifest({ name: "Tasks", icons })

    expect(manifest).toEqual({
      name: "Tasks",
      short_name: "Tasks",
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      icons,
    })
  })

  it("starts and scopes the app at Vite's base", () => {
    const manifest = buildWebManifest({ name: "Tasks", icons }, "/app/")

    expect([manifest.start_url, manifest.scope, manifest.id]).toEqual(["/app/", "/app/", "/app/"])
  })

  it("keeps the caller's own values over the defaults", () => {
    const manifest = buildWebManifest({
      name: "Tasks",
      short_name: "T",
      display: "minimal-ui",
      start_url: "/today",
      icons,
    })

    expect([manifest.short_name, manifest.display, manifest.id]).toEqual([
      "T",
      "minimal-ui",
      "/today",
    ])
  })

  it("refuses icons a browser would not offer to install, naming each one missing", () => {
    expect(() => buildWebManifest({ name: "Tasks", icons: [icons[1]] })).toThrow(
      `needs a 192x192 icon, an icon with purpose "maskable"`,
    )
  })

  it("refuses an empty name", () => {
    expect(() => buildWebManifest({ name: " ", icons })).toThrow("`name` is required")
  })
})

describe("webManifest", () => {
  it("writes the manifest into the output folder after a build", async () => {
    const written: Array<[string, string]> = []
    const plugin = webManifest({
      manifest: { name: "Tasks", icons },
      writeTextFile: (path, text) => Promise.resolve(void written.push([path, text])),
    })
    plugin.configResolved!({ command: "build", root: "/app", build: { outDir: "dist" } })
    plugin.buildEnd!()
    await plugin.closeBundle!.call({})

    expect(written.map(([path]) => path)).toEqual(["/app/dist/manifest.webmanifest"])
    expect(JSON.parse(written[0][1]).display).toBe("standalone")
  })

  it("writes nothing when the app build failed", async () => {
    const written: string[] = []
    const plugin = webManifest({
      manifest: { name: "Tasks", icons },
      writeTextFile: (path) => Promise.resolve(void written.push(path)),
    })
    plugin.configResolved!({ command: "build", root: "/app", build: { outDir: "dist" } })
    plugin.buildEnd!(new Error("boom"))
    await plugin.closeBundle!.call({})

    expect(written).toEqual([])
  })

  it("serves the manifest from the dev server under the base", () => {
    const plugin = webManifest({
      manifest: { name: "Tasks", icons },
      writeTextFile: () => Promise.resolve(),
    })
    const middlewares: ViteMiddleware[] = []
    plugin.configResolved!({
      command: "serve",
      root: "/app",
      base: "/app/",
      build: { outDir: "d" },
    })
    plugin.configureServer!({ middlewares: { use: (middleware) => middlewares.push(middleware) } })
    const headers: Record<string, string> = {}
    let body = ""
    let passed = false
    const response = {
      statusCode: 0,
      setHeader: (name: string, value: string) => (headers[name] = value),
      end: (text: string) => (body = text),
    }

    middlewares[0]({ url: "/other.js" }, response, () => (passed = true))
    middlewares[0]({ url: "/app/manifest.webmanifest?v=1" }, response, () => {})

    expect(passed).toBe(true)
    expect(headers["Content-Type"]).toBe("application/manifest+json")
    expect(JSON.parse(body).start_url).toBe("/app/")
  })
})
