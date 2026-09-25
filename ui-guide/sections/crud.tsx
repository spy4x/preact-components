/**
 * The CRUD section.
 *
 * All eleven of the package's undemoed components are here, plus the ones already demonstrated. The
 * section is unusual because almost everything in it is *scaffolding for a store*, so the honest
 * question is what a store is. This file answers it with a real one: {@link makeTeamStore} is a
 * small in-memory implementation of the structural interfaces in `crud/store.ts`
 * (`CrudListStore`, `CrudEditorStore`) and `crud/types.ts`, built from `@preact/signals` and
 * nothing else.
 *
 * Why a double rather than `buildModelStore` from `signals/`: the guide is prerendered at build time
 * by `pages/`, and a store wired to a `fetch` would need either an endpoint that does not exist or a
 * stubbed `fetch` — and a stubbed `fetch` in a demo is a demo of the stub. The structural interfaces
 * are the package's actual contract, so implementing them directly is the honest demonstration, and
 * `crud/examples/regions.tsx` is the worked example of the same page against the real store.
 *
 * Everything here is deterministic: row timestamps are literals, no id comes from anything but a
 * counter, and no demo reads the clock.
 */

import {
  AssociationEditor,
  CheckboxField,
  CrudEditor,
  CrudList,
  type CrudRow,
  DeletionValidation,
  FieldIssues,
  fieldText,
  NumberField,
  RowAction,
  RowActions,
  SelectField,
  TextareaField,
  TextField,
} from "@preact-components/crud"
import type { CrudAssociationStore } from "@preact-components/crud/association-editor"
import type { CrudListStore } from "@preact-components/crud/store"
import type { CrudEditorStore } from "@preact-components/crud/store"
import type { OperationState } from "@preact-components/crud"
import { Button } from "@preact-components/ui"
import { computed, type ReadonlySignal, signal, useSignal } from "@preact/signals"
import { search } from "@spy4x/platform/universal/text"
import type { FieldIssue, ValidationModel } from "@spy4x/validation/model"
import { type } from "arktype"
import { useMemo } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"

/** The row every editor in this section edits. */
interface Team extends CrudRow {
  id: number
  name: string
  members: number
  notes: string
  archived: boolean
  parentId: number
  deletedAt: Date | null
}

/** One settled operation, the shape the scaffold reads. `result` is never inspected by it. */
function settled(result: unknown, error: string | null = null): OperationState {
  return { inProgress: false, result, error: error === null ? null : { message: error } }
}

/** The blank a `mode="add"` editor starts from, server-owned columns included. */
function blankTeam(): Team {
  return {
    id: 0,
    name: "",
    members: 0,
    notes: "",
    archived: false,
    parentId: 0,
    deletedAt: null,
  }
}

/** The seed rows: three live and one archived, so both status slices have something in them. */
function seedTeams(): Team[] {
  return [
    { ...blankTeam(), id: 1, name: "Design", members: 4, notes: "Owns the design system." },
    { ...blankTeam(), id: 2, name: "Support", members: 0, parentId: 1 },
    {
      ...blankTeam(),
      id: 3,
      name: "Platform",
      members: 7,
      parentId: 1,
      notes: "Split by product.",
    },
    {
      ...blankTeam(),
      id: 4,
      name: "Research",
      members: 2,
      archived: true,
      deletedAt: new Date("2026-01-15T09:00:00.000Z"),
    },
  ]
}

/**
 * An in-memory team store: both slices, the two writes, and a log of what the form submitted.
 *
 * `writes` records what reached the port so a card can show that the port was reached without
 * pretending a server answered. Every write settles synchronously with the row it would have
 * created, patched or ended.
 */
