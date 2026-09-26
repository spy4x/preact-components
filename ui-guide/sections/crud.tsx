/**
 * The CRUD section.
 *
 * Every component `crud/` exports has a card here. Almost everything in the package is scaffolding
 * for a store, so the cards need a real one: {@link makeTeamStore} is a
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
} from "@spy4x/preact-crud"
import type { CrudAssociationStore } from "@spy4x/preact-crud/association-editor"
import type { CrudListStore } from "@spy4x/preact-crud/store"
import type { CrudEditorStore } from "@spy4x/preact-crud/store"
import type { OperationState } from "@spy4x/preact-crud"
import { Button, Stack } from "@spy4x/preact-ui"
import { computed, type ReadonlySignal, signal, useSignal } from "@preact/signals"
import { search } from "@spy4x/platform/universal/text"
import type { FieldIssue, ValidationModel } from "@spy4x/validation/model"
import { type } from "arktype"
import type { ComponentChildren, JSX } from "preact"
import { useMemo } from "preact/hooks"
import type { DemoFragment, DemoProp } from "../registry.ts"

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

/** A caption under a demo: what the demo's model holds, or what to try. */
function Caption(
  { children, e2e }: { children: ComponentChildren; e2e?: string },
): JSX.Element {
  return <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e={e2e}>{children}</p>
}

/** The four field rows bound to one live model, with the model printed under them. */
function TeamFieldsDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), name: "Design", members: 4, parentId: 1 })

  return (
    <Stack>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-6">
        <TextField vm={vm} vl={vl} name="name" label="Name" placeholder="Design" />
        <NumberField vm={vm} vl={vl} name="members" label="Members" />
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
      <Caption e2e="model">
        name: {fieldText(vm.value.name)} · members: {fieldText(vm.value.members)} · parentId:{" "}
        {fieldText(vm.value.parentId)} · archived: {vm.value.archived ? "on" : "off"} · notes:{" "}
        {fieldText(vm.value.notes) || "(empty)"}
      </Caption>
    </Stack>
  )
}

/**
 * One field row, buttons that write issues into its validation model, and the same issues rendered
 * a second time through `FieldIssues` with a custom `renderIssue`.
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
    <Stack>
      <TextField vm={vm} vl={vl} name="name" label="Name" />
      <Stack gap="sm" class="items-start">
        <Button variant="outline" size="sm" onClick={() => addIssue("SCHEMA")}>
          Add a SCHEMA issue
        </Button>
        <Button variant="outline" size="sm" onClick={() => addIssue("NOT_UNIQUE")}>
          Add a NOT_UNIQUE issue
        </Button>
        <Button variant="ghost" size="sm" onClick={() => vl.value = {}}>Clear</Button>
      </Stack>
      <Stack gap="xs">
        <Caption>The same issues through a custom renderIssue:</Caption>
        <FieldIssues
          vl={vl}
          name="name"
          renderIssue={(issue: FieldIssue, type: string) => (
            <p key={type} class="text-sm text-red-700 dark:text-red-400">
              {type}: {issue.message}
              {issue.payload !== undefined ? ` (see row ${issue.payload})` : ""}
            </p>
          )}
        />
      </Stack>
    </Stack>
  )
}

/** One editor in `mode="add"`, with its slot functions, and the write it performed printed below. */
function CrudEditorDemo() {
  // `useMemo` rather than a bare call: a save writes the `created` signal this component reads, so a
  // save re-renders the card, and a fresh `makeTeamStore()` on that render would reset the log.
  const { store, writes, rows } = useMemo(() => makeTeamStore(), [])
  const created = useSignal("nothing created yet")

  return (
    <Stack>
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
          // `notice` renders straight after the component's field grid, which leaves the gap to it.
          <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
            A <code>notice</code> slot sits between the fields and the footer.
          </p>
        )}
        footerSlot={() => (
          // `footerSlot` renders first in the component's footer row; `mr-auto` pushes the buttons
          // to the far end, as the footer's own layout expects.
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
              hint="Must differ from Name"
            />
            <NumberField vm={vm} vl={vl} name="members" label="Members" />
          </>
        )}
      </CrudEditor>
      <Stack gap="xs" class="text-xs text-gray-500 dark:text-gray-400" data-e2e="model">
        <p>onCreated received: {created.value}</p>
        <p>
          the create port logged:{" "}
          {writes.value.length === 0 ? "nothing yet" : writes.value.join(", ")}
        </p>
        <p>rows in the store: {rows.value.length} (4 before the first save)</p>
      </Stack>
    </Stack>
  )
}

