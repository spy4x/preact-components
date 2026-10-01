import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { fromFileUrl, relative } from "@std/path"
import { checkModule, forbiddenImport } from "./boundary.ts"

/** The messages `checkModule` reports for `source`, in the order Deno reports them. */
function messages(source: string, options: Parameters<typeof checkModule>[1] = {}): string[] {
  return checkModule(source, options).map((violation) => violation.message)
}

describe("checkModule", () => {
  it("reports nothing for a screen that takes everything through props", () => {
    const source = `
      import { useState } from "preact/hooks"
      import { Button } from "@spy4x/preact-ui"
      export function Counter(props: { start: number; onSave: (n: number) => void }) {
        const [n, setN] = useState(props.start)
        return <Button onClick={() => props.onSave(n)}>{n}</Button>
      }
    `
    expect(checkModule(source)).toEqual([])
  })

  it("reports a signals store or router import, with or without a scheme, version or subpath", () => {
    const source = `
      import { signal } from "@preact/signals"
      import { computed } from "npm:@preact/signals-core@1.8.0"
      import { buildModelStore } from "jsr:@spy4x/preact-signals/model-store"
      import { Link } from "wouter-preact"
    `
    expect(messages(source)).toEqual([
      `"@preact/signals" is a store or a router; take state as props, report through callbacks.`,
      `"npm:@preact/signals-core@1.8.0" is a store or a router; take state as props, report through callbacks.`,
      `"jsr:@spy4x/preact-signals/model-store" is a store or a router; take state as props, report through callbacks.`,
      `"wouter-preact" is a store or a router; take state as props, report through callbacks.`,
    ])
  })

  it("reports a forbidden source reached through a re-export or a dynamic import", () => {
    const source = `
      export { signal } from "@preact/signals"
      export * from "wouter-preact"
      const lazy = () => import("@preact/signals")
    `
    expect(messages(source)).toHaveLength(3)
  })

  it("leaves a package that only shares a forbidden name's prefix alone", () => {
    expect(checkModule(`import { x } from "@preact/signals-extra"`)).toEqual([])
  })

  it("reports an app alias only when the caller names it", () => {
    const source = `import { api } from "@api/client"`

    expect(checkModule(source)).toEqual([])
    expect(messages(source, { appAliases: ["@api/"] })).toEqual([
      `"@api/client" is app code; a screen must not import from an app.`,
    ])
  })

  it("reports a relative import that resolves into a named app directory", () => {
    const options = { filename: "/repo/libs/ui/screen.tsx", appDirectories: ["apps"] }

    expect(messages(`import { x } from "../../apps/spa/store.ts"`, options)).toEqual([
      `"../../apps/spa/store.ts" is app code; a screen must not import from an app.`,
    ])
    expect(checkModule(`import { x } from "./apps-list.ts"`, options)).toEqual([])
    expect(
      checkModule(`import { x } from "../../apps/spa/store.ts"`, { filename: options.filename }),
    )
      .toEqual([])
  })

  it("reports every read of a forbidden global, bare or off the global object", () => {
    const source = `
      export function Screen() {
        const data = fetch("/x")
        const a = globalThis.localStorage
        const b = self.location
        const c = { window }
        return <p>{document.title}</p>
      }
    `
    expect(messages(source)).toEqual([
      `"fetch" reaches outside the screen; take it through props instead.`,
      `"localStorage" reaches outside the screen; take it through props instead.`,
      `"location" reaches outside the screen; take it through props instead.`,
      `"window" reaches outside the screen; take it through props instead.`,
      `"document" reaches outside the screen; take it through props instead.`,
    ])
  })

  it("leaves a forbidden name alone where it is a property or a key", () => {
    const source = `
      interface Ports { fetch: () => void }
      class Box { history = [] }
      export function Screen(props: Ports & { api: { location: string } }) {
        const keys = { document: 1, navigator: 2 }
        return <p window="x" onClick={props.fetch}>{props.api.location}</p>
      }
    `
    expect(checkModule(source)).toEqual([])
  })

  it("checks the globals and packages the caller passes instead of the defaults", () => {
    const source = `
      import { signal } from "@preact/signals"
      import { route } from "my-router"
      const a = window
      const b = alert
    `
    expect(messages(source, { forbiddenPackages: ["my-router"], forbiddenGlobals: ["alert"] }))
      .toEqual([
        `"my-router" is a store or a router; take state as props, report through callbacks.`,
        `"alert" reaches outside the screen; take it through props instead.`,
      ])
  })

  it("gives each violation the source range of its node", () => {
    const source = `const a = 1; fetch("/x")`
    const [violation] = checkModule(source)

    expect(source.slice(...violation.range)).toBe("fetch")
  })
})

describe("forbiddenImport", () => {
  it("allows a relative import when no app directory is named", () => {
    expect(forbiddenImport("../apps/x.ts", "/repo/libs/ui/a.tsx")).toBeNull()
  })
})

const ROOT = fromFileUrl(new URL("../", import.meta.url))

/**
 * What this library holds its own components to. They may keep local state in a signal and touch
 * `document` inside an effect (AGENTS.md, "Component rules"), so the template's full lists do not
 * apply; but no component routes, reads an app store, talks to the network or persists anything.
 */
const LIBRARY_BOUNDARY = {
  forbiddenPackages: ["@spy4x/preact-signals", "wouter-preact"],
  forbiddenGlobals: [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "history",
    "localStorage",
    "sessionStorage",
  ],
}

/** Every `.ts` and `.tsx` module under `dir` but the tests, as absolute paths. */
async function modules(dir: string): Promise<string[]> {
  const found: string[] = []
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory) found.push(...await modules(path))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path)
  }
  return found.sort()
}

describe("this library's own components", () => {
  it("never route, read an app store, use the network or persist anything", async () => {
    const files = [...await modules(`${ROOT}ui`), ...await modules(`${ROOT}system`)]
    // An empty walk would pass silently, so require a module from each folder.
    const names = files.map((file) => relative(ROOT, file))
    expect(names).toContain("ui/modal.tsx")
    expect(names).toContain("system/shell.tsx")

    const found: string[] = []
    for (const file of files) {
      const source = await Deno.readTextFile(file)
      for (const { message } of checkModule(source, { ...LIBRARY_BOUNDARY, filename: file })) {
        found.push(`${relative(ROOT, file)}: ${message}`)
      }
    }
    expect(found).toEqual([])
  })
})
