/**
 * `@spy4x/preact-server/vite` — a website's build and dev server on Vite, in place of Fresh's
 * plugin. Build-time only: no page or server bundle imports it.
 *
 * `vite build` makes two bundles in `dist/`:
 *
 * - `client/`: `static/` as it is, and `client.ts` with the styles and the islands' code, hashed
 *   under `client/assets/`;
 * - `server/server-entry.mjs` with its chunks in `server/assets/`, everything bundled, and
 *   `server.js`, which the runtime's server runs. The server learns the client build's files from
 *   `__WEBSITE_BUILD__` ({@link BUILD_PLACEHOLDER}), which this plugin replaces in
 *   `server-entry.ts`.
 *
 * `vite` serves the site from `server-entry.ts`, with `static/` and the client code from Vite.
 *
 * The plugin is typed structurally: this package takes no `vite` dependency, and every file it
 * reads goes through the readers in {@link WebsiteOptions}, so it runs on Deno, Node and Bun.
 *
 * @module
 */
import { contentType } from "@std/media-types"
import { extname, join } from "@std/path"
import { encodeHex } from "@std/encoding/hex"
import type { WebsiteBuild } from "./build.ts"
import type { StaticFile } from "./static.ts"

const OUT = "dist"
const CLIENT_ENTRY = "client.ts"
const SERVER_ENTRY = "server-entry.ts"

/**
 * The name `server-entry.ts` declares and assigns (`const build = __WEBSITE_BUILD__`): the build
 * replaces it with the client build's {@link WebsiteBuild}, the dev server with `null`.
 */
export const BUILD_PLACEHOLDER = "__WEBSITE_BUILD__"

/** The part of a directory entry {@link WebsiteOptions.readDir} yields, as `Deno.readDir` does. */
export interface WebsiteDirEntry {
  /** The entry's name. */
  name: string
  /** Whether the entry is a directory. */
  isDirectory: boolean
}

/** Options for {@link website}: how it reads files, and the build id. */
export interface WebsiteOptions {
  /** Lists a directory, after the client build: `Deno.readDir`. */
  readDir: (path: string) => AsyncIterable<WebsiteDirEntry>
  /** Reads a file, after the client build: `Deno.readFile`. */
  readFile: (path: string) => Promise<Uint8Array>
  /**
   * Whether `path` is a file, for the dev server to leave it to Vite:
   * `(path) => Deno.stat(path).then((info) => info.isFile, () => false)`.
   */
  isFile: (path: string) => Promise<boolean>
  /**
   * The build id, such as the commit (`CI_COMMIT_SHA`). Default: a SHA-256 of the client build's
   * files, so an unchanged build keeps its id.
   */
  buildId?: string
}

/** The build's environments, as `builder.buildApp` receives them. */
export interface WebsiteBuilder {
  /** The environments by name: `client` and `ssr`. */
  environments: Record<string, unknown>
  /** Builds one environment. */
  build(environment: unknown): Promise<unknown>
}

/** Node's request, as Vite's dev server hands it to a middleware. */
export interface WebsiteNodeRequest extends AsyncIterable<Uint8Array> {
  /** The method. */
  method?: string
  /** The address, relative to Vite's base. */
  url?: string
  /** The address as the browser sent it. */
  originalUrl?: string
  /** The request headers. */
  headers: Record<string, string | string[] | undefined>
  /** The client's address. */
  socket: { remoteAddress?: string; remotePort?: number }
}

/** Node's response, as Vite's dev server hands it to a middleware. */
export interface WebsiteNodeResponse {
  /** The status to send. */
  statusCode: number
  /** Sets one header. */
  setHeader(name: string, value: string | string[]): unknown
  /** Writes part of the body. */
  write(chunk: Uint8Array): unknown
  /** Ends the response. */
  end(): unknown
}

/** The part of Vite's dev server the plugin uses. */
export interface WebsiteDevServer {
  /** The resolved config: the project root. */
  config: { root: string }
  /** The server's Connect app. */
  middlewares: {
    use(
      middleware: (
        req: WebsiteNodeRequest,
        res: WebsiteNodeResponse,
        next: (error?: unknown) => void,
      ) => void,
    ): unknown
  }
  /** Loads a module through Vite, for the server. */
  ssrLoadModule(url: string): Promise<Record<string, unknown>>
}

/** The shape of the Vite plugin {@link website} returns, cut down to the hooks it implements. */
export interface WebsitePlugin {
  /** The plugin's name. */
  name: string
  /** Vite's config: the public folder, JSX, the two environments and the build order. */
  config: () => Record<string, unknown>
  /** Receives the project root. */
  configResolved(config: { root: string }): void
  /** Writes the client build into `server-entry.ts`. */
  transform(
    this: { environment: { mode: string } },
    code: string,
    id: string,
  ): Promise<string | null>
  /** Emits `server.js` with the server bundle. */
  generateBundle(this: {
    environment: { name: string }
    emitFile(file: { type: "asset"; fileName: string; source: string }): string
  }): void
  /** Answers the dev server's page requests with the site. */
  configureServer(server: WebsiteDevServer): void
}