/** One association editor whose conflict port reports the row a new one would duplicate. */
function AssociationEditorDemo() {
  const { store } = makeAssociationStore()

  return (
    <Stack>
      <AssociationEditor
        store={store}
        mode="add"
        blank={blankTeam()}
        entity="Supplier association"
        title="Add a supplier"
        cancelHref="#crud"
        conflictField="name"
        conflict={(row, all) => all.find((entry) => entry.name === row.name)}
        conflictMessage="A supplier with that name already exists."
        conflictRemovedMessage="That supplier existed before and was removed — restore it instead."
      >
        {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Supplier name" />}
      </AssociationEditor>
      <Caption>
        Type <code>Paper supplier</code> for a duplicate, or <code>Ink supplier</code>{" "}
        for one that was removed.
      </Caption>
    </Stack>
  )
}

/**
 * The blocked-archive block, with a dependency list the reader can fill in to see it appear, plus a
 * second button that re-renders this demo for a reason that has nothing to do with the dependency
 * list — the same kind of re-render a keystroke in another field would cause in a real form — so
 * the block visibly does not move when it fires.
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
    <Stack>
      <Stack gap="sm" class="items-start">
        <Button variant="outline" size="sm" onClick={() => blocked.value = !blocked.value}>
          {blocked.value ? "Empty the dependency list" : "Restore the dependency list"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => renders.value++}>
          Re-render for an unrelated reason
        </Button>
      </Stack>
      <DeletionValidation dependencies={blocked.value ? dependencies : []} model="Team" />
      <Caption>
        {blocked.value ? "" : "An empty list shows nothing. "}Re-rendered {renders.value}{" "}
        time{renders.value === 1 ? "" : "s"} for an unrelated reason.
      </Caption>
    </Stack>
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

/** The numeric row on its own, so the parse rule is the thing on screen. */
function NumberFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), members: 4 })
  return (
    <Stack gap="sm" class="max-w-sm">
      <NumberField
        vm={vm}
        vl={vl}
        name="members"
        label="Members"
        hint="Clear the box or type 1e, then click away"
      />
      <Caption e2e="model">members in the model: {fieldText(vm.value.members)}</Caption>
    </Stack>
  )
}

/** The select row, seeded with a foreign key one of its options really carries. */
function SelectFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), parentId: 2 })
  return (
    <Stack gap="sm" class="max-w-sm">
      <SelectField
        vm={vm}
        vl={vl}
        name="parentId"
        label="Parent team"
        options={parentOptions}
        placeholder="— none —"
      />
      <Caption e2e="model">
        parentId in the model: {fieldText(vm.value.parentId)} ({typeof vm.value.parentId})
      </Caption>
    </Stack>
  )
}

/** The checkbox row, on a model whose field is already true. */
function CheckboxFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), archived: true })
  return (
    <Stack gap="sm" class="max-w-sm">
      <CheckboxField vm={vm} vl={vl} name="archived" label="Is archived?" />
      <Caption e2e="model">archived in the model: {vm.value.archived ? "on" : "off"}</Caption>
    </Stack>
  )
}

