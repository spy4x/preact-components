import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { buildIdOf, serviceWorker, type ServiceWorkerOptions, type ViteMiddleware } from "./vite.ts"

const bytes = (text: string) => new TextEncoder().encode(text)

describe(`buildIdOf`, () => {
  it(`changes when the content of a file changes`, async () => {
    const before = await buildIdOf(new Map([[`/index.html`, bytes(`a`)]]))
    const after = await buildIdOf(new Map([[`/index.html`, bytes(`b`)]]))
    expect(before).not.toBe(after)
  })

  it(`changes when a file is renamed`, async () => {
    const before = await buildIdOf(new Map([[`/a.js`, bytes(`x`)]]))
    const after = await buildIdOf(new Map([[`/b.js`, bytes(`x`)]]))
    expect(before).not.toBe(after)
  })

  it(`is the same for the same files in any order`, async () => {
    const one = await buildIdOf(new Map([[`/a`, bytes(`1`)], [`/b`, bytes(`2`)]]))
    const two = await buildIdOf(new Map([[`/b`, bytes(`2`)], [`/a`, bytes(`1`)]]))
    expect(one).toBe(two)
  })

  it(`is twelve hex digits`, async () => {
    expect(await buildIdOf(new Map())).toMatch(/^[0-9a-f]{12}$/)
  })
})

/** An in-memory output folder and a recording `build`. */
function fixture(files: Record<string, string>, extra: Partial<ServiceWorkerOptions> = {}) {
  const calls: Record<string, unknown>[] = []
  const options: ServiceWorkerOptions = {
    entry: `/app/src/sw.ts`,
    build: (config) => {
      calls.push(config)
      return Promise.resolve()
    },
    plugins: [`a-plugin`],
    readDir: async function* (dir) {
      const prefix = dir === `/app/dist` ? `` : dir.slice(`/app/dist/`.length) + `/`
      const seen = new Set<string>()
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue
        const name = path.slice(prefix.length).split(`/`)[0]
        if (seen.has(name)) continue
        seen.add(name)
        yield { name, isDirectory: path.slice(prefix.length).includes(`/`) }
      }
    },
    readFile: (path) => Promise.resolve(bytes(files[path.slice(`/app/dist/`.length)])),
    ...extra,
  }
  return { calls, plugin: serviceWorker(options) }
}

async function run(plugin: ReturnType<typeof serviceWorker>, outDir = `dist`) {
  plugin.configResolved!({ command: `build`, root: `/app`, build: { outDir } })
  plugin.buildEnd!()
  await plugin.closeBundle!.call({})
}

const define = (call: Record<string, unknown>) => call.define as Record<string, string>

describe(`serviceWorker`, () => {
  it(`builds nothing when the dev server shuts down`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` })
    plugin.configResolved!({ command: `serve`, root: `/app`, build: { outDir: `dist` } })
    await plugin.closeBundle!.call({})
    expect(calls).toHaveLength(0)
  })

  it(`skips the worker when the app build failed, so the app's error is the one reported`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` })
    plugin.configResolved!({ command: `build`, root: `/app`, build: { outDir: `dist` } })
    plugin.buildEnd!(new Error(`the app failed`))
    await plugin.closeBundle!.call({})
    expect(calls).toHaveLength(0)
  })

  it(`fails when the output folder is missing, rather than ship no worker`, async () => {
    const { calls, plugin } = fixture({}, {
      // deno-lint-ignore require-yield
      readDir: async function* () {
        throw Object.assign(new Error(`readdir '/app/dist'`), { name: `NotFound` })
      },
    })
    await expect(run(plugin)).rejects.toThrow(`readdir '/app/dist'`)
    expect(calls).toHaveLength(0)
  })

  it(`builds into the output folder of the environment whose build closed`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` })
    // Vite resolves one config per environment; the last one seen is the server's.
    plugin.configResolved!({ command: `build`, root: `/app`, build: { outDir: `dist-ssr` } })
    plugin.buildEnd!()
    const client = { environment: { config: { build: { outDir: `./dist` } } } }
    await plugin.closeBundle!.call(client)
    expect((calls[0].build as { outDir: string }).outDir).toBe(`/app/dist`)
  })

  it(`builds the worker as one classic script named sw.js into the output folder`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` })
    await run(plugin)
    expect(calls).toHaveLength(1)
    const build = calls[0].build as Record<string, unknown>
    const lib = build.lib as { entry: string; formats: string[]; fileName: () => string }
    expect(build.outDir).toBe(`/app/dist`)
    expect(build.emptyOutDir).toBe(false)
    expect(lib.entry).toBe(`/app/src/sw.ts`)
    expect(lib.formats).toEqual([`iife`])
    expect(lib.fileName()).toBe(`sw.js`)
    expect(calls[0].plugins).toEqual([`a-plugin`])
    expect(calls[0].publicDir).toBe(false)
  })

  it(`defines __BUILD_ID__ as the hash of the other built files, in folders too`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x`, "assets/a.js": `y` })
    await run(plugin)
    const expected = await buildIdOf(
      new Map([[`/index.html`, bytes(`x`)], [`/assets/a.js`, bytes(`y`)]]),
    )
    expect(define(calls[0]).__BUILD_ID__).toBe(JSON.stringify(expected))
  })

  it(`leaves the worker itself out of the hash, so a rebuild gives the same id`, async () => {
    const without = fixture({ "index.html": `x` })
    const withWorker = fixture({ "index.html": `x`, "sw.js": `old worker` })
    await run(without.plugin)
    await run(withWorker.plugin)
    expect(define(withWorker.calls[0]).__BUILD_ID__).toBe(define(without.calls[0]).__BUILD_ID__)
  })

  it(`gives a different id when a built file changes`, async () => {
    const one = fixture({ "index.html": `x` })
    const two = fixture({ "index.html": `z` })
    await run(one.plugin)
    await run(two.plugin)
    expect(define(one.calls[0]).__BUILD_ID__).not.toBe(define(two.calls[0]).__BUILD_ID__)
  })

  it(`takes the file name and the global name from its options`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` }, {
      fileName: `worker.js`,
      buildIdName: `BUILD`,
    })
    await run(plugin)
    const lib = (calls[0].build as { lib: { fileName: () => string } }).lib
    expect(lib.fileName()).toBe(`worker.js`)
    expect(Object.keys(define(calls[0]))).toEqual([`BUILD`])
  })

  it(`reads an absolute output folder as it is`, async () => {
    const { calls, plugin } = fixture({ "index.html": `x` })
    await run(plugin, `/app/dist`)
    expect((calls[0].build as { outDir: string }).outDir).toBe(`/app/dist`)
  })
})