function makeTeamStore() {
  const rows = signal<Team[]>(seedTeams())
  const writes = signal<string[]>([])
  const settledOp = signal<OperationState>(settled(null))
  const inProgress: ReadonlySignal<OperationState | undefined> = computed(() => undefined)
  let nextId = 100

  const store: CrudListStore<Team> & CrudEditorStore<Team> = {
    list: {
      nonDeleted: computed(() => rows.value.filter((row) => !row.deletedAt)),
      deleted: computed(() => rows.value.filter((row) => Boolean(row.deletedAt))),
    },
    one: {
      byId: (id: number) => computed(() => rows.value.find((row) => row.id === id)),
    },
    op: {
      list: settledOp,
      create: settledOp,
      update: () => inProgress,
    },
    create: (data) => {
      const created: Team = { ...blankTeam(), ...data, id: nextId++ }
      rows.value = [...rows.value, created]
      writes.value = [...writes.value, `create #${created.id} "${created.name}"`]
      return Promise.resolve({ error: null, result: created })
    },
    update: (id, data) => {
      const before = rows.value.find((row) => row.id === id)
      const updated: Team = { ...blankTeam(), ...data, id }
      rows.value = rows.value.map((row) => (row.id === id ? updated : row))
      writes.value = [
        ...writes.value,
        `update #${id} ("${before?.name ?? "?"}" → "${updated.name}")`,
      ]
      return Promise.resolve({ error: null, result: updated })
    },
  }

  return { store, rows, writes }
}

/**
 * The association store: the editor slice plus the collection-wide list and the two endings.
 *
 * `list.all` rather than `list.nonDeleted` is the point — the duplicate an association editor has to
 * tell the user about is usually a row removed earlier that can be restored instead of re-created.
 */
function makeAssociationStore() {
  const rows = signal<Team[]>([
    { ...blankTeam(), id: 101, name: "Paper supplier" },
    { ...blankTeam(), id: 102, name: "Print supplier" },
    {
      ...blankTeam(),
      id: 103,
      name: "Ink supplier",
      deletedAt: new Date("2026-02-01T00:00:00.000Z"),
    },
  ])
  const settledOp = signal<OperationState>(settled(null))
  const idle: ReadonlySignal<OperationState | undefined> = computed(() => undefined)

  const store: CrudAssociationStore<Team> = {
    list: {
      all: rows,
    },
    one: { byId: (id: number) => computed(() => rows.value.find((row) => row.id === id)) },
    op: {
      create: settledOp,
      update: () => idle,
      delete: () => idle,
      undelete: () => idle,
    },
    create: (data) => {
      const created: Team = { ...blankTeam(), ...data, id: 200 + rows.value.length }
      rows.value = [...rows.value, created]
      return Promise.resolve({ error: null, result: created })
    },
    update: (id, data) => {
      const updated: Team = { ...blankTeam(), ...data, id }
      rows.value = rows.value.map((row) => (row.id === id ? updated : row))
      return Promise.resolve({ error: null, result: updated })
    },
    delete: (id) => {
      const row = rows.value.find((entry) => entry.id === id)
      if (row === undefined) {
        return Promise.resolve({ error: { message: `no row ${id}` }, result: null })
      }
      const ended: Team = { ...row, deletedAt: new Date("2026-03-01T00:00:00.000Z") }
      rows.value = rows.value.map((entry) => (entry.id === id ? ended : entry))
      return Promise.resolve({ error: null, result: ended })
    },
    undelete: (id) => {
      const row = rows.value.find((entry) => entry.id === id)
      if (row === undefined) {
        return Promise.resolve({ error: { message: `no row ${id}` }, result: null })
      }
      const restored: Team = { ...row, deletedAt: null }
      rows.value = rows.value.map((entry) => (entry.id === id ? restored : entry))
      return Promise.resolve({ error: null, result: restored })
    },
  }

  return { store, rows }
}

/** Teams a team can sit under — the option list of the select row. */
const parentOptions = [
  { value: 0, label: "— none —" },
  { value: 1, label: "Design" },
  { value: 2, label: "Support" },
]

/**
 * The rule `CrudEditorDemo`'s schema adds: Name and Notes must differ.
 *
 * Deliberately artificial, because the point is the *shape* of the failure, not a real business
 * rule: a `.narrow` across the whole model has no field of its own to report against, which is what
 * issue #119 was about. `regionSchema` in `examples/regions.tsx` shows the ordinary, per-field kind;
 * this one is the other kind, and `CrudEditor` files it under `FORM_FIELD` and shows it above Save.
 *
 * `ctx.reject({ message })` rather than `ctx.mustBe(...)`: arktype's default wording for a
 * whole-model `.narrow` failure appends the entire rejected value as JSON — every field the row
 * carries, not just the two this rule is about — and a polite, atomic live region re-reads that
 * whole sentence to a screen reader on every field change that still fails the rule, not only the
 * ones that touch Name or Notes. `ctx.reject` gives the message in full instead, which is what the label
 * policy already asks a caller to do for any string this library shows.
 */
