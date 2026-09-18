# `@preact-components/crud`

The list and editor scaffolding every resource page in `gb` was rebuilt from: one table with search,
a status filter, a count and row actions, and one add/edit form with validation, a soft delete and a
dependency block. The package knows no entity — the store arrives as a prop and the cells and fields
arrive as slots.

```ts
import {
  CrudEditor,
  CrudList,
  RowAction,
  RowActions,
  search,
  TextField,
} from "@preact-components/crud"
```

## Why it exists

`gb` carries sixteen `List.tsx` (2,948 lines) and eleven `Editor.tsx` (3,785 lines). Nine of the
eleven editors are the same six-part harness — load the row once, validate on every change, offer
the archive toggle, submit, reload, render a title, a card, a footer and a dependency list — with a
different field list in the middle. Roughly 55% of that is copy-paste.

The copies have already drifted, and every drift is a bug the type system did not catch because
each copy was written out by hand:

| Source file                           | What drifted                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `admin/users/List.tsx:90`             | reads `state.gateway.op.list.error` — the wrong store's error                                                               |
| `admin/system/List.tsx:71`            | reads `state.userSession.listOp` — a store the page never loads                                                             |
| `lamp-profiles/List.tsx:41`           | the count badge counts `state.lampBox`                                                                                      |
| `lamps/List.tsx:79`                   | the search input lost `value={query.value}`, so a re-render wipes the box                                                   |
| `zones/Editor.tsx:284`                | a second field reuses `for="zone-name"`…                                                                                    |
| `lamp-profiles/Editor.tsx`            | …four times over, so every label points at the first field                                                                  |
| `gateways/Editor.tsx:209`             | a field named `sensor-device-id` on the gateway form                                                                        |
| `sensors/Editor.tsx:251`              | the "navigate to it" link builds a `/devices/lamp-boxes/…` URL from a sensor                                                |
| `alerts/View.tsx:76`                  | an Acknowledge button with no `onClick`                                                                                     |
| `lamp-boxes/[id]/zones/Editor.tsx:28` | branches on the `deletedAt` of a row found in `list.nonDeleted`, so its "you can restore the old one" branch is unreachable |

The scaffold closes that class of bug by construction: the status slice, the error source, the
count, the control ids and the save rule are written once. `field.tsx` generates every control id
with `useId`, `crud-list.tsx` reads the error from the store it was handed, and both `value` and
`onInput` are bound to the search box.

## Slots, not a schema

`fields={[…]}` was the tempting API and it is the wrong one. The four largest editors
(`schedules` 461, `sensors` 456, `lamp-boxes` 440, `admin/users` 342) and both association editors
put tables, grids, toggles and conditional sections between their fields; expressing them through a
field array needs a `render:` hatch per field, which is the same code plus indirection and a type
parameter nobody can read. So the field list is a function slot and the table's cells are a slot,
and the parts that are genuinely identical are the parts that live here.

What each slot receives is small: the editor's body gets `{ vm, vl }` — the model signal and the
validation signal — and the list gets `header`, `row` and `actions`.

## The store contract

`signals/` is a sibling package, and this one reads it through two **structural** interfaces
(`store.ts`) rather than importing `ModelStore`:

```ts
interface CrudListStore<M extends CrudModel> {
  list: { nonDeleted: ReadonlySignal<M[]>; deleted: ReadonlySignal<M[]> }
  op: { list: ReadonlySignal<OperationState> }
}

interface CrudEditorStore<M extends CrudRow, T = M> {
  one: { byId: (id: number) => ReadonlySignal<M | undefined> }
  op: {
    create: ReadonlySignal<OperationState>
    update: (id: number) => ReadonlySignal<OperationState | undefined>
  }
  create: (data: T) => Promise<OperationResult<M>>
  update: (id: number, data: T) => Promise<OperationResult<M>>
}
```

A real `buildModelStore` satisfies both with no adapter, no cast and no `extraOps` — that is what
`crud/store.test.ts` asserts, against the real factory bound to a fake `fetch`.

Deriving these from `ModelStore<F, C, U>` instead would not work: its row type is `SchemaOutput<F>`,
so a prop typed `ModelStoreBase<…>` would have to spell out arktype schemas and would collapse every
component to `CrudList<Model>`, losing the row type that makes `CrudList<Region>` read as it does.
The interfaces here describe the slice actually consumed, and nothing else.

## `CrudList`

