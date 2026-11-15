/**
 * A website's server: routes, middleware and page rendering with Fresh 2's API shape (`define`,
 * `ctx.render`, `ctx.next`, `routes/` conventions), on web standards only, so it runs on Deno,
 * Node and Bun.
 *
 * @module
 */
import { type ComponentType, h, type VNode } from "preact"
import { renderPage } from "./render.tsx"

/** An error with an HTTP status, as Fresh's `HttpError`. */
export class HttpError extends Error {
  /** The response's status. */
  readonly status: number
  constructor(status: number, message: string = STATUS_TEXT[status] ?? "Error") {
    super(message)
    this.name = "HttpError"
    this.status = status
  }
}

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  413: "Content Too Large",
  500: "Internal Server Error",
  502: "Bad Gateway",
}

/** Who sent the request, as the runtime's server reports it. */
export interface ServeInfo {
  /** The client's address. */
  remoteAddr: { transport: string; hostname: string; port: number }
}

/** How the app runs. */
export interface AppConfig {
  /** `development` under the dev server, `production` otherwise. */
  mode: "development" | "production"
}

/** What a page, a layout and the app wrapper receive. */
export interface PageProps<S, D = unknown> {
  /** The content inside this component: the page for a layout, the layouts for the wrapper. */
  Component: ComponentType
  /** How the app runs. */
  config: AppConfig
  /** What the route's handler gave its page. */
  data: D
  /** Who sent the request. */
  info: ServeInfo
  /** The route's parameters, decoded. */
  params: Record<string, string>
  /** The request. */
  req: Request
  /** What middleware put on the context. */
  state: S
  /** The request's address, with repeated slashes collapsed. */
  url: URL
  /** The matched route's pattern, or `null`. */
  route: string | null
}

/** A step of the request chain: answers, or calls `ctx.next()` for the rest. */
export type Middleware<S> = (ctx: Context<S>) => Response | Promise<Response>

/** What a handler may return instead of a response: data and status for its page. */
export interface PageResponse<D> {
  /** What the page receives as `data`. */
  data?: D
  /** The page's status. */
  status?: number
  /** Headers added to the page's response. */
  headers?: HeadersInit
}

/** A route's handler: a response, or data for its page. */
export type HandlerFn<S, D = unknown> = (
  ctx: Context<S>,
) => Response | PageResponse<D> | Promise<Response | PageResponse<D>>

/** A route's handlers by HTTP method, such as `{ GET, POST }`. */
export type HandlerByMethod<S, D = unknown> = Partial<Record<string, HandlerFn<S, D>>>

/** One handler for every method, or one per method. */
export type RouteHandler<S, D = unknown> = HandlerFn<S, D> | HandlerByMethod<S, D>

/** A page, a layout or the app wrapper. */
export type PageComponent<S, D = unknown> = (
  props: PageProps<S, D>,
) => VNode | null | Response | Promise<VNode | null | Response>

/** A route file's exports; `component` is the page's name in `app.route()`, as in Fresh. */
export interface RouteModule<S> {
  /** The page. */
  default?: PageComponent<S>
  /** The page, by another name. */
  component?: PageComponent<S>
  /** The route's handler. */
  handler?: RouteHandler<S>
}

/** Typed identity helpers, as Fresh's `createDefine`. */
export function createDefine<S>(): {
  page<D = unknown>(page: PageComponent<S, D>): PageComponent<S, D>
  layout(layout: PageComponent<S>): PageComponent<S>
  middleware(middleware: Middleware<S>): Middleware<S>
  handlers<D = unknown, H extends RouteHandler<S, D> = RouteHandler<S, D>>(handlers: H): H
} {
  return {
    page: (page) => page,
    layout: (layout) => layout,
    middleware: (middleware) => middleware,
    handlers: (handlers) => handlers,
  }
}

/** Fresh's `page()`: data and response options for a handler to give its page. */
export function page<D>(data?: D, init?: Omit<PageResponse<D>, "data">): PageResponse<D> {
  return { data, ...init }
}

/** One registered route: a pattern, the middleware of its folders and its module. */
interface Route<S> {
  pattern: RegExp
  path: string
  middlewares: Middleware<S>[]
  layouts: PageComponent<S>[]
  module: RouteModule<S> | (() => Promise<RouteModule<S>>)
  /** The handlers by method, for a route `get`, `post` or another method call added. */
  methods?: Record<string, Middleware<S> | undefined>
}

/** The request's context, as Fresh's `Context`. */
export class Context<S> {
  /** The request. */
  readonly req: Request
  /** The request's address, with repeated slashes collapsed. */
  readonly url: URL
  /** Who sent the request. */
  readonly info: ServeInfo
  /** How the app runs. */
  readonly config: AppConfig
  /** The matched route's parameters, decoded. */
  params: Record<string, string> = {}
  /** What middleware puts here for the steps after it. */
  state: S = {} as S
  /** The matched route's pattern, or `null`. */
  route: string | null = null
  /** Runs the rest of the chain. */
  next: () => Promise<Response> = () => Promise.reject(new HttpError(404))
  /** The layouts around the matched route's page, outermost first. */
  layouts: PageComponent<S>[] = []
  readonly #app: PageComponent<S> | null

