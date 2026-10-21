import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type ReadonlySignal, signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import { search } from "@spy4x/platform/universal/text"
import { CrudList, type CrudListBaseProps, listRows, pageOf, rowsForStatus } from "./crud-list.tsx"
import type { CrudListStore } from "./store.ts"
import type { CrudModel, CrudStatus, StoreErrorLike } from "./types.ts"
import { buildModelStore } from "@spy4x/preact-signals/build-model-store"
import { RemoteEvent } from "@spy4x/preact-signals/types"
import { type } from "arktype"

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

/**
 * A store with no network behind it: plain signals the test can read and write. Its load has
 * settled with the rows it holds, the way a store looks once its collection has arrived.
 */
function fakeStore(
  rows: Region[] = liveRows,
  deleted: Region[] = archivedRows,
  error: StoreErrorLike | null = null,
): CrudListStore<Region> {
  return {
    list: { nonDeleted: signal(rows), deleted: signal(deleted) },
    op: {
      list: signal({ inProgress: false, result: error ? null : [...rows, ...deleted], error }),
    },
  }
}

/** A store whose load has not settled: no result yet, whatever rows it holds. */
function unsettledStore(rows: Region[] = []): CrudListStore<Region> {
  return {
    list: { nonDeleted: signal(rows), deleted: signal([]) },
    op: { list: signal({ inProgress: false, result: null, error: null }) },
  }
}

const date = type("Date | string.date.iso.parse")
const teamSchema = type({
  id: "number",
  name: "string",
  createdAt: date,
  updatedAt: date,
  deletedAt: date.or("null"),
})
const teamBase = teamSchema.omit("id", "createdAt", "updatedAt", "deletedAt")
const teamAt = new Date("2025-03-04T12:00:00Z")
const team = (id: number, name: string) => ({
  id,
  name,
  createdAt: teamAt,
  updatedAt: teamAt,
  deletedAt: null,
})

/** The real `buildModelStore`, as an application builds it; no request is ever sent. */
function realStore() {
  return buildModelStore({
    model: "team",
    endpoint: "/api/teams",
    schemas: { full: teamSchema, create: teamBase, update: teamBase.partial() },
    fetch: () => Promise.reject(new Error("no request is expected")),
  })
}

