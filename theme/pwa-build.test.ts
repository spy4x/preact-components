import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  buildIdOf,
  requireComponentCss,
  serviceWorker,
  type ViteOutputFile,
  type VitePlugin,
  webManifest,
} from "./vite.ts"

type WriteBundle = NonNullable<VitePlugin["writeBundle"]>

/** The handler of a `writeBundle` hook, whether it is a function or an object. */
const handlerOf = (hook: WriteBundle) => typeof hook === "function" ? hook : hook.handler

/**
 * Runs `writeBundle` as Rollup 4.46.2 does (`PluginDriver.hookParallel`, `node-entry.js:22249`):
 * `pre` hooks, then plain ones, then `post` ones; a `sequential` hook first waits for every hook
 * started before it, and the ones after it wait for it.
 */
async function writeBundleHooks(plugins: VitePlugin[]): Promise<void> {
  const order = (hook: WriteBundle) => typeof hook === "function" ? undefined : hook.order
  const hooks = plugins.flatMap((plugin) => plugin.writeBundle ? [plugin.writeBundle] : [])
  const sorted = [
    ...hooks.filter((hook) => order(hook) === "pre"),
    ...hooks.filter((hook) => order(hook) === undefined),
    ...hooks.filter((hook) => order(hook) === "post"),
  ]
  let running: Promise<void>[] = []
  for (const hook of sorted) {
    if (typeof hook !== "function" && hook.sequential) {
      await Promise.all(running)
      running = []
      await hook.handler.call({})
    } else {
      running.push(handlerOf(hook).call({}))
    }
  }
  await Promise.all(running)
}

/**
 * `vite build` with these plugins, in Vite 7's order: `rollup()` ends with `buildEnd`;
 * `bundle.write()` calls `generateBundle`, writes the files, then calls `writeBundle`; and
 * `bundle.close()`, in a `finally`, calls `closeBundle` even when the build failed.
 */
async function viteBuild(
  plugins: VitePlugin[],
  bundle: Record<string, ViteOutputFile>,
  writeFiles: () => void,
): Promise<void> {
  for (const plugin of plugins) {
    plugin.configResolved?.({ command: "build", root: "/app", build: { outDir: "dist" } })
  }
  try {
    for (const plugin of plugins) plugin.buildEnd?.()
    const context = {
      error(message: string): never {
        throw new Error(message)
      },
    }
    for (const plugin of plugins) plugin.generateBundle?.call(context, {}, bundle)
    writeFiles()
    await writeBundleHooks(plugins)
  } finally {
    await Promise.all(plugins.map((plugin) => plugin.closeBundle?.call({})))
  }
}

/** An in-memory output folder, and the plugins' file access to it. */
function outputFolder() {
  const files = new Map<string, Uint8Array>()
  return {
    files,
    readDir: async function* (dir: string) {
      const names = new Set<string>()
      for (const path of files.keys()) {
        if (path.startsWith(`${dir}/`)) names.add(path.slice(dir.length + 1).split("/")[0]!)
      }
      if (names.size === 0) {
        throw Object.assign(new Error(`No such file or directory: readdir '${dir}'`), {
          name: "NotFound",
        })
      }
      for (const name of names) {
        yield { name, isDirectory: [...files.keys()].some((p) => p.startsWith(`${dir}/${name}/`)) }
      }
    },
    readFile: (path: string) => Promise.resolve(files.get(path)!),
    // A real write finishes later than a read starts, which is what makes the order matter.
    writeTextFile: async (path: string, text: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      files.set(path, new TextEncoder().encode(text))
    },
  }
}

const icons = [
  { src: "/192.png", sizes: "192x192" },
  { src: "/512.png", sizes: "512x512", purpose: "maskable" as const },
]

/** A worker and a manifest plugin over one output folder; the worker is listed first. */
function pwaPlugins(name = "Tasks") {
  const folder = outputFolder()
  const builds: Record<string, unknown>[] = []
  const plugins = [
    serviceWorker({
      entry: "/app/src/sw.ts",
      build: (config) => Promise.resolve(void builds.push(config)),
      readDir: folder.readDir,
      readFile: folder.readFile,
    }),
    webManifest({ manifest: { name, icons }, writeTextFile: folder.writeTextFile }),
  ]
  const writeApp = () => folder.files.set("/app/dist/index.html", new TextEncoder().encode("<p>"))
  const buildId = () => (builds[0]?.define as Record<string, string>).__BUILD_ID__
  return { folder, builds, plugins, writeApp, buildId }
}

describe("serviceWorker and webManifest in a vite build", () => {
  it("leave the CSS guard's error as the build's error, with no output folder written", async () => {
    const { folder, builds, plugins } = pwaPlugins()
    const css: ViteOutputFile = { type: "asset", fileName: "app.css", source: ".app{}" }
    const build = viteBuild([requireComponentCss(), ...plugins], { "app.css": css }, () => {})

    await expect(build).rejects.toThrow("The built CSS lacks the library's classes")
    expect(builds).toEqual([])
    expect([...folder.files.keys()]).toEqual([])
  })

  it("put the manifest in the worker's build id, whatever the plugin order", async () => {
    const { folder, plugins, writeApp, buildId } = pwaPlugins()
    await viteBuild(plugins, {}, writeApp)

    const manifest = folder.files.get("/app/dist/manifest.webmanifest")
    expect(manifest).toBeDefined()
    const expected = await buildIdOf(
      new Map([["/index.html", folder.files.get("/app/dist/index.html")!], [
        "/manifest.webmanifest",
        manifest!,
      ]]),
    )
    expect(buildId()).toBe(JSON.stringify(expected))
  })

  it("give the same build id on every run, and a new one when only the manifest changes", async () => {
    const runs = [pwaPlugins(), pwaPlugins(), pwaPlugins("Tasks and more")]
    for (const run of runs) await viteBuild(run.plugins, {}, run.writeApp)
    const [first, second, renamed] = runs.map((run) => run.buildId())

    expect(second).toBe(first)
    expect(renamed).not.toBe(first)
  })
})
