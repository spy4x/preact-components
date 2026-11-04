/**
 * Wakes the page's islands in the browser. The server marks each island's HTML with
 * `<!--island:N-->…<!--/island:N-->` and lists their files, exports and props in
 * `<script id="__islands" type="application/json">` (`render.tsx`). Each island hydrates in place,
 * between its two comments, with its module loaded only when the page has it.
 *
 * Browser only, and free of server imports, so the client bundle carries Preact and this file alone.
 *
 * @module
 */
import { type ComponentType, h, hydrate } from "preact"

interface Island {
  file: string
  exportName: string
  props: Record<string, unknown>
}

type Loaders = Record<string, () => Promise<Record<string, unknown>>>

/** Hydrates every island of the page, from `loaders` (`import.meta.glob("./islands/**\/*.tsx")`). */
export function hydrateIslands(loaders: Loaders): Promise<void[]> {
  const data = document.getElementById("__islands")
  if (!data?.textContent) return Promise.resolve([])
  const islands: Island[] = JSON.parse(data.textContent)
  const starts = new Map<number, Comment>()
  const ends = new Map<number, Comment>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const found = /^(\/?)island:(\d+)$/.exec(node.nodeValue ?? "")
    if (found) (found[1] ? ends : starts).set(Number(found[2]), node as Comment)
  }
  return Promise.all(islands.map(async (island, index) => {
    const start = starts.get(index)
    const end = ends.get(index)
    const load = loaders[island.file]
    if (!start || !end || !load) {
      console.error(`Island ${island.file}#${island.exportName} cannot hydrate`)
      return
    }
    const component = (await load())[island.exportName] as ComponentType
    hydrate(h(component, island.props), rootFragment(start, end))
  }))
}

/**
 * The nodes between `start` and `end`, shaped as the parent Preact renders into, so an island
 * hydrates in place among its siblings (Preact's `createRootFragment` pattern).
 */
function rootFragment(start: Comment, end: Comment): Element {
  const parent = start.parentNode as Element
  const children: Node[] = []
  for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
    children.push(node)
  }
  const insert = (child: Node, before?: Node | null) => parent.insertBefore(child, before ?? end)
  return {
    nodeType: 1,
    namespaceURI: parent.namespaceURI,
    parentNode: parent,
    firstChild: children[0] ?? null,
    childNodes: children,
    insertBefore: insert,
    appendChild: insert,
    removeChild: (child: Node) => parent.removeChild(child),
  } as unknown as Element
}
