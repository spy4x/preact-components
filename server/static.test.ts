import { expect } from "@std/expect"
import { afterEach, describe, it } from "@std/testing/bdd"
import { App } from "./app.ts"
import { asset, setAssets } from "./render.tsx"
import { setStaticFiles, type StaticFileHandle, staticFiles } from "./static.ts"

const HASH = "ab12"

/** Opened paths, and the handles closed, so a test sees what the middleware touched. */
const opened: string[] = []
let closed = 0

/** A file system holding `body` at every path it is asked for. */
const fs = {
  open(path: string): Promise<StaticFileHandle | null> {
    opened.push(path)
    if (path.endsWith("/missing.txt")) return Promise.resolve(null)
    const bytes = new TextEncoder().encode("body")
    return Promise.resolve({
      size: bytes.length,
      body: new Blob([bytes]).stream(),
      close: () => closed++,
    })
  },
}

/** An app with the build's files in front of a route that answers `next`. */
function staticApp() {
  setAssets({ buildId: "b1", css: [], script: null, preload: null, devScripts: [] })
  setStaticFiles({
    root: "/srv/dist",
    fs,
    files: {
      "/logo.svg": { filePath: "client/logo.svg", hash: HASH, contentType: "image/svg+xml" },
      "/assets/client-x1.js": {
        filePath: "client/assets/client-x1.js",
        hash: HASH,
        contentType: "text/javascript",
        immutable: true,
      },
      "/missing.txt": { filePath: "client/missing.txt", hash: HASH, contentType: "text/plain" },
    },
  })
  const handler = new App().use(staticFiles()).get("*", (ctx) => ctx.text("next")).handler()
  return (path: string, init?: RequestInit) =>
    handler(new Request(`https://example.test${path}`, init))
}

afterEach(() => {
  setStaticFiles(null)
  opened.length = 0
  closed = 0
})

describe("staticFiles", () => {
  it("sends a file with its type, a weak ETag, its length and no caching without a build id", async () => {
    const response = await staticApp()("/logo.svg")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/svg+xml")
    expect(response.headers.get("etag")).toBe(`W/"${HASH}"`)
    expect(response.headers.get("content-length")).toBe("4")
    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-store, max-age=0, must-revalidate",
    )
    expect(await response.text()).toBe("body")
    expect(opened).toEqual(["/srv/dist/client/logo.svg"])
  })

  it("sends a file whose address carries this build's id as immutable for a year", async () => {
    const response = await staticApp()(asset("/logo.svg"))
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
  })

  it("sends the client build's hashed files as immutable for a year", async () => {
    const response = await staticApp()("/assets/client-x1.js")
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
  })

  it("answers a matching If-None-Match with 304 and no body, weak or strong", async () => {
    for (const tag of [`W/"${HASH}"`, HASH]) {
      const response = await staticApp()("/logo.svg", { headers: { "If-None-Match": tag } })
      expect(response.status).toBe(304)
      expect(response.body).toBeNull()
    }
    expect(opened).toEqual([])
  })

  it("redirects an address with another build's id to the same address without it", async () => {
    const response = await staticApp()("/logo.svg?v=2&__v=old")
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("/logo.svg?v=2")
  })

  it("answers a method other than GET and HEAD with 405", async () => {
    const response = await staticApp()("/logo.svg", { method: "POST" })
    expect(response.status).toBe(405)
  })

  it("answers HEAD with the headers, no body, and closes the file", async () => {
    const response = await staticApp()("/logo.svg", { method: "HEAD" })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-length")).toBe("4")
    expect(response.body).toBeNull()
    expect(closed).toBe(1)
  })

  it("passes an address the build has no file for to the next step", async () => {
    expect(await (await staticApp()("/pricing")).text()).toBe("next")
    expect(await (await staticApp()("/")).text()).toBe("next")
  })

  it("answers a missing /favicon.ico with 404 instead of a page", async () => {
    expect((await staticApp()("/favicon.ico")).status).toBe(404)
  })

  it("answers 404 when a listed file is gone from disk", async () => {
    expect((await staticApp()("/missing.txt")).status).toBe(404)
  })

  it("passes every request on when no build is set, as in development", async () => {
    const app = new App().use(staticFiles()).get("*", (ctx) => ctx.text("next"))
    const response = await app.handler()(new Request("https://example.test/logo.svg"))
    expect(await response.text()).toBe("next")
  })
})