/** Render a list on the real store. */
function realList(store: ReturnType<typeof realStore>): string {
  return render(
    <CrudList
      title="Teams"
      store={store}
      match={(row, word) => search(row.name, word)}
      header={<th scope="col">Name</th>}
      row={(row) => <td>{row.name}</td>}
    />,
  )
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
    loading?: ReadonlySignal<boolean>
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

describe("pageOf", () => {
  const five = [1, 2, 3, 4, 5]

  it("cuts the page asked for out of the rows", () => {
    expect(pageOf(five, 2, 2)).toEqual({ rows: [3, 4], page: 2, pageCount: 3 })
  })

  it("shows the last page when the page asked for is past the end", () => {
    expect(pageOf(five, 9, 2)).toEqual({ rows: [5], page: 3, pageCount: 3 })
  })

  it("shows the first page for a page below one, or one that is no number", () => {
    expect(pageOf(five, 0, 2).rows).toEqual([1, 2])
    expect(pageOf(five, Number.NaN, 2).rows).toEqual([1, 2])
  })

  it("counts no pages for an empty list and still shows page one", () => {
    expect(pageOf([], 1, 10)).toEqual({ rows: [], page: 1, pageCount: 0 })
    expect(pageOf([], 4, 10)).toEqual({ rows: [], page: 1, pageCount: 0 })
  })

  it("shows one row a page for a page size below one", () => {
    expect(pageOf(five, 1, 0)).toEqual({ rows: [1], page: 1, pageCount: 5 })
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

  it("names the Search button Search, or what the app calls it", () => {
    expect(storeList({ store: fakeStore() })).toContain(`type="submit" title="Search"`)
    expect(storeList({ store: fakeStore(), searchLabel: "Find a region" }))
      .toContain(`type="submit" title="Find a region"`)
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
      actions: (row: Region) => <a href={`/regions/${row.id}/edit`}>Edit</a>,
    })

    expect(html).toContain(">Actions</th>")
    expect(html).toContain(`href="/regions/1/edit"`)
    expect(html).toContain(`href="/regions/2/edit"`)
  })

  it("omits the actions column when there are no actions", () => {
    expect(storeList({ store: fakeStore() })).not.toContain(">Actions</th>")
  })

  it("shows the add action only when there is somewhere to go", () => {
    expect(storeList({ store: fakeStore() })).not.toContain("Add new")
    expect(storeList({ store: fakeStore(), addHref: "/regions/add" })).toContain("Add new")
  })

  it("hides the add action from a user who may not add", () => {
    const html = storeList({
      store: fakeStore(),
      addHref: "/regions/add",
      canAdd: () => false,
    })
    expect(html).not.toContain("Add new")
  })

  it("shows an empty state in place of the table when the list has no row", () => {
    const html = storeList({ store: fakeStore([], []) })

    expect(html).toContain(`role="status"`)
    expect(html).toContain(">Nothing here yet</h2>")
    expect(html).not.toContain("<table")
    expect(storeList({ store: fakeStore() })).not.toContain(`role="status"`)
  })

  it("words the empty state as the app asks", () => {
    const html = storeList({
      store: fakeStore([], []),
      emptyTitle: "No regions yet",
      emptyDescription: "Add the first one.",
    })

    expect(html).toContain(">No regions yet</h2>")
    expect(html).toContain("Add the first one.")
    expect(html).not.toContain("Nothing here yet")
  })

  it("says the search matched nothing, in the default or the app's wording", () => {
    const html = storeList({ store: fakeStore(), query: signal("west") })
    expect(html).toContain(">Nothing matches your search</h2>")
    expect(html).not.toContain("Nothing here yet")

    const worded = storeList({
      store: fakeStore(),
      query: signal("west"),
      noMatchTitle: "No such region",
      noMatchDescription: "Try a shorter name.",
    })
    expect(worded).toContain(">No such region</h2>")
    expect(worded).toContain("Try a shorter name.")
  })

  it("keeps the table, and no empty state, while a store that loaded before is loading again", () => {
    const loading: CrudListStore<Region> = {
      list: { nonDeleted: signal([]), deleted: signal([]) },
      op: { list: signal({ inProgress: true, result: [], error: null }) },
    }
    const html = storeList({ store: loading })

    expect(html).toContain("<table")
    expect(html).not.toContain(`role="status"`)
  })

  it("on a real model store, shows the table before the first rows arrive and the empty state only after an empty list has", async () => {
    const store = realStore()

    const before = realList(store)
    expect(before).toContain("<table")
    expect(before).not.toContain(`role="status"`)

    await store.onWs([], RemoteEvent.LIST)
    const empty = realList(store)
    expect(empty).toContain(">Nothing here yet</h2>")
    expect(empty).not.toContain("<table")

    await store.onWs([team(1, "Design")], RemoteEvent.LIST)
    const filled = realList(store)
    expect(filled).toContain("<td>Design</td>")
    expect(filled).not.toContain(`role="status"`)
  })

  it("keeps the table for a store that holds no row and whose load has not settled", () => {
    const html = storeList({ store: unsettledStore() })

    expect(html).toContain("<table")
    expect(html).not.toContain(`role="status"`)
  })

  it("says the search matched nothing over rows a store holds before any load settled", () => {
    const html = storeList({ store: unsettledStore(liveRows), query: signal("west") })

    expect(html).toContain(">Nothing matches your search</h2>")
  })

  it("keeps the table of a signal-backed list while its loading signal is true", () => {
    const loading = signalList({ rows: signal<Region[]>([]), loading: signal(true) })
    expect(loading).toContain("<table")
    expect(loading).not.toContain(`role="status"`)

    const loaded = signalList({ rows: signal<Region[]>([]), loading: signal(false) })
    expect(loaded).toContain(">Nothing here yet</h2>")
  })

  it("shows the load error without claiming the list is empty", () => {
    const html = storeList({ store: fakeStore([], [], { message: "gateway is down" }) })

    expect(html).toContain("gateway is down")
    expect(html).not.toContain(`role="status"`)

    // A signal-backed list has no load to wait for, so only the error holds the claim back.
    const nested = signalList({
      rows: signal<Region[]>([]),
      error: signal({ message: "gateway is down" }),
    })
    expect(nested).toContain("gateway is down")
    expect(nested).not.toContain(`role="status"`)
  })

  it("shows the empty state of a signal-backed list", () => {
    expect(signalList({ rows: signal<Region[]>([]) })).toContain(">Nothing here yet</h2>")
  })

  const manyRows = [live(1, "North"), live(2, "South"), live(3, "East"), live(4, "West")]

  it("renders every row and no pager when no page size is given", () => {
    const html = storeList({ store: fakeStore(manyRows) })

    expect(html.match(/<td>/g)?.length).toBe(4)
    expect(html).not.toContain(`aria-label="Pagination"`)
  })

  it("renders one page of rows and a pager when the rows fill more than one page", () => {
    const html = storeList({ store: fakeStore(manyRows), pageSize: 3 })

    expect(html.match(/<td>/g)?.length).toBe(3)
    expect(html).not.toContain("<td>West</td>")
    expect(html).toContain(`<nav aria-label="Pagination"`)
    expect(html).toContain(`aria-current="page" aria-label="Page 1"`)
  })

  it("renders the page the caller's signal names", () => {
    const html = storeList({ store: fakeStore(manyRows), pageSize: 3, page: signal(2) })

    expect(html.match(/<td>/g)?.length).toBe(1)
    expect(html).toContain("<td>West</td>")
  })

  it("renders no pager when the rows fit on one page", () => {
    const html = storeList({ store: fakeStore(manyRows), pageSize: 4 })

    expect(html.match(/<td>/g)?.length).toBe(4)
    expect(html).not.toContain("<nav")
  })

  it("words the pager as the app asks", () => {
    const html = storeList({
      store: fakeStore(manyRows),
      pageSize: 3,
      paginationLabels: {
        label: "Region pages",
        previousLabel: "Earlier",
        nextLabel: "Later",
        pageLabel: (page) => `Sheet ${page}`,
      },
    })

    expect(html).toContain(`<nav aria-label="Region pages"`)
    expect(html).toContain("Earlier")
    expect(html).toContain("Later")
    expect(html).toContain(`aria-label="Sheet 2"`)
    expect(html).not.toContain(`aria-label="Page 2"`)
  })

  it("names the search field after its placeholder, or what the app calls it", () => {
    expect(storeList({ store: fakeStore() })).toContain(`aria-label="Search"`)
    expect(storeList({ store: fakeStore(), searchPlaceholder: "Find" }))
      .toContain(`aria-label="Find"`)
    expect(storeList({ store: fakeStore(), searchFieldLabel: "Search regions" }))
      .toContain(`placeholder="Search" aria-label="Search regions"`)
  })

  it("heads the list with an h1, or with the level the page asks for", () => {
    expect(storeList({ store: fakeStore() })).toMatch(/<h1[^>]*><span>Regions<\/span>/)

    const nested = storeList({ store: fakeStore([], []), headingLevel: 2 })
    expect(nested).toMatch(/<h2[^>]*><span>Regions<\/span>/)
    expect(nested).not.toContain("<h1")
    expect(nested).toContain(">Nothing here yet</h3>")
  })

  it("heads the empty state no deeper than h4, under a title at any level", () => {
    const html = storeList({ store: fakeStore([], []), headingLevel: 5 })

    expect(html).toMatch(/<h5[^>]*><span>Regions<\/span>/)
    expect(html).toContain(">Nothing here yet</h4>")
  })

  it("replaces the default title with the caller's slot", () => {
    const html = storeList({
      store: fakeStore(),
      titleSlot: <span>Regions for site ABC</span>,
    })

    expect(html).toContain("Regions for site ABC")
    expect(html).not.toContain("<span>Regions</span>")
  })
})
