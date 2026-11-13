import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { hydrateIslands } from "./client.ts"

/**
 * Runs `body` with a stand-in `document` holding `json` as the islands' data and `comments` as the
 * page's comment nodes. Hydrating itself needs a real DOM, so these tests stop before it; a site's
 * browser checks prove that part.
 */
async function withPage(
  json: string | null,
  comments: string[],
  body: () => Promise<void>,
): Promise<void> {
  const nodes = comments.map((nodeValue) => ({ nodeValue }))
  const scope = globalThis as Record<string, unknown>
  scope.NodeFilter = { SHOW_COMMENT: 128 }
  scope.document = {
    body: {},
    getElementById: (id: string) =>
      id === "__islands" && json !== null ? { textContent: json } : null,
    createTreeWalker: () => {
      let at = 0
      return { nextNode: () => nodes[at++] ?? null }
    },
  }
  try {
    await body()
  } finally {
    delete scope.document
    delete scope.NodeFilter
  }
}

describe("hydrateIslands", () => {
  it("does nothing, and loads no module, on a page without islands", async () => {
    let loads = 0
    await withPage(null, [], async () => {
      const done = await hydrateIslands({ "./islands/a.tsx": () => (loads++, Promise.resolve({})) })
      expect(done).toEqual([])
    })
    expect(loads).toBe(0)
  })

  it("reports an island it has no module or no markers for, and loads nothing for it", async () => {
    const errors: unknown[] = []
    const original = console.error
    console.error = (message: unknown) => errors.push(message)
    let loads = 0
    const islands = [
      { file: "./islands/gone.tsx", exportName: "Gone", props: {} },
      { file: "./islands/a.tsx", exportName: "A", props: {} },
    ]
    try {
      // Island 0 has markers but no module; island 1 has a module but no closing marker.
      await withPage(JSON.stringify(islands), ["island:0", "/island:0", "island:1"], async () => {
        await hydrateIslands({ "./islands/a.tsx": () => (loads++, Promise.resolve({})) })
      })
    } finally {
      console.error = original
    }
    expect(errors).toEqual([
      "Island ./islands/gone.tsx#Gone cannot hydrate",
      "Island ./islands/a.tsx#A cannot hydrate",
    ])
    expect(loads).toBe(0)
  })

  it("gives the browser a turn between loading an island and hydrating it (#623)", async () => {
    const steps: string[] = []
    const scope = globalThis as Record<string, unknown>
    scope.scheduler = { yield: () => (steps.push(`yield`), Promise.resolve()) }
    const islands = [{ file: "./islands/a.tsx", exportName: "A", props: {} }]
    const end = { nodeValue: "/island:0" }
    const start = { nodeValue: "island:0", nextSibling: end, parentNode: { namespaceURI: null } }
    try {
      await withPage(JSON.stringify(islands), [], async () => {
        ;(document as unknown as { createTreeWalker: () => unknown }).createTreeWalker = () => {
          const nodes = [start, end]
          return { nextNode: () => nodes.shift() ?? null }
        }
        const A = () => (steps.push(`render`), null)
        await hydrateIslands({
          "./islands/a.tsx": () => (steps.push(`load`), Promise.resolve({ A })),
        })
      })
    } finally {
      delete scope.scheduler
    }
    expect(steps).toEqual([`load`, `yield`, `render`])
  })
})