/** A dev server that records its middleware, and a request to it. */
function devServer(plugin: ReturnType<typeof serviceWorker>, base?: string) {
  const middlewares: ViteMiddleware[] = []
  plugin.configResolved!({ command: `serve`, root: `/app`, base, build: { outDir: `dist` } })
  plugin.configureServer!({ middlewares: { use: (middleware) => middlewares.push(middleware) } })
  const request = (url: string) =>
    new Promise<{ status: number; headers: Record<string, string>; body: string } | `next`>(
      (resolve) => {
        const headers: Record<string, string> = {}
        const response = {
          statusCode: 0,
          setHeader: (name: string, value: string) => (headers[name.toLowerCase()] = value),
          end: (body: string) => resolve({ status: response.statusCode, headers, body }),
        }
        middlewares[0]({ url }, response, () => resolve(`next`))
      },
    )
  return { middlewares, request }
}

/** A `build` that answers each call with the next of `results`: code, or an error to throw. */
function scriptedBuild(results: Array<string | Error>) {
  const calls: Record<string, unknown>[] = []
  const build = (config: Record<string, unknown>) => {
    calls.push(config)
    const next = results.shift()!
    if (next instanceof Error) return Promise.reject(next)
    return Promise.resolve([{ output: [{ type: `chunk`, code: next }] }])
  }
  return { calls, build }
}

describe(`serviceWorker in the dev server`, () => {
  it(`serves the worker built in memory at /sw.js, uncached`, async () => {
    const { calls, build } = scriptedBuild([`self.addEventListener("fetch", f)`])
    const { request } = devServer(fixture({}, { build }).plugin)
    const answer = await request(`/sw.js?v=1`)
    expect(answer).toEqual({
      status: 200,
      headers: { "content-type": `text/javascript`, "cache-control": `no-cache` },
      body: `self.addEventListener("fetch", f)`,
    })
    const config = calls[0].build as Record<string, unknown>
    const lib = config.lib as { entry: string; formats: string[]; name: string }
    expect(config.write).toBe(false)
    expect(config.outDir).toBeUndefined()
    expect([lib.entry, lib.formats, lib.name]).toEqual([`/app/src/sw.ts`, [`iife`], `sw`])
    expect(calls[0].configFile).toBe(false)
    expect(calls[0].publicDir).toBe(false)
    expect(calls[0].plugins).toEqual([`a-plugin`])
    expect(define(calls[0]).__BUILD_ID__).toBe(`"dev"`)
  })

  it(`passes every other request on`, async () => {
    const { calls, build } = scriptedBuild([])
    const { request } = devServer(fixture({}, { build }).plugin)
    expect(await request(`/sw.js.map`)).toBe(`next`)
    expect(await request(`/index.html`)).toBe(`next`)
    expect(calls).toHaveLength(0)
  })

  it(`serves the worker under Vite's base and at its own file name`, async () => {
    const { build } = scriptedBuild([`code`])
    const { request } = devServer(fixture({}, { build, fileName: `worker.js` }).plugin, `/app/`)
    expect(await request(`/worker.js`)).toBe(`next`)
    expect(await request(`/app/worker.js`)).toMatchObject({ status: 200, body: `code` })
  })

  it(`shows an edit to the worker on the next request`, async () => {
    const { build } = scriptedBuild([`old`, `new`])
    const { request } = devServer(fixture({}, { build }).plugin)
    expect(await request(`/sw.js`)).toMatchObject({ body: `old` })
    expect(await request(`/sw.js`)).toMatchObject({ body: `new` })
  })

  it(`answers a failed build with 500 and its message, then tries again`, async () => {
    const { build } = scriptedBuild([new Error(`sw.ts:3: unexpected token`), `fixed`])
    const { request } = devServer(fixture({}, { build }).plugin)
    expect(await request(`/sw.js`)).toEqual({
      status: 500,
      headers: { "content-type": `text/plain`, "cache-control": `no-cache` },
      body: `sw.ts:3: unexpected token`,
    })
    expect(await request(`/sw.js`)).toMatchObject({ status: 200, body: `fixed` })
  })

  it(`answers 500 when the build gives no script`, async () => {
    const build = () => Promise.resolve({ output: [{ type: `asset` }] })
    const { request } = devServer(fixture({}, { build }).plugin)
    expect(await request(`/sw.js`)).toMatchObject({ status: 500 })
  })

  it(`serves nothing with dev: false`, () => {
    const { middlewares } = devServer(fixture({}, { dev: false }).plugin)
    expect(middlewares).toHaveLength(0)
  })
})