const teamCrossFieldSchema = type({
  name: "string",
  notes: "string",
}).narrow((row, ctx) =>
  row.name !== row.notes || ctx.reject({ message: "Name must differ from Notes" })
)

/** One editor's own model and validation signals. Local to a demo, never module-level. */
function useTeamForm(initial: Team = blankTeam()) {
  const vm = useSignal<Team>(initial)
  const vl = useSignal<ValidationModel<Team>>({})
  return { vm, vl }
}

/**
 * Four field components bound to one live model, so the write path is visible.
 *
 * `TextField` commits on blur rather than on every keystroke; `NumberField` commits `0` for a box
 * the browser cannot parse; `SelectField` falls back to its empty option when the model holds a
 * foreign key no option carries; `CheckboxField` writes a boolean.
 */
function TeamFieldsDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), name: "Design", members: 4, parentId: 1 })

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
        <TextField vm={vm} vl={vl} name="name" label="Name" placeholder="North" />
        <NumberField
          vm={vm}
          vl={vl}
          name="members"
          label="Members"
          hint="Commits 0 for an empty box"
        />
        <SelectField
          vm={vm}
          vl={vl}
          name="parentId"
          label="Parent team"
          options={parentOptions}
          placeholder="— none —"
        />
        <CheckboxField vm={vm} vl={vl} name="archived" label="Is archived?" />
        <TextareaField vm={vm} vl={vl} name="notes" label="Notes" rows={3} />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        name: {fieldText(vm.value.name)} · members: {fieldText(vm.value.members)} · parentId:{" "}
        {fieldText(vm.value.parentId)} · archived: {vm.value.archived ? "on" : "off"} · notes:{" "}
        {fieldText(vm.value.notes) || "(empty)"}
      </p>
    </div>
  )
}

/**
 * One field row plus a validation model the reader can edit, and a second rendering of the issues.
 *
 * The buttons only rewrite the validation model; `FieldIssues` reads it. That is the split the
 * package makes — a field row renders the *control*, `FieldIssues` renders the *issues* — and
 * `renderIssue` is where an app that links to the row a value collides with puts its button.
 */
function FieldIssueDemo() {
  const { vm, vl } = useTeamForm()

  const addIssue = (type: string) => {
    vl.value = {
      ...vl.value,
      name: { ...vl.value.name, [type]: { message: `${type} on name`, payload: 2 } },
    }
  }

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
        <TextField
          vm={vm}
          vl={vl}
          name="name"
          label="Name"
          hint="Two issue types can sit on one field at once; clearing both drops the field"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addIssue("SCHEMA")}>
          Add a SCHEMA issue
        </Button>
        <Button variant="outline" size="sm" onClick={() => addIssue("NOT_UNIQUE")}>
          Add a NOT_UNIQUE issue
        </Button>
        <Button variant="ghost" size="sm" onClick={() => vl.value = {}}>Clear</Button>
      </div>
      <div class="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">
          the field row above renders the default message; this is the same model through a custom
          {" "}
          <code>renderIssue</code>:
        </p>
        <FieldIssues
          vl={vl}
          name="name"
          renderIssue={(issue: FieldIssue, type: string) => (
            <p key={type} class="mt-2 text-sm text-red-700 dark:text-red-400">
              {type}: {issue.message}
              {issue.payload !== undefined ? ` (see row ${issue.payload})` : ""}
            </p>
          )}
        />
      </div>
    </div>
  )
}

