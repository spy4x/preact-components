/**
 * The built site's static files (`static/` and the client build), with Fresh 2's cache rules, so
 * caches and CDNs see the same headers as they did from Fresh:
 *
 * - `ETag: W/"<sha-256>"`, and `304` for a matching `If-None-Match`;
 * - a year, `immutable`, for an address that carries this build's id (`asset()` in `render.tsx`)
 *   and for the client build's hashed files under `/assets/`; no caching for any other;
 * - an address with another build's id answers `307` to the same address without it;
 * - a method other than `GET` and `HEAD` answers `405`.
 *
 * The server entry hands it the build's list (`setStaticFiles`); without one, as in development,
 * where Vite serves the files, and in tests, it passes every request on.
 *
 * @module
 */
import { HttpError, type Middleware } from "./app.ts"
import { BUILD_ID_KEY, buildId } from "./render.tsx"

/** One file of the build, as the build lists it (the `website()` Vite plugin). */
export interface StaticFile {
  /** Path relative to the build's folder, such as `client/favicon.svg`. */
  filePath: string
  /** Hex SHA-256 of the contents. */
  hash: string
  /** The `Content-Type` it is sent with. */
  contentType: string
  /** True for a file whose name holds its hash. */
  immutable?: boolean
}

/**
 * A file opened for streaming; the shape of `StaticFileHandle` in `@spy4x/server/static`, so its
 * `denoStaticFs` fits {@link StaticBuild.fs} as it is.
 */
export interface StaticFileHandle {
  /** Size in bytes, sent as `Content-Length`. */
  size: number
  /** The contents, read as the response body is consumed. */
  body: ReadableStream<Uint8Array>
  /** Releases the file; called for a `HEAD` request, whose body is never read. */
  close: () => void
}

/** What the server entry hands {@link setStaticFiles}: the build's list and how to open a file. */
export interface StaticBuild {
  /** The build's files, keyed by their address, such as `/favicon.svg`. */
  files: Readonly<Record<string, StaticFile>>
  /** The build's folder, which `StaticFile.filePath` is relative to. */
  root: string
  /** Opens a file, or resolves to `null` when there is none at `path`. */
  fs: { open: (path: string) => Promise<StaticFileHandle | null> }
}

let BUILD: StaticBuild | null = null

/** The build's files; the server entry calls it once. */
export function setStaticFiles(build: StaticBuild | null): void {
  BUILD = build
}

/** Answer with the file at the request's path, when the build has one; else the next step. */
export function staticFiles<S>(): Middleware<S> {
  return async (ctx) => {
    if (BUILD === null) return ctx.next()
    const { files, root, fs } = BUILD
    let pathname: string
    try {
      pathname = `/${
        decodeURIComponent(ctx.url.pathname).split("/").filter(Boolean).map(encodeURIComponent)
          .join("/")
      }`
    } catch (error) {
      if (!(error instanceof URIError)) throw error
      return ctx.next()
    }
    const file = Object.hasOwn(files, pathname) ? files[pathname] : undefined
    if (pathname === "/" || !file) {
      if (pathname === "/favicon.ico") return new Response(null, { status: 404 })
      return ctx.next()
    }
    const method = ctx.req.method
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 })
    }
    const key = ctx.url.searchParams.get(BUILD_ID_KEY)
    if (key !== null && key !== buildId()) {
      const url = new URL(ctx.url)
      url.searchParams.delete(BUILD_ID_KEY)
      return new Response(null, { status: 307, headers: { location: url.pathname + url.search } })
    }
    const headers = new Headers({ "Content-Type": file.contentType, vary: "If-None-Match" })
    const ifNoneMatch = ctx.req.headers.get("If-None-Match")
    if (ifNoneMatch === file.hash || ifNoneMatch === `W/"${file.hash}"`) {
      return new Response(null, { status: 304, headers })
    }
    headers.set("Etag", `W/"${file.hash}"`)
    headers.append(
      "Cache-Control",
      key !== null || file.immutable
        ? "public, max-age=31536000, immutable"
        : "no-cache, no-store, max-age=0, must-revalidate",
    )
    const handle = await fs.open(`${root}/${file.filePath}`)
    if (!handle) throw new HttpError(404)
    headers.set("Content-Length", String(handle.size))
    if (method === "HEAD") {
      handle.close()
      return new Response(null, { headers })
    }
    return new Response(handle.body, { headers })
  }
}
