import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { join } from "@std/path"
import type { WebsiteBuild } from "./build.ts"
import {
  website,
  type WebsiteDevServer,
  type WebsiteNodeRequest,
  type WebsiteNodeResponse,
  type WebsiteOptions,
} from "./vite.ts"

const ROOT = join("/", "site")
const CLIENT = join(ROOT, "dist", "client")

/** The client build's manifest: the entry with a shared chunk, and one island. */
const MANIFEST = {
  "client.ts": {
    file: "assets/client-1.js",
    css: ["assets/client-1.css"],
    imports: ["_preact.js"],
  },
  "_preact.js": { file: "assets/preact-2.js" },
  "islands/counter.tsx": { file: "assets/counter-3.js", imports: ["_preact.js"] },
}

/** The client build's files on an in-memory disk, by their path below `client/`. */
const FILES: Record<string, string> = {
  ".vite/manifest.json": JSON.stringify(MANIFEST),
  "assets/client-1.js": "client",
  "assets/client-1.css": "css",
  "assets/preact-2.js": "preact",
  "assets/counter-3.js": "counter",
  "favicon.svg": "<svg/>",
  "my file.txt": "spaced",
}

/** Readers over {@link FILES}, as `Deno.readDir` and `Deno.readFile` would read them. */
function options(extra: Partial<WebsiteOptions> = {}): WebsiteOptions {
  const files = new Map(Object.entries(FILES).map(([path, text]) => [join(CLIENT, path), text]))
  return {
    async *readDir(dir) {
      const names = new Map<string, boolean>()
      for (const path of files.keys()) {
        if (!path.startsWith(`${dir}/`)) continue
        const [name, ...rest] = path.slice(dir.length + 1).split("/")
        names.set(name, rest.length > 0)
      }
      for (const [name, isDirectory] of names) yield { name, isDirectory }
    },
    readFile(path) {
      const text = files.get(path)
      if (text === undefined) return Promise.reject(new Error(`no ${path}`))
      return Promise.resolve(new TextEncoder().encode(text))
    },
    isFile: (path) => Promise.resolve(files.has(path)),
    ...extra,
  }
}

const ENTRY = `declare const __WEBSITE_BUILD__: unknown\nconst build = __WEBSITE_BUILD__\n`