/** One editor in `mode="add"`, with its slot functions, and the write it performed printed below. */
function CrudEditorDemo() {
  // `useMemo` rather than a bare call: a successful save writes the `created` signal below, which
  // this component reads in its own JSX, so a save re-renders the card — and a fresh
  // `makeTeamStore()` on every render would reset `writes`/`rows` to their seed state right after,
  // so a save the reader just watched happen would read as if it never had. Committing a field does
  // not itself re-render this component (`CrudEditor` revalidates in its own effect, not here); the
  // guard is about the save, not the field. `created` needs no such guard: a `useSignal` is already
  // stable across re-renders by construction.
  const { store, writes, rows } = useMemo(() => makeTeamStore(), [])
  const created = useSignal("nothing created yet")

  return (
    <div class="space-y-4">
      <CrudEditor
        store={store}
        mode="add"
        blank={blankTeam()}
        schema={teamCrossFieldSchema}
        entity="Team"
        title="Add a team"
        cancelHref="#crud"
        canChange={() => true}
        onCreated={(row) => created.value = `#${row.id} "${row.name}"`}
        notice={() => (
          <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
            A <code>notice</code> slot sits between the field grid and the footer.
          </p>
        )}
        footerSlot={() => (
          <span class="mr-auto text-xs text-gray-500 dark:text-gray-400">
            <code>footerSlot</code> sits before Cancel and Save
          </span>
        )}
      >
        {({ vm, vl }) => (
          <>
            <TextField vm={vm} vl={vl} name="name" label="Name" />
            <TextField
              vm={vm}
              vl={vl}
              name="notes"
              label="Notes"
              hint="The schema's own rule: must differ from Name"
            />
            <NumberField vm={vm} vl={vl} name="members" label="Members" />
          </>
        )}
      </CrudEditor>
      <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        <p>onCreated received: {created.value}</p>
        <p>
          the create port logged:{" "}
          {writes.value.length === 0 ? "nothing yet" : writes.value.join(", ")}
        </p>
        <p>rows in the store: {rows.value.length} (was 4 before the first save)</p>
        <p class="text-gray-400 dark:text-gray-500">
          Save is disabled until the form has initialised, the validation model is clean and nothing
          blocks the archive. The blank row starts with Name and Notes equal (both empty), so the
          schema's cross-field rule fails from the start — that rule has no field of its own to
          report against, so it shows as the live region above Save instead.
        </p>
      </div>
    </div>
  )
}

/** One association editor whose conflict port reports the row a new one would duplicate. */
function AssociationEditorDemo() {
  const { store, rows } = makeAssociationStore()

  return (
    <div class="space-y-4">
      <AssociationEditor
        store={store}
        mode="add"
        blank={blankTeam()}
        entity="Supplier association"
        title="Add a supplier association"
        cancelHref="#crud"
        conflictField="name"
        conflict={(row, all) => all.find((entry) => entry.name === row.name)}
        conflictMessage="A supplier with that name already exists."
        conflictRemovedMessage="That supplier existed before and was removed — restore it instead."
      >
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Supplier name" />}
      </AssociationEditor>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        rows the conflict port scans: {rows.value.length}, of which{" "}
        {rows.value.filter((row) => row.deletedAt).length} were removed — so typing{" "}
        <code>Ink supplier</code> reaches the "restore it instead" branch, and{" "}
        <code>Paper supplier</code> the live-conflict branch.
      </p>
    </div>
  )
}

/**
 * The blocked-archive block, with a dependency list the reader can fill in to see it appear, plus a
 * second button that re-renders this demo for a reason that has nothing to do with the dependency
 * list — the same kind of re-render a keystroke in another field or a timer would cause in a real
 * form — so the block visibly does not move when it fires.
 */
function DeletionValidationDemo() {
  const blocked = useSignal(false)
  const renders = useSignal(0)
  const dependencies = [
    {
      kind: "Projects",
      values: [
        { title: "Launch plan", url: "#crud" },
        { title: "Help centre", url: "#crud" },
      ],
    },
    { kind: "Schedules", values: [{ title: "Weekly summary", url: "#crud" }] },
  ]

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => blocked.value = !blocked.value}>
          {blocked.value ? "Empty the dependency list" : "Restore the dependency list"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => renders.value++}>
          Re-render for an unrelated reason
        </Button>
      </div>
      <DeletionValidation dependencies={blocked.value ? dependencies : []} model="Team" />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {blocked.value
          ? "A non-empty list is the block above."
          : "An empty list renders nothing visible."} Re-rendered {renders.value}{" "}
        time{renders.value === 1 ? "" : "s"}{" "}
        for a reason unrelated to the dependency list — the block does not move when that happens.
      </p>
    </div>
  )
}

