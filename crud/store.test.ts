import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { buildModelStore } from "@spy4x/preact-signals/build-model-store"
import { RemoteEvent } from "@spy4x/preact-signals/types"
import { type } from "arktype"
import type { CrudEditorStore, CrudListStore } from "./store.ts"
import type { CrudRow } from "./types.ts"

/**
 * The scaffold reads a store through structural interfaces rather than importing `ModelStore`.
 *
 * This suite is what makes that claim checkable: the store below is the real `buildModelStore`,
 * bound to a fake `fetch`, and it is used through `CrudListStore` and `CrudEditorStore` with no
 * adapter, no cast and no `extraOps`. If the state layer changes shape, `deno check` fails here
 * rather than in an application.
 */

const date = type("Date | string.date.iso.parse")

const regionSchema = type({
  id: "number",
  name: "1 <= string <= 255",
  createdAt: date,
  updatedAt: date,
  deletedAt: date.or("null"),
})
const regionBase = regionSchema.omit("id", "createdAt", "updatedAt", "deletedAt")
const regionUpdate = regionBase.partial()

type Region = typeof regionSchema.infer

const at = new Date("2025-03-04T12:00:00Z")

const row = (id: number, name: string, deletedAt: Date | null = null): Region => ({
  id,
  name,
  createdAt: at,
  updatedAt: at,
  deletedAt,
})

/** A `Response` carrying a row, so a create or an update settles without a network. */
const respondWith = (body: unknown): typeof fetch => () =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  )

function buildRegionStore(body: unknown = row(9, "East")) {
  return buildModelStore({
    model: "region",
    endpoint: "/api/regions",
    schemas: { full: regionSchema, create: regionBase, update: regionUpdate },
    fetch: respondWith(body),
  })
}

describe("a real ModelStore as CrudListStore", () => {
  it("splits the collection the way the list's status filter expects", async () => {
    const store = buildRegionStore()
    const list: CrudListStore<Region> = store

    await store.onWs([row(1, "North"), row(2, "Old North", at)], RemoteEvent.LIST)

    expect(list.list.nonDeleted.value.map((region) => region.name)).toEqual(["North"])
    expect(list.list.deleted.value.map((region) => region.name)).toEqual(["Old North"])
  })

  it("reports the load error through `op.list`, which is what the banner reads", () => {
    const store = buildRegionStore()
    const list: CrudListStore<Region> = store
    expect(list.op.list.value.error).toBeNull()
  })
})

describe("a real ModelStore as CrudEditorStore", () => {
  it("creates the whole row the form holds and carries the new one back", async () => {
    const store = buildRegionStore()
    const editor: CrudEditorStore<Region> = store

    const outcome = await editor.create({ ...row(0, "East"), id: 0 })

    expect(outcome.error).toBeNull()
    expect(outcome.result?.name).toBe("East")
    expect(store.list.nonDeleted.value.map((region) => region.name)).toEqual(["East"])
  })

  it("finds the row the editor loads by id", async () => {
    const store = buildRegionStore()
    const editor: CrudEditorStore<Region> = store

    await store.onWs([row(4, "South")], RemoteEvent.LIST)

    expect(editor.one.byId(4).value?.name).toBe("South")
    expect(editor.one.byId(99).value).toBeUndefined()
  })

  it("reports the per-row update slot the busy flag watches", async () => {
    const store = buildRegionStore(row(4, "South renamed"))
    const editor: CrudEditorStore<Region> = store

    await store.onWs([row(4, "South")], RemoteEvent.LIST)

    // No operation has run on the row yet, so there is no slot at all — which is why the editor
    // reads `op.update(id).value?.inProgress === true` and not the slot itself.
    expect(editor.op.update(4).value).toBeUndefined()

    const outcome = await editor.update(4, { ...row(4, "South renamed") })
    expect(outcome.error).toBeNull()
    expect(editor.op.update(4).value?.inProgress).toBe(false)
  })

  it("keeps a soft-deleted row in the collection, where the archive toggle left it", async () => {
    const store = buildRegionStore(row(4, "South", at))
    const editor: CrudEditorStore<Region> = store

    await store.onWs([row(4, "South")], RemoteEvent.LIST)
    await editor.update(4, { ...row(4, "South", at) })

    expect(store.list.deleted.value.map((region) => region.id)).toEqual([4])
    expect(store.list.all.value.map((region) => region.id)).toEqual([4])
  })
})

describe("the scaffold's row contract", () => {
  it("accepts a store row without widening it", async () => {
    const store = buildRegionStore()
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const rows: CrudRow[] = store.list.all.value
    expect(rows[0].id).toBe(1)
  })
})
