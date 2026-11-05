/**
 * Renders a page the way Fresh 2 does, so a site moved off Fresh keeps the same HTML:
 *
 * - the page renders first, inside its layouts; then the app wrapper renders around its HTML;
 * - `<Head>` children replace the wrapper's `<head>` element with the same key (`<title>`, a
 *   `<meta>` with the same name), and the rest go at the end of `<head>`, after the stylesheets;
 * - a component {@link registerIslands} registered is an island: its HTML is marked with comments,
 *   its props go to the browser as JSON, and the client script wakes it (`client.ts`);
 * - an `<img>` or `<source>` address on this site carries the build id, so it can be cached for a
 *   year (`static.ts`);
 * - a link to the current page gets `aria-current="page"`, one to an ancestor `aria-current`.
 *
 * @module
 */
import {
  type ComponentChildren,
  type ComponentType as PreactComponentType,
  createContext,
  Fragment,
  h,
  isValidElement,
  options,
  type VNode as PreactVNode,
} from "preact"
import { useContext } from "preact/hooks"
import { jsxTemplate } from "preact/jsx-runtime"
import { renderToString } from "preact-render-to-string"
import type { Context, PageComponent } from "./app.ts"

// The renderer handles elements of every kind, whatever their props.
// deno-lint-ignore no-explicit-any
type VNode = PreactVNode<any>
// deno-lint-ignore no-explicit-any
type ComponentType = PreactComponentType<any>

/** What the build tells the renderer: the stylesheets, the client script and the build id. */
export interface Assets {
  buildId: string
  /** Stylesheets every page links. */
  css: string[]
  /** The client script, loaded on a page with an island; in development, on every page. */
  script: string | null
  /** The chunks to preload with the client script and with each island's file; none in development. */
  preload: Preload | null
  /** Scripts development needs on every page (Vite's client). */
  devScripts: string[]
}

/** The chunks a page with islands preloads, from the client build's manifest. */
export interface Preload {
  script: string[]
  islands: Record<string, string[]>
}

let ASSETS: Assets = { buildId: "dev", css: [], script: null, preload: null, devScripts: [] }

/** Sets what the build produced; the server entry calls it once. */
export function setAssets(assets: Assets): void {
  ASSETS = assets
}

/** The build id, for the static files' cache rule. */
export function buildId(): string {
  return ASSETS.buildId
}

/** An island: a component the client wakes, by its file and export. */
export interface IslandRef {
  file: string
  exportName: string
}

const ISLANDS = new Map<unknown, IslandRef>()

/** Registers the exports of `islands/` files, each a component the browser wakes. */
export function registerIslands(modules: Record<string, Record<string, unknown>>): void {
  for (const [file, module] of Object.entries(modules)) {
    for (const [exportName, value] of Object.entries(module)) {
      if (typeof value === "function" && !ISLANDS.has(value)) {
        ISLANDS.set(value, { file, exportName })
      }
    }
  }
}

interface RenderState {
  url: URL
  head: Map<string, VNode>
  islands: { file: string; exportName: string; props: Record<string, unknown> }[]
  islandDepth: number
  renderedHead: boolean
}

let STATE: RenderState | null = null

const HeadContext = createContext(false)

/** Its children go into the page's `<head>`, as Fresh's `Head`. */
export function Head({ children }: { children?: ComponentChildren }): VNode {
  return h(HeadContext.Provider, { value: true }, children)
}

const HEAD_TAGS = new Set([
  "title",
  "meta",
  "link",
  "script",
  "style",
  "base",
  "noscript",
  "template",
])

/** Vnodes this file made, which the hook leaves alone. */
const OWN = new WeakSet<VNode>()
/** An island's own vnode: what renders inside it is not an island again. */
const ISLAND_ROOTS = new WeakSet<VNode>()

// deno-lint-ignore no-explicit-any
type Hook = ((vnode: any) => void) | undefined
// deno-lint-ignore no-explicit-any
const hooks = options as any as Record<string, Hook>
const oldDiff = hooks.__b
const oldDiffed = hooks.diffed