/** The list, its search box, the status filter and the per-row actions menu. */
function CrudListDemo() {
  const { store } = makeTeamStore()
  const query = useSignal("")

  return (
    <CrudList
      store={store}
      title="Teams"
      match={(row, word) => search(row.name, word)}
      query={query}
      addHref="#crud"
      canAdd={() => true}
      header={
        <>
          <th scope="col" class="text-left">Name</th>
          <th scope="col" class="text-left">Members</th>
        </>
      }
      row={(row) => (
        <>
          <td class="text-gray-900 dark:text-gray-100">{row.name}</td>
          <td class="tabular-nums">{row.members}</td>
        </>
      )}
      actions={(row) => (
        <RowActions label={`Actions for ${row.name}`}>
          <RowAction href={`#crud-${row.id}`}>Edit</RowAction>
          <RowAction onClick={() => {}}>Duplicate</RowAction>
          <RowAction danger onClick={() => {}}>Archive</RowAction>
        </RowActions>
      )}
    />
  )
}

/**
 * The numeric row on its own, so the parse rule is the thing on screen.
 *
 * The hint says what to do: clear the box or type `1e`, click away, and the model shows `0`.
 */
function NumberFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), members: 4 })
  return (
    <div class="max-w-sm space-y-2">
      <NumberField
        vm={vm}
        vl={vl}
        name="members"
        label="Members"
        hint="Clear the box or type 1e, then click away"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        members in the model: {fieldText(vm.value.members)}
      </p>
    </div>
  )
}

/** The select row, seeded with a foreign key one of its options really carries. */
function SelectFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), parentId: 2 })
  return (
    <div class="max-w-sm space-y-2">
      <SelectField
        vm={vm}
        vl={vl}
        name="parentId"
        label="Parent team"
        options={parentOptions}
        placeholder="— none —"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        parentId in the model: {fieldText(vm.value.parentId)} — a number, because{" "}
        <code>SelectOption.value</code>{" "}
        keeps its type; set it to an id no option carries and the select shows the empty option
        instead of the first entry
      </p>
    </div>
  )
}

/** The checkbox row, on a model whose field is already true. */
function CheckboxFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), archived: true })
  return (
    <div class="max-w-sm space-y-2">
      <CheckboxField
        vm={vm}
        vl={vl}
        name="archived"
        label="Is archived?"
        hint="Bound to a boolean field of the model"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        archived in the model: {vm.value.archived ? "on" : "off"}
      </p>
    </div>
  )
}

/** The multi-line row, on a model with a note in it. */
function TextareaFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), notes: "Runs the night shift." })
  return (
    <div class="max-w-sm space-y-2">
      <TextareaField vm={vm} vl={vl} name="notes" label="Notes" rows={3} />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        notes in the model: {fieldText(vm.value.notes) || "(empty)"}
      </p>
    </div>
  )
}

