import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  edgeScrollStep,
  type SortableBox,
  type SortableItem,
  SortableList,
  sortableOffsets,
  sortableTarget,
} from "./sortable-list.tsx"

interface Task extends SortableItem {
  title: string
}

const tasks: Task[] = [
  { id: "milk", title: "Buy milk" },
  { id: "call", title: "Call Ana" },
  { id: "bins", title: "Take the bins out" },
]

function list(extra: Partial<Parameters<typeof SortableList<Task>>[0]> = {}): string {
  return render(
    <SortableList
      items={tasks}
      renderItem={(task) => <span>{task.title}</span>}
      itemLabel={(task) => task.title}
      onMove={() => {}}
      {...extra}
    />,
  )
}

/** Three 40px rows 8px apart: tops 0, 48 and 96. */
const even: SortableBox[] = [
  { top: 0, height: 40 },
  { top: 48, height: 40 },
  { top: 96, height: 40 },
]

describe("SortableList", () => {
  it("renders the items as a list, in the order of the items array", () => {
    const html = list()
    const rows = [...html.matchAll(/<li data-sortable-item="([^"]+)"/g)].map((match) => match[1])

    expect(html).toContain("<ul ")
    expect(rows).toEqual(["milk", "call", "bins"])
    expect(html.indexOf(">Buy milk<")).toBeLessThan(html.indexOf(">Call Ana<"))
  })

  it("gives every item a handle button named after the item and described by the instructions", () => {
    const html = list()
    const handles = html.match(/<button [^>]*data-sortable-handle[^>]*>/g) ?? []
    const instructions = html.match(/<span id="([^"]+)" class="sr-only">Press Space or Enter/)

    expect(instructions).not.toBeNull()
    expect(handles.length).toBe(3)
    expect(handles[0]).toContain('aria-label="Reorder Buy milk"')
    expect(handles[2]).toContain('aria-label="Reorder Take the bins out"')
    for (const handle of handles) {
      expect(handle).toContain('type="button"')
      expect(handle).toContain(`aria-describedby="${instructions?.[1]}"`)
    }
  })

  it("makes only the handle a 44px target that keeps touch for itself", () => {
    const html = list()
    const handle = html.match(/<button [^>]*data-sortable-handle[^>]*>/)?.[0] ?? ""

    expect(handle).toMatch(/class="[^"]*\bsize-11\b/)
    expect(handle).toMatch(/class="[^"]*\btouch-none\b/)
    expect(html.match(/touch-none/g)?.length).toBe(3)
  })

  it("renders an empty polite live region for the announcements", () => {
    expect(list()).toContain(
      '<div role="status" aria-live="polite" aria-atomic="true" data-sortable-live class="sr-only"></div>',
    )
  })

  it("takes the handle name and the instructions from labels", () => {
    const html = list({ labels: { handle: (item) => `Mover ${item}`, instructions: "Espacio" } })

    expect(html).toContain('aria-label="Mover Buy milk"')
    expect(html).toContain('class="sr-only">Espacio</span>')
  })

  it("marks every handle as not pressed before anything is picked up", () => {
    const handles = list().match(/<button [^>]*data-sortable-handle[^>]*>/g) ?? []

    expect(handles.length).toBe(3)
    for (const handle of handles) expect(handle).toContain('aria-pressed="false"')
  })

  it("shifts no row before anything is picked up", () => {
    expect(list()).not.toContain("translateY")
  })
})

describe("sortableTarget", () => {
  it("keeps an item in place until its middle passes a neighbour's middle", () => {
    expect(sortableTarget(even, 0, 20)).toBe(0)
    expect(sortableTarget(even, 0, 67)).toBe(0)
    expect(sortableTarget(even, 0, 69)).toBe(1)
    expect(sortableTarget(even, 0, 117)).toBe(2)
  })

  it("moves an item up past every middle it is above", () => {
    expect(sortableTarget(even, 2, 115)).toBe(2)
    expect(sortableTarget(even, 2, 67)).toBe(1)
    expect(sortableTarget(even, 2, 19)).toBe(0)
  })
})

describe("sortableOffsets", () => {
  it("shifts nothing while an item is shown where it was", () => {
    expect(sortableOffsets(even, 1, 1)).toEqual([0, 0, 0])
  })

  it("slides the rows it passes up by its height and the gap when an item moves down", () => {
    expect(sortableOffsets(even, 0, 2)).toEqual([96, -48, -48])
  })

  it("slides the rows it passes down by its height and the gap when an item moves up", () => {
    expect(sortableOffsets(even, 2, 0)).toEqual([48, 48, -96])
  })

  it("lands a short item below a tall one it moves past", () => {
    const uneven: SortableBox[] = [{ top: 0, height: 40 }, { top: 48, height: 80 }]

    // The tall row moves up 48 to the top; the short one starts 8 below its new bottom, at 88.
    expect(sortableOffsets(uneven, 0, 1)).toEqual([88, -48])
  })

  it("shifts nothing for an index outside the list", () => {
    expect(sortableOffsets(even, 0, 5)).toEqual([0, 0, 0])
  })
})

describe("edgeScrollStep", () => {
  it("does not scroll away from the edges", () => {
    expect(edgeScrollStep(400, 0, 800)).toBe(0)
  })

  it("scrolls up near the top and down near the bottom, faster closer to the edge", () => {
    expect(edgeScrollStep(40, 0, 800)).toBeLessThan(0)
    expect(edgeScrollStep(0, 0, 800)).toBe(-16)
    expect(edgeScrollStep(760, 0, 800)).toBeGreaterThan(0)
    expect(edgeScrollStep(800, 0, 800)).toBe(16)
    expect(edgeScrollStep(5, 0, 800)).toBeLessThan(edgeScrollStep(40, 0, 800))
  })

  it("keeps its top speed when the pointer leaves the area", () => {
    expect(edgeScrollStep(-50, 0, 800)).toBe(-16)
    expect(edgeScrollStep(900, 0, 800)).toBe(16)
  })

  it("narrows the zone to a quarter of a short area", () => {
    expect(edgeScrollStep(30, 0, 100)).toBe(0)
    expect(edgeScrollStep(20, 0, 100)).toBeLessThan(0)
  })
})
