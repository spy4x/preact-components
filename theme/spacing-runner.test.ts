import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  guardFiles,
  type GuardFileSystem,
  guardRoot,
  type GuardTest,
  registerSpacingTests,
} from "./spacing-runner.ts"

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

/** A `test` function that keeps what a runner registers, so a test can run it. */
function collector(): {
  test: GuardTest
  tests: { name: string; run: () => void | Promise<void> }[]
} {
  const tests: { name: string; run: () => void | Promise<void> }[] = []
  return { test: (name, run) => tests.push({ name, run }), tests }
}

const ROOT = "/repo"
const ON_SCALE = `export const a = <div class="p-4 gap-2" />`

describe("guardRoot", () => {
  it("turns a file URL and a path with a trailing slash into the same path", () => {
    expect(guardRoot(new URL("file:///repo/"))).toBe("/repo")
    expect(guardRoot("/repo/")).toBe("/repo")
    expect(guardRoot("/repo")).toBe("/repo")
  })
})

describe("guardFiles", () => {
  it("lists the wanted files below every directory, sorted, without test files", async () => {
    const fs = memoryFs({
      "/repo/libs/ui/screen.tsx": "",
      "/repo/libs/ui/screen.test.tsx": "",
      "/repo/libs/ui/notes.md": "",
      "/repo/apps/spa/src/app.tsx": "",
      "/repo/apps/spa/src/app.css": "",
      "/repo/other/skipped.ts": "",
    })
    const files = await guardFiles({
      root: ROOT,
      directories: ["libs", "apps/"],
      extensions: [".ts", ".tsx", ".css"],
      fs,
    })
    expect(files).toEqual(["apps/spa/src/app.css", "apps/spa/src/app.tsx", "libs/ui/screen.tsx"])
  })

  it("leaves out build output below the root", async () => {
    const fs = memoryFs({
      "/repo/apps/spa/src/app.tsx": "",
      "/repo/apps/spa/dist/assets/index.ts": "",
      "/repo/apps/mpa/_fresh/server.ts": "",
      "/repo/apps/spa/.vite/deps.ts": "",
      "/repo/apps/spa/build/out.ts": "",
      "/repo/apps/node_modules/x/index.ts": "",
    })
    const files = await guardFiles({
      root: ROOT,
      directories: ["apps"],
      extensions: [".ts", ".tsx"],
      fs,
    })
    expect(files).toEqual(["apps/spa/src/app.tsx"])
  })

  it("walks a checkout that sits under a folder named like build output", async () => {
    const fs = memoryFs({ "/home/a+b (1)/build/dist/x/apps/spa/app.tsx": "" })
    const files = await guardFiles({
      root: "/home/a+b (1)/build/dist/x/",
      directories: ["apps"],
      extensions: [".tsx"],
      fs,
    })
    expect(files).toEqual(["apps/spa/app.tsx"])
  })

  it("walks a skipped name when the app's own list leaves it out", async () => {
    const fs = memoryFs({ "/repo/apps/build/step.ts": "", "/repo/apps/tmp/x.ts": "" })
    const files = await guardFiles({
      root: ROOT,
      directories: ["apps"],
      extensions: [".ts"],
      skipDirectories: ["tmp"],
      fs,
    })
    expect(files).toEqual(["apps/build/step.ts"])
  })

  it("rejects a directory that does not exist", async () => {
    const fs = memoryFs({ "/repo/apps/app.tsx": "" })
    await expect(
      guardFiles({ root: ROOT, directories: ["apps", "libs"], extensions: [".tsx"], fs }),
    )
      .rejects.toThrow(`told to walk "libs", which does not exist`)
  })

  it("rejects an empty directory", async () => {
    const fs = memoryFs({ "/repo/apps/app.tsx": "" }, ["/repo/libs"])
    await expect(
      guardFiles({ root: ROOT, directories: ["apps", "libs"], extensions: [".tsx"], fs }),
    )
      .rejects.toThrow(`told to walk "libs" in /repo, which holds no .tsx file`)
  })

  it("rejects a directory that holds only test files, other extensions and build output", async () => {
    const fs = memoryFs({
      "/repo/libs/ui/screen.test.tsx": "",
      "/repo/libs/ui/readme.md": "",
      "/repo/libs/dist/screen.tsx": "",
    })
    await expect(guardFiles({ root: ROOT, directories: ["libs"], extensions: [".tsx"], fs }))
      .rejects.toThrow(`holds no .tsx file to check`)
  })

  it("rejects when a required file was not walked", async () => {
    const fs = memoryFs({ "/repo/apps/web/src/app.tsx": "" })
    await expect(guardFiles({
      root: ROOT,
      directories: ["apps"],
      extensions: [".tsx"],
      requiredFiles: ["apps/web/src/app.tsx", "apps/spa/src/app.tsx"],
      fs,
    })).rejects.toThrow("did not find apps/spa/src/app.tsx in /repo")
  })
})

