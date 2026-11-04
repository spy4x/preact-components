# `@spy4x/preact-server`

A small server for a public website, with Fresh 2's API shape: routes, middleware, layouts, pages
rendered with Preact, islands woken in the browser, and static files with Fresh's cache rules. A
site moved off Fresh keeps its routes, its HTML and its cache headers. Web standards only, so the
server runs on Deno, Node and Bun.

Three entry points, one per place the code runs:

| Entry point                   | Runs in        | Holds                                         |
| ----------------------------- | -------------- | --------------------------------------------- |
| `@spy4x/preact-server`        | the server     | the app, routing, rendering, static files     |
| `@spy4x/preact-server/client` | the browser    | `hydrateIslands`; imports nothing of the rest |
| `@spy4x/preact-server/vite`   | the Vite build | the `website` plugin                          |

## A site in four files

```ts
// main.ts — the app
import { App, fsRoutes, staticFiles } from "@spy4x/preact-server"

export const app = new App<State>({ mode: import.meta.env?.DEV ? "development" : "production" })
app.use(staticFiles())
await fsRoutes(app, import.meta.glob(["./routes/**/*.{ts,tsx}", "!**/*.test.*"]))
```

```ts
// server-entry.ts — what the build bundles and the runtime serves
import { registerIslands, setAssets, setStaticFiles, type WebsiteBuild } from "@spy4x/preact-server"
import { app } from "./main.ts"

declare const __WEBSITE_BUILD__: WebsiteBuild | null
const build = __WEBSITE_BUILD__

registerIslands(import.meta.glob(["./islands/**/*.tsx", "!**/*.test.*"], { eager: true }))
setAssets(
  build ? { ...build, devScripts: [] } : {
    buildId: "dev",
    css: ["/styles.css"],
    script: "/client.ts",
    preload: null,
    devScripts: ["/@vite/client"],
  },
)
setStaticFiles(build && { files: build.files, root: "/path/to/dist", fs: staticFs })

export default { fetch: app.handler() }
```

```ts
// client.ts — the browser entry
import "./styles.css"
import { hydrateIslands } from "@spy4x/preact-server/client"

hydrateIslands(import.meta.glob(["./islands/**/*.tsx", "!**/*.test.*"]))
```

```ts
// vite.config.ts — on Deno; on Node pass `fs/promises` readers of the same shape
import { website } from "@spy4x/preact-server/vite"

export default defineConfig({
  plugins: [
    website({
      readDir: Deno.readDir,
      readFile: Deno.readFile,
      isFile: (path) => Deno.stat(path).then((info) => info.isFile, () => false),
      buildId: Deno.env.get("CI_COMMIT_SHA"),
    }),
  ],
})
```

`staticFs` is anything with `open(path)` resolving to `{ size, body, close }` or `null`, such as
`denoStaticFs` from `@spy4x/server/static`.

## The server

- `App` — the app: `use(...middlewares)`, `get`, `post`, `all`, `route(path, module)`,
  `layout(path, component)`, `appWrapper(component)` and `handler()`, the `fetch` function for
  `Deno.serve`, `Bun.serve` or Hono's Node server. A path takes `:name`, an optional `:name?`
  anywhere, and `*` for the rest. `get` and `post` on one path share a route, a `HEAD` request
  runs the `GET` handler, a method with no handler answers `405`, and an error no middleware
  caught answers its `HttpError` status, or a plain `500`.
- `Context` — what each step receives: `req`, `url` (repeated slashes collapsed), `params`,
  `state`, `next()`, `render(vnode)`, `text`, `html`, and `redirect(path)`, which collapses
  repeated slashes so `//evil.example/` stays on this site.
- `HttpError` — an error with an HTTP status, `new HttpError(404)`.
- `createDefine()` — typed identity helpers `page`, `layout`, `middleware` and `handlers`, as
  Fresh's `createDefine`.
- `page(data, { status, headers })` — what a handler returns to give its page data.
- `compilePath(path)` — the regular expression a route path compiles to.
- `runRoute(ctx, module)` — runs a route module: its handler for the method, then its page.
- `fsRoutes(app, files)` — Fresh's `routes/` folder conventions over an `import.meta.glob`:
  `[x]`, `[[x]]` and `[...x]` segments, `_middleware`, `_layout` and `_app` files. A more specific
  route wins: `/pricing` is the pricing page, not a language called `pricing` under `[[lang]]`.

## Rendering

- `Head` — its children go into the page's `<head>`: a `<title>`, or a `<meta>` with the same
  name, replaces the wrapper's, the rest go at the end, after the stylesheets.
- `asset(path)` — `path` with the build id (`?__v=…`), so it can be cached for a year. Every
  `<img>` and `<source>` on this site gets it on its own.
- `BUILD_ID_KEY` — that query key, `__v`.
- `buildId()` — the current build id.
- `setAssets(assets)` — the stylesheets, the client script, the preload chunks and the build id;
  the server entry calls it once.
- `registerIslands(modules)` — every function these modules export becomes an island: its HTML is
  marked `<!--island:N-->…<!--/island:N-->`, its props go to the browser as JSON in
  `<script id="__islands">`, and the page loads the client script with a `Link: rel=modulepreload`
  header for its chunks. A page with no island loads no script. A prop JSON cannot carry, such as
  a function, fails the render.
- A link to the current page gets `aria-current="page"`, one to an ancestor `aria-current="true"`.

## Static files

- `staticFiles()` — middleware that answers with the build's files: a weak `ETag` and `304` for a
  match, a year and `immutable` for an address with this build's id and for `/assets/`, no caching
  otherwise, `307` for another build's id and `405` for a method other than `GET` and `HEAD`.
- `setStaticFiles(build)` — the build's file list, its folder and how to open a file. Without one,
  as in development, `staticFiles()` passes every request on.

## The browser

- `hydrateIslands(loaders)` — wakes each island of the page in place, loading only the modules
  the page lists.

## The build

- `website(options)` — the Vite plugin. `vite build` writes `dist/client/` (`static/` and the
  hashed client code) and `dist/server.js` with the server bundle; `vite` serves the site from
  `server-entry.ts` and leaves modules and files on disk to Vite. Its options are the file
  readers (`readDir`, `readFile`, `isFile`) and an optional `buildId`; without one the id is a
  hash of the client files.
- `BUILD_PLACEHOLDER` — `__WEBSITE_BUILD__`, the name the plugin replaces in `server-entry.ts`
  with the build's `WebsiteBuild`, or with `null` under the dev server.