```tsx
<CrudList
  store={regionStore}                       // or `rows={…}` for a nested or read-only list
  title="Regions"
  match={(region, word) => search(region.name, word)}
  addHref="/devices/regions/add"
  canAdd={() => canChange.value}
  header={<th class="text-left" scope="col">Name</th>}
  row={(region) => <td>{region.name}</td>}
  actions={(region) => <RowActions><RowAction href={…}>Edit</RowAction></RowActions>}
/>
```

| Prop                            | Default           | What it does                                                      |
| ------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `store`                         | —                 | model store: the status slices, the count and the load error      |
| `rows`                          | —                 | a plain signal instead — nested, or a read-only collection        |
| `error`                         | `store.op.list`   | the banner source for a signal-backed list                        |
| `title` / `titleSlot`           | —                 | the page title, or a slot for a back button or a parent entity    |
| `badge`                         | non-deleted count | badge after the title; `false` hides it                           |
| `match`                         | —                 | whether one word matches a row; words are ANDed                   |
| `header`, `row`                 | —                 | the table's cells, excluding the actions column                   |
| `actions`                       | —                 | right-aligned actions cell; adds its own header cell              |
| `addHref`, `addLabel`, `canAdd` | —                 | the add action, hidden when there is nowhere to go                |
| `statusFilter`                  | on                | `false`, or `{ label, active, archived }` for a different wording |
| `query`, `status`               | local signals     | hand over the signals to own them (URL filters, a parent page)    |
| `searchDelay`                   | `300`             | debounce of the search box                                        |

`rows` is how the two variants the store cannot express are built. A nested list scoped to a parent
passes a selector (`state.zoneLampBox.zonesOfLampBox(lampBoxId)`); a read-only collection with no
soft-delete column passes its own signal and its own error. Either way the status filter is off,
because there is nothing to switch between.

## `CrudEditor`

```tsx
<CrudEditor
  mode="edit"                               // or mode="add"
  editId={Number(params.id)}
  store={regionStore}
  blank={blankRegion}
  schema={regionBaseSchema}
  entity="Region"
  cancelHref="/devices/regions"
  onCreated={(region) => navigate(`/devices/regions/${region.id}/edit`)}
  validate={(value, vl) => …}               // optional domain checks
  archive={{ dependencies: (region) => regionDependents(region) }}   // the archive toggle
>
  {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Name" />}
</CrudEditor>
```

The harness is the six parts, once:

1. **Load once** through `useSignalEffect` — the row is copied out of the store with
   `structuredClone`, so an edit nobody submitted cannot reach the store the rest of the page reads.
   A row that has not arrived yet re-runs the effect when it does.
2. **Validate on every change** with arktype, plus the caller's own checks through `validate`, which
   runs after the schema and may read signals — that is how a check against a not-yet-loaded
   collection fixes itself.
3. **Archive** by toggling `deletedAt` on the model — when the caller passed `archive`. The update
   that carries the stamp is the update the form already submits; the scaffold never issues a
   `DELETE`, and a row with no life of its own (a junction row) gets no toggle at all.
4. **Dependencies**: `archive.dependencies(row)` is asked first, and a non-empty answer blocks Save
   and is listed by `DeletionValidation`.
5. **Submit**: an add calls `create` and hands the new row to `onCreated` (navigate from there); an
   edit calls `update` and reloads the row from the store.
6. **Chrome**: page title, error line, card, footer with the archive toggle, Cancel and Save, and the
   dependency block. Save is live only when the form is initialised, valid, idle and unblocked.

| Prop         | Default             | Notes                                                           |
| ------------ | ------------------- | --------------------------------------------------------------- |
| `blank`      | —                   | the add-mode row; the row type is inferred from it              |
| `schema`     | —                   | arktype schema validated on every change; omit if there is none |
| `entity`     | —                   | "Add **Region**", "Region not found", dependency sentence       |
| `title`      | `Add/Edit <entity>` | full title override                                             |
| `canChange`  | `true`              | a port, because the library has no auth                         |
| `archive`    | no toggle           | `{}` turns the archive toggle on; `{ label, dependencies }`     |
| `onCreated`  | —                   | navigate where the created row belongs                          |
| `validate`   | —                   | extra checks after the schema                                   |
| `cancelHref` | —                   | where Cancel points                                             |
| `notice`     | —                   | slot between the field grid and the footer                      |
| `footerSlot` | —                   | slot at the start of the footer                                 |

## Field rows

`field.tsx` holds the rows the nine validated editors repeat: `TextField`, `NumberField`,
`TextareaField`, `SelectField`, `CheckboxField`. Each takes `{ vm, vl, name, label }` plus `span`,
`hint`, `placeholder`, `inputClass` and `renderIssue`.