hooks.__b = (vnode: VNode) => {
  if (STATE !== null && !OWN.has(vnode)) patch(STATE, vnode)
  if (ISLAND_ROOTS.has(vnode) && STATE) STATE.islandDepth++
  oldDiff?.(vnode)
}

hooks.diffed = (vnode: VNode) => {
  if (ISLAND_ROOTS.has(vnode) && STATE) STATE.islandDepth--
  oldDiffed?.(vnode)
}

function patch(state: RenderState, vnode: VNode): void {
  const type = vnode.type
  // deno-lint-ignore no-explicit-any
  const props = vnode.props as Record<string, any>
  if (typeof type === "function") {
    const island = ISLANDS.get(type)
    if (!island || state.islandDepth > 0) return
    vnode.type = (props: Record<string, unknown>) => {
      const index = state.islands.push({ ...island, props: islandProps(island, props) }) - 1
      const root = h(type as ComponentType, props)
      ISLAND_ROOTS.add(root)
      OWN.add(root)
      return [
        raw(`<!--island:${index}-->`),
        root,
        raw(`<!--/island:${index}-->`),
      ]
    }
    return
  }
  if (typeof type !== "string") return
  if (type === "a") setActiveUrl(props, state.url)
  if (type === "img" || type === "source") hashAssets(props)
  if (type === "head") {
    state.renderedHead = true
    props.children = [props.children, h(HeadEnd, {})]
    return
  }
  if (type === "body") {
    props.children = [props.children, h(BodyEnd, {})]
    return
  }
  if (!HEAD_TAGS.has(type)) return
  const key = headKey(type, vnode.key, props)
  vnode.type = (props: Record<string, unknown>) => {
    const inHead = useContext(HeadContext)
    const own = h(type, props)
    OWN.add(own)
    if (inHead) {
      state.head.set(key, own)
      return null
    }
    const replacement = state.head.get(key)
    if (replacement) {
      state.head.delete(key)
      return replacement
    }
    return own
  }
}

/** Fresh's key for a head element: its explicit key, else its tag and attributes. */
function headKey(type: string, key: unknown, props: Record<string, unknown>): string {
  if (key != null) return String(key)
  if (type === "title") return "title"
  let found = type
  for (const name of Object.keys(props).sort()) {
    if (name === "children" || name === "nonce" || name === "ref") continue
    if (name === "dangerouslySetInnerHTML") {
      found += String((props[name] as { __html: unknown }).__html)
    } else if (!(type === "meta" && name === "content") && !(type === "link" && name === "href")) {
      found += `::${props[name]}`
    }
  }
  return found
}

/** The stylesheets and the `<Head>` elements no wrapper element replaced. */
function HeadEnd(): VNode {
  const state = STATE!
  const items: VNode[] = ASSETS.css.map((href) =>
    h("link", { rel: "stylesheet", href: asset(href) })
  )
  items.push(...state.head.values())
  state.head.clear()
  return own(h(Fragment, {}, items))
}

/** The islands' props and the client script, when the page has an island. */
function BodyEnd(): VNode | null {
  const state = STATE!
  const scripts: VNode[] = ASSETS.devScripts.map((src) => h("script", { type: "module", src }))
  if (state.islands.length > 0) {
    scripts.push(h("script", {
      type: "application/json",
      id: "__islands",
      dangerouslySetInnerHTML: { __html: islandJson(state.islands) },
    }))
  }
  if (ASSETS.script && (state.islands.length > 0 || ASSETS.devScripts.length > 0)) {
    scripts.push(h("script", { type: "module", src: ASSETS.script }))
  }
  return scripts.length ? own(h(Fragment, {}, scripts)) : null
}

function own(vnode: VNode): VNode {
  OWN.add(vnode)
  return vnode
}

function raw(html: string): VNode {
  // deno-lint-ignore no-explicit-any
  return own(jsxTemplate([html]) as any)
}

/** JSON for a `<script>`: `<` escaped, so no text in it can close the element. */
function islandJson(islands: RenderState["islands"]): string {
  return JSON.stringify(islands).replaceAll("<", "\\u003c")
}

