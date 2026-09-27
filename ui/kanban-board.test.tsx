import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  KanbanBoard,
  type KanbanColumn,
  type KanbanItem,
  moveKanbanItem,
  nextKanbanSlot,
} from "./kanban-board.tsx"

interface Task extends KanbanItem {
  title: string
}

const columns: KanbanColumn[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
]

const tasks: Task[] = [
  { id: "a", column: "todo", title: "Alpha" },
  { id: "b", column: "doing", title: "Beta" },
  { id: "c", column: "todo", title: "Gamma" },
]

function board(extra: Partial<Parameters<typeof KanbanBoard<Task>>[0]> = {}): string {
  return render(
    <KanbanBoard
      columns={columns}
      items={tasks}
      renderItem={(task) => <span>{task.title}</span>}
      itemLabel={(task) => task.title}
      onMove={() => {}}
      {...extra}
    />,
  )
}

/** The markup of the column whose `data-kanban-column` is `id`, up to the next column. */
function columnHtml(html: string, id: string): string {
  const start = html.indexOf(`data-kanban-column="${id}"`)
  const next = html.indexOf("data-kanban-column=", start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

describe("KanbanBoard", () => {
  it("renders the columns as a named list of lists, each named by its heading", () => {
    const html = board()

    expect(html).toContain('<ul aria-label="Board"')
    for (const column of columns) {
      const markup = columnHtml(html, column.id)
      const titleId = markup.match(/<span id="([^"]+)">([^<]+)<\/span>/)
      expect(titleId?.[2]).toBe(column.title)
      expect(markup).toContain(`<ul aria-labelledby="${titleId?.[1]}"`)
    }
  })

  it("puts each item in its column, in the order of the items array", () => {
    const html = board()

    const todo = columnHtml(html, "todo")
    expect(todo.indexOf(">Alpha<")).toBeGreaterThan(-1)
    expect(todo.indexOf(">Gamma<")).toBeGreaterThan(todo.indexOf(">Alpha<"))
    expect(columnHtml(html, "doing")).toContain(">Beta<")
    expect(columnHtml(html, "todo")).not.toContain(">Beta<")
  })

  it("renders an empty column with its list, so it can take a drop", () => {
    const done = columnHtml(board(), "done")

    expect(done).toContain("data-kanban-list")
    expect(done).not.toContain("data-kanban-item")
  })

  it("shows each column's count next to its title", () => {
    const html = board()

    expect(columnHtml(html, "todo")).toMatch(/To do<\/span><span[^>]*>2<\/span>/)
    expect(columnHtml(html, "done")).toMatch(/Done<\/span><span[^>]*>0<\/span>/)
  })

  it("makes every card a focusable, draggable control described by the instructions", () => {
    const html = board()
    const handles = html.match(/<div data-kanban-handle[^>]*>/g) ?? []
    const instructions = html.match(/<span id="([^"]+)" class="sr-only">Press Space or Enter/)

    expect(handles.length).toBe(3)
    expect(instructions).not.toBeNull()
    for (const handle of handles) {
      expect(handle).toContain('role="button"')
      expect(handle).toContain('tabindex="0"')
      expect(handle).toContain('draggable="true"')
      expect(handle).toContain('aria-roledescription="movable card"')
      expect(handle).toContain(`aria-describedby="${instructions?.[1]}"`)
    }
  })

  it("renders an empty live region for the announcements", () => {
    expect(board()).toContain(
      '<div aria-live="assertive" aria-atomic="true" data-kanban-live class="sr-only"></div>',
    )
  })

  it("takes its visible and announced strings from labels", () => {
    const html = board({
      labels: { board: "Tafel", roleDescription: "Karte", instructions: "Leertaste" },
    })

    expect(html).toContain('aria-label="Tafel"')
    expect(html).toContain('aria-roledescription="Karte"')
    expect(html).toContain('class="sr-only">Leertaste</span>')
  })

  it("renders column headings at the level asked for", () => {
    expect(board()).toContain("<h3 ")
    expect(board({ headingLevel: 2 })).toContain("<h2 ")
    expect(board({ headingLevel: 2 })).not.toContain("<h3 ")
  })

  it("does not render an item whose column is not on the board", () => {
    const html = board({ items: [...tasks, { id: "x", column: "gone", title: "Lost" }] })

    expect(html).not.toContain(">Lost<")
  })

  it("never renders a drop indicator before a drag starts", () => {
    expect(board()).not.toContain("data-kanban-indicator")
  })
})

