/**
 * A lint rule that keeps a folder of screens pure: props in, callbacks out.
 *
 * It reports a module that imports a signals store, a router or an app's own code, or that reaches
 * for `fetch`, `window` or another browser global. State and transport belong to the app that
 * renders the screen; the screen gets them through props and ports.
 *
 * {@link boundaryPlugin} builds a Deno lint plugin from the lists in {@link BoundaryOptions}, and
 * {@link checkModule} runs that plugin over one module's source and returns what it found. Run it
 * from a test that walks the folder rather than listing the plugin under `lint.plugins` in a
 * workspace's `deno.json`: with a lint plugin in the workspace config, the `deno info` calls a Vite
 * plugin makes at startup stalled on the `node_modules` lock, and the app never started.
 *
 * `checkModule` calls `Deno.lint.runPlugin`, which Deno provides only under `deno test`. The types
 * here describe only the slice of Deno's lint API the rule uses: Deno declares the rest in its
 * unstable library, which a published module may not reference.
 *
 * @module
 */

/** Import sources a screen must not use by default: signals stores and the router. */
export const DEFAULT_FORBIDDEN_PACKAGES: readonly string[] = [
  "@preact/signals",
  "@preact/signals-core",
  "@spy4x/preact-signals",
  "wouter-preact",
]

/** Globals a screen must not read by default: each fetches, routes or reads the page. */
export const DEFAULT_FORBIDDEN_GLOBALS: readonly string[] = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "window",
  "document",
  "location",
  "history",
  "navigator",
  "localStorage",
  "sessionStorage",
]

/** What {@link boundaryPlugin} and {@link checkModule} forbid. Every list is optional. */
export interface BoundaryOptions {
  /**
   * Package names a screen must not import, with or without a `jsr:` or `npm:` prefix; a subpath
   * of one is forbidden too. Defaults to {@link DEFAULT_FORBIDDEN_PACKAGES}.
   */
  forbiddenPackages?: readonly string[]
  /**
   * Import prefixes that point into an app, such as `"@api/"`. A source starting with one is
   * forbidden. Defaults to none: only the app knows its own aliases.
   */
  appAliases?: readonly string[]
  /**
   * Directory names that hold apps, such as `"apps"`. A relative import whose resolved path passes
   * through one is forbidden. Defaults to none.
   */
  appDirectories?: readonly string[]
  /** Global names a screen must not read. Defaults to {@link DEFAULT_FORBIDDEN_GLOBALS}. */
  forbiddenGlobals?: readonly string[]
}

/** One place {@link checkModule} found a module breaking the boundary. */
export interface BoundaryViolation {
  /** Why it is forbidden, ready to print. */
  message: string
  /** Start and end character offsets of the offending node in the source. */
  range: [number, number]
}

/**
 * Why an import source is forbidden for a module at `filename`, or `null` when it is allowed.
 *
 * @param source The import specifier as written.
 * @param filename Absolute path of the importing module; resolves a relative `source`.
 * @param options The lists to check against; see {@link BoundaryOptions} for the defaults.
 */
export function forbiddenImport(
  source: string,
  filename: string,
  options: BoundaryOptions = {},
): string | null {
  const packages = options.forbiddenPackages ?? DEFAULT_FORBIDDEN_PACKAGES
  const bare = source.replace(/^(jsr|npm):/, "")
  const named = packages.some((name) =>
    bare === name || bare.startsWith(`${name}/`) || bare.startsWith(`${name}@`)
  )
  if (named) {
    return `"${source}" is a store or a router; take state as props, report through callbacks.`
  }
  if ((options.appAliases ?? []).some((alias) => source.startsWith(alias))) {
    return `"${source}" is app code; a screen must not import from an app.`
  }
  const directories = options.appDirectories ?? []
  if (source.startsWith(".") && directories.length > 0) {
    const base = filename.replaceAll("\\", "/")
    const resolved = new URL(source, `file://${base.startsWith("/") ? "" : "/"}${base}`).pathname
    const segments = resolved.split("/")
    if (directories.some((directory) => segments.includes(directory))) {
      return `"${source}" is app code; a screen must not import from an app.`
    }
  }
  return null
}

/** One node of Deno's lint syntax tree, as much of it as the rule reads. */
export interface BoundaryLintNode {
  /** The node's kind, such as `"Identifier"` or `"ImportDeclaration"`. */
  type: string
  /** Start and end character offsets in the source. */
  range: [number, number]
  /** The node that contains this one. */
  parent: BoundaryLintNode
  /** Every other field, read by kind. */
  [field: string]: unknown
}

