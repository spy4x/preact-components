/**
 * Examples of the helpers `crud/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`. A helper that reads a store is
 * handed the smallest object with that store's shape, built from `@preact/signals`, and every
 * timestamp is a literal, so each card prints the same output on every render.
 *
 * An example that reads a signal and then writes it runs inside `untracked`. `run` is called during
 * the card's render, and a signal read there subscribes the card to it, so the write that follows
 * would re-render the card, which runs the example again, forever — the page never finishes loading.
 */

import {
  associationActions,
  commitNumber,
  CONFLICT,
  conflictIssue,
  type CrudAssociationStore,
  editorState,
  fieldText,
  formatTimestamp,
  isRestorable,
  listRows,
  rowsForStatus,
  setField,
  submitEditor,
  timeAgo,
  toggleArchiveState,
} from "@preact-components/crud"
import { signal, untracked } from "@preact/signals"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

/** The row every card here works with. */
interface Project {
  id: number
  name: string
  deletedAt: string | null
}

const projects: Project[] = [
  { id: 1, name: "Launch plan", deletedAt: null },
  { id: 2, name: "Help centre", deletedAt: null },
  { id: 3, name: "Old launch notes", deletedAt: "2026-01-15T09:00:00Z" },
]

/** A list store: the two status slices and the load state, as `CrudListStore` reads them. */
function listStore() {
  return {
    list: {
      nonDeleted: signal(projects.filter((row) => !row.deletedAt)),
      deleted: signal(projects.filter((row) => row.deletedAt)),
    },
    op: { list: signal({ inProgress: false, result: null, error: null }) },
  }
}

