/**
 * Static server for the built demo.
 *
 * GitHub Pages mounts a project site at `/<repo>/`, so the artefact is served under the same base
 * here. A check that read `dist/index.html` from the filesystem root would never exercise the
 * prefixed asset paths the deployed page depends on.
 *
 * `deno task preview` serves it at http://127.0.0.1:8080/preact-components/.
 */

import { dirname, extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_BASE, normalizeBase } from "./src/site.ts"

/** Content types the artefact can contain. Anything else is served as bytes. */
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
}

/** A running preview server. */
export interface PreviewServer {
  /** Port it actually bound, which is the requested one unless that was 0. */
  port: number
  /** Absolute URL of the page, base included. */
  url: string
  /** Stop listening. */
  close(): Promise<void>
}

/**
 * Serve `distDirectory` under `base`.
 *
 * @param distDirectory Directory built by `build.ts`.
 * @param base Path to mount it at, with a leading and trailing slash.
 * @param port Port to bind; 0 picks a free one.
 * @returns The running server, and the URL the page is reachable at.
 */
export async function serveDist(
  distDirectory: string,
  base: string,
  port = 0,
): Promise<PreviewServer> {
  let listening: (address: { port: number }) => void = () => {}
  const address = new Promise<{ port: number }>((resolve) => listening = resolve)

  const server = Deno.serve(
    { port, hostname: "127.0.0.1", onListen: (bound) => listening(bound) },
    (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      if (!path.startsWith(base)) {
        return new Response("not found", { status: 404 })
      }

      return serveFile(distDirectory, path.slice(base.length))
    },
  )

  const bound = await address
  return {
    port: bound.port,
    url: `http://127.0.0.1:${bound.port}${base}`,
    close: () => server.shutdown(),
  }
}

/** Read one file out of the artefact, refusing anything that escapes it. */
async function serveFile(distDirectory: string, relativePath: string): Promise<Response> {
  const requested = relativePath === "" || relativePath.endsWith("/")
    ? `${relativePath}index.html`
    : relativePath

  const resolved = normalize(join(distDirectory, requested))
  if (!resolved.startsWith(normalize(distDirectory))) {
    return new Response("forbidden", { status: 403 })
  }

  try {
    const body = await Deno.readFile(resolved)
    return new Response(body, {
      headers: { "content-type": CONTENT_TYPES[extname(resolved)] ?? "application/octet-stream" },
    })
  } catch {
    return new Response("not found", { status: 404 })
  }
}

if (import.meta.main) {
  const here = dirname(fileURLToPath(import.meta.url))
  const base = normalizeBase(Deno.env.get("PAGES_BASE") ?? DEFAULT_BASE)
  const port = Number(Deno.args[0] ?? 8080)

  const server = await serveDist(join(here, "dist"), base, port)
  console.log(`serving ${join(here, "dist")} at ${server.url}`)
}