/** The plugins that build and serve the website. */
export function website(options: WebsiteOptions): WebsitePlugin[] {
  let root = ""
  return [{
    name: "preact-server-website",
    config: () => ({
      publicDir: "static",
      esbuild: { jsx: "automatic", jsxImportSource: "preact" },
      environments: {
        client: {
          build: {
            outDir: `${OUT}/client`,
            manifest: true,
            rollupOptions: { input: CLIENT_ENTRY },
          },
        },
        ssr: {
          resolve: { noExternal: true },
          build: {
            outDir: OUT,
            emptyOutDir: false,
            copyPublicDir: false,
            rollupOptions: {
              input: { "server-entry": SERVER_ENTRY },
              output: {
                entryFileNames: "server/[name].mjs",
                chunkFileNames: "server/assets/[name]-[hash].mjs",
                assetFileNames: "server/assets/[name]-[hash][extname]",
              },
            },
          },
        },
      },
      builder: {
        async buildApp(builder: WebsiteBuilder) {
          await builder.build(builder.environments.client)
          await builder.build(builder.environments.ssr)
        },
      },
    }),
    configResolved(config) {
      root = config.root
    },
    async transform(code, id) {
      if (!id.endsWith(`/${SERVER_ENTRY}`) || !code.includes(BUILD_PLACEHOLDER)) return null
      const build = this.environment.mode === "build" ? await clientBuild(root, options) : null
      return code.replace(`= ${BUILD_PLACEHOLDER}`, `= ${JSON.stringify(build)}`)
    },
    generateBundle() {
      if (this.environment.name !== "ssr") return
      this.emitFile({
        type: "asset",
        fileName: "server.js",
        source: `import server from "./server/server-entry.mjs"\n\nexport default server\n`,
      })
    },
    configureServer(server) {
      // First, so a route such as `/theme.js` is the site's, not a module Vite would transform.
      const site = devHandler(server)
      server.middlewares.use((req, res, next) => {
        isViteRequest(server.config.root, req.url ?? "/", options.isFile).then(
          (vite) => vite ? next() : site(req, res, next),
          next,
        )
      })
    },
  }]
}

/** Every file below `dir`, as paths relative to it with `/` between segments. */
async function listFiles(options: WebsiteOptions, dir: string, prefix = ""): Promise<string[]> {
  const paths: string[] = []
  for await (const entry of options.readDir(dir)) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory) {
      paths.push(...await listFiles(options, join(dir, entry.name), `${path}/`))
    } else paths.push(path)
  }
  return paths
}

/** The client build's stylesheets, script, id and files, read after Vite wrote them. */
async function clientBuild(root: string, options: WebsiteOptions): Promise<WebsiteBuild> {
  const client = join(root, OUT, "client")
  const manifest = JSON.parse(
    new TextDecoder().decode(await options.readFile(join(client, ".vite", "manifest.json"))),
  )
  const entry = manifest[CLIENT_ENTRY]
  const files: Record<string, StaticFile> = {}
  for (const path of (await listFiles(options, client)).sort()) {
    if (path.startsWith(".vite/")) continue
    const bytes = await options.readFile(join(client, ...path.split("/")))
    const hash = encodeHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource))
    const name = `/${path.split("/").map(encodeURIComponent).join("/")}`
    files[name] = {
      filePath: `client/${path}`,
      hash,
      contentType: contentType(extname(path)) ?? "application/octet-stream",
      ...(path.startsWith("assets/") ? { immutable: true } : {}),
    }
  }
  const all = Object.keys(files).sort().map((name) => files[name].hash).join("")
  const buildId = options.buildId ??
    encodeHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(all)))
  // Each module's file and every chunk it imports, for the `Link: rel=modulepreload` header.
  const chunks = (key: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(`/${manifest[key].file}`)) return seen
    seen.add(`/${manifest[key].file}`)
    for (const imported of manifest[key].imports ?? []) chunks(imported, seen)
    return seen
  }
  const islands: Record<string, string[]> = {}
  for (const key of Object.keys(manifest)) {
    if (key.startsWith("islands/")) islands[`./${key}`] = [...chunks(key)]
  }
  return {
    buildId,
    css: (entry.css ?? []).map((file: string) => `/${file}`),
    script: `/${entry.file}`,
    preload: { script: [...chunks(CLIENT_ENTRY)], islands },
    files,
  }
}

/** A request for Vite's client, a module or a file on disk, which Vite answers. */
async function isViteRequest(
  root: string,
  url: string,
  isFile: WebsiteOptions["isFile"],
): Promise<boolean> {
  const { pathname, search } = new URL(url, "http://localhost")
  if (/^\/(@|\.vite\/|node_modules\/)/.test(pathname) || search) return true
  if (pathname.endsWith("/")) return false
  const path = decodeURIComponent(pathname)
  for (const dir of [root, join(root, "static")]) {
    if (await isFile(join(dir, path))) return true
  }
  return false
}

/** Answers the dev server's requests with the website, loaded through Vite. */
function devHandler(server: WebsiteDevServer) {
  return async (
    req: WebsiteNodeRequest,
    res: WebsiteNodeResponse,
    next: (error?: unknown) => void,
  ) => {
    try {
      const entry = await server.ssrLoadModule(join(server.config.root, SERVER_ENTRY)) as {
        default: { fetch: (req: Request, info: unknown) => Promise<Response> }
      }
      const method = req.method ?? "GET"
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) {
        for (const one of [value ?? []].flat()) headers.append(name, one)
      }
      const chunks: Uint8Array[] = []
      if (method !== "GET" && method !== "HEAD") {
        for await (const chunk of req) chunks.push(chunk)
      }
      const request = new Request(
        new URL(req.originalUrl ?? req.url ?? "/", `http://${headers.get("host")}`),
        {
          method,
          headers,
          body: chunks.length ? new Blob(chunks as BlobPart[]) : undefined,
        },
      )
      const response = await entry.default.fetch(request, {
        remoteAddr: {
          transport: "tcp",
          hostname: req.socket.remoteAddress ?? "",
          port: req.socket.remotePort ?? 0,
        },
      })
      res.statusCode = response.status
      for (const [name, value] of response.headers) {
        if (name !== "set-cookie") res.setHeader(name, value)
      }
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader("set-cookie", cookies)
      if (response.body) { for await (const chunk of response.body) res.write(chunk) }
      res.end()
    } catch (error) {
      next(error)
    }
  }
}
