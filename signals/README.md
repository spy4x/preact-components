# `@preact-components/signals`

Signals state layer: a CRUD store factory, list and table state, and the small stores around them.
No Preact component, no Tailwind class, no application singleton.

```ts
import { buildModelStore } from "@preact-components/signals/build-model-store"
// or
import { buildModelStore, cn, createToastStore } from "@preact-components/signals"
```

## Why it exists

`buildModelStore` is one 240-line factory that replaced eleven hand-rolled CRUD stores, and
`build-model-store` here is that factory rewritten for arktype. The other modules each collapse a
per-app copy of the same idea: roley's `listStateFactory` (five entity stores), financy's
`theme`/`toast`/`clipboard` singletons, warthunder's sort codec.

## What is in the box

| Module              | Exports                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `build-model-store` | `buildModelStore` — CRUD over one REST collection, arktype-validated |
| `list-state`        | `createListState` — `{list, operations}` on signals                  |
| `table-state`       | `SortRule`, `toggleSort`, `sortRows`, `parseSort`, `serializeSort`   |
| `theme`             | `createThemeStore` — light/dark/system, persistence, `matchMedia`    |
| `toast`             | `createToastStore` — the store behind `Toastr`                       |
| `clipboard`         | `createClipboard` — `navigator.clipboard` plus a feedback port       |
| `validate`          | `validate(schema, value)` → `{ error, data }`                        |
| `map-entry`         | `setMapEntry` / `deleteMapEntry` — immutable `Map` writes            |
| `use-url-filters`   | `useUrlFilters` — two-way binding between URL params and signals     |
| `+signals`          | `<For>`, `<Show>`, `Signal.prototype.map` (`…/signals/signals`)      |
| `cn`                | `cn()` — `clsx` + `tailwind-merge`                                   |

`types.ts` holds the shared shapes (`OperationState`, `OperationResult`, `ErrType`, `ValidationError`,
`RemoteEvent`, `ToastMessage`, …) and is re-exported from the barrel.

## Design rules this package follows

- **Ports, not singletons.** `buildModelStore` takes `fetch`, a `toast` port and a `session` flag;
  `createThemeStore` takes `storage`, `media` and `apply`; `createClipboard` takes the clipboard.
  Every one has a browser default, and every one can be a test double.
- **Immutability is load-bearing.** Signals compare by reference, so per-row operation state lives in
  `Map`s that are copied on write, `list.all` sorts a copy, and toasts append to a new array.
- **Honest types.** No optional members that are always present, no `as` casts in consumers. `op.delete`
  exists, `one.byId` returns `M | undefined`, and the generic store knows nothing about any domain's
  operations — those come in through `extraOps`.
- **arktype only.** A response body is parsed once with the schema you pass, and both the runtime
  validation and the TypeScript type come from that one schema.

## `buildModelStore` in one example

```ts
import { type } from "arktype"
import { buildModelStore } from "@preact-components/signals/build-model-store"
import { createToastStore } from "@preact-components/signals/toast"

const toast = createToastStore()
const dateSchema = type("Date | string.date.iso.parse")

const zoneSchema = type({
  id: "number",
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.or("null"),
  name: "1 <= string <= 255",
})
const zoneCreateSchema = zoneSchema.omit("id", "createdAt", "updatedAt", "deletedAt")
const zoneUpdateSchema = zoneCreateSchema.partial()

export const zone = buildModelStore({
  model: "zone",
  endpoint: "/api/zones",
  schemas: { full: zoneSchema, create: zoneCreateSchema, update: zoneUpdateSchema },
  toast,
  sort: (a, b) => a.name.localeCompare(b.name),
  session: () => currentUser.value !== null,
  extraOps: ({ request, setUpdateOp, pathFor }) => ({
    turn: async (id: number, isOn: boolean) => {
      setUpdateOp(id, { inProgress: true, error: null, result: null })
      const outcome = await request(`${pathFor(id)}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOn }),
      }, zoneSchema)
      if (outcome.error) return false
      setUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
      return true
    },
  }),
})

