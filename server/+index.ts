/**
 * `@spy4x/preact-server` — a small website server with Fresh 2's API shape: routes, middleware,
 * layouts, pages rendered with Preact, islands woken in the browser, and static files with
 * Fresh's cache rules. Web standards only, so it runs on Deno, Node and Bun.
 *
 * The browser half is `@spy4x/preact-server/client`, the build half `@spy4x/preact-server/vite`.
 *
 * @module
 */
export {
  App,
  type AppConfig,
  Context,
  createDefine,
  type HandlerByMethod,
  type HandlerFn,
  HttpError,
  type Middleware,
  page,
  type PageComponent,
  type PageProps,
  type PageResponse,
  type RouteHandler,
  type RouteModule,
  type ServeInfo,
} from "./app.ts"
export type { WebsiteBuild } from "./build.ts"
export { fsRoutes } from "./fs-routes.ts"
export {
  asset,
  type Assets,
  Head,
  type IslandRef,
  type Preload,
  registerIslands,
  setAssets,
} from "./render.tsx"
export {
  setStaticFiles,
  type StaticBuild,
  type StaticFile,
  type StaticFileHandle,
  staticFiles,
} from "./static.ts"
