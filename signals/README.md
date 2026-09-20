# `@preact-components/signals`

Signals state layer: a CRUD store factory, table sort state, and the small stores around them.
No Preact component, no Tailwind class, no application singleton.

```ts
import { buildModelStore } from "@preact-components/signals/build-model-store"
// or
import { buildModelStore, createToastStore } from "@preact-components/signals"
```

## Why it exists

`buildModelStore` is one 240-line factory that replaced eleven hand-rolled CRUD stores, and
`build-model-store` here is that factory rewritten for arktype. The other modules each collapse a
per-app copy of the same idea: financy's `theme`/`toast`/`clipboard` singletons, warthunder's
sort codec.

## What is in the box

| Module              | Exports                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `build-model-store` | `buildModelStore` — CRUD over one REST collection, arktype-validated |
| `table-state`       | `SortRule`, `toggleSort`, `sortRows`, `parseSort`, `serializeSort`   |
| `theme`             | `createThemeStore` — light/dark/system, persistence, `matchMedia`    |
| `toast`             | `createToastStore` — the store behind `Toastr`                       |
| `clipboard`         | `createClipboard` — `navigator.clipboard` plus a feedback port       |
| `validate`          | `validate(schema, value)` → `{ error, data }`                        |
| `map-entry`         | `setMapEntry` / `deleteMapEntry` — immutable `Map` writes            |
| `use-url-filters`   | `useUrlFilters` — two-way binding between URL params and signals     |

`types.ts` holds the shared shapes (`OperationState`, `OperationResult`, `ErrType`, `ValidationError`,
`RemoteEvent`, `ToastMessage`, …) and is re-exported from the barrel.

## `For` and `Show` live in the dependency, not here

This package used to ship its own `<For>` and `<Show>`. The pinned `@preact/signals` 2.5.1 ships
both, so ours are gone and the import moves:

```ts
import { For, Show } from "@preact/signals/utils"
```

The subpath resolves through the root import map's `@preact/signals` entry; there is nothing new to
pin. The two are not drop-in identical, and one of the differences is silent:

- **`fallback` renders for an _empty_ array.** Ours rendered nothing for an empty array and used
  `fallback` only for a missing one, so a list that legitimately empties out now shows the fallback
  where it used to show nothing. Decide per call site which you meant.
- **`each` must hold an array.** It takes `Signal<T[]>`, `ReadonlySignal<T[]>` or a function
  returning one; a signal holding `null` or `undefined` is not accepted, so give that signal a `[]`
  default or put the `<For>` inside a `<Show>`.
- **`fallback` and `children` are `ComponentChildren`** rather than a single `JSX.Element` — wider,
  not narrower: a string fallback and a list of children both type-check now.
- **`Show` also takes a getter** (`when={() => …}` as well as `when={signal}`), and its `children`
  function receives the value narrowed to non-nullable.
- **`Signal.prototype.map` has no replacement.** It was a patch on a type this package does not own,
  and `<For each={items}>{…}</For>` is what it expanded to, so write that.

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

- **Importing this package changes nothing globally.** It renders nothing, augments no prototype
  and registers no listener, and `+index.test.ts` is the guard on that. `<For>` and `<Show>` used to
  live here and the module patched `Signal.prototype.map` as a side effect of being imported, which
  reached every consumer of every package that imported this one.
- **`sortRows` reads a cell as one of three kinds, and the kind decides first.** Empty is `null`,
  `undefined`, `""` and `NaN` — "this column says nothing about this row" — and **it sorts last
  ascending and descending**, which is where a reader looks for those rows whichever way the column
  points; two empty cells tie, so the next rule decides. Of the rest, **every numeric cell sorts
  before every textual one**: a number, a boolean, a `bigint` and a `Date` are ordered by their
  number, and everything else by the text it prints.

  **A numeric string is textual.** `"9"` is text, so it sorts after `1000`, and a column that mixes
  the two shows every real number first and every quoted one after. This is the first thing a real
  column hits, because values arriving from a form, a query string or a CSV are strings however
  numeric they look: coerce the column where you load it — `Number(cell)` — rather than expecting
  the sort to guess.

  Deciding by kind first is what makes the order a real one. The first version of this fix chose its
  method per pair — two strings as text, anything else numerically — and that is not transitive: `5`
  beats `"1e3"` numerically, `"1e3"` beats `"2"` as text, and `"2"` beats `5` numerically, so those
  three cells sort into three different tables depending on the order the rows arrive in, and
  `Array.prototype.sort` is entitled to return anything when its comparator contradicts itself.
  `sortRows is a consistent order` in the test file is the guard: it checks transitivity over every
  triple of a set holding one cell of each kind, and sorts all 720 orderings of a mixed column to
  assert they come out as one table. Three caveats the rule does carry: a `bigint` past
  `Number.MAX_SAFE_INTEGER` can tie with its neighbour; a `Date` with no valid time sorts with the
  text, as `Invalid Date`; and a cell whose string conversion throws — an object made with
  `Object.create(null)`, or one with a throwing `toString` — throws out of `sortRows` when it meets
  a textual cell. That last one predates this rule and is not defended against here: a table cell
  holds something a table can show, and swallowing the throw would hide the real problem one layer
  further from where it was created.
- **`useUrlFilters` needs a DOM and a wouter router**, so only its value coercion
  (`resolveFilterValue`, `shouldPersistFilter`) is unit-tested here; the hook itself is wired the
  same way as every other hook in this repo — assert it in the app that renders it.
- **`createThemeStore` reads nothing until `attach()`.** Creating the store touches neither
  `localStorage` nor `matchMedia`, so a module-level `createThemeStore()` is inert on a server —
  which matters on Deno, where `localStorage` is a real file shared by every request the process
  serves. `attach()` loads the stored preference (once, on the first attach), reads the OS
  preference, starts watching it and applies the theme; until then `preference` is `"system"` and
  `system` is light. `set()` is the other caller-initiated read: it persists through the storage
  port, and a storage that refuses the write — a browser in private mode throws on `setItem` — is
  ignored rather than allowed to throw out of the click handler.
- **`as` assertions.** The package uses a handful, and only one is unavoidable: the spread of
  `extraOps`/`selectors` onto the base store in `build-model-store.ts`, where TypeScript cannot verify
  a spread of `Extra | undefined` against a generic `Extra`. The rest are local narrowing inside one
  function, each next to the check that justifies it — `parseSort` after its allow-list and direction
  tests, `resolveFilterValue` and the `filters` map in `useUrlFilters` where a generic `T` loses its
  key mapping, and `responseError` after `typeof body === "object"`. To audit them:

  ```bash
  grep -n " as " signals/*.ts | grep -v "\.test\." | grep -v "as const"
  ```
- **A reused toast id replaces that toast** and cancels the timer the old entry was carrying; it does
  not append a second entry a `remove(id)` could not tell apart.

## Tests

```bash
deno test signals/          # from the repository root
```

Every module has a colocated test except `types.ts`, which is types and enums only; the barrel's
own test is about what importing it does to the process rather than about an export of its own.
The model store is exercised against a fake `fetch`; toasts against a fake clock — no network, no
timers left running. `useUrlFilters` is the one exception: it needs a DOM and a router, so only its
pure coercion helpers are covered here.