  constructor(req: Request, info: ServeInfo, config: AppConfig, app: PageComponent<S> | null) {
    this.req = req
    const url = new URL(req.url)
    // As Fresh: repeated slashes collapse before anything routes or reads the path.
    url.pathname = url.pathname.replaceAll(/\/+/g, "/")
    this.url = url
    this.info = info
    this.config = config
    this.#app = app
  }

  /**
   * A redirect. A path that starts with `/` stays on this site: a browser reads `\` as `/` and
   * drops tabs and line breaks, so those go first, then repeated slashes collapse, and
   * `//evil.com/`, `/\evil.com` and `/<tab>/evil.com` all stay here.
   */
  redirect(pathOrUrl: string, status = 302): Response {
    let location = pathOrUrl
    if (pathOrUrl !== "/" && /^[/\\]/.test(pathOrUrl)) {
      pathOrUrl = pathOrUrl.replaceAll(/[\t\r\n]/g, "").replaceAll("\\", "/")
      let at = pathOrUrl.indexOf("?")
      if (at === -1) at = pathOrUrl.indexOf("#")
      const path = at > -1 ? pathOrUrl.slice(0, at) : pathOrUrl
      const rest = at > -1 ? pathOrUrl.slice(at) : ""
      location = `${path.replaceAll(/\/+/g, "/")}${rest}`
    }
    return new Response(null, { status, headers: { location } })
  }

  /** Plain text. */
  text(body: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers)
    if (!headers.has("content-type")) headers.set("content-type", "text/plain;charset=UTF-8")
    return new Response(body, { ...init, headers })
  }

  /** An HTML string, as it is. */
  html(body: string, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers)
    if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8")
    return new Response(body, { ...init, headers })
  }

  /** An HTML page: `vnode` inside the route's layouts and the app wrapper. */
  render(vnode: VNode | null, init: ResponseInit = {}): Promise<Response> {
    return renderPage(this, vnode, this.layouts, this.#app, init)
  }

  /** The props a page, a layout or the app wrapper receives. */
  pageProps<D>(data: D, Component: ComponentType): PageProps<S, D> {
    return {
      Component,
      config: this.config,
      data,
      info: this.info,
      params: this.params,
      req: this.req,
      state: this.state,
      url: this.url,
      route: this.route,
    }
  }
}

const NO_INFO: ServeInfo = { remoteAddr: { transport: "tcp", hostname: "", port: 0 } }

/** The app: middleware, routes and an app wrapper, as Fresh's `App`. */
export class App<S> {
  /** How the app runs. */
  readonly config: AppConfig
  #middlewares: Middleware<S>[] = []
  #routes: Route<S>[] = []
  #layouts: { pattern: RegExp; layout: PageComponent<S> }[] = []
  #app: PageComponent<S> | null = null

  constructor(config: Partial<AppConfig> = {}) {
    this.config = { mode: "production", ...config }
  }

  /** Middleware that runs before every route, in the order added. */
  use(...middlewares: Middleware<S>[]): this {
    this.#middlewares.push(...middlewares)
    return this
  }

  /** A layout around every page whose path `path` matches (`*` for all). */
  layout(path: string, layout: PageComponent<S>): this {
    this.#layouts.push({ pattern: compilePath(path), layout })
    return this
  }

  /** The component around the whole document: `<html>`, `<head>` and `<body>`. */
  appWrapper(component: PageComponent<S>): this {
    this.#app = component
    return this
  }

  /** A `GET` handler at `path`, after the middleware before it. */
  get(path: string, ...handlers: Middleware<S>[]): this {
    return this.#method("GET", path, handlers)
  }

  /** A `POST` handler at `path`, after the middleware before it. */
  post(path: string, ...handlers: Middleware<S>[]): this {
    return this.#method("POST", path, handlers)
  }

  /** A handler for every method at `path`, after the middleware before it. */
  all(path: string, ...handlers: Middleware<S>[]): this {
    return this.#add(path, handlers.slice(0, -1), [], { handler: handlers.at(-1) })
  }

  /**
   * A page or handler module at `path` (`/blog/:slug`, `/:lang?/pricing`, `/s/*`), or a function
   * that loads it, called on the route's first request.
   */
  route(
    path: string,
    module: RouteModule<S> | (() => Promise<RouteModule<S>>),
    options: { middlewares?: Middleware<S>[]; layouts?: PageComponent<S>[] } = {},
  ): this {
    return this.#add(path, options.middlewares ?? [], options.layouts ?? [], module)
  }