zone.list.nonDeleted.value // rows with no deletedAt
zone.one.byId(3).value // Zone | undefined
zone.op.update(3).value?.error // per-row operation state
await zone.create({ name: "North" })
await zone.delete(3) // soft delete: the row keeps its place in the list
await zone.undelete(3)
zone.remove(3) // local eviction, no request
await zone.onWs(message.p, RemoteEvent.CREATED)
zone.init() // one session watch, with a disposer
```

### Endpoints it calls

| Operation  | Request                           | Result                                |
| ---------- | --------------------------------- | ------------------------------------- |
| `create`   | `POST ${endpoint}`                | appends the parsed row                |
| `update`   | `PATCH ${endpoint}/${id}`         | replaces the row in place             |
| `delete`   | `DELETE ${endpoint}/${id}`        | replaces the row — a soft delete      |
| `undelete` | `POST ${endpoint}/${id}/undelete` | replaces the row                      |
| `remove`   | none                              | drops the row and its operation slots |

`paths.one` and `paths.undelete` override the two URLs. Every response body must be a full row:
that is what `schemas.full` is for, and a body that does not match becomes a payload error rather
than a mistyped row in the UI.

### Extension points

- `extraOps(context)` — domain operations, merged onto the returned store. The context hands over
  `state`, `patch`, `setUpdateOp`, `setDeleteOp`, `request`, `toast` and `pathFor`, so a domain
  operation behaves like a built-in one without the generic type ever learning about it.
- `selectors(context)` — derived signals, merged the same way. `extraOps` wins a key collision.
- `session` — a signal or getter. `init()` watches it: when it goes falsy after having been truthy,
  the store resets (and `onReset` runs, for state the app owns). Unlike the 17 copies this replaces,
  the effect has a disposer. `dispose()` runs it; `init()` returns it.

## Notes and sharp edges

- **`cn` is the original scaffold module** — unchanged, still exported from
  `@preact-components/signals/cn`.
- **`+signals` patches `Signal.prototype`** when imported, adding `.map(fn)` as JSX sugar. Importing
  the barrel imports it.
- **`For`'s `fallback` is for an absent array**, not an empty one; an empty array renders nothing.
- **`useUrlFilters` needs a DOM and a wouter router**, so only its value coercion
  (`resolveFilterValue`, `shouldPersistFilter`) is unit-tested here; the hook itself is wired the
  same way as every other hook in this repo — assert it in the app that renders it.
- **`createThemeStore` reads the OS once at creation** and keeps watching only after `attach()`,
  which is also what applies the theme.
- **`as` assertions.** The package uses a handful, and only one is unavoidable: the spread of
  `extraOps`/`selectors` onto the base store in `build-model-store.ts`, where TypeScript cannot verify
  a spread of `Extra | undefined` against a generic `Extra`. The rest are local narrowing inside one
  function, each next to the check that justifies it — `parseSort` after its allow-list and direction
  tests, `resolveFilterValue` and the `filters` map in `useUrlFilters` where a generic `T` loses its
  key mapping, `responseError` after `typeof body === "object"`, and `Signal.prototype.map` handing
  its element through `For`. To audit them:

  ```bash
  grep -n " as " signals/*.ts signals/*.tsx | grep -v "\.test\." | grep -v "as const"
  ```
- **A reused toast id replaces that toast** and cancels the timer the old entry was carrying; it does
  not append a second entry a `remove(id)` could not tell apart.

## Tests

```bash
deno test signals/          # from the repository root
```

Every module has a colocated test except the barrel and `types.ts`, which is types and enums only.
The model store is exercised against a fake `fetch`; toasts against a fake clock — no network, no
timers left running. `useUrlFilters` is the one exception: it needs a DOM and a router, so only its
pure coercion helpers are covered here.