export const crudDemos = {
  CrudList: {
    summary:
      "A resource list from a store: title, count badge, search box, Active/Archived filter, an add link and a table whose header, cells and actions column are slots. `store` is the structural `CrudListStore` — two status slices plus a load state — so any model store satisfies it; this card drives a small in-memory one built from signals. `rows` is the other source: a plain signal, for a nested list or a collection with no soft-delete column. `match` decides what one search word matches, and words are ANDed.",
    snippet: `<CrudList
  title="Teams"
  store={teamStore}
  match={(row, word) => search(row.name, word)}
  query={query}
  header={<th scope="col">Name</th>}
  row={(row) => <td>{row.name}</td>}
  actions={(row) => (
    <RowActions>
      <RowAction href={\`/teams/\${row.id}/edit\`}>Edit</RowAction>
      <RowAction danger onClick={() => archive(row.id)}>Archive</RowAction>
    </RowActions>
  )}
/>`,
    render: () => <CrudListDemo />,
  },
  RowAction: {
    summary:
      'One item of a row\'s action menu. With `href` it is a link and without one a `<button>`, which is how one component covers a navigation and an operation without the caller branching. `danger` renders it red; `disabled` disables the button, and the menu\'s arrow keys skip it. The element itself is a `DropdownItem`, so it carries `role="menuitem"` and the menu around it can move focus to it; the spacing row it sits in is `role="none"`, which keeps it a direct child of the menu for assistive tech. `RowActions` still supplies the popup and the trigger.',
    snippet: `<RowAction href={\`/teams/\${row.id}/edit\`}>Edit</RowAction>
<RowAction danger onClick={() => archive(row.id)}>Archive</RowAction>`,
    render: () => (
      // A menu item belongs to a menu, so the card renders one rather than leaving four of them
      // loose in a `<div>`, which is a menu item with no menu as far as a screen reader is
      // concerned. `RowActions` is what supplies this wrapper in real use.
      <div
        class="w-56 divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-600 dark:border-gray-700"
        role="menu"
        aria-orientation="vertical"
        aria-label="Item shapes"
      >
        <RowAction href="#crud">A link, because it has one</RowAction>
        <RowAction onClick={() => {}}>A button, because it does not</RowAction>
        <RowAction danger onClick={() => {}}>Danger</RowAction>
        <RowAction disabled onClick={() => {}}>Disabled</RowAction>
      </div>
    ),
  },
  RowActions: {
    summary:
      'The per-row actions menu: a vertical-ellipsis `Dropdown` trigger over `RowAction` items, with the label defaulting to `Actions` and naming both the trigger and the menu. It is the piece that knows it is a popup, so the trigger, the menu label and the keyboard contract live here — opening it moves focus to the first action, the arrow keys walk them, and Escape closes it and returns focus to the trigger. The item supplies its own `role="menuitem"`, because that role cannot be applied to a child from outside.',
    snippet: `<RowActions label="Team actions">
  <RowAction href="/teams/1/edit">Edit</RowAction>
  <RowAction onClick={archive}>Archive</RowAction>
</RowActions>`,
    render: () => (
      <RowActions label="Team actions">
        <RowAction href="#crud">Edit</RowAction>
        <RowAction onClick={() => {}}>Duplicate</RowAction>
        <RowAction danger onClick={() => {}}>Archive</RowAction>
      </RowActions>
    ),
  },
  CrudEditor: {
    summary:
      "The add/edit form harness: it loads the row out of the store once, validates the model on every change, owns the archive toggle and the blocked-archive cascade, and renders chrome around a body the caller supplies. `children`, `notice` and `footerSlot` are functions rather than children so the caller's rows receive the model and validation signals directly — the same contract every field row in `field.tsx` takes. Save is enabled only once the form has initialised, the validation model is clean and nothing blocks the archive. `schema` is an arktype schema run through `validateSchema`; `validate` is the domain-check port that runs after it, reading signals so a check against a not-yet-loaded collection fixes itself. A rule with no field of its own — this card's schema adds one, Name must differ from Notes — is filed under the reserved `FORM_FIELD` key and shown as a live region above Save, named at all times by Save's `aria-describedby`.",
    snippet: `<CrudEditor
  store={teamStore}
  blank={blankTeam}
  schema={teamBaseSchema}
  entity="Team"
  cancelHref="/teams"
  archive={{}}
  onCreated={(row) => navigate(\`/teams/\${row.id}/edit\`)}
>
  {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Name" />}
</CrudEditor>`,
    render: () => <CrudEditorDemo />,
  },
  AssociationEditor: {
    summary:
      "The editor for a row that exists only to join two entities, composed from `CrudEditor` rather than rebuilt beside it. Three differences, each a slot or a port: no validation model of its own, because a junction row has no rules; a *conflict* instead of a dependency list — the row a new one would duplicate is reported as an issue on the field the user has to change, which is what blocks Save, with the duplicate's id travelling as the issue payload — and removal instead of archiving, written into `footerSlot`. Its store reads `list.all`, removed rows included, because the duplicate worth telling the user about is often one that can be restored: that branch was unreachable in the source editors, which scanned `nonDeleted` and then branched on `deletedAt`.",
    snippet: `<AssociationEditor
  store={associationStore}
  mode="add"
  blank={blankAssociation}
  entity="Supplier association"
  cancelHref="/suppliers"
  conflictField="supplierId"
  conflict={(row, all) => all.find((entry) => entry.supplierId === row.supplierId)}
  conflictMessage="That supplier is already attached."
  conflictRemovedMessage="It was attached before and removed — restore it instead."
>
  {({ vm, vl }) => <SelectField vm={vm} vl={vl} name="supplierId" label="Supplier" options={…} />}
</AssociationEditor>`,
    render: () => <AssociationEditorDemo />,
  },
  DeletionValidation: {
    summary:
      'The list of entities blocking a soft delete. A row can only be archived once everything pointing at it has been archived, and the store hands back what still points at it. An empty list renders nothing visible, which is why the healthy path looks empty — the button below switches between the two. The block scrolls itself into view on a first non-empty list, on a later list with different content, and on a list that follows an empty one (a second blocked archive attempt, after `CrudEditor`\'s archive checkbox is unchecked and rechecked); a re-render that replaces one non-empty list with an equal one, without emptying in between, never moves the page. The `role="alert"` region itself is always present, empty until there is something to say.',
    snippet: `<DeletionValidation
  dependencies={[
    { kind: "Projects", values: [{ title: "Launch plan", url: "/projects/1/edit" }] },
  ]}
  model="Team"
/>`,
    render: () => <DeletionValidationDemo />,
  },
  TextField: {
    summary:
      'One labelled text input that reads and writes one field of a model signal. It commits on **blur**, trimmed, so a keystroke is not a store write. The row generates its own control id with `useId`, which is what stops two editors — or two rows — on one page sharing `id="name"` and stealing each other\'s label. `span` sets the grid cell, `hint` the helper text, and `renderIssue` replaces the default red paragraph.',
    snippet:
      `<TextField vm={vm} vl={vl} name="name" label="Name" placeholder="North" span="sm:col-span-2" />`,
    render: () => <TeamFieldsDemo />,
  },
  NumberField: {
    summary:
      'The same row with a numeric control. A number input reports `""` for anything the browser cannot parse — an empty box, a lone `-`, the intermediate states of `1e` — so an empty or unparsable box commits `0` rather than `NaN`, which is what would otherwise make an arktype schema reject the model on every keystroke. `commitNumber` is exported and pure for exactly that rule.',
    snippet:
      `<NumberField vm={vm} vl={vl} name="members" label="Members" hint="Commits 0 for an empty box" />`,
    render: () => <NumberFieldDemo />,
  },
  SelectField: {
    summary:
      "One labelled select taking its options as data. The control's value is the model's, not each option's `selected` flag, so a model holding a foreign key no option carries falls back to the empty option instead of silently displaying the first entry as if it were chosen. Option values are stringified in the markup on purpose: a browser only ever reports a string, and leaving a numeric `0` on an option made it match the empty placeholder (`\"\" == 0`), so two options rendered selected. `SelectOption.value` keeps its type, so a numeric foreign key stays numeric in the model.",
    snippet: `<SelectField
  vm={vm}
  vl={vl}
  name="parentId"
  label="Parent team"
  options={[{ value: 1, label: "Design" }, { value: 2, label: "Support" }]}
  placeholder="— none —"
/>`,
    render: () => <SelectFieldDemo />,
  },
  CheckboxField: {
    summary:
      "One labelled checkbox with its label after the box, so the box and the text share one hit area. `checked` is the model's boolean and `onChange` writes it straight back; the control's id is generated per row like every other field, so the label always points at its own box.",
    snippet: `<CheckboxField vm={vm} vl={vl} name="archived" label="Is archived?" />`,
    render: () => <CheckboxFieldDemo />,
  },
  TextareaField: {
    summary:
      "The multi-line row. Same contract as `TextField` — commits on blur, trimmed, own control id — with `rows` defaulting to `4`.",
    snippet: `<TextareaField vm={vm} vl={vl} name="notes" label="Notes" rows={3} />`,
    render: () => <TextareaFieldDemo />,
  },
  FieldIssues: {
    summary:
      "The issues of one field, keyed by issue type, so an application's own checks (`NOT_UNIQUE`, `LINKED_ENTITY_IS_DELETED`) sit beside the schema's and neither overwrites the other. A field with no issues renders nothing, and one whose every issue has been cleared is dropped from the model rather than left as an empty object — that is what makes `setFieldIssue(…, undefined)` an eraser. `renderIssue` replaces the default red paragraph, which the editors that link to the row a value collides with use to put a \"Navigate to it\" control beside the message; the issue's `payload` is the id to link at.",
    snippet: `<FieldIssues vl={vl} name="name" />

// Or with the caller's own rendering, and the payload the issue carries:
<FieldIssues
  vl={vl}
  name="name"
  renderIssue={(issue, type) => <p>{type}: {issue.message}</p>}
/>`,
    render: () => <FieldIssueDemo />,
  },
} satisfies DemoFragment