  #method(method: string, path: string, handlers: Middleware<S>[]): this {
    // `get` and `post` on one path share a route, so each method finds its handler.
    const methods = { [method]: handlers.at(-1) }
    const same = this.#routes.find((route) =>
      route.path === path && route.methods && route.middlewares.length === handlers.length - 1 &&
      route.middlewares.every((middleware, i) => middleware === handlers[i])
    )
    if (same) {
      Object.assign(same.methods!, methods)
      return this
    }
    this.#add(path, handlers.slice(0, -1), [], { handler: methods })
    this.#routes.at(-1)!.methods = methods
    return this
  }

  #add(
    path: string,
    middlewares: Middleware<S>[],
    layouts: PageComponent<S>[],
    module: RouteModule<S> | (() => Promise<RouteModule<S>>),
  ): this {
    let loaded: Promise<RouteModule<S>> | null = null
    const load = typeof module === "function" ? () => (loaded ??= module()) : null
    this.#routes.push({
      pattern: compilePath(path),
      path,
      middlewares,
      layouts,
      module: load ?? module as RouteModule<S>,
    })
    return this
  }

  /** The request handler, for `Deno.serve`, `Bun.serve` or Hono's Node server. */
  handler(): (req: Request, info?: ServeInfo) => Promise<Response> {
    return async (req, info = NO_INFO) => {
      const ctx = new Context<S>(req, info, this.config, this.#app)
      const matched = this.#match(ctx.url.pathname)
      const chain: Middleware<S>[] = [...this.#middlewares]
      if (matched) {
        const [route, params] = matched
        ctx.params = params
        ctx.route = route.path
        ctx.layouts = [
          ...this.#layouts.filter((it) => it.pattern.test(ctx.url.pathname)).map((it) => it.layout),
          ...route.layouts,
        ]
        const module = route.module
        chain.push(
          ...route.middlewares,
          async (ctx) => runRoute(ctx, typeof module === "function" ? await module() : module),
        )
      }
      const run = (index: number): Promise<Response> => {
        const step = chain[index]
        if (!step) return Promise.reject(new HttpError(404))
        ctx.next = () => run(index + 1)
        return Promise.resolve(step(ctx))
      }
      // An error no middleware turned into a page, as Fresh answers it.
      try {
        return await run(0)
      } catch (error) {
        if (error instanceof HttpError) return new Response(error.message, { status: error.status })
        console.error(error)
        return new Response("Internal Server Error", { status: 500 })
      }
    }
  }

  #match(pathname: string): [Route<S>, Record<string, string>] | undefined {
    for (const route of this.#routes) {
      const found = route.pattern.exec(pathname)
      if (!found) continue
      const params: Record<string, string> = {}
      for (const [name, value] of Object.entries(found.groups ?? {})) {
        params[name] = value === undefined ? "" : safeDecode(value)
      }
      return [route, params]
    }
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * `/blog/:slug` → a regular expression. `:name?` (or `{/:name}?`) is an optional segment anywhere
 * in the path and `*` (or `:name*`) the rest of it.
 */
export function compilePath(path: string): RegExp {
  path = path.replaceAll(/\{\/:(\w+)\}\?/g, "/:$1?")
  if (path === "/" || path === "*") return path === "*" ? /^\/.*$/ : /^\/$/
  let source = ""
  for (const segment of path.split("/").slice(1)) {
    const optional = /^:(\w+)\?$/.exec(segment)
    const rest = /^(?::(\w+))?\*$/.exec(segment)
    const param = /^:(\w+)$/.exec(segment)
    if (optional) source += `(?:/(?<${optional[1]}>[^/]+))?`
    else if (rest) source += `/(?<${rest[1] ?? "path"}>.*)`
    else if (param) source += `/(?<${param[1]}>[^/]+)`
    else source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  }
  // `/:lang?` alone matches `/` too.
  return new RegExp(`^${source || "/"}${source.endsWith(")?") ? "/?" : ""}$`)
}

/** Runs a route module: its handler for the method, then its page. */
export async function runRoute<S>(ctx: Context<S>, module: RouteModule<S>): Promise<Response> {
  const method = ctx.req.method.toUpperCase()
  const handler = module.handler
  let result: Response | PageResponse<unknown> = { data: {} }
  if (typeof handler === "function") {
    result = await handler(ctx)
  } else if (handler) {
    const fn = handler[method] ?? (method === "HEAD" ? handler.GET : undefined)
    if (fn) result = await fn(ctx)
    else if (!(module.default ?? module.component) || (method !== "GET" && method !== "HEAD")) {
      throw new HttpError(405)
    }
  } else if (method !== "GET" && method !== "HEAD") {
    throw new HttpError(405)
  }
  if (result instanceof Response) return result
  const Page = module.default ?? module.component
  if (!Page) throw new HttpError(404)
  const props = ctx.pageProps(result.data, () => null)
  // An async page is called for its vnode, as in Fresh; any other renders as a component, so its
  // hooks work.
  const rendered = Page.constructor.name === "AsyncFunction"
    ? await Page(props)
    : h(Page as ComponentType<PageProps<S>>, props)
  if (rendered instanceof Response) return rendered
  return ctx.render(rendered as VNode | null, { status: result.status, headers: result.headers })
}
