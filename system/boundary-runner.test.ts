import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { GuardFileSystem, GuardTest } from "@spy4x/preact-theme/spacing-runner"
import { type BoundaryRunnerOptions, registerBoundaryTests } from "./boundary-runner.ts"

/** An in-memory tree: `files` maps an absolute path to its text, `emptyDirectories` hold nothing. */
function memoryFs(files: Record<string, string>, emptyDirectories: string[] = []): GuardFileSystem {
  const paths = [...Object.keys(files), ...emptyDirectories.map((directory) => `${directory}/`)]
  return {
    exists: (path) => Promise.resolve(paths.some((p) => p === path || p.startsWith(`${path}/`))),
    readText: (path) => Promise.resolve(files[path] ?? null),
    readDir: (path) => {
      const names = new Map<string, boolean>()
      for (const p of paths) {
        if (!p.startsWith(`${path}/`)) continue
        const [name, ...rest] = p.slice(path.length + 1).split("/")
        if (name !== "") names.set(name, rest.length > 0)
      }
      return Promise.resolve(
        [...names].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory })),
      )
    },
  }
}

/** One registered test. */
interface Registered {
  name: string
  run: () => void | Promise<void>
}

/** Register the boundary tests over an in-memory tree and return them. */
function register(
  files: Record<string, string>,
  options: Partial<BoundaryRunnerOptions> = {},
  emptyDirectories: string[] = [],
): Registered[] {
  const tests: Registered[] = []
  const test: GuardTest = (name, run) => tests.push({ name, run })
  registerBoundaryTests({
    test,
    root: "/repo",
    directories: ["libs/ui"],
    fs: memoryFs(files, emptyDirectories),
    ...options,
  })
  return tests
}

/** The message a registered test fails with, or `null` when it passes. */
function failure(test: Registered): Promise<string | null> {
  return Promise.resolve().then(test.run).then(() => null, (error: Error) => error.message)
}

const PURE =
  `export function Screen(props: { title: string }) {\n  return <h1>{props.title}</h1>\n}`
const APP = { appAliases: ["@api/", "@spa/"], appDirectories: ["apps"] }

describe("registerBoundaryTests: the walk over the screens", () => {
  it("names the test after the directories", () => {
    const tests = register({}, { directories: ["libs/ui", "libs/admin"] })
    expect(tests.map((t) => t.name)).toEqual([
      "no module in libs/ui, libs/admin imports a store, router or app code or touches fetch or a page global",
    ])
  })

  it("passes a folder of pure screens", async () => {
    const [walk] = register({
      "/repo/libs/ui/screen.tsx": PURE,
      "/repo/libs/ui/labels.ts": `import { PURE } from "./screen.tsx"\nexport const l = PURE`,
    }, { boundary: APP })
    expect(await failure(walk)).toBeNull()
  })

  it("rejects a module that imports a signals store", async () => {
    const [walk] = register({
      "/repo/libs/ui/screen.tsx": PURE,
      "/repo/libs/ui/forms/bad.tsx":
        `import { signal } from "@preact/signals"\nexport const s = signal(1)`,
    })
    const message = await failure(walk)
    expect(message).toContain("The boundary is broken in 1 place(s):")
    expect(message).toContain(`libs/ui/forms/bad.tsx: "@preact/signals" is a store or a router`)
  })

  it("rejects a module that imports through one of the app's aliases", async () => {
    const files = {
      "/repo/libs/ui/bad.ts": `import { api } from "@api/client.ts"\nexport const a = api`,
    }
    expect(await failure(register(files, { boundary: APP })[0])).toContain(
      `libs/ui/bad.ts: "@api/client.ts"`,
    )
    expect(await failure(register(files)[0])).toBeNull()
  })

  it("rejects a relative import that resolves into an app directory", async () => {
    const files = {
      "/repo/libs/ui/bad.ts":
        `import { auth } from "../../apps/spa/src/state/auth.ts"\nexport const a = auth`,
    }
    expect(await failure(register(files, { boundary: APP })[0]))
      .toContain(`libs/ui/bad.ts: "../../apps/spa/src/state/auth.ts"`)
    expect(await failure(register(files)[0])).toBeNull()
  })

  it("rejects a module that calls fetch or reads a page global", async () => {
    const [walk] = register({
      "/repo/libs/ui/a.ts": `export const load = () => fetch("/api")`,
      "/repo/libs/ui/b.ts": `export const title = () => document.title`,
    })
    const message = await failure(walk)
    expect(message).toContain("The boundary is broken in 2 place(s):")
    expect(message).toContain("libs/ui/a.ts: ")
    expect(message).toContain("libs/ui/b.ts: ")
  })

  it("does not read a test file or build output", async () => {
    const bad = `import { signal } from "@preact/signals"\nexport const s = signal(1)`
    const [walk] = register({
      "/repo/libs/ui/screen.tsx": PURE,
      "/repo/libs/ui/screen.test.tsx": bad,
      "/repo/libs/ui/dist/screen.ts": bad,
    })
    expect(await failure(walk)).toBeNull()
  })

  it("rejects when a directory it was told to walk does not exist", async () => {
    const [walk] = register({ "/repo/libs/other/screen.tsx": PURE })
    expect(await failure(walk)).toContain(`told to walk "libs/ui", which does not exist in /repo`)
  })

  it("rejects when a directory it was told to walk holds no module", async () => {
    const [empty] = register({}, {}, ["/repo/libs/ui"])
    expect(await failure(empty)).toContain(`"libs/ui" in /repo, which holds no .ts, .tsx file`)
    const [onlyTests] = register({
      "/repo/libs/ui/screen.test.tsx": PURE,
      "/repo/libs/ui/a.css": "",
    })
    expect(await failure(onlyTests)).toContain(`"libs/ui" in /repo, which holds no .ts, .tsx file`)
  })

  it("rejects when a file the app requires was not walked", async () => {
    const [walk] = register({ "/repo/libs/ui/screen.tsx": PURE }, {
      requiredFiles: ["libs/ui/auth-screen.tsx"],
    })
    expect(await failure(walk)).toContain("did not find libs/ui/auth-screen.tsx")
  })
})

describe("registerBoundaryTests: the check of the app's own lists", () => {
  it("registers no second test when there is no import to try", () => {
    expect(register({})).toHaveLength(1)
  })

  it("passes when every alias and listed import is refused and the allowed one passes", async () => {
    const tests = register({}, {
      boundary: APP,
      refusedImports: ["../../apps/spa/src/state/auth.ts"],
      allowedImports: ["./progressive.tsx"],
    })
    expect(tests[1].name).toBe(
      "the boundary refuses app imports from libs/ui and allows the listed ones",
    )
    expect(await failure(tests[1])).toBeNull()
  })

  it("rejects when an import the app lists as refused is allowed", async () => {
    const tests = register({}, {
      boundary: { appAliases: ["@api/"] },
      refusedImports: ["../../apps/spa/src/state/auth.ts"],
    })
    expect(await failure(tests[1]))
      .toBe(`"../../apps/spa/src/state/auth.ts" should be refused, and is allowed`)
  })

  it("rejects when an import the app lists as allowed is refused", async () => {
    const tests = register({}, { boundary: APP, allowedImports: ["./ok.tsx", "@spa/state.ts"] })
    const message = await failure(tests[1])
    expect(message).toContain(`"@spa/state.ts" should be allowed: `)
    expect(message).not.toContain("./ok.tsx")
  })
})
