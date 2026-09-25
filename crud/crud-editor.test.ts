import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, signal } from "@preact/signals"
import type { ValidationModel } from "@spy4x/validation/model"
import type { CrudEditorStore } from "./store.ts"
import { editorState, submitEditor, toggleArchiveState } from "./crud-editor.tsx"
import type { CrudRow, DeletionDependency } from "./types.ts"

interface Region extends CrudRow {
  name: string
}

const region = (patch: Partial<Region> = {}): Region => ({
  id: 3,
  name: "North",
  deletedAt: null,
  ...patch,
})

interface FakeStore {
  store: CrudEditorStore<Region>
  created: Region[]
  updated: [number, Region][]
}

/**
 * A store with no network behind it: it records what it was asked to do and answers with a row.
 *
 * @param failure When set, the answer is this error instead of a row.
 */
function fakeStore(failure?: { message: string }): FakeStore {
  const created: Region[] = []
  const updated: [number, Region][] = []
  const idle = { inProgress: false, result: null, error: null }

  return {
    created,
    updated,
    store: {
      one: { byId: () => computed(() => undefined) },
      op: {
        create: signal(idle),
        update: () => signal(undefined),
      },
      create: (data) => {
        created.push(data)
        return Promise.resolve(
          failure === undefined
            ? { error: null, result: { ...data, id: 7 } } as const
            : { error: failure, result: null } as const,
        )
      },
      update: (id, data) => {
        updated.push([id, data])
        return Promise.resolve(
          failure === undefined
            ? { error: null, result: data } as const
            : { error: failure, result: null } as const,
        )
      },
    },
  }
}

describe("submitEditor", () => {
  it("creates in add mode and hands back the new row", async () => {
    const fake = fakeStore()
    const outcome = await submitEditor({
      mode: "add",
      store: fake.store,
      value: region({ id: 0 }),
    })

    expect(fake.created).toHaveLength(1)
    expect(fake.updated).toHaveLength(0)
    expect(outcome.created?.id).toBe(7)
    expect(outcome.updated).toBe(false)
  })

  it("patches the edited row and asks for a reload", async () => {
    const fake = fakeStore()
    const outcome = await submitEditor({
      mode: "edit",
      id: 3,
      store: fake.store,
      value: region(),
      blocked: 0,
    })

    expect(fake.updated).toEqual([[3, region()]])
    expect(fake.created).toHaveLength(0)
    expect(outcome.updated).toBe(true)
    expect(outcome.created).toBeNull()
  })

  it("writes nothing when the archive is blocked", async () => {
    const fake = fakeStore()
    const outcome = await submitEditor({
      mode: "edit",
      id: 3,
      store: fake.store,
      value: region({ deletedAt: new Date("2025-03-04T12:00:00Z") }),
      blocked: 2,
    })

    expect(fake.updated).toHaveLength(0)
    expect(outcome.updated).toBe(false)
    expect(outcome.error).toBeNull()
  })

  it("reports a failed create instead of a row to navigate to", async () => {
    const fake = fakeStore({ message: "server said no" })
    const outcome = await submitEditor({
      mode: "add",
      store: fake.store,
      value: region({ id: 0 }),
    })

    expect(outcome.created).toBeNull()
    expect(outcome.error?.message).toBe("server said no")
  })

  it("reports a failed update without asking for a reload", async () => {
    const fake = fakeStore({ message: "server said no" })
    const outcome = await submitEditor({
      mode: "edit",
      id: 3,
      store: fake.store,
      value: region(),
    })

    expect(outcome.updated).toBe(false)
    expect(outcome.error?.message).toBe("server said no")
  })
})

describe("toggleArchiveState", () => {
  const blockers: DeletionDependency[] = [
    { kind: "Zones", values: [{ title: "North gate", url: "/devices/zones/4/edit" }] },
  ]

  it("stamps the archive time and reports what blocks the archive", () => {
    const next = toggleArchiveState(region(), () => blockers)

    expect(next.deletedAt).toBeInstanceOf(Date)
    expect(next.blocked).toEqual(blockers)
  })

  it("asks nothing when the caller gave no dependency port", () => {
    expect(toggleArchiveState(region()).blocked).toEqual([])
  })

  it("un-archives by clearing the column and the blockers", () => {
    const next = toggleArchiveState(
      region({ deletedAt: new Date("2025-01-01T00:00:00Z") }),
      () => blockers,
    )

    expect(next.deletedAt).toBeNull()
    expect(next.blocked).toEqual([])
  })

  it("reads an undefined column as not archived", () => {
    expect(toggleArchiveState(region({ deletedAt: undefined })).deletedAt).toBeInstanceOf(Date)
  })
})

describe("editorState", () => {
  const clean: ValidationModel<Region> = {}
  const invalid: ValidationModel<Region> = { name: { SCHEMA: { message: "required" } } }
  const base = {
    initialized: true,
    validation: clean,
    canChange: true,
    inProgress: false,
    blocked: 0,
  }

  it("is not valid before the row has been loaded", () => {
    expect(editorState({ ...base, initialized: false, validation: clean }).valid).toBe(false)
  })

  it("is valid once an initialised form carries no issue", () => {
    expect(editorState(base).valid).toBe(true)
  })

  it("is busy while a request is in flight", () => {
    expect(editorState({ ...base, inProgress: true }).busy).toBe(true)
  })

  it("is busy when the user may not change the entity, even with nothing in flight", () => {
    expect(editorState({ ...base, canChange: false }).busy).toBe(true)
  })

  it("enables save only when valid, idle and unblocked", () => {
    expect(editorState(base).saveEnabled).toBe(true)
    expect(editorState({ ...base, validation: invalid }).saveEnabled).toBe(false)
    expect(editorState({ ...base, inProgress: true }).saveEnabled).toBe(false)
    expect(editorState({ ...base, blocked: 1 }).saveEnabled).toBe(false)
  })
})