```tsx
<TextField vm={vm} vl={vl} name="name" label="Name" />
<NumberField vm={vm} vl={vl} name="powerW" label="Power, W" span="sm:col-span-2" />
<SelectField
  vm={vm} vl={vl} name="zoneId" label="Zone" placeholder="Select zone"
  options={zones.value.map((zone) => ({ value: zone.id, label: zone.name }))}
  renderIssue={(issue) => (
    <p class="text-sm text-red-700 mt-2">
      {issue.message} <a class="btn-link" href={`/devices/zones/${issue.payload}/edit`}>Go to it</a>
    </p>
  )}
/>
```

Four behaviours the copies got wrong, now in one place:

- **Ids.** Every control generates its own id with `useId`, so two rows — or two editors on one
  page — can no longer share one and steal each other's label.
- **Writes.** A field commits on blur into a fresh object (`setField`), because signals compare by
  reference and an in-place mutation renders nothing.
- **Selects.** The control's value is the model's, not each option's `selected` flag; a value no
  option carries falls back to the empty option instead of displaying the first entry as chosen.
  Option values are rendered as strings, because a browser only reports a string and the server
  renderer compares an option to its select with `==` — a numeric `0` matched the empty placeholder
  (`"" == 0`) and rendered two options selected.
- **Numbers.** An empty or half-typed number box commits `0`, not `NaN`, which is what the schema
  would otherwise reject on every keystroke.

## `DeletionValidation`, `RowActions`, `timeAgo`

`DeletionValidation` renders the entities that block an archive and scrolls itself into view. It
lives here rather than in `ui/` because only the CRUD scaffold produces a `DeletionDependency`.
`RowActions`/`RowAction` are the per-row menu: a link when given an `href`, a button when given an
`onClick`, red when `danger`. `timeAgo` and `formatTimestamp` format the archive line.

## Worked example: `gb`'s regions, end to end

`crud/examples/regions.tsx` ports `devices/regions` — `List.tsx` (116 lines) and `Editor.tsx` (204
lines) — against the real `buildModelStore`. The whole resource is a schema, a store and two
components; `crud/examples/regions.test.tsx` renders both.

```tsx
const regionSchema = type({
  id: "number",
  name: "1 <= string <= 255",
  createdAt: date,
  updatedAt: date,
  deletedAt: date.or("null"),
})
const regionBaseSchema = regionSchema.omit("id", "createdAt", "updatedAt", "deletedAt")

export const regionStore = buildModelStore({
  model: "region",
  endpoint: "/api/regions",
  schemas: { full: regionSchema, create: regionBaseSchema, update: regionBaseSchema.partial() },
  sort: (a, b) => a.name.localeCompare(b.name),
  toast: createToastStore(),
})

export function RegionList() {
  return (
    <CrudList
      store={regionStore}
      title="Regions"
      match={(region, word) => search(region.name, word)}
      addHref="/devices/regions/add"
      canAdd={() => canChange.value}
      header={<th class="text-left" scope="col">Name</th>}
      row={(region) => (
        <td>
          <a href={`/devices/regions/${region.id}/edit`} class="hover:underline">{region.name}</a>
        </td>
      )}
      actions={(region) => (
        <RowActions>
          <RowAction href={`/devices/regions/${region.id}/edit`}>
            {canChange.value ? "Edit" : "View"}
          </RowAction>
        </RowActions>
      )}
    />
  )
}

export function RegionEditor(props: RegionEditorProps) {
  return (
    <CrudEditor
      {...props}
      store={regionStore}
      blank={blankRegion}
      schema={regionBaseSchema}
      entity="Region"
      cancelHref="/devices/regions"
      canChange={() => canChange.value}
      onCreated={(region) => navigate(`/devices/regions/${region.id}/edit`)}
    >
      {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Name" />}
    </CrudEditor>
  )
}
```

320 lines of component become 40 lines of component plus the schema and the store, which the app
already had. What is gone is the chrome; what is left is what is true of a region.

## The 49 route stubs

The route files are 100% mechanical and deliberately not shipped. The convention, per resource `X`:

```
routes/<area>/x/index.tsx     → <XList />
routes/<area>/x/add.tsx       → <XEditor mode="add" />
routes/<area>/x/[id]/edit.tsx → <XEditor mode="edit" editId={Number(params.id)} />
```

`CrudEditor`'s props are a discriminated pair, so the `add` route cannot forget an id and the `edit`
route cannot omit one.

## Association rows

A junction row — a lamp box _is in_ a zone — is the second editor shape in `gb`
(`lamp-boxes/[id]/zones` 215 lines, `schedules/[id]/zones` 223, `lamp-boxes/[id]/lamps` 295, all
near-identical). It differs from a validated form in three ways, and each one is a slot or a port on
`CrudEditor` rather than a second harness to drift from:

- **No validation model.** A junction row has no rules of its own, so there is no schema; its one
  rule — "this pair already exists" — arrives through the same `validate` port everything else uses,
  as an issue on the field the user has to change.
- **A conflict instead of a dependency list.** `conflict(row, rows)` names the row that would be
  duplicated; `conflictIssue` turns it into an issue whose payload is that row's id, so the message
  appears beside the control and disables Save through the existing rule.
- **Removal instead of archiving.** Delete ends the row and Restore brings it back, written into
  `footerSlot`.

`association-editor.tsx` is the composition, not a copy:

```tsx
<AssociationEditor
  mode="edit"
  editId={zoneLampBoxId}
  store={zoneLampBoxStore}
  blank={blankZoneLampBox(lampBoxId)}
  entity="zone association"
  cancelHref={`/devices/lamp-boxes/${lampBoxId}/zones`}
  conflictField="zoneId"
  conflict={(value, rows) =>
    rows.find((other) =>
      other.id !== value.id && other.lampBoxId === value.lampBoxId && other.zoneId === value.zoneId
    )}
  onCreated={(created) => navigate(`/devices/lamp-boxes/${lampBoxId}/zones/${created.id}/edit`)}
>
  {({ vm, vl }) => (
    <SelectField
      vm={vm}
      vl={vl}
      name="zoneId"
      label="Zone"
      placeholder="Select zone"
      options={zones.value.map((zone) => ({ value: zone.id, label: zone.name }))}
    />
  )}
</AssociationEditor>
```

`CrudAssociationStore` adds `list.all`, `delete` and `undelete` to `CrudEditorStore`. It reads
`list.all` rather than `list.nonDeleted` because the duplicate worth telling the user about is often
a row that was removed earlier: the source editors scanned `nonDeleted` and then branched on
`deletedAt`, which is always falsy there, so their "you can restore the old one" branch was
unreachable. Here the removed duplicate renders a Restore offer beside the conflict message.

## What is deliberately not here

- **Editor C — multi-form editors** (two independent forms plus a ban toggle) and the **singleton**
  settings form (no id, no collection). Neither is a list-plus-editor shape.
- **The 49 route stubs** — a convention, above, not library code.
- **A full ported association example.** `regions` proves the list and the validated editor end to
  end; the association editor is covered by `association-editor.test.tsx` against a fake junction
  store (removal, restore, the conflict issue, the unreachable-branch fix) and by the snippet above,
  rather than by a second resource ported into `examples/`.
- **A DOM-level test of the harness.** Effects do not run under `preact-render-to-string`, so the
  load, validate, submit and archive loops are covered against a fake store at the function level
  (`crud-editor.test.ts`), and the markup is covered by a server render. Wiring a real browser to the
  scaffold is the app's test to write, the same way `signals/` leaves `useUrlFilters` to the app
  that renders it.

## Differences from the source files

Small, deliberate, and each one is why the source files could drift:

- **`search(value, word, condition)` lost its third argument.** Callers write
  `row.module === Kind.X && search(label, word)` instead of folding the condition into the matcher.
- **Statuses are `"active" | "archived"`, not numeric enums.** A `DeviceStatus.ACTIVE = 1` is not a
  library's to define, and the wording is a prop (`{ archived: "Banned" }`).
- **The error banner renders `error.message`.** The source files interpolated the error object into
  a paragraph.
- **`timeAgo` no longer reports "0 years ago"** for something 360–364 days old; it keeps counting
  months until a full year has passed.
- **`undelete`, not `restore`.** The state layer names the operation `undelete`, and the scaffold
  uses its vocabulary — the button label stays "Restore".
- **The archive toggle is a port (`archive`), not a default.** Every source editor had one; a
  junction row must not, and "no `dependencies` prop" was the wrong way to say so.
- **The status filter's count is the non-deleted total**, as in every source list, not the count of
  the rows the search term left visible.

## Tests

```bash
deno test crud/       # from the repository root
```

Every module has a colocated suite: the validation fold (`validation.test.ts`), search and
filtering (`search.test.ts`), the relative timestamps (`time-ago.test.ts`), the save-enabled rule,
the submit routing, the archive toggle and editor chrome (`crud-editor.test.ts`), the field rows
rendered to real markup (`field.test.tsx`), the list's status switch, count, error, search binding
and actions column (`crud-list.test.tsx`), the two structural interfaces satisfied by the real
`buildModelStore` (`store.test.ts`), and the ported regions resource
(`examples/regions.test.tsx`). No network, no timers left running.
