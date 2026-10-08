import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { buildIdOf, serviceWorker, type ServiceWorkerOptions } from "./vite.ts"

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
  plugin.configResolved!({ root: `/app`, build: { outDir } })
  await plugin.closeBundle!()
}

const define = (call: Record<string, unknown>) => call.define as Record<string, string>

describe(`serviceWorker`, () => {
  it(`runs on a production build only`, () => {
    expect(fixture({}).plugin.apply).toBe(`build`)
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
