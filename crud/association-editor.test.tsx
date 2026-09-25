import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import type { ValidationModel } from "@spy4x/validation/model"
import {
  associationActions,
  AssociationEditor,
  CONFLICT,
  conflictIssue,
  type CrudAssociationStore,
  isRestorable,
} from "./association-editor.tsx"
import { TextField } from "./field.tsx"
import type { CrudRow, OperationState } from "./types.ts"

/** A junction row: it exists only to join a lamp box and a zone. */
interface ZoneLampBox extends CrudRow {
  lampBoxId: number
  zoneId: number
}

const row = (patch: Partial<ZoneLampBox> = {}): ZoneLampBox => ({
  id: 0,
  lampBoxId: 7,
  zoneId: 0,
  deletedAt: null,
  ...patch,
})

/** The duplicate rule both source editors wrote: same parent, same child, different row. */
const samePair = (a: ZoneLampBox, b: ZoneLampBox) =>
  a.lampBoxId === b.lampBoxId && a.zoneId === b.zoneId
const conflict = (value: ZoneLampBox, rows: ZoneLampBox[]) =>
  rows.find((other) => other.id !== value.id && samePair(other, value))

const idle: OperationState = { inProgress: false, result: null, error: null }

interface FakeStore {
  store: CrudAssociationStore<ZoneLampBox>
  removed: number[]
  restored: number[]
}

/** A junction store with no network behind it: it records removals and restores. */
function fakeStore(rows: ZoneLampBox[] = []): FakeStore {
  const removed: number[] = []
  const restored: number[] = []

  return {
    removed,
    restored,
    store: {
      list: { all: signal(rows) },
      one: { byId: (id) => computed(() => rows.find((row) => row.id === id)) },
      op: {
        create: signal(idle),
        update: () => signal(undefined),
        delete: () => signal(undefined),
        undelete: () => signal(undefined),
      },
      create: (data) => Promise.resolve({ error: null, result: { ...data, id: 99 } } as const),
      update: (_id, data) => Promise.resolve({ error: null, result: data } as const),
      delete: (id) => {
        removed.push(id)
        return Promise.resolve({ error: null, result: row({ id }) })
      },
      undelete: (id) => {
        restored.push(id)
        return Promise.resolve({ error: null, result: row({ id }) })
      },
    },
  }
}

const conflictInput = {
  conflict,
  field: "zoneId" as const,
  message: "This zone is already associated with this lamp box.",
  removedMessage: "This association existed before and was removed.",
}

describe("conflictIssue", () => {
  const clean: ValidationModel<ZoneLampBox> = {}

  it("leaves the model clean when nothing duplicates it", () => {
    const vl = conflictIssue(row({ zoneId: 3 }), clean, { ...conflictInput, rows: [] })
    expect(vl.zoneId).toBeUndefined()
  })

  it("reports a live duplicate beside the field the user has to change", () => {
    const rows = [row({ id: 5, zoneId: 3 })]
    const vl = conflictIssue(row({ id: 0, zoneId: 3 }), clean, { ...conflictInput, rows })

    expect(vl.zoneId?.[CONFLICT]?.message).toContain("already associated")
    expect(vl.zoneId?.[CONFLICT]?.payload).toBe(5)
  })

  it("says a duplicate was removed rather than that it exists", () => {
    const rows = [row({ id: 5, zoneId: 3, deletedAt: new Date("2025-01-01T00:00:00Z") })]
    const vl = conflictIssue(row({ id: 0, zoneId: 3 }), clean, { ...conflictInput, rows })

    expect(vl.zoneId?.[CONFLICT]?.message).toContain("existed before")
  })

  it("clears the issue once the row no longer duplicates anything", () => {
    const conflicting = conflictIssue(row({ id: 0, zoneId: 3 }), clean, {
      ...conflictInput,
      rows: [row({ id: 5, zoneId: 3 })],
    })
    const fixed = conflictIssue(row({ id: 0, zoneId: 4 }), conflicting, {
      ...conflictInput,
      rows: [row({ id: 5, zoneId: 3 })],
    })

    expect(fixed.zoneId).toBeUndefined()
  })
})

describe("isRestorable", () => {
  it("is true only for a duplicate that carries a deletedAt", () => {
    expect(isRestorable(undefined)).toBe(false)
    expect(isRestorable(row({ id: 5 }))).toBe(false)
    expect(isRestorable(row({ id: 5, deletedAt: new Date() }))).toBe(true)
  })
})

describe("associationActions", () => {
  it("removes a junction row for good rather than archiving it", async () => {
    const fake = fakeStore()
    await associationActions(fake.store).remove(4)

    expect(fake.removed).toEqual([4])
    expect(fake.restored).toEqual([])
  })

  it("restores through undelete, so a duplicate can be repaired instead of re-created", async () => {
    const fake = fakeStore()
    await associationActions(fake.store).restore(4)

    expect(fake.restored).toEqual([4])
    expect(fake.removed).toEqual([])
  })
})

describe("AssociationEditor", () => {
  const shared = {
    blank: row(),
    entity: "association",
    cancelHref: "/devices/lamp-boxes/7/zones",
    conflictField: "zoneId" as const,
    conflict,
  }

  it("offers removal in edit mode and no removal on a row that does not exist", () => {
    const store = fakeStore().store
    const html = render(
      <AssociationEditor {...shared} mode="edit" editId={1} store={store}>
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(html).toContain(">Delete</button>")
    expect(html).toContain(">Save</button>")
    expect(render(
      <AssociationEditor {...shared} mode="add" store={store}>
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )).not.toContain(">Delete</button>")
  })

  it("offers restore in place of removal for a row that was removed", () => {
    const html = render(
      <AssociationEditor
        {...shared}
        mode="edit"
        editId={1}
        store={fakeStore().store}
        blank={row({ id: 1, deletedAt: new Date("2025-01-01T00:00:00Z") })}
      >
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(html).toContain(">Restore</button>")
    expect(html).not.toContain(">Delete</button>")
    expect(html).toContain("Removed")
  })

  it("offers to restore the duplicate when the row it collides with was removed", () => {
    const store = fakeStore([row({ id: 5, zoneId: 0, deletedAt: new Date() })]).store
    const html = render(
      <AssociationEditor {...shared} mode="add" store={store}>
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(html).toContain("Restoring it keeps the record that was there before")

    const live = fakeStore([row({ id: 5, zoneId: 0 })]).store
    expect(
      render(
        <AssociationEditor {...shared} mode="add" store={live}>
          {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
        </AssociationEditor>,
      ),
    ).not.toContain("Restoring it keeps the record")
  })

  it("adds no archive toggle: a junction row is removed, never archived", () => {
    const html = render(
      <AssociationEditor {...shared} mode="edit" editId={1} store={fakeStore().store}>
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(html).not.toContain(`type="checkbox"`)
  })
})