/** What the plugin writes into the server entry, for an environment in `mode`. */
async function transformed(mode: string, opts = options()): Promise<WebsiteBuild | null> {
  const [plugin] = website(opts)
  plugin.configResolved({ root: ROOT })
  const code = await plugin.transform.call(
    { environment: { mode } },
    ENTRY,
    join(ROOT, "server-entry.ts"),
  )
  return JSON.parse(code!.split("const build = ")[1])
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

describe("website() build", () => {
  it("writes the client build's stylesheets, script and preload chunks into the server entry", async () => {
    const build = (await transformed("build"))!
    expect(build.css).toEqual(["/assets/client-1.css"])
    expect(build.script).toBe("/assets/client-1.js")
    expect(build.preload).toEqual({
      script: ["/assets/client-1.js", "/assets/preact-2.js"],
      islands: { "./islands/counter.tsx": ["/assets/counter-3.js", "/assets/preact-2.js"] },
    })
  })

  it("lists every client file but the manifest, hashed, typed, with hashed assets immutable", async () => {
    const build = (await transformed("build"))!
    expect(Object.keys(build.files).sort()).toEqual([
      "/assets/client-1.css",
      "/assets/client-1.js",
      "/assets/counter-3.js",
      "/assets/preact-2.js",
      "/favicon.svg",
      "/my%20file.txt",
    ])
    expect(build.files["/favicon.svg"]).toEqual({
      filePath: "client/favicon.svg",
      hash: await sha256("<svg/>"),
      contentType: "image/svg+xml",
    })
    expect(build.files["/assets/client-1.js"].immutable).toBe(true)
    expect(build.files["/my%20file.txt"].filePath).toBe("client/my file.txt")
  })

  it("uses the build id it is given, else a hash of the files that stays the same", async () => {
    expect((await transformed("build", options({ buildId: "commit-1" })))!.buildId).toBe(
      "commit-1",
    )
    const first = (await transformed("build"))!.buildId
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect((await transformed("build"))!.buildId).toBe(first)
  })

  it("writes null into the server entry under the dev server", async () => {
    expect(await transformed("dev")).toBeNull()
  })

  it("leaves every module but the server entry alone", async () => {
    const [plugin] = website(options())
    plugin.configResolved({ root: ROOT })
    const other = await plugin.transform.call({ environment: { mode: "build" } }, ENTRY, "/x.ts")
    expect(other).toBeNull()
  })

  it("emits server.js beside the server bundle, and nothing in the client build", () => {
    const [plugin] = website(options())
    const emitted: string[] = []
    const context = (name: string) => ({
      environment: { name },
      emitFile: (file: { fileName: string; source: string }) => {
        emitted.push(`${file.fileName}: ${file.source}`)
        return file.fileName
      },
    })
    plugin.generateBundle.call(context("client"))
    plugin.generateBundle.call(context("ssr"))
    expect(emitted).toEqual([
      `server.js: import server from "./server/server-entry.mjs"\n\nexport default server\n`,
    ])
  })
})

/** A dev server whose site answers every request with its method and address. */
function devServer() {
  let middleware: Parameters<WebsiteDevServer["middlewares"]["use"]>[0] | undefined
  const loaded: string[] = []
  const server: WebsiteDevServer = {
    config: { root: ROOT },
    middlewares: { use: (fn) => (middleware = fn) },
    ssrLoadModule: (url) => {
      loaded.push(url)
      return Promise.resolve({
        default: {
          fetch: async (req: Request) =>
            new Response(`${req.method} ${new URL(req.url).pathname} ${await req.text()}`, {
              status: 201,
              headers: [["set-cookie", "a=1"], ["set-cookie", "b=2"], ["x-site", "1"]],
            }),
        },
      })
    },
  }
  const [plugin] = website(options({ isFile: (path) => Promise.resolve(path.endsWith(".svg")) }))
  plugin.configureServer(server)
  /** Sends one request through the middleware; resolves with what it wrote, or `next`. */
  return {
    loaded,
    send(url: string, method = "GET", body = ""): Promise<string> {
      return new Promise((resolve) => {
        const written: string[] = []
        const headers: Record<string, string | string[]> = {}
        const req = {
          method,
          url,
          headers: { host: "localhost:5173" },
          socket: {},
          async *[Symbol.asyncIterator]() {
            if (body) yield new TextEncoder().encode(body)
          },
        } as WebsiteNodeRequest
        const res: WebsiteNodeResponse = {
          statusCode: 0,
          setHeader: (name, value) => (headers[name] = value),
          write: (chunk) => written.push(new TextDecoder().decode(chunk)),
          end: () => resolve(`${res.statusCode} ${JSON.stringify(headers)} ${written.join("")}`),
        }
        middleware!(req, res, (error) => resolve(error ? `error ${error}` : "next"))
      })
    },
  }
}

describe("website() dev server", () => {
  it("answers a page request with the site from server-entry.ts, cookies kept apart", async () => {
    const dev = devServer()
    expect(await dev.send("/pricing", "POST", "a=1")).toBe(
      `201 {"content-type":"text/plain;charset=UTF-8","x-site":"1","set-cookie":["a=1","b=2"]} ` +
        `POST /pricing a=1`,
    )
    expect(dev.loaded).toEqual([join(ROOT, "server-entry.ts")])
  })

  it("leaves Vite's own requests, module queries and files on disk to Vite", async () => {
    const dev = devServer()
    for (const url of ["/@vite/client", "/node_modules/x.js", "/client.ts?v=1", "/logo.svg"]) {
      expect(await dev.send(url), url).toBe("next")
    }
    expect(dev.loaded).toEqual([])
  })
})
