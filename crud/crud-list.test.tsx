import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type ReadonlySignal, signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import {
  CrudList,
  type CrudListBaseProps,
  listRows,
  RowAction,
  RowActions,
  rowsForStatus,
} from "./crud-list.tsx"
import { search } from "./search.ts"
import type { CrudListStore } from "./store.ts"
import type { CrudModel, CrudStatus, StoreErrorLike } from "./types.ts"

interface Region extends CrudModel {
  name: string
  deletedAt: Date | null
}

const live = (id: number, name: string): Region => ({ id, name, deletedAt: null })
const archived = (id: number, name: string): Region => ({
  id,
  name,
  deletedAt: new Date("2025-01-01T00:00:00Z"),
})

const liveRows = [live(1, "North"), live(2, "South")]
const archivedRows = [archived(3, "Old North")]

/** A store with no network behind it: plain signals the test can read and write. */
function fakeStore(
  rows: Region[] = liveRows,
  deleted: Region[] = archivedRows,
  error: StoreErrorLike | null = null,
): CrudListStore<Region> {
  return {
    list: { nonDeleted: signal(rows), deleted: signal(deleted) },
    op: { list: signal({ inProgress: false, result: null, error }) },
  }
}

const match = (row: Region, word: string) => search(row.name, word)

/** Everything the base props need, so each test states only what it is about. */
type ListExtras = Partial<Omit<CrudListBaseProps<Region>, "title" | "match" | "header" | "row">>

const baseProps = {
  title: "Regions",
  match,
  header: <th scope="col">Name</th>,
  row: (row: Region) => <td>{row.name}</td>,
}

/** Render a list backed by a store. */
function storeList(props: ListExtras & { store: CrudListStore<Region> }): string {
  return render(<CrudList {...baseProps} {...props} />)
}

/** Render a list backed by a plain signal, the way a nested or read-only list is. */
function signalList(
  props: ListExtras & {
    rows: ReadonlySignal<Region[]>
    error?: ReadonlySignal<StoreErrorLike | null>
  },
): string {
  return render(<CrudList {...baseProps} {...props} />)
}

describe("rowsForStatus", () => {
  it("reads the non-deleted slice for the active status", () => {
    expect(rowsForStatus(fakeStore(), "active")).toEqual(liveRows)
  })

  it("reads the deleted slice for the archived status", () => {
    expect(rowsForStatus(fakeStore(), "archived")).toEqual(archivedRows)
  })

  it("reads the slice's current value, not the one it had when the status was read", () => {
    const store = fakeStore()
    expect(rowsForStatus(store, "active")).toHaveLength(2)
    ;(store.list.nonDeleted as { value: Region[] }).value = [...liveRows, live(4, "East")]
    expect(rowsForStatus(store, "active")).toHaveLength(3)
  })
})

describe("listRows", () => {
  it("filters the status slice by the query", () => {
    expect(listRows(fakeStore(), "active", "north", match).map((row) => row.name)).toEqual([
      "North",
    ])
  })

  it("filters the archived slice too", () => {
    expect(listRows(fakeStore(), "archived", "old", match).map((row) => row.name)).toEqual([
      "Old North",
    ])
  })
})

describe("CrudList", () => {
  it("renders one body row per row of the active slice", () => {
    const html = storeList({ store: fakeStore() })

    expect(html).toContain("<td>North</td>")
    expect(html).toContain("<td>South</td>")
    expect(html).not.toContain("Old North")
  })

  it("switches to the archived slice with the status signal", () => {
    const html = storeList({ store: fakeStore(), status: signal<CrudStatus>("archived") })

    expect(html).toContain("Old North")
    expect(html).not.toContain("<td>North</td>")
  })

  it("badges the non-deleted total, not the filtered count", () => {
    const html = storeList({ store: fakeStore(), query: signal("north") })

    expect(html).toContain(">2</span>")
    expect(html).toContain("<td>North</td>")
    expect(html).not.toContain("<td>South</td>")
  })

  it("hides the badge when asked to", () => {
    expect(storeList({ store: fakeStore(), badge: false })).not.toContain("translate-y-0.5")
  })

  it("shows the store's load error", () => {
    const failing = fakeStore(liveRows, archivedRows, { message: "gateway is down" })
    expect(storeList({ store: failing })).toContain("gateway is down")
  })

  it("shows no banner when the collection loaded cleanly", () => {
    expect(storeList({ store: fakeStore() })).not.toContain(`role="alert"`)
  })

  it("binds the search box to the query signal", () => {
    expect(storeList({ store: fakeStore(), query: signal("north") })).toContain(`value="north"`)
  })

  it("renders the status select with the default wording", () => {
    const html = storeList({ store: fakeStore() })
    expect(html).toContain(">Active</option>")
    expect(html).toContain(">Archived</option>")
  })

  it("renames the archived option when the app calls it something else", () => {
    const html = storeList({ store: fakeStore(), statusFilter: { archived: "Banned" } })

    expect(html).toContain(">Banned</option>")
    expect(html).not.toContain(">Archived</option>")
  })

  it("hides the status select when the filter is off", () => {
    expect(storeList({ store: fakeStore(), statusFilter: false })).not.toContain("<select")
  })

  it("renders the rows of a plain signal instead of a store's slices", () => {
    const html = signalList({ rows: signal([live(9, "Scoped")]) })

    expect(html).toContain("<td>Scoped</td>")
    expect(html).not.toContain("<select")
  })

  it("shows the error of a signal-backed list", () => {
    const html = signalList({
      rows: signal([live(9, "Scoped")]),
      error: signal<StoreErrorLike | null>({ message: "scoped list failed" }),
    })
    expect(html).toContain("scoped list failed")
  })

  it("adds a header and a cell per row when actions are given", () => {
    const html = storeList({
      store: fakeStore(),
      actions: (row: Region) => <a href={`/devices/regions/${row.id}/edit`}>Edit</a>,
    })

    expect(html).toContain(">Actions</th>")
    expect(html).toContain(`href="/devices/regions/1/edit"`)
    expect(html).toContain(`href="/devices/regions/2/edit"`)
  })

  it("omits the actions column when there are no actions", () => {
    expect(storeList({ store: fakeStore() })).not.toContain(">Actions</th>")
  })

  it("shows the add action only when there is somewhere to go", () => {
    expect(storeList({ store: fakeStore() })).not.toContain("Add new")
    expect(storeList({ store: fakeStore(), addHref: "/devices/regions/add" })).toContain("Add new")
  })

  it("hides the add action from a user who may not add", () => {
    const html = storeList({
      store: fakeStore(),
      addHref: "/devices/regions/add",
      canAdd: () => false,
    })
    expect(html).not.toContain("Add new")
  })

  it("replaces the default title with the caller's slot", () => {
    const html = storeList({
      store: fakeStore(),
      titleSlot: <span>Regions for lamp box ABC</span>,
    })

    expect(html).toContain("Regions for lamp box ABC")
    expect(html).not.toContain("<span>Regions</span>")
  })
})

describe("RowActions", () => {
  it("renders a link item for an href", () => {
    const html = render(
      <RowActions>
        <RowAction href="/devices/regions/1/edit">Edit</RowAction>
      </RowActions>,
    )
    expect(html).toContain(`href="/devices/regions/1/edit"`)
  })

  it("renders a button item for an onClick, in red when destructive", () => {
    const html = render(
      <RowActions>
        <RowAction danger onClick={() => {}}>Delete</RowAction>
      </RowActions>,
    )

    expect(html).toContain("<button")
    expect(html).toContain("text-red-600")
  })
})
