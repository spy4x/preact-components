# `@preact-components/signals`

Signals state layer: a CRUD store factory, table sort state, and the small stores around them.
No Preact component, no Tailwind class, no application singleton.

```ts
import { buildModelStore } from "@preact-components/signals/build-model-store"
// or
import { buildModelStore, createToastStore } from "@preact-components/signals"
```

## Why it exists

`buildModelStore` is one factory that replaced eleven hand-rolled CRUD stores, and
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
than a mistyped row in the UI. Each of those replacements is subject to the ordering rule below.

### Which answer the store keeps

Three rules decide what a row looks like once several answers have arrived for it: the session the
request was made in, the order the requests were made in, and, for a remote event, a freshness
check.

**An answer is only ever applied to the session that asked for it.** `reset()` raises a generation
number; every request reads it when it starts and compares it when its answer lands. An answer from
an earlier generation is handed back to its caller and otherwise ignored, so a save still on the
wire when the user signed out cannot reach the list the next sign-in loads. There is a longer note
on this below, because until recently it was a sharp edge rather than a promise.

**Requests are ordered by when they were made, not by when they answer.** Every write to a row
draws a number from one counter that the row's `update`, `undelete` and `delete` share. An answer
belonging to a request older than one already applied is dropped, so two quick edits leave the
second one's value in the store however the network reorders them, and a delete that answers before
an older update is not undone by it. A dropped answer is still returned to its own caller —
`await store.update(…)` tells you what the server said about _your_ request, and the store tells you
what it holds.

**`inProgress` drops when the newest request for the row has answered.** Nothing that reached the
network lowers it earlier, so no operation slot reports the work finished while the write that will
change the row is still on the wire. An older request does not hold the flag up: once the newest one
has settled, every answer still outstanding is one the store has already decided to discard, and
both of the row's slots are released. So a slot can read "finished" while a superseded request is,
strictly, still unanswered — there is nothing left that could change the row. Inside an operation,
the only thing that lowers a flag with no answer at all is input a schema rejects, because it never
reaches the network: the update schema for a row's slot, the create schema for the create slot.
There is a sharp edge about it below. `remove(id)` and `reset()` are the other way a flag stops
reading as in progress — they clear the slots outright rather than settling them.

A create has no id until the server answers, so "the same row" cannot mean a row there. Two creates
in flight make two different rows and both are appended; the only thing they contend for is the
single `createOp` slot, which the newest of them settles.

Nothing orders a remote event against a local request. An `"updated"` event that arrives while your
own `PATCH` is in flight is applied whenever the freshness check accepts it, and your own answer
then replaces it.

**A remote `"updated"` event is judged by `updatedAt`.** `isNewer` decides whether an incoming row
replaces the one being held. The default reads the first of `updatedAt`, `createdAt` that either row
carries a usable value for, and accepts the incoming row when that value is at least as late as the
stored one. Every other case accepts the incoming row too: equal timestamps, a pair where only one
side carries the column, and a model with no timestamp column at all. The event is the server saying
the row changed, so where the two rows cannot be ordered the event wins — a check that cannot read a
clock must not silently drop the write. Pass your own `isNewer` for a model that versions its rows
some other way.

### Extension points

- `extraOps(context)` — domain operations, merged onto the returned store. The context hands over
  `state`, `patch`, `setUpdateOp`, `setDeleteOp`, `request`, `toast`, `pathFor`, `generation` and
  `isCurrentGeneration`, so a domain operation behaves like a built-in one without the generic type
  ever learning about it. Two things it does not inherit, because the store cannot see inside it.
  The request ordering above: `setUpdateOp` writes the slot as it is told, so two domain operations
  in flight for one row settle in the order their answers arrive. And the session rule: read
  `context.generation()` before the request, and write nothing when
  `context.isCurrentGeneration(captured)` comes back false. That is also how an app-owned collection
  loader should be written — the store has no `fetch` of its own for the list, so `listOp` is
  resolved either by a remote event or by such a loader.
- `selectors(context)` — derived signals, merged the same way. `extraOps` wins a key collision.
- `session` — a signal or getter. `init()` watches it: when it goes falsy after having been truthy,
  the store resets (and `onReset` runs, for state the app owns). It calls `reset()` rather than
  clearing the slices itself, so the generation rises the same way it does for an application that
  resets by hand — there is one way to start a new session. Unlike the 17 copies this replaces, the
  effect has a disposer. `dispose()` runs it; `init()` returns it.

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

  **Why a `NaN` from the comparator did nothing rather than something loud:** `Array.prototype.sort`
  is specified to read a `NaN` result as `+0`, which is the answer for "these two are equal". The
  original bug follows from that one sentence. `Number(undefined)` is `NaN`, every subtraction
  against the blank cell was `NaN`, every pair reported equal, and a stable sort asked to order a
  column of equals hands back the order it was given. Nothing threw, nothing warned, and the column
  simply did not move — so a comparator that can return `NaN` does not fail, it goes quiet, which is
  the part worth remembering when writing the next one.

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
- **`useUrlFilters` re-reads the address every time it changes.** A link, a router push, back or
  forward: each one re-reads every parameter into its signal, and a parameter that has left the
  address takes its field back to `initialValue`. It did not always. The URL-to-signals effect was a
  `useSignalEffect` whose body reads no signal, and in the pinned `@preact/signals` 2.5.1 that is an
  effect with an empty dependency list, so the address was read once at mount and never again: a
  pushed route left the filters showing the previous route's values while the address bar showed the
  new one. The effect is keyed on the router's search string now, and the `popstate` listener that
  used to sit beside it is gone — the router re-renders on `popstate`, `pushState`, `replaceState`
  and `hashchange` by itself, so the listener was a duplicate, and one that read
  `globalThis.location.search` by hand rather than the half of the address its router was
  configured to use.