/** What a rule gets from Deno's linter: the file it runs over, and a way to report. */
export interface BoundaryRuleContext {
  /** Absolute path of the module being linted. */
  filename: string
  /** Record one violation at `node`. */
  report(violation: { node: BoundaryLintNode; message: string }): void
}

/** A Deno lint plugin, typed as far as {@link boundaryPlugin} builds one. */
export interface BoundaryLintPlugin {
  /** The plugin name; a rule's id is `<name>/<rule>`. */
  name: string
  /** Each rule builds its node visitors from the context. */
  rules: Record<string, {
    create(context: BoundaryRuleContext): Record<string, (node: BoundaryLintNode) => void>
  }>
}

/** The specifier an import, a re-export or a dynamic import names, when it is a plain string. */
function sourceOf(node: BoundaryLintNode): string | null {
  const source = node.source as { type?: string; value?: unknown } | null | undefined
  if (source?.type !== "Literal" || typeof source.value !== "string") return null
  return source.value
}

/** Whether an identifier here names a variable, rather than a property or a key. */
function isReference(node: BoundaryLintNode): boolean {
  const parent = node.parent
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
    return false
  }
  const keyed = ["Property", "TSPropertySignature", "PropertyDefinition", "MethodDefinition"]
  if (keyed.includes(parent.type) && parent.key === node && !parent.computed) return false
  return true
}

/** Whether an identifier is a property read off the global object, as in `globalThis.fetch`. */
function isGlobalProperty(node: BoundaryLintNode): boolean {
  const parent = node.parent
  if (parent.type !== "MemberExpression" || parent.property !== node) return false
  const object = parent.object as BoundaryLintNode
  return object.type === "Identifier" && (object.name === "globalThis" || object.name === "self")
}

/**
 * Build the Deno lint plugin `ui` with one rule, `boundary`, from the lists in `options`.
 *
 * To lint with it, export the result as the default export of a module of your own and run it with
 * `Deno.lint.runPlugin`, or list that module under `lint.plugins` (see the module note on why a
 * test is the safer place).
 */
export function boundaryPlugin(options: BoundaryOptions = {}): BoundaryLintPlugin {
  const globals = new Set(options.forbiddenGlobals ?? DEFAULT_FORBIDDEN_GLOBALS)
  return {
    name: "ui",
    rules: {
      boundary: {
        create(context) {
          const checkSource = (node: BoundaryLintNode) => {
            const source = sourceOf(node)
            const reason = source === null
              ? null
              : forbiddenImport(source, context.filename, options)
            if (reason) context.report({ node, message: reason })
          }
          return {
            ImportDeclaration: checkSource,
            ExportNamedDeclaration: checkSource,
            ExportAllDeclaration: checkSource,
            ImportExpression: checkSource,
            Identifier(node) {
              const name = node.name as string
              if (!globals.has(name)) return
              if (!isReference(node) && !isGlobalProperty(node)) return
              context.report({
                node,
                message: `"${name}" reaches outside the screen; take it through props instead.`,
              })
            },
          }
        },
      },
    },
  }
}

/** `Deno.lint.runPlugin`, declared here because Deno types it only in its unstable library. */
type RunPlugin = (
  plugin: BoundaryLintPlugin,
  filename: string,
  source: string,
) => { message: string; range: [number, number] }[]

/**
 * Check one module's source against the boundary and return every violation, in source order.
 *
 * Works only under `deno test`, where Deno provides `Deno.lint.runPlugin`; anywhere else it throws.
 *
 * @param source The module's text.
 * @param options The lists to check against, plus `filename`: the module's absolute path, which
 *   resolves relative imports and picks the parser (`.tsx` for JSX). Defaults to `/module.tsx`.
 */
export function checkModule(
  source: string,
  options: BoundaryOptions & { filename?: string } = {},
): BoundaryViolation[] {
  const runPlugin = (Deno as unknown as { lint?: { runPlugin?: RunPlugin } }).lint?.runPlugin
  if (!runPlugin) {
    throw new Error(
      "checkModule needs Deno.lint.runPlugin, which Deno provides only under deno test",
    )
  }
  const filename = options.filename ?? "/module.tsx"
  return runPlugin(boundaryPlugin(options), filename, source)
    .map(({ message, range }) => ({ message, range: [range[0], range[1]] as [number, number] }))
    .sort((a, b) => a.range[0] - b.range[0])
}