describe("registerSpacingTests", () => {
  it("registers one test named after the directories", () => {
    const { test, tests } = collector()
    registerSpacingTests({ test, root: ROOT, directories: ["apps", "libs"], fs: memoryFs({}) })
    expect(tests.map((t) => t.name)).toEqual(["every spacing class in apps, libs is on the scale"])
  })

  it("passes a tree whose spacing classes are all on the scale", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({
      "/repo/apps/spa/app.tsx": ON_SCALE,
      "/repo/apps/spa/app.css": `.card { @apply p-4 mt-2; }`,
      "/repo/apps/spa/index.html": `<body class="p-6">`,
    })
    registerSpacingTests({ test, root: ROOT, directories: ["apps"], fs })
    await tests[0].run()
  })

  it("rejects with the file, position and class of every spacing class off the scale", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({
      "/repo/apps/spa/app.tsx": ON_SCALE,
      "/repo/apps/spa/card.tsx": `const a = 1\nexport const b = <div class="p-4 mt-5" />`,
      "/repo/libs/ui/page.css": `.page { @apply gap-[13px]; }`,
      "/repo/libs/ui/index.html": `<body class="p-7">`,
    })
    registerSpacingTests({
      test,
      root: new URL("file:///repo/"),
      directories: ["apps", "libs"],
      fs,
    })
    const error = await Promise.resolve().then(tests[0].run).then(() => null, (e: Error) => e)
    expect(error?.message.split("\n")).toEqual([
      "Spacing off the scale in 3 place(s):",
      "apps/spa/card.tsx:2:34 mt-5 — step 5 is not on the scale (0 px 1 2 3 4 6 8 12 16)",
      "libs/ui/index.html:1:14 p-7 — step 7 is not on the scale (0 px 1 2 3 4 6 8 12 16)",
      "libs/ui/page.css:1:16 gap-[13px] — arbitrary spacing value [13px]; use a step from the scale",
    ])
  })

  it("does not read a test file, which spells out classes to assert on", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({
      "/repo/apps/app.tsx": ON_SCALE,
      "/repo/apps/app.test.tsx": `expect(html).toContain("p-5")`,
    })
    registerSpacingTests({ test, root: ROOT, directories: ["apps"], fs })
    await tests[0].run()
  })

  it("reads only the extensions the app lists", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({
      "/repo/apps/app.tsx": ON_SCALE,
      "/repo/apps/page.html": `<i class="p-5">`,
    })
    registerSpacingTests({ test, root: ROOT, directories: ["apps"], extensions: [".tsx"], fs })
    await tests[0].run()
  })

  it("rejects when a directory it was told to walk is missing or empty", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({ "/repo/apps/app.tsx": ON_SCALE }, ["/repo/libs"])
    registerSpacingTests({ test, root: ROOT, directories: ["apps", "libs"], fs })
    registerSpacingTests({ test, root: ROOT, directories: ["apps", "packages"], fs })
    await expect(Promise.resolve().then(tests[0].run)).rejects.toThrow(
      `"libs" in /repo, which holds no`,
    )
    await expect(Promise.resolve().then(tests[1].run)).rejects.toThrow(
      `"packages", which does not exist`,
    )
  })

  it("rejects when a file the app requires was not walked", async () => {
    const { test, tests } = collector()
    const fs = memoryFs({ "/repo/apps/web/app.tsx": ON_SCALE })
    registerSpacingTests({
      test,
      root: ROOT,
      directories: ["apps"],
      requiredFiles: ["apps/spa/src/app.tsx"],
      fs,
    })
    await expect(Promise.resolve().then(tests[0].run)).rejects.toThrow(
      "did not find apps/spa/src/app.tsx",
    )
  })

  it("reads the real file system when no other is given", async () => {
    const { test, tests } = collector()
    const root = new URL("../", import.meta.url)
    registerSpacingTests({ test, root, directories: ["cn"], requiredFiles: ["cn/cn.ts"] })
    registerSpacingTests({ test, root, directories: ["no-such-package"] })
    await tests[0].run()
    await expect(Promise.resolve().then(tests[1].run)).rejects.toThrow("which does not exist")
  })
})
