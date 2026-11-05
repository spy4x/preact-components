/**
 * Fresh's `routes/` conventions on top of `App`:
 *
 * - `routes/a/b.tsx` serves `/a/b`, `index.tsx` its folder, `[x]` a segment as `params.x`,
 *   `[[x]]` an optional segment, `[...x]` the rest of the path;
 * - `_middleware.ts` (its `handler`) runs before every route in its folder and below;
 * - `_layout.tsx` wraps every page in its folder and below; `_app.tsx` wraps the whole document;
 * - a more specific route wins: a fixed segment before `[x]`, before `[[x]]`, before `[...x]`.
 *
 * @module
 */
import type { App, Middleware, PageComponent, RouteModule } from "./app.ts"

/** A route file's exports, loaded when its route is first asked for. */
type Lazy<S> = () => Promise<RouteModule<S> & { handler?: unknown }>

interface FsRoute<S> {
  path: string
  segments: string[]
  dir: string
  load: Lazy<S>
}

/**
 * Adds every file of `files` (from `import.meta.glob("./routes/**\/*.{ts,tsx}")`, keyed
 * `./routes/…`) to `app`.
 */
export async function fsRoutes<S>(
  app: App<S>,
  files: Record<string, Lazy<S>>,
): Promise<void> {
  const middlewares = new Map<string, Middleware<S>[]>()
  const layouts = new Map<string, PageComponent<S>>()
  const routes: FsRoute<S>[] = []
  for (const [key, load] of Object.entries(files)) {
    const file = key.replace(/^\.\/routes\//, "").replace(/\.tsx?$/, "")
    if (file.endsWith(".test")) continue
    const parts = file.split("/")
    const name = parts.pop()!
    const dir = parts.join("/")
    if (name === "_app") {
      const page = (await load()).default
      if (page) app.appWrapper(page)
    } else if (name === "_layout") {
      const page = (await load()).default
      if (page) layouts.set(dir, page)
    } else if (name === "_middleware") {
      const { handler } = await load()
      const list = Array.isArray(handler) ? handler : [handler]
      middlewares.set(dir, list as Middleware<S>[])
    } else if (!name.startsWith("_")) {
      const segments = (name === "index" ? parts : [...parts, name]).map(segment)
      routes.push({ path: `/${segments.join("/")}`, segments, dir, load })
    }
  }
  routes.sort((a, b) => compareRoutes(a.segments, b.segments))
  for (const route of routes) {
    const scopes = ["", ...route.dir.split("/").map((_, i, all) => all.slice(0, i + 1).join("/"))]
    const unique = [...new Set(scopes)]
    // The module loads on the first request, as in Fresh.
    app.route(route.path, route.load, {
      middlewares: unique.flatMap((dir) => middlewares.get(dir) ?? []),
      layouts: unique.flatMap((dir) => layouts.get(dir) ?? []),
    })
  }
}

/** `[x]` → `:x`, `[[x]]` → `:x?`, `[...x]` → `:x*`. */
function segment(part: string): string {
  return part
    .replace(/^\[\[(\w+)\]\]$/, ":$1?")
    .replace(/^\[\.\.\.(\w+)\]$/, ":$1*")
    .replace(/^\[(\w+)\]$/, ":$1")
}

function rank(segment: string): number {
  if (!segment.startsWith(":")) return 0
  if (segment.endsWith("*")) return 3
  if (segment.endsWith("?")) return 2
  return 1
}

/**
 * A path with no parameter first, as Fresh checks those before the others; then the path with
 * more fixed segments; then a fixed segment before `:x`, before `:x?`, before `:x*`; then the
 * longer path.
 */
function compareRoutes(a: string[], b: string[]): number {
  const fixed = Number(b.every((s) => rank(s) === 0)) - Number(a.every((s) => rank(s) === 0))
  if (fixed !== 0) return fixed
  // `/:lang?/pricing` before `/:lang`, so `/pricing` is the page, not a language.
  const statics = (s: string[]) => s.filter((part) => rank(part) === 0).length
  const more = statics(b) - statics(a)
  if (more !== 0) return more
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const diff = rank(a[i]) - rank(b[i])
    if (diff !== 0) return diff
  }
  return b.length - a.length
}
