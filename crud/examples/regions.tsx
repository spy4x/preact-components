/**
 * A source application's `regions` resource, ported end to end as the worked example for this
 * package.
 *
 * The two source files — a list (116 lines) and an editor (204 lines) — become the schema, the
 * store and the two components below. Every slot that is genuinely about a region is still written
 * out; everything the source files restated (the page layout, the count badge, the debounced search
 * box, the status select, the table shell, the validation loop, the archive toggle, the dependency
 * block, the save button's enabled rule) is the scaffold's.
 *
 * The store is the real one — `buildModelStore` from `@preact-components/signals`. This package
 * only ever reads it through the structural interfaces in `store.ts`, which is what lets the two
 * components below be typed by the row and nothing else.
 */

import { CrudEditor, CrudList, RowAction, RowActions, TextField } from "@preact-components/crud"
import { buildModelStore } from "@preact-components/signals/build-model-store"
import { createToastStore } from "@preact-components/signals/toast"
import { signal } from "@preact/signals"
import { search } from "@spy4x/platform/universal/text"
import { type } from "arktype"

// #region Model — one schema, and the row type derived from it

const date = type("Date | string.date.iso.parse")

const regionSchema = type({
  id: "number",
  name: "1 <= string <= 255",
  createdAt: date,
  updatedAt: date,
  deletedAt: date.or("null"),
})

/** A region row, as the API returns it. */
export type Region = typeof regionSchema.infer

/** What the form submits: the server-owned columns are left out. */
const regionBaseSchema = regionSchema.omit("id", "createdAt", "updatedAt", "deletedAt")
const regionUpdateSchema = regionBaseSchema.partial()

const blankRegion: Region = {
  id: 0,
  name: "",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

// #endregion

// #region Store and ports — what the components are not allowed to know

export const regionStore = buildModelStore({
  model: "region",
  endpoint: "/api/regions",
  schemas: {
    full: regionSchema,
    create: regionBaseSchema,
    update: regionUpdateSchema,
  },
  sort: (a, b) => a.name.localeCompare(b.name),
  toast: createToastStore(),
})

/** Stand-in for `state.auth.haveChangeRole()`: the library has no auth, so it arrives as a port. */
export const canChange = signal(true)

/** Stand-in for the app's client-side navigation. */
export const navigate = (url: string): void => {
  globalThis.location.href = url
}

// #endregion

// #region Components — 14 lines of list, 15 lines of editor, was 320 between them

/** `/regions` — the table. */
export function RegionList() {
  return (
    <CrudList
      store={regionStore}
      title="Regions"
      match={(region, word) => search(region.name, word)}
      addHref="/regions/add"
      canAdd={() => canChange.value}
      header={<th class="text-left" scope="col">Name</th>}
      row={(region) => (
        <td class="text-gray-900">
          <a href={`/regions/${region.id}/edit`} class="hover:underline">{region.name}</a>
        </td>
      )}
      actions={(region) => (
        <RowActions>
          <RowAction href={`/regions/${region.id}/edit`}>
            {canChange.value ? "Edit" : "View"}
          </RowAction>
        </RowActions>
      )}
    />
  )
}

/** Props of {@link RegionEditor}: the pair every route stub passes. */
export type RegionEditorProps =
  | { mode: "add"; editId?: undefined }
  | { mode: "edit"; editId: number }

/** `/regions/add` and `/regions/[id]/edit` — the form. */
export function RegionEditor(props: RegionEditorProps) {
  return (
    <CrudEditor
      {...props}
      store={regionStore}
      blank={blankRegion}
      schema={regionBaseSchema}
      entity="Region"
      cancelHref="/regions"
      canChange={() => canChange.value}
      // A region archives rather than being removed. Nothing blocks the archive in this example;
      // in the source application the port answers with the region's zones, which have to be
      // archived first.
      archive={{}}
      onCreated={(region) => navigate(`/regions/${region.id}/edit`)}
    >
      {({ vm, vl }) => <TextField vm={vm} vl={vl} name="name" label="Name" />}
    </CrudEditor>
  )
}

// #endregion
