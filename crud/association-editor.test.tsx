import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, signal } from "@preact/signals"
import { render } from "preact-render-to-string"
import type { ValidationModel } from "@spy4x/validation/model"
import { uuidV7 } from "@spy4x/platform/universal/uuid"
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

/** A junction row: it exists only to join a site and a zone. */
interface ZoneSite extends CrudRow {
  siteId: number
  zoneId: number
}

const row = (patch: Partial<ZoneSite> = {}): ZoneSite => ({
  id: 0,
  siteId: 7,
  zoneId: 0,
  deletedAt: null,
  ...patch,
})

/** The duplicate rule both source editors wrote: same parent, same child, different row. */
const samePair = (a: ZoneSite, b: ZoneSite) => a.siteId === b.siteId && a.zoneId === b.zoneId
const conflict = (value: ZoneSite, rows: ZoneSite[]) =>
  rows.find((other) => other.id !== value.id && samePair(other, value))

const idle: OperationState = { inProgress: false, result: null, error: null }

interface FakeStore {
  store: CrudAssociationStore<ZoneSite>
  removed: (string | number)[]
  restored: (string | number)[]
}

/** A junction store with no network behind it: it records removals and restores. */
function fakeStore(rows: ZoneSite[] = []): FakeStore {
  const removed: (string | number)[] = []
  const restored: (string | number)[] = []

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
  message: "This zone is already associated with this site.",
  removedMessage: "This association existed before and was removed.",
}

describe("conflictIssue", () => {
  const clean: ValidationModel<ZoneSite> = {}

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

  it("reports a duplicate keyed by a UUID string, without a payload validation cannot type", () => {
    const duplicate = uuidV7()
    const rows = [row({ id: duplicate, zoneId: 3 })]
    const vl = conflictIssue(row({ id: uuidV7(), zoneId: 3 }), clean, { ...conflictInput, rows })

    expect(vl.zoneId?.[CONFLICT]?.message).toContain("already associated")
    expect(vl.zoneId?.[CONFLICT]?.payload).toBeUndefined()
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
    cancelHref: "/sites/7/zones",
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

  it("words Save, Cancel, the removed line and the restore hint as the app asks", () => {
    const removed = row({ id: 1, deletedAt: new Date("2025-01-01T00:00:00Z") })
    const edit = render(
      <AssociationEditor
        {...shared}
        mode="edit"
        editId={1}
        store={fakeStore().store}
        blank={removed}
        saveLabel="Keep changes"
        cancelLabel="Back"
        removedLabel={(ago) => `Detached ${ago}`}
      >
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(edit).toContain("Keep changes</button>")
    expect(edit).not.toContain(">Save</button>")
    expect(edit).toContain(">Back</a>")
    expect(edit).toMatch(/Detached .+ ago/)
    expect(edit).not.toContain("Removed ")

    const add = render(
      <AssociationEditor
        {...shared}
        mode="add"
        store={fakeStore([row({ id: 5, zoneId: 0, deletedAt: new Date() })]).store}
        restoreHint="Bring the old one back instead."
      >
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
      </AssociationEditor>,
    )

    expect(add).toContain("Bring the old one back instead.")
    expect(add).not.toContain("Restoring it keeps the record")
  })

  it("heads the form with an h1, or with the level the page asks for", () => {
    const at = (headingLevel?: 2) =>
      render(
        <AssociationEditor
          {...shared}
          mode="add"
          store={fakeStore().store}
          headingLevel={headingLevel}
        >
          {({ vm, vl }) => <TextField vm={vm} vl={vl} name="zoneId" label="Zone" />}
        </AssociationEditor>,
      )

    expect(at()).toMatch(/<h1[^>]*><span class="block truncate">Add association<\/span><\/h1>/)
    expect(at(2)).toMatch(/<h2[^>]*><span class="block truncate">Add association<\/span><\/h2>/)
    expect(at(2)).not.toContain("<h1")
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