- **Reading the address never writes to it; a filter changing in the page is the only thing that
  does.** Reading flips `isInitializing`, which re-runs the signals-to-address effect, so the write
  has to be able to tell "the filters moved" from "I have just read them". It compares what the
  filters now imply against what they implied at the last read (`agreed` in the source), not against
  the address. Comparing against the address is nearly right and wrong in one case that matters: an
  address the hook would spell differently — a filter written out at its default (`?page=1`), a
  value a `parser` rejects (`?size=huge`), an empty value (`?status=`) — is not a filter change, and
  treating it as one rewrote the address on arrival. That cost a history entry nobody asked for, so
  Back landed on the address that had just been rewritten and was rewritten again, and on a
  fragment-routed page the rewrite took the route with it. Such an address is now left exactly as it
  arrived; the first real filter change rewrites the query string canonically.
- **A write replaces the whole address.** The router pushes `pathname?search`, which carries no
  fragment, so a fragment-routed page loses its route when a filter changes. Arriving, reading and
  remounting do not.
- **One address change costs one history entry**, in either direction, so one press of Back moves
  the reader once. `clearFilters` batches its writes through `clearFilterFields`, so clearing is one
  change rather than one per field. Preact's signals adapter batches writes inside an event handler
  anyway, so a clear driven by a button looks the same either way; the batch is what covers an
  application clearing from a timer or after a request.
- **`useUrlFilters` needs a DOM and a wouter router**, so what can be tested here is what it does to
  a query string: `resolveFilterValue`, `shouldPersistFilter`, `filterWrite`, `filterSearch` and
  `clearFilterFields` — which between them hold the rules for dropping a default, carrying a
  parameter the filters do not own, answering with the same string when nothing changed, and
  clearing as one change. The binding itself is an effect, and no
  test in this repository runs one: it is proven in a real browser by `pages/checks/signals.ts`,
  which drives a demo on the Pages host and asserts the filters change from one value to another as
  the address changes — including the history entry each change costs, an address the hook would
  spell differently, a parameter belonging to something else on the page, and a field with a custom
  `parser`.
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
- **Input a schema rejects settles the slot even while a write is outstanding.** An `update(id, …)`
  whose payload does not validate never reaches the network, so it takes no place in the row's
  request sequence: it files the validation error in that row's slot and lowers `inProgress` there,
  which is how the message reaches the form. A write for the same row that is still on the wire
  settles the slot again when its own answer lands. `create` does the same to the create slot, which
  another create may still be holding.
- **A request `reset()` leaves behind can no longer change anything.** `reset()` is what an
  application calls when somebody signs out. It raises a generation number that every operation
  reads when it issues its request and compares when the answer comes back, so an answer belonging
  to the session that ended writes nothing into the one that followed: not the list, not an
  operation slot, not a notification. It does not matter how many resets have happened in between,
  or whether the id it names still exists. The caller is still told the truth about its own
  request — `await store.update(…)` resolves with the row the server returned, or with the failure
  it returned, exactly as it would have — so a form waiting on that promise can stop waiting and
  say what happened; it is only the shared store that stays out of it.

  This used to be the other way round for the list. The per-row counters already refused to let an
  older answer settle a newer request's slot, but nothing stopped that answer replacing the row in
  the freshly loaded list. Where row ids are unique across the whole table that was a briefly stale
  name; where they restart per tenant it put one tenant's row under an id naming a different one,
  and a save from the editor made it permanent. #181 closed it. `buildModelStore across a reset` in
  the test file is the set of tests that pins the rule, and the generated cases reset the store
  mid-run and check the whole store against a model of it.

  A domain operation added through `extraOps` does not inherit the rule — the store cannot see
  inside it — and the extension points above say how one holds it.

## Tests

```bash
deno test signals/          # from the repository root
```

Every module has a colocated test except `types.ts`, which is types and enums only; the barrel's
own test is about what importing it does to the process rather than about an export of its own.
The model store is exercised against a fake `fetch`; toasts against a fake clock — no network, no
timers left running. The ordering rules above are tested with a second fake `fetch` that holds every
request open until the test answers it, so two writes to one row can be put in flight and answered
in the other order. `useUrlFilters` is the one exception: it needs a DOM and a router, so only its
pure coercion helpers are covered here and its binding to the address bar is covered in a real
browser, by `pages/checks/signals.ts` — run with `deno task --cwd pages build` and
`deno task --cwd pages verify`.

The model store has a second file, `build-model-store.generated.test.ts`. The named tests fix one
arrangement each and hold everything else still — three small row ids, two requests, a handful of
statuses, a list of one or two rows — and a rule that reads an axis none of them varies cannot fail
when it breaks. That is not hypothetical: a freshness check comparing the wrong column and a request
counter shared by every row both survived a green suite here. The generated file varies those axes
instead, from a fixed seed, and checks the store against a model of the rules after every step. It
covers what no finite set of fixtures can — row identity, how many rows are in flight, how long the
list is, which status came back, and whether the store was reset between a request and its answer —
and its own header says what it does not cover, how many of its cases reach each of those shapes,
and how to reproduce a failure from the number it prints. It is not a description of the store: read
the named tests for that.