const examples: ExampleFragment = {
  timeAgo: {
    title: "timeAgo()",
    summary:
      "How long ago a timestamp was, in words; `now` is a parameter, so a render never depends on the clock.",
    snippet: `import { timeAgo } from "@preact-components/crud"

timeAgo("2026-01-01T10:00:00Z", new Date("2026-01-01T12:30:00Z"))`,
    covers: ["timeAgo"],
    run: () => timeAgo("2026-01-01T10:00:00Z", new Date("2026-01-01T12:30:00Z")),
  },
  formatTimestamp: {
    title: "formatTimestamp()",
    summary:
      "An absolute timestamp for a `title` attribute: the date and a 24-hour time, the time alone, or `-` for an unset column.",
    snippet: `import { formatTimestamp } from "@preact-components/crud"

formatTimestamp("2026-01-15T09:05:00Z", { full: true, timeZone: "UTC" })
formatTimestamp("2026-01-15T09:05:00Z", { timeOnly: true, timeZone: "UTC" })
formatTimestamp(null)`,
    covers: ["formatTimestamp"],
    run: () => [
      formatTimestamp("2026-01-15T09:05:00Z", { full: true, timeZone: "UTC" }),
      formatTimestamp("2026-01-15T09:05:00Z", { timeOnly: true, timeZone: "UTC" }),
      formatTimestamp(null),
    ],
  },
  listRows: {
    title: "The rows a list shows",
    summary:
      "`rowsForStatus` picks the Active or Archived slice of a store, and `listRows` filters that slice by the search box, one word at a time.",
    snippet: `import { listRows, rowsForStatus } from "@preact-components/crud"

const match = (row, word) => row.name.toLowerCase().includes(word.toLowerCase())

rowsForStatus(store, "archived").map((row) => row.name)
listRows(store, "active", "launch", match).map((row) => row.name)`,
    covers: ["rowsForStatus", "listRows"],
    run: () =>
      untracked(() => {
        const store = listStore()
        const match = (row: Project, word: string) =>
          row.name.toLowerCase().includes(word.toLowerCase())
        return {
          archived: rowsForStatus(store, "archived").map((row) => row.name),
          activeLaunch: listRows(store, "active", "launch", match).map((row) => row.name),
        }
      }),
  },
  editorState: {
    title: "editorState()",
    summary:
      "Whether the editor's form is valid, busy, and savable: Save is live only once the row has loaded, nothing is invalid, nothing is in flight and nothing blocks the archive.",
    snippet: `import { editorState } from "@preact-components/crud"

const ready = { initialized: true, validation: {}, canChange: true, inProgress: false, blocked: 0 }

editorState(ready)
editorState({ ...ready, initialized: false })
editorState({ ...ready, blocked: 2 })`,
    covers: ["editorState"],
    run: () => {
      const ready = {
        initialized: true,
        validation: {},
        canChange: true,
        inProgress: false,
        blocked: 0,
      }
      return {
        ready: editorState(ready),
        notLoaded: editorState({ ...ready, initialized: false }),
        blocked: editorState({ ...ready, blocked: 2 }),
      }
    },
  },
  submitEditor: {
    title: "submitEditor()",
    summary:
      "Routes a save to the store write its mode implies: an add creates, an edit updates, and an edit whose archive is blocked writes nothing. The card prints which store methods each submit reached.",
    snippet: `import { submitEditor } from "@preact-components/crud"

const calls = []
const store = {
  create: (row) => (calls.push("create"), Promise.resolve({ error: null, result: row })),
  update: (id, row) => (calls.push(\`update \${id}\`), Promise.resolve({ error: null, result: row })),
}
const row = { id: 1, name: "Launch plan", deletedAt: null }

submitEditor({ mode: "add", store, value: row })
submitEditor({ mode: "edit", id: 1, store, value: row })
submitEditor({ mode: "edit", id: 1, store, value: row, blocked: 2 })`,
    covers: ["submitEditor"],
    run: () => {
      const calls: string[] = []
      const store = {
        create: (
          row: Project,
        ) => (calls.push("create"), Promise.resolve({ error: null, result: row } as const)),
        update: (
          id: number,
          row: Project,
        ) => (calls.push(`update ${id}`), Promise.resolve({ error: null, result: row } as const)),
      }
      const row = projects[0]
      // Each store write starts before `submitEditor`'s first `await`, so `calls` is complete here;
      // the outcomes themselves settle later and are not what this card shows.
      void submitEditor({ mode: "add", store, value: row })
      void submitEditor({ mode: "edit", id: 1, store, value: row })
      void submitEditor({ mode: "edit", id: 1, store, value: row, blocked: 2 })
      return calls
    },
  },
  toggleArchiveState: {
    title: "toggleArchiveState()",
    summary:
      "The archive checkbox's next state: archiving stamps `deletedAt` with the current time and asks what still points at the row; un-archiving clears both.",
    snippet: `import { toggleArchiveState } from "@preact-components/crud"

const dependents = () => [{ kind: "Tasks", values: [{ title: "Write copy", url: "/tasks/7" }] }]

const archiving = toggleArchiveState({ id: 1, deletedAt: null }, dependents)
archiving.deletedAt instanceof Date
archiving.blocked
toggleArchiveState({ id: 3, deletedAt: "2026-01-15T09:00:00Z" }, dependents)`,
    covers: ["toggleArchiveState"],
    run: () => {
      const dependents = () => [{
        kind: "Tasks",
        values: [{ title: "Write copy", url: "/tasks/7" }],
      }]
      const archiving = toggleArchiveState({ id: 1, deletedAt: null }, dependents)
      return {
        // The stamp is the current time, so the card prints whether there is one, not its value.
        stamped: archiving.deletedAt instanceof Date,
        blocked: archiving.blocked,
        unarchiving: toggleArchiveState({ id: 3, deletedAt: "2026-01-15T09:00:00Z" }, dependents),
      }
    },
  },
  setField: {
    title: "Field values in and out",
    summary:
      '`setField` writes one field into a model signal as a fresh object, `fieldText` shows a value in a control (`null` as empty, never `"null"`), and `commitNumber` reads a number box, half-typed input included.',
    snippet: `import { commitNumber, fieldText, setField } from "@preact-components/crud"
import { signal } from "@preact/signals"

const vm = signal({ name: "Launch plan", budget: null })
setField(vm, "budget", commitNumber(" 1200 "))

vm.value
fieldText(null)
commitNumber("12e")`,
    covers: ["setField", "fieldText", "commitNumber"],
    run: () =>
      untracked(() => {
        const vm = signal<{ name: string; budget: number | null }>({
          name: "Launch plan",
          budget: null,
        })
        setField(vm, "budget", commitNumber(" 1200 "))
        return { model: vm.value, empty: fieldText(null), halfTyped: commitNumber("12e") }
      }),
  },
  conflictIssue: {
    title: "A duplicate association as a field issue",
    summary:
      "`conflictIssue` files a duplicate under `CONFLICT` on the field the user has to change, with the duplicate's id as payload; `isRestorable` says whether that duplicate was removed and can be brought back instead.",
    snippet: `import { CONFLICT, conflictIssue, isRestorable } from "@preact-components/crud"

const rows = [
  { id: 1, name: "Paper supplier", deletedAt: null },
  { id: 2, name: "Ink supplier", deletedAt: "2026-02-01T00:00:00Z" },
]
const input = {
  rows,
  conflict: (row, all) => all.find((entry) => entry.name === row.name),
  field: "name",
  message: "Already attached.",
  removedMessage: "Removed earlier — restore it instead.",
}

conflictIssue({ id: 0, name: "Ink supplier", deletedAt: null }, {}, input).name[CONFLICT]
isRestorable(rows[1])`,
    covers: ["CONFLICT", "conflictIssue", "isRestorable"],
    run: () => {
      const rows: Project[] = [
        { id: 1, name: "Paper supplier", deletedAt: null },
        { id: 2, name: "Ink supplier", deletedAt: "2026-02-01T00:00:00Z" },
      ]
      const input = {
        rows,
        conflict: (row: Project, all: Project[]) => all.find((entry) => entry.name === row.name),
        field: "name" as const,
        message: "Already attached.",
        removedMessage: "Removed earlier — restore it instead.",
      }
      const issues = conflictIssue({ id: 0, name: "Ink supplier", deletedAt: null }, {}, input)
      return { issue: issues.name?.[CONFLICT], restorable: isRestorable(rows[1]) }
    },
  },
  associationActions: {
    title: "associationActions()",
    summary:
      "Binds an association editor's Delete and Restore buttons to the store's `delete` and `undelete`. The card prints which store method each button reached.",
    snippet: `import { associationActions } from "@preact-components/crud"

const calls = []
// The store's other members are left out; these two are all the actions call.
const store = {
  delete: (id) => (calls.push(\`delete \${id}\`), Promise.resolve({ error: null, result: null })),
  undelete: (id) => (calls.push(\`undelete \${id}\`), Promise.resolve({ error: null, result: null })),
}

const { remove, restore } = associationActions(store)
remove(4)
restore(4)`,
    covers: ["associationActions"],
    run: () => {
      const calls: string[] = []
      const ended = (id: number) => ({ error: null, result: { ...projects[0], id } } as const)
      const store = {
        delete: (id: number) => (calls.push(`delete ${id}`), Promise.resolve(ended(id))),
        undelete: (id: number) => (calls.push(`undelete ${id}`), Promise.resolve(ended(id))),
      }
      // A partial store: `associationActions` reads only these two members, and the rest of
      // `CrudAssociationStore` would be signals this card never shows.
      const { remove, restore } = associationActions(
        store as unknown as CrudAssociationStore<Project>,
      )
      void remove(4)
      void restore(4)
      return calls
    },
  },
}

/** The `crud/` examples, as registry cards. */
export const crudExamples = toExampleDemos(examples)