/** The multi-line row, on a model with a note in it. */
function TextareaFieldDemo() {
  const { vm, vl } = useTeamForm({ ...blankTeam(), notes: "Runs the night shift." })
  return (
    <Stack gap="sm" class="max-w-sm">
      <TextareaField vm={vm} vl={vl} name="notes" label="Notes" rows={3} />
      <Caption e2e="model">notes in the model: {fieldText(vm.value.notes) || "(empty)"}</Caption>
    </Stack>
  )
}

/** The props every field row takes; the TextField card lists them once for all five rows. */
const fieldRowProps: DemoProp[] = [
  { name: "vm", type: "Signal<M>", description: "The model the row reads and writes." },
  {
    name: "vl",
    type: "ReadonlySignal<ValidationModel<M>>",
    description: "The validation model whose issues the row shows.",
  },
  { name: "name", type: "keyof M", description: "The field of the model this row edits." },
  { name: "label", type: "string", description: "The label, which names the control." },
  { name: "hint", type: "ComponentChildren", description: "Helper text under the control." },
  {
    name: "span",
    type: "string",
    default: `"sm:col-span-3"`,
    description: "The row's cell in the editor's six-column grid.",
  },
]

export const crudDemos = {
  CrudList: {
    summary:
      "A resource list read from a store: title, count, search box, Active and Archived filter, an add link, and a table whose header, cells and row actions you supply.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "The list's heading." },
      {
        name: "store",
        type: "CrudListStore<M>",
        description:
          "The active and archived rows and their load state; pass `rows`, a plain signal, instead for a list with no archive.",
      },
      {
        name: "match",
        type: "(row: M, word: string) => boolean",
        description: "Whether a row matches one word of the search; every word must match.",
      },
      { name: "header", type: "ComponentChildren", description: "The table's header cells." },
      { name: "row", type: "(row: M) => ComponentChildren", description: "One row's cells." },
      {
        name: "actions",
        type: "(row: M) => ComponentChildren",
        default: "no actions column",
        description: "The row's actions, usually a `RowActions` menu.",
      },
      {
        name: "addHref",
        type: "string",
        default: "no add link",
        description: "Where the add link leads; `canAdd` decides whether it shows.",
      },
    ],
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
      "One item of a row's actions menu: a link when it has an `href`, a button when it has none, red when it is `danger`.",
    wide: false,
    snippet: `<RowAction href={\`/teams/\${row.id}/edit\`}>Edit</RowAction>
<RowAction danger onClick={() => archive(row.id)}>Archive</RowAction>`,
    render: () => (
      // A menu item belongs to a menu, so the card gives the items one; `RowActions` supplies it,
      // and the popup's box, in real use.
      <div class="w-56" role="menu" aria-orientation="vertical" aria-label="Item shapes">
        <RowAction href="#crud">A link, because it has one</RowAction>
        <RowAction onClick={() => {}}>A button, because it does not</RowAction>
        <RowAction danger onClick={() => {}}>Danger</RowAction>
        <RowAction disabled onClick={() => {}}>Disabled</RowAction>
      </div>
    ),
  },
  RowActions: {
    summary:
      "The actions menu of one row, behind a three-dots button, that the keyboard opens and walks.",
    wide: false,
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
      "The add and edit form for one row: it loads the row, validates every change, and puts your fields above Cancel and Save.",
    wide: true,
    props: [
      {
        name: "store",
        type: "CrudEditorStore<M>",
        description: "Where the row is read from and where `create` and `update` go.",
      },
      {
        name: "mode",
        type: `"add" | "edit"`,
        description: "Whether the form creates a row or edits the one `editId` names.",
      },
      {
        name: "entity",
        type: "string",
        description: "The row's kind, used in the default title and messages.",
      },
      { name: "cancelHref", type: "string", description: "Where Cancel leads." },
      { name: "blank", type: "M", description: "The row an add form starts from." },
      {
        name: "schema",
        type: "Type",
        default: "none",
        description: "An arktype schema every change is checked against.",
      },
      {
        name: "validate",
        type: "(value, vl) => ValidationModel",
        default: "none",
        description: "Your own checks, run after the schema.",
      },
      {
        name: "archive",
        type: "ArchiveConfig<M>",
        default: "no archive checkbox",
        description: "Adds the archive checkbox and what blocks it.",
      },
      {
        name: "children",
        type: "({ vm, vl }) => ComponentChildren",
        description: "The field rows, given the model and validation signals.",
      },
    ],
    snippet: `<CrudEditor
  store={teamStore}
  mode="add"
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
      "The editor for a row that joins two others, which blocks Save when the new row would duplicate one that exists or was removed.",
    wide: true,
    props: [
      {
        name: "store",
        type: "CrudAssociationStore<M>",
        description:
          "The editor's store plus every row, removed ones included, and `delete` and `undelete`.",
      },
      { name: "blank", type: "M", description: "The row an add form starts from." },
      {
        name: "mode",
        type: `"add" | "edit"`,
        description: "Whether the form creates a row or edits the one `editId` names.",
      },
      {
        name: "entity",
        type: "string",
        description: "The row's kind, used in the default title and messages.",
      },
      { name: "cancelHref", type: "string", description: "Where Cancel leads." },
      {
        name: "children",
        type: "({ vm, vl }) => ComponentChildren",
        description: "The field rows, given the model and validation signals.",
      },
      {
        name: "conflict",
        type: "(row: M, rows: M[]) => M | undefined",
        description: "The existing row the new one would duplicate, if any.",
      },
      {
        name: "conflictField",
        type: "keyof M",
        description: "The field the duplicate's message is shown under.",
      },
      {
        name: "conflictRemovedMessage",
        type: "string",
        default: "an English sentence",
        description: "What to say when the duplicate was removed and can be restored.",
      },
    ],
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
  TextField: {
    summary:
      "A labelled text input bound to one field of a model signal, which writes the trimmed value when it loses focus.",
    wide: true,
    props: fieldRowProps,
    snippet:
      `<TextField vm={vm} vl={vl} name="name" label="Name" placeholder="Design" span="sm:col-span-2" />`,
    render: () => <TeamFieldsDemo />,
  },
  NumberField: {
    summary:
      "The numeric field row, which writes `0` for an empty or half-typed box instead of `NaN`.",
    wide: false,
    snippet:
      `<NumberField vm={vm} vl={vl} name="members" label="Members" hint="Commits 0 for an empty box" />`,
    render: () => <NumberFieldDemo />,
  },
  SelectField: {
    summary:
      "A labelled select whose options are data, so a numeric id stays a number in the model.",
    wide: false,
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
    summary: "A labelled checkbox bound to one boolean field of the model.",
    wide: false,
    snippet: `<CheckboxField vm={vm} vl={vl} name="archived" label="Is archived?" />`,
    render: () => <CheckboxFieldDemo />,
  },
  TextareaField: {
    summary: "The multi-line field row, which writes when it loses focus, like `TextField`.",
    wide: false,
    snippet: `<TextareaField vm={vm} vl={vl} name="notes" label="Notes" rows={3} />`,
    render: () => <TextareaFieldDemo />,
  },
  FieldIssues: {
    summary:
      "The messages of one field, one per issue type, so your own checks show beside the schema's.",
    wide: false,
    snippet: `<FieldIssues vl={vl} name="name" />

// Or with your own rendering, and the payload the issue carries:
<FieldIssues
  vl={vl}
  name="name"
  renderIssue={(issue, type) => <p>{type}: {issue.message}</p>}
/>`,
    render: () => <FieldIssueDemo />,
  },
  DeletionValidation: {
    summary:
      "The rows that still point at a row and so stop it being archived; with none, it shows nothing.",
    wide: false,
    snippet: `<DeletionValidation
  dependencies={[
    { kind: "Projects", values: [{ title: "Launch plan", url: "/projects/1/edit" }] },
  ]}
  model="Team"
/>`,
    render: () => <DeletionValidationDemo />,
  },
} satisfies DemoFragment