/** An island's props, refused when JSON cannot carry them to the browser. */
function islandProps(island: IslandRef, props: Record<string, unknown>): Record<string, unknown> {
  JSON.stringify(props, (key, value) => {
    if (typeof value === "function" || isValidElement(value) || key === "children") {
      throw new Error(
        `Island ${island.file}#${island.exportName}: prop "${key}" cannot reach the browser; ` +
          "pass plain data",
      )
    }
    return value
  })
  return props
}

// Fresh's asset() and active-link rules, kept so the HTML stays the same.

function hashAssets(props: Record<string, unknown>): void {
  if (props["data-fresh-disable-lock"]) return
  if (typeof props.src === "string") props.src = asset(props.src)
  if (typeof props.srcset === "string" && !props.srcset.includes("(")) {
    props.srcset = props.srcset.split(",").map((part) => {
      const trimmed = part.trimStart()
      const end = trimmed.indexOf(" ") === -1 ? trimmed.length : trimmed.indexOf(" ")
      return part.slice(0, part.length - trimmed.length) + asset(trimmed.slice(0, end)) +
        trimmed.slice(end)
    }).join(",")
  }
}

/** The query key that marks an address with the build id. */
export const BUILD_ID_KEY = "__v"

/** `path` with the build id, when it is a path on this site. */
export function asset(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path
  const url = new URL(path, "https://asset.local")
  if (url.host !== "asset.local" || url.searchParams.has(BUILD_ID_KEY)) return path
  url.searchParams.set(BUILD_ID_KEY, ASSETS.buildId)
  return url.pathname + url.search + url.hash
}

function setActiveUrl(props: Record<string, unknown>, url: URL): void {
  const href = props.href
  if (typeof href !== "string" || !href.startsWith("/") || props["aria-current"] !== undefined) {
    return
  }
  const needle = new URL(href, "http://localhost")
  const trim = (path: string) => path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path
  const current = trim(url.pathname)
  const target = trim(needle.pathname)
  if (current === target) {
    if (needle.search && needle.search !== url.search) {
      props["data-ancestor"] = "true"
      props["aria-current"] = "true"
    } else {
      props["data-current"] = "true"
      props["aria-current"] = "page"
    }
  } else if (current.startsWith(`${target}/`) || target === "/") {
    props["data-ancestor"] = "true"
    props["aria-current"] = "true"
  }
}

/** Renders `vnode` in `layouts` and `app` into an HTML response. */
export function renderPage<S>(
  ctx: Context<S>,
  vnode: VNode | null,
  layouts: PageComponent<S>[],
  app: PageComponent<S> | null,
  init: ResponseInit,
): Promise<Response> {
  let tree: VNode | null = vnode
  for (let i = layouts.length - 1; i >= 0; i--) {
    const child = tree
    tree = h(layouts[i] as ComponentType, ctx.pageProps(null, () => child))
  }
  const previous = STATE
  STATE = { url: ctx.url, head: new Map(), islands: [], islandDepth: 0, renderedHead: false }
  try {
    let html = renderToString(tree ?? h(Fragment, {}))
    if (app) {
      const page = raw(html)
      html = renderToString(h(app as ComponentType, ctx.pageProps(null, () => page)))
    }
    const headers = new Headers(init.headers)
    headers.set("content-type", "text/html; charset=utf-8")
    // As Fresh did: the browser fetches the client script and the islands' chunks while it parses.
    const preload = ASSETS.preload
    if (preload && STATE.islands.length > 0) {
      const urls = new Set(preload.script)
      for (const { file } of STATE.islands) {
        for (const url of preload.islands[file] ?? []) urls.add(url)
      }
      headers.append(
        "Link",
        [...urls].map((url) => `<${encodeURI(url)}>; rel="modulepreload"; as="script"`).join(", "),
      )
    }
    return Promise.resolve(
      new Response(`<!DOCTYPE html>${html}`, {
        status: init.status ?? 200,
        statusText: init.statusText,
        headers,
      }),
    )
  } finally {
    STATE = previous
  }
}