describe("nextKanbanSlot", () => {
  const lengths = [2, 0, 4]

  it("steps up and down within the column, stopping at both ends", () => {
    expect(nextKanbanSlot("ArrowDown", { column: 0, index: 0 }, lengths)).toEqual({
      column: 0,
      index: 1,
    })
    expect(nextKanbanSlot("ArrowDown", { column: 0, index: 2 }, lengths)).toEqual({
      column: 0,
      index: 2,
    })
    expect(nextKanbanSlot("ArrowUp", { column: 0, index: 0 }, lengths)).toEqual({
      column: 0,
      index: 0,
    })
  })

  it("moves sideways at the same index, or to the bottom of a shorter column", () => {
    expect(nextKanbanSlot("ArrowRight", { column: 0, index: 2 }, lengths)).toEqual({
      column: 1,
      index: 0,
    })
    expect(nextKanbanSlot("ArrowLeft", { column: 2, index: 3 }, lengths)).toEqual({
      column: 1,
      index: 0,
    })
    expect(nextKanbanSlot("ArrowRight", { column: 1, index: 0 }, lengths)).toEqual({
      column: 2,
      index: 0,
    })
  })

  it("keeps a card at the first and last column where it is", () => {
    expect(nextKanbanSlot("ArrowLeft", { column: 0, index: 1 }, lengths)).toEqual({
      column: 0,
      index: 1,
    })
    expect(nextKanbanSlot("ArrowRight", { column: 2, index: 1 }, lengths)).toEqual({
      column: 2,
      index: 1,
    })
  })

  it("answers undefined for a key the board does not use", () => {
    expect(nextKanbanSlot("Home", { column: 0, index: 0 }, lengths)).toBeUndefined()
  })
})

describe("moveKanbanItem", () => {
  const ids = (items: readonly Task[], column: string) =>
    items.filter((item) => item.column === column).map((item) => item.id)

  it("moves an item to another column at the index asked for", () => {
    const moved = moveKanbanItem(tasks, {
      itemId: "a",
      fromColumn: "todo",
      fromIndex: 0,
      toColumn: "doing",
      toIndex: 0,
    })

    expect(ids(moved, "doing")).toEqual(["a", "b"])
    expect(ids(moved, "todo")).toEqual(["c"])
    expect(moved.find((item) => item.id === "a")?.title).toBe("Alpha")
  })

  it("moves an item to the bottom of a column and into an empty one", () => {
    const bottom = moveKanbanItem(tasks, {
      itemId: "a",
      fromColumn: "todo",
      fromIndex: 0,
      toColumn: "doing",
      toIndex: 1,
    })
    const empty = moveKanbanItem(tasks, {
      itemId: "b",
      fromColumn: "doing",
      fromIndex: 0,
      toColumn: "done",
      toIndex: 0,
    })

    expect(ids(bottom, "doing")).toEqual(["b", "a"])
    expect(ids(empty, "done")).toEqual(["b"])
    expect(ids(empty, "doing")).toEqual([])
  })

  it("reorders within one column, counting the index without the item", () => {
    const moved = moveKanbanItem(tasks, {
      itemId: "a",
      fromColumn: "todo",
      fromIndex: 0,
      toColumn: "todo",
      toIndex: 1,
    })

    expect(ids(moved, "todo")).toEqual(["c", "a"])
  })

  it("does not change the array it was given", () => {
    const before = structuredClone(tasks)
    moveKanbanItem(tasks, {
      itemId: "a",
      fromColumn: "todo",
      fromIndex: 0,
      toColumn: "done",
      toIndex: 0,
    })

    expect(tasks).toEqual(before)
  })

  it("returns a copy for an item it does not know", () => {
    const moved = moveKanbanItem(tasks, {
      itemId: "zzz",
      fromColumn: "todo",
      fromIndex: 0,
      toColumn: "done",
      toIndex: 0,
    })

    expect(moved).toEqual(tasks)
    expect(moved).not.toBe(tasks)
  })
})
