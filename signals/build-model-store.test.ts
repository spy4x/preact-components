import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { effect, signal } from "@preact/signals"
import { type } from "arktype"
import { buildModelStore } from "./build-model-store.ts"
import { ErrType, RemoteEvent, type ToastMessage } from "./types.ts"

const dateSchema = type("Date | string.date.iso.parse")

const rowSchema = type({
  id: "number",
  name: "string",
  createdAt: dateSchema,
  deletedAt: dateSchema.or("null"),
})
const createSchema = type({ name: "1 <= string <= 50" })
const updateSchema = type({ name: "string" })

type Row = typeof rowSchema.infer

function row(id: number, name: string, deletedAt: Date | null = null): Row {
  return { id, name, createdAt: new Date("2024-01-01T00:00:00.000Z"), deletedAt }
}

/**
 * A row carrying both timestamps, for the freshness tests.
 *
 * `rowSchema` above has no `updatedAt`, which is what keeps the `createdAt` fallback covered. This
 * one exists so a test can move the two columns in opposite directions and see which one the
 * freshness check reads: a fixture whose timestamps move together proves nothing.
 */
const timedRowSchema = type({
  id: "number",
  name: "string",
  createdAt: dateSchema,
  updatedAt: dateSchema,
  deletedAt: dateSchema.or("null"),
})

type TimedRow = typeof timedRowSchema.infer

function timedRow(id: number, name: string, createdAt: string, updatedAt: string): TimedRow {
  return {
    id,
    name,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    deletedAt: null,
  }
}

/** When every row in the overlap tests was created. Only `updatedAt` moves there. */
const CREATED_AT = "2024-01-01T00:00:00.000Z"
/** The instant the list starts from, so a later change and an earlier one are both expressible. */
const LOADED_AT = "2024-04-01T00:00:00.000Z"
/** Two instants after {@link LOADED_AT}, for the two sides of a comparison. */
const EARLIER = "2024-06-01T00:00:00.000Z"
const LATER = "2024-09-01T00:00:00.000Z"

/** A timed row stamped `updatedAt`, which is the column both freshness comparisons read. */
function stampedRow(id: number, name: string, updatedAt: string): TimedRow {
  return timedRow(id, name, CREATED_AT, updatedAt)
}

/** The same row, soft-deleted at `at` — what the server sends back for a delete. */
function archivedAt(source: TimedRow, at: string): TimedRow {
  return { ...source, deletedAt: new Date(at) }
}

interface RecordedCall {
  url: string
  init: RequestInit
}

/** A `fetch` stand-in that replays queued responses and records the requests made. */
function queueFetch(...queue: Array<Response | Error>) {
  const calls: RecordedCall[] = []
  const impl = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : String(input), init: init ?? {} })
    const next = queue.shift()
    if (!next) throw new Error("fake fetch: unexpected request")
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }) as typeof fetch
  return { impl, calls }
}

/**
 * Row pairs the two-row tests run over.
 *
 * One pair would only catch a keying mistake that happens to merge that pair: `id % 2` leaves rows
 * 1 and 2 apart and merges 1 and 3, `Math.floor(id / 2)` merges 2 and 3. Every merge of the first
 * three ids shows in one of these three, which is what a mis-keyed lookup looks like in practice.
 * A fixture cannot do better than that: a lookup that merges only rows 7 and 8 survives any finite
 * set of ids.
 */
const ROW_PAIRS: ReadonlyArray<readonly [number, number]> = [[1, 2], [2, 3], [1, 3]]

interface PendingCall extends RecordedCall {
  /** Answer this request: a `Response` resolves it, an `Error` rejects it. */
  settle: (answer: Response | Error) => void
}

/**
 * A `fetch` stand-in that holds every request open until the test answers it.
 *
 * `queueFetch` settles each request the moment it is made, in the order the responses were queued,
 * which cannot express what these tests are about: two requests in flight at once, answered in the
 * other order.
 */
function deferredFetch(): { impl: typeof fetch; pending: PendingCall[] } {
  const pending: PendingCall[] = []
  const impl =
    ((input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        pending.push({
          url: input instanceof Request ? input.url : String(input),
          init: init ?? {},
          settle: (answer) => answer instanceof Error ? reject(answer) : resolve(answer),
        })
      })) as typeof fetch
  return { impl, pending }
}

function toastRecorder(): {
  port: { success: (t: ToastMessage) => void; error: (t: ToastMessage) => void }
  messages: ToastMessage[]
} {
  const messages: ToastMessage[] = []
  return {
    port: {
      success: (message: ToastMessage) => messages.push(message),
      error: (message: ToastMessage) => messages.push(message),
    },
    messages,
  }
}

function buildStore(options: {
  fetch: typeof fetch
  toast?: { success: (t: ToastMessage) => void; error: (t: ToastMessage) => void }
  sort?: (a: Row, b: Row) => number
  session?: ReturnType<typeof signal<unknown>>
  onReset?: () => void
}) {
  return buildModelStore({
    model: "zone",
    endpoint: "/api/zones",
    schemas: { full: rowSchema, create: createSchema, update: updateSchema },
    fetch: options.fetch,
    toast: options.toast,
    sort: options.sort,
    session: options.session,
    onReset: options.onReset,
  })
}

/** The same store over {@link timedRowSchema}, so remote rows carry both timestamps. */
function buildTimedStore(fetchImpl: typeof fetch, options: {
  toast?: { success: (t: ToastMessage) => void; error: (t: ToastMessage) => void }
  isNewer?: (incoming: TimedRow, existing: TimedRow) => boolean
} = {}) {
  return buildModelStore({
    model: "zone",
    endpoint: "/api/zones",
    schemas: { full: timedRowSchema, create: createSchema, update: updateSchema },
    fetch: fetchImpl,
    toast: options.toast,
    isNewer: options.isNewer,
  })
}

/** A store whose rows may or may not carry `updatedAt`, for the one-side-only freshness cases. */
function buildLooseStore(fetchImpl: typeof fetch) {
  const looseSchema = type({ id: "number", name: "string", "updatedAt?": dateSchema })
  return buildModelStore({
    model: "zone",
    endpoint: "/api/zones",
    schemas: { full: looseSchema, create: looseSchema, update: looseSchema },
    fetch: fetchImpl,
  })
}

describe("buildModelStore list selectors", () => {
  it("orders list.all without reordering the stored list", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl, sort: (a, b) => a.name.localeCompare(b.name) })
    store.onWs([row(1, "Beta"), row(2, "Alpha")], RemoteEvent.LIST)

    expect(store.list.all.value.map((r) => r.name)).toEqual(["Alpha", "Beta"])
    // Reading a sorted view must not sort the stored array in place.
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Beta", "Alpha"])
  })

  it("keeps source order when no sort is configured", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    store.onWs([row(1, "Beta"), row(2, "Alpha")], RemoteEvent.LIST)
    expect(store.list.all.value.map((r) => r.name)).toEqual(["Beta", "Alpha"])
  })

  it("treats a missing deletedAt as not deleted", () => {
    const { impl } = queueFetch()
    const bare = type({ id: "number", name: "string" })
    const store = buildModelStore({
      model: "tag",
      endpoint: "/api/tags",
      schemas: { full: bare, create: bare, update: bare },
      fetch: impl,
    })
    const items = [{ id: 1, name: "a" }, { id: 2, name: "b" }]
    expect(store.list.all.value.length).toBe(0)
    store.onWs(items, RemoteEvent.LIST)
    expect(store.list.nonDeleted.value.map((r) => r.id)).toEqual([1, 2])
    expect(store.list.deleted.value).toEqual([])
  })

  it("splits soft-deleted rows out of nonDeleted", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    store.onWs(
      [row(1, "live"), row(2, "gone", new Date("2024-02-01T00:00:00.000Z"))],
      RemoteEvent.LIST,
    )
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([2])
    expect(store.list.nonDeleted.value.map((r) => r.id)).toEqual([1])
  })

  it("returns undefined for a row that is not loaded", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    expect(store.one.byId(7).value).toBeUndefined()
  })
})

describe("buildModelStore create", () => {
  it("posts the payload, parses the created row and appends it", async () => {
    const created = row(3, "North")
    const { impl, calls } = queueFetch(Response.json(created, { status: 201 }))
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const result = await store.create({ name: "North" })

    expect(calls[0].url).toBe("/api/zones")
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].init.body).toBe(JSON.stringify({ name: "North" }))
    expect(result.error).toBeNull()
    expect(result.result?.id).toBe(3)
    expect(store.state.value.list.map((r) => r.id)).toEqual([3])
    expect(store.op.create.value).toEqual({ inProgress: false, error: null, result: created })
    expect(toast.messages).toEqual([{ body: "zone was created" }])
  })

  it("rejects invalid input without sending a request", async () => {
    const { impl, calls } = queueFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const result = await store.create({ name: "" })

    expect(calls).toEqual([])
    expect(result.error?.type).toBe(ErrType.VALIDATION)
    expect(store.op.create.value.inProgress).toBe(false)
    expect(toast.messages[0].body).toBe(
      "Provided data doesn't seem valid. Check the form validation error messages.",
    )
  })

  it("reports field issues keyed by path", async () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    const { error } = await store.create({ name: 42 } as unknown as { name: string })
    expect(error?.type).toBe(ErrType.VALIDATION)
    if (error?.type !== ErrType.VALIDATION) throw new Error("expected a validation error")
    expect(error.errors.name?.[0].path).toBe("name")
    expect(error.errors.name?.[0].message).toContain("string")
  })

  it("reports a connection failure when the request never leaves", async () => {
    const { impl } = queueFetch(new Error("network down"))
    const store = buildStore({ fetch: impl })
    const result = await store.create({ name: "North" })
    expect(result.error?.type).toBe(ErrType.CONNECTION)
    expect(store.op.create.value.error?.type).toBe(ErrType.CONNECTION)
  })

  it("reports a payload error when the created row does not match the schema", async () => {
    const { impl } = queueFetch(Response.json({ id: "three", name: "North" }, { status: 201 }))
    const store = buildStore({ fetch: impl })
    const result = await store.create({ name: "North" })
    expect(result.error?.type).toBe(ErrType.PAYLOAD)
    expect(result.error?.message).toContain("Malformed zone response")
    expect(store.state.value.list).toEqual([])
  })
})

describe("buildModelStore update", () => {
  it("replaces the row in place without mutating the previous array", async () => {
    const { impl } = queueFetch(Response.json(row(1, "Nörth")))
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North"), row(2, "South")], RemoteEvent.LIST)
    const before = store.state.value.list
    const beforeOps = store.state.value.updateOps

    const result = await store.update(1, { name: "Nörth" })

    expect(result.result?.name).toBe("Nörth")
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Nörth", "South"])
    // The previous array and op map are still intact: updates are immutable.
    expect(before.map((r) => r.name)).toEqual(["North", "South"])
    expect(beforeOps.size).toBe(0)
    expect(store.state.value.list).not.toBe(before)
    expect(store.state.value.updateOps).not.toBe(beforeOps)
  })

  it("leaves the other slot's map alone when there is nothing to release", async () => {
    const { impl } = queueFetch(Response.json(row(1, "Nörth")))
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    const before = store.state.value.deleteOps

    await store.update(1, { name: "Nörth" })

    // No delete was ever started for this row, so settling the update has nothing to lower and the
    // delete map keeps its identity. Signals compare by reference, so a consumer watching that map
    // sees no change rather than a change that means nothing.
    expect(store.state.value.deleteOps).toBe(before)
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("keeps a per-row op slot that settles on the row", async () => {
    const { impl } = queueFetch(Response.json(row(1, "Nörth")))
    const store = buildStore({ fetch: impl })
    expect(store.op.update(1).value).toBeUndefined()
    await store.update(1, { name: "Nörth" })
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.result?.name).toBe("Nörth")
  })

  it("patches only the requested row and sends a PATCH to its URL", async () => {
    const { impl, calls } = queueFetch(Response.json(row(2, "Süd")))
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North"), row(2, "South")], RemoteEvent.LIST)

    await store.update(2, { name: "Süd" })

    expect(calls[0].url).toBe("/api/zones/2")
    expect(calls[0].init.method).toBe("PATCH")
    expect(store.state.value.list.map((r) => r.name)).toEqual(["North", "Süd"])
  })

  it("files a rejected payload under the row's op slot", async () => {
    const { impl, calls } = queueFetch()
    const store = buildStore({ fetch: impl })
    const result = await store.update(4, { name: 7 } as unknown as { name: string })
    expect(result.error?.type).toBe(ErrType.VALIDATION)
    expect(store.op.update(4).value?.error?.type).toBe(ErrType.VALIDATION)
    expect(calls).toEqual([])
  })
})

describe("buildModelStore delete and undelete", () => {
  it("keeps a soft-deleted row in the list", async () => {
    const { impl, calls } = queueFetch(
      Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))),
    )
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const result = await store.delete(1)

    expect(calls[0].url).toBe("/api/zones/1")
    expect(calls[0].init.method).toBe("DELETE")
    expect(result.error).toBeNull()
    expect(store.state.value.list.map((r) => r.id)).toEqual([1])
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.delete(1).value?.result?.id).toBe(1)
  })

  it("posts to the undelete path and restores the row", async () => {
    const { impl, calls } = queueFetch(Response.json(row(1, "North")))
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const result = await store.undelete(1)

    expect(calls[0].url).toBe("/api/zones/1/undelete")
    expect(calls[0].init.method).toBe("POST")
    expect(result.error).toBeNull()
    expect(store.list.nonDeleted.value.map((r) => r.id)).toEqual([1])
    expect(store.list.deleted.value).toEqual([])
    expect(toast.messages).toEqual([{ body: "zone was restored" }])
  })

  it("honours endpoint overrides", async () => {
    const { impl, calls } = queueFetch(Response.json(row(1, "North")))
    const store = buildModelStore({
      model: "zone",
      endpoint: "/api/zones",
      schemas: { full: rowSchema, create: createSchema, update: updateSchema },
      fetch: impl,
      paths: {
        one: (id) => `/api/legacy/zone/${id}`,
        undelete: (id) => `/api/legacy/zone/${id}/on`,
      },
    })
    await store.undelete(1)
    expect(calls[0].url).toBe("/api/legacy/zone/1/on")
  })

  it("drops a row locally without a request", async () => {
    const { impl, calls } = queueFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North"), row(2, "South")], RemoteEvent.LIST)

    store.remove(1)

    expect(calls).toEqual([])
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
  })

  it("drops a removed row's operation slots", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    expect(store.op.update(1).value?.inProgress).toBe(true)

    store.remove(1)

    // The row is gone and so is everything said about it: no slot left saying "saving" for a row
    // the list no longer holds.
    expect(store.op.update(1).value).toBeUndefined()
    expect(store.op.delete(1).value).toBeUndefined()

    pending[0].settle(Response.json(row(1, "Renamed")))
    await updating
  })

  it("archives a row through an update whose answer carries deletedAt", async () => {
    const archived = new Date("2024-03-01T00:00:00.000Z")
    const { impl } = queueFetch(Response.json(row(1, "North", archived)))
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    await store.update(1, { name: "North" })

    // An archive checkbox is an ordinary update that sets the column, and the answer is a full row
    // that replaces what is held — so the row moves to the archived slice.
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.list.nonDeleted.value).toEqual([])
  })
})

describe("buildModelStore requests answered out of order", () => {
  it("numbers a second write to a row after the first has answered", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    pending[0].settle(Response.json(row(1, "First")))
    await first
    expect(store.op.update(1).value?.inProgress).toBe(false)

    // The ordinary thing a user does: edit, wait, edit again. A row's numbers keep going up across
    // that gap, so the second write is newer than the first and not a repeat of it.
    const second = store.update(1, { name: "Second" })
    expect(store.op.update(1).value?.inProgress).toBe(true)
    pending[1].settle(Response.json(row(1, "Second")))
    await second

    expect(store.state.value.list[0].name).toBe("Second")
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("returns a dropped update answer to the caller that made it", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })

    pending[1].settle(Response.json(row(1, "Second")))
    await second
    pending[0].settle(Response.json(row(1, "First")))
    const dropped = await first

    // The caller is told what the server said about its own request; the store holds the newer one.
    expect(dropped.error).toBeNull()
    expect(dropped.result?.name).toBe("First")
    expect(store.state.value.list[0].name).toBe("Second")
  })

  it("returns a dropped delete answer to the caller that made it", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating
    pending[0].settle(Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))))
    const dropped = await deleting

    expect(dropped.error).toBeNull()
    expect(dropped.result?.id).toBe(1)
    expect(Boolean(dropped.result?.deletedAt)).toBe(true)
    // The store kept the newer update, so the row is not archived.
    expect(store.list.deleted.value).toEqual([])
  })

  it("does not let an answer from before a reset settle a request made after it", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const before = store.update(1, { name: "Before" })
    store.reset()
    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    const after = store.update(1, { name: "After" })

    pending[0].settle(Response.json(row(1, "Before")))
    const answer = await before

    // Both halves of the rule at once. The older answer settles nothing — a counter that started
    // again at the reset would let it — and it no longer reaches the list either, which is what
    // this issue changed: until now the list was written and the README carried it as a sharp edge.
    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.state.value.list[0].name).toBe("North")
    expect(toast.messages).toEqual([])
    // The caller of the disowned request is still told what the server said about it.
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Before")

    pending[1].settle(Response.json(row(1, "After")))
    await after

    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.state.value.list[0].name).toBe("After")
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("keeps the newer value when two updates to one row answer oldest last", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })
    expect(pending.length).toBe(2)

    pending[1].settle(Response.json(row(1, "Second")))
    await second
    expect(store.state.value.list[0].name).toBe("Second")

    pending[0].settle(Response.json(row(1, "First")))
    await first

    expect(store.state.value.list[0].name).toBe("Second")
    expect(store.op.update(1).value?.result?.name).toBe("Second")
    // The older answer succeeded at the server and was discarded here all the same, so announcing
    // it would tell the user about a value the store does not hold.
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("does not let a write to one row supersede a write in flight to another", async () => {
    for (const [held, answered] of ROW_PAIRS) {
      const { impl, pending } = deferredFetch()
      const store = buildStore({ fetch: impl })
      const pair = `rows ${held} and ${answered}`
      await store.onWs([row(held, "North"), row(answered, "South")], RemoteEvent.LIST)

      const updatingHeld = store.update(held, { name: "Nörth" })
      const updatingAnswered = store.update(answered, { name: "Süd" })

      pending[1].settle(Response.json(row(answered, "Süd")))
      await updatingAnswered
      expect(store.op.update(answered).value?.inProgress, pair).toBe(false)
      // One row answering says nothing about the other: a request is numbered against its own row.
      expect(store.op.update(held).value?.inProgress, pair).toBe(true)

      pending[0].settle(Response.json(row(held, "Nörth")))
      await updatingHeld

      // Were the numbers drawn from one counter for the whole collection, the first row's request
      // would be the older one, its answer would be dropped as stale, and the edit would vanish
      // with the flag never coming down.
      expect(store.state.value.list.map((r) => r.name), pair).toEqual(["Nörth", "Süd"])
      expect(store.op.update(held).value?.inProgress, pair).toBe(false)
    }
  })

  it("does not release another row's flag when one row settles", async () => {
    for (const [held, answered] of ROW_PAIRS) {
      const { impl, pending } = deferredFetch()
      const store = buildStore({ fetch: impl })
      const pair = `rows ${held} and ${answered}`
      await store.onWs([row(held, "North"), row(answered, "South")], RemoteEvent.LIST)

      const deletingHeld = store.delete(held)
      const updatingAnswered = store.update(answered, { name: "Süd" })

      pending[1].settle(Response.json(row(answered, "Süd")))
      await updatingAnswered

      expect(store.op.update(answered).value?.inProgress, pair).toBe(false)
      // Settling one row releases that row's other slot. The delete belongs to a different row and
      // is still on the wire.
      expect(store.op.delete(held).value?.inProgress, pair).toBe(true)

      pending[0].settle(
        Response.json(row(held, "North", new Date("2024-03-01T00:00:00.000Z"))),
      )
      await deletingHeld

      expect(store.op.delete(held).value?.inProgress, pair).toBe(false)
      expect(store.list.deleted.value.map((r) => r.id), pair).toEqual([held])
    }
  })

  it("keeps saving until the newest update to a row has answered", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })

    pending[0].settle(Response.json(row(1, "First")))
    await first
    // Nothing newer has answered, so this value is the best the store has and it shows at once…
    expect(store.state.value.list[0].name).toBe("First")
    // …while the second write is still outstanding: saying it is finished is what put a form back
    // in front of the user while their edit was still on the wire.
    expect(store.op.update(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "Second")))
    await second

    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.state.value.list[0].name).toBe("Second")
  })

  it("keeps saving when an older update fails while a newer update is outstanding", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })

    pending[0].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await first

    // Nothing newer has answered, so this failure is real news and is reported…
    expect(toast.messages).toEqual([{ title: "Failed to update zone", body: "name taken" }])
    // …while the second write is still outstanding, so the slot may not settle on it. This is the
    // arrangement that tells the two decisions apart: the answer is the newest the store has
    // heard, and it is not the newest it was asked for.
    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.op.update(1).value?.error).toBeNull()

    pending[1].settle(Response.json(row(1, "Second")))
    await second

    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.error).toBeNull()
    expect(store.state.value.list[0].name).toBe("Second")
    expect(toast.messages.map((message) => message.body)).toEqual([
      "name taken",
      "zone was updated",
    ])
  })

  it("lowers the delete flag when a newer update fails for the same row", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[1].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await updating

    // The newest request has answered, so nothing the store will act on is outstanding — the
    // delete's answer is already destined for the bin, and its flag must not outlive it.
    expect(store.op.update(1).value?.error?.type).toBe(ErrType.SERVER)
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.delete(1).value?.inProgress).toBe(false)

    pending[0].settle(Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))))
    await deleting

    expect(store.list.deleted.value).toEqual([])
    expect(store.op.delete(1).value?.inProgress).toBe(false)
  })

  it("keeps saving when an older update never reaches the server", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })

    pending[0].settle(new Error("network down"))
    await first

    // A request that never reached the server is answered like any other — sequenced, and silent,
    // because the host already surfaces a connection failure.
    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.op.update(1).value?.error).toBeNull()
    expect(toast.messages).toEqual([])

    pending[1].settle(Response.json(row(1, "Second")))
    await second

    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.state.value.list[0].name).toBe("Second")
  })

  it("keeps saving when an older delete answers with a body the schema rejects", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[0].settle(Response.json({ id: "not a number" }))
    await deleting

    // A payload the schema rejects is a failure like a rejected status, and it is sequenced the
    // same way: reported, because nothing newer has answered, and settling nothing.
    expect(toast.messages[0].body).toContain("Malformed zone response")
    expect(store.op.delete(1).value?.inProgress).toBe(true)
    expect(store.op.update(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating

    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.state.value.list[0].name).toBe("Renamed")
  })

  it("drops an older update that succeeds after the newest one has failed", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    const second = store.update(1, { name: "Second" })

    pending[1].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await second
    pending[0].settle(Response.json(row(1, "First")))
    await first

    // A failure is an answer and advances the sequence like any other, so the older success behind
    // it is stale. The cost of that one rule is visible here: the server holds "First" and the
    // store shows "North" until the next remote event or reload says otherwise.
    expect(store.state.value.list[0].name).toBe("North")
    expect(store.op.update(1).value?.error?.type).toBe(ErrType.SERVER)
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(toast.messages).toEqual([{ title: "Failed to update zone", body: "name taken" }])
  })

  it("ignores a failure that answers after a newer update has succeeded", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const failing = store.update(1, { name: "First" })
    const winning = store.update(1, { name: "Second" })

    pending[1].settle(Response.json(row(1, "Second")))
    await winning
    pending[0].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await failing

    expect(store.op.update(1).value?.error).toBeNull()
    expect(store.op.update(1).value?.result?.name).toBe("Second")
    expect(store.state.value.list[0].name).toBe("Second")
    expect(toast.messages.map((message) => message.body)).toEqual(["zone was updated"])
  })

  it("does not resurrect a row when a delete answers before an older update", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    const deleting = store.delete(1)

    pending[1].settle(Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))))
    await deleting
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])

    // The update's answer carries `deletedAt: null`, so applying it would undo the delete.
    pending[0].settle(Response.json(row(1, "Renamed")))
    await updating

    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.state.value.list[0].name).toBe("North")
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    // The update's answer was dropped, so nothing in its own slot would have lowered this flag.
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("does not delete a row when the delete answers after a newer update", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating
    pending[0].settle(Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))))
    await deleting

    expect(store.list.deleted.value).toEqual([])
    expect(store.state.value.list[0].name).toBe("Renamed")
    // The delete's answer was dropped, so nothing in its own slot would have lowered this flag.
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    // The row is not deleted, so the user must not be told that it is.
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("applies an older delete but keeps saving while a newer update is outstanding", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[0].settle(Response.json(row(1, "North", new Date("2024-03-01T00:00:00.000Z"))))
    await deleting
    // The delete is the newest answer so far and is applied, but the update behind it is still on
    // the wire and neither slot may say the work is done.
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.delete(1).value?.inProgress).toBe(true)
    expect(store.op.update(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating

    expect(store.state.value.list[0].name).toBe("Renamed")
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("keeps saving when an older delete fails while a newer update is outstanding", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[0].settle(Response.json({ error: "not yours" }, { status: 403 }))
    await deleting

    // Nothing newer has answered, so the failure is real news and is reported…
    expect(toast.messages).toEqual([{ title: "Failed to delete zone", body: "not yours" }])
    // …but the update behind it is still outstanding, so neither slot may settle on it.
    expect(store.op.delete(1).value?.inProgress).toBe(true)
    expect(store.op.delete(1).value?.error).toBeNull()
    expect(store.op.update(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating

    expect(store.state.value.list[0].name).toBe("Renamed")
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("lowers the update flag when a newer delete fails for the same row", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    const deleting = store.delete(1)

    pending[1].settle(Response.json({ error: "not yours" }, { status: 403 }))
    await deleting

    // The mirror of the update case: the failed delete is the newest request, and the update
    // behind it will be discarded, so its slot may not keep saying "saving".
    expect(store.op.delete(1).value?.error?.type).toBe(ErrType.SERVER)
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.inProgress).toBe(false)

    pending[0].settle(Response.json(row(1, "Renamed")))
    await updating

    expect(store.state.value.list[0].name).toBe("North")
    expect(store.op.update(1).value?.inProgress).toBe(false)
  })

  it("ignores a delete that fails after a newer update has succeeded", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const updating = store.update(1, { name: "Renamed" })

    pending[1].settle(Response.json(row(1, "Renamed")))
    await updating
    pending[0].settle(Response.json({ error: "not yours" }, { status: 403 }))
    await deleting

    // The request that failed had already been superseded, so its failure is not the row's news.
    expect(store.op.delete(1).value?.error).toBeNull()
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
    expect(store.state.value.list[0].name).toBe("Renamed")
  })

  it("does not restore a row when an undelete answers after a newer delete", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    const deleting = store.delete(1)

    pending[1].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting
    pending[0].settle(Response.json(row(1, "North")))
    await restoring

    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.update(1).value?.inProgress).toBe(false)
    // The row was not restored, so the user must not be told that it was.
    expect(toast.messages).toEqual([{ body: "zone was deleted" }])
  })

  it("restores the row but keeps saving while a newer delete is outstanding", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    const deleting = store.delete(1)

    pending[0].settle(Response.json(row(1, "North")))
    await restoring
    expect(store.list.deleted.value).toEqual([])
    // An undelete settles the row's update slot, and the delete behind it is still outstanding.
    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.op.delete(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting

    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.delete(1).value?.inProgress).toBe(false)
  })

  it("keeps saving when an older undelete fails while a newer delete is outstanding", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    const deleting = store.delete(1)

    pending[0].settle(Response.json({ error: "gone for good" }, { status: 404 }))
    await restoring

    expect(toast.messages).toEqual([{ title: "Failed to restore zone", body: "gone for good" }])
    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.op.update(1).value?.error).toBeNull()
    expect(store.op.delete(1).value?.inProgress).toBe(true)

    pending[1].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting

    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.delete(1).value?.inProgress).toBe(false)
  })

  it("lowers the delete flag when a newer undelete succeeds for the same row", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const restoring = store.undelete(1)

    pending[1].settle(Response.json(row(1, "North")))
    await restoring

    // An undelete settles the update slot, and the delete it superseded holds the other one.
    expect(store.list.deleted.value).toEqual([])
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.delete(1).value?.inProgress).toBe(false)

    pending[0].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting

    expect(store.list.deleted.value).toEqual([])
    expect(store.op.delete(1).value?.inProgress).toBe(false)
  })

  it("lowers the delete flag when a newer undelete fails for the same row", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const deleting = store.delete(1)
    const restoring = store.undelete(1)

    pending[1].settle(Response.json({ error: "gone for good" }, { status: 404 }))
    await restoring

    // A failed undelete settles its slot too, and releases the delete's for the same reason.
    expect(store.op.update(1).value?.error?.type).toBe(ErrType.SERVER)
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.delete(1).value?.inProgress).toBe(false)

    pending[0].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting

    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.delete(1).value?.inProgress).toBe(false)
  })

  it("ignores an undelete that fails after a newer delete has succeeded", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    const deleting = store.delete(1)

    pending[1].settle(Response.json(row(1, "North", new Date("2024-05-01T00:00:00.000Z"))))
    await deleting
    pending[0].settle(Response.json({ error: "gone for good" }, { status: 404 }))
    await restoring

    expect(store.op.update(1).value?.error).toBeNull()
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(toast.messages).toEqual([{ body: "zone was deleted" }])
  })

  it("keeps the create slot in progress until the newest create has answered", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })

    const first = store.create({ name: "First" })
    const second = store.create({ name: "Second" })

    pending[0].settle(Response.json(row(1, "First"), { status: 201 }))
    await first
    expect(store.op.create.value.inProgress).toBe(true)
    expect(store.state.value.list.map((r) => r.id)).toEqual([1])

    pending[1].settle(Response.json(row(2, "Second"), { status: 201 }))
    await second

    expect(store.op.create.value.inProgress).toBe(false)
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([1, 2])
  })

  it("reports a create that fails after a newer create has succeeded", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const first = store.create({ name: "First" })
    const second = store.create({ name: "Second" })

    pending[1].settle(Response.json(row(2, "Second"), { status: 201 }))
    await second
    pending[0].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await first

    // Two creates are two different rows, so neither supersedes the other: this failure is news
    // about the row that did not arrive, not a stale answer about the row that did.
    expect(toast.messages).toEqual([
      { body: "zone was created" },
      { title: "Failed to create zone", body: "name taken" },
    ])
    // The slot belongs to the newest create, which succeeded.
    expect(store.op.create.value.error).toBeNull()
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
  })

  it("keeps the create slot in progress when an older create fails", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const first = store.create({ name: "First" })
    const second = store.create({ name: "Second" })

    pending[0].settle(Response.json({ error: "name taken" }, { status: 409 }))
    await first

    // A create's failure is its own news, whichever of the two in flight it belongs to…
    expect(toast.messages).toEqual([{ title: "Failed to create zone", body: "name taken" }])
    // …but the second create is still outstanding, so the shared slot may not settle on it.
    expect(store.op.create.value.inProgress).toBe(true)
    expect(store.op.create.value.error).toBeNull()

    pending[1].settle(Response.json(row(2, "Second"), { status: 201 }))
    await second

    expect(store.op.create.value.inProgress).toBe(false)
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
  })

  it("appends and announces both rows when two creates answer out of order", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const first = store.create({ name: "First" })
    const second = store.create({ name: "Second" })

    pending[1].settle(Response.json(row(2, "Second"), { status: 201 }))
    await second
    expect(store.op.create.value.result?.id).toBe(2)

    pending[0].settle(Response.json(row(1, "First"), { status: 201 }))
    await first

    // A create has no id to contend over, so both rows are real and both belong in the list.
    expect(store.state.value.list.map((r) => r.id)).toEqual([2, 1])
    // Both rows arrived, so both are announced: neither create supersedes the other.
    expect(toast.messages).toEqual([{ body: "zone was created" }, { body: "zone was created" }])
    // Only the create slot is contended, and the older create does not take it back.
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.op.create.value.inProgress).toBe(false)
  })
})

describe("buildModelStore notifications", () => {
  it("stays silent on a server crash", async () => {
    const { impl } = queueFetch(Response.json({ error: "boom" }, { status: 500 }))
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    const result = await store.create({ name: "North" })
    expect(result.error?.type).toBe(ErrType.SERVER)
    expect(result.error?.message).toBe("boom")
    expect(toast.messages).toEqual([])
  })

  it("reports an ordinary rejection with the server's own message", async () => {
    const { impl } = queueFetch(Response.json({ error: "name taken" }, { status: 409 }))
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.create({ name: "North" })
    expect(toast.messages).toEqual([{ title: "Failed to create zone", body: "name taken" }])
  })

  it("needs no toast port at all", async () => {
    const { impl } = queueFetch(Response.json({ error: "nope" }, { status: 400 }))
    const store = buildStore({ fetch: impl })
    const result = await store.create({ name: "North" })
    expect(result.error?.type).toBe(ErrType.SERVER)
  })
})

describe("buildModelStore remote events", () => {
  it("dedupes created rows against the loaded ones", async () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    await store.onWs([row(1, "North again"), row(2, "South")], RemoteEvent.CREATED)
    expect(store.state.value.list.map((r) => r.id)).toEqual([1, 2])
  })

  it("applies a deleted event as a row replacement", async () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    await store.onWs([row(1, "North", new Date("2024-04-01T00:00:00.000Z"))], RemoteEvent.DELETED)
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
  })

  it("rejects a batch whole when one item does not parse", async () => {
    const { impl } = queueFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    await store.onWs([row(2, "South"), { id: "three", name: "Broken" }], RemoteEvent.CREATED)

    expect(store.state.value.list.map((r) => r.id)).toEqual([1])
    expect(store.op.list.value.error?.type).toBe(ErrType.PAYLOAD)
    expect(toast.messages[0].body).toContain("Malformed zone update")
  })

  it("resolves the list operation on a full sync", async () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    expect(store.op.list.value.inProgress).toBe(false)
    expect(store.op.list.value.result?.map((r) => r.id)).toEqual([1])
  })
})

/**
 * A remote change and one of this client's own writes, overlapping.
 *
 * Every test here does the same three things in the same order: put a request in flight, deliver a
 * remote event for that row while it is outstanding, then answer the request. Two people are
 * editing one list and one of them is mid-save, which is the case a multi-user application hits
 * routinely; what the store shows afterwards is the later of the two changes, whichever side it
 * came from.
 *
 * They run over {@link timedRowSchema}, because `updatedAt` is the column the freshness check reads
 * and `rowSchema` has none: a fixture there could only move `createdAt`, which a write does not
 * move, so every comparison would come out a tie and prove nothing. What a model with no usable
 * clock does is its own test below.
 */
describe("buildModelStore remote change against a request in flight", () => {
  it("leaves the row deleted when our update answers after a remote delete", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildTimedStore(impl, { toast: toast.port })
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    // Somebody else deleted the row while our `PATCH` was on the wire. The delete is the later of
    // the two changes, so it is the one the list should still be showing at the end.
    await store.onWs([archivedAt(stampedRow(1, "North", LATER), LATER)], RemoteEvent.DELETED)
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])

    pending[0].settle(Response.json(stampedRow(1, "Mine", EARLIER)))
    const answer = await updating

    // Before this rule the answer put the row back: a row somebody had deleted reappeared on
    // screen, under a name from before the delete, with nothing said about it.
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.state.value.list[0].name).toBe("North")
    // The write did finish, so its slot settles, its flag drops and the caller is told what the
    // server said. Only the list stays out of it.
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.result?.name).toBe("Mine")
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Mine")
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("keeps a later remote update when our own older answer lands", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    await store.onWs([stampedRow(1, "Theirs", LATER)], RemoteEvent.UPDATED)
    expect(store.state.value.list[0].name).toBe("Theirs")

    pending[0].settle(Response.json(stampedRow(1, "Mine", EARLIER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Theirs")
  })

  it("replaces an earlier remote update with our own newer answer", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    // The mirror of the test above, and the one that stops the fix overshooting into "a remote
    // event always wins": the event is older than our answer, so our answer is the one to keep.
    await store.onWs([stampedRow(1, "Theirs", EARLIER)], RemoteEvent.UPDATED)
    expect(store.state.value.list[0].name).toBe("Theirs")

    pending[0].settle(Response.json(stampedRow(1, "Mine", LATER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Mine")
  })

  it("keeps our own answer when it is stamped the same instant as the remote change", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    await store.onWs([stampedRow(1, "Theirs", LATER)], RemoteEvent.UPDATED)

    // Two changes stamped the same instant cannot be ordered, and the rule for that is the one the
    // freshness check already had: the incoming row wins. Our own answer is the incoming one here.
    pending[0].settle(Response.json(stampedRow(1, "Mine", LATER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Mine")
  })

  it("keeps our own answer for a model that carries no timestamp at all", async () => {
    const { impl, pending } = deferredFetch()
    const bare = type({ id: "number", name: "string" })
    const store = buildModelStore({
      model: "tag",
      endpoint: "/api/tags",
      schemas: { full: bare, create: bare, update: bare },
      fetch: impl,
    })
    await store.onWs([{ id: 1, name: "North" }], RemoteEvent.LIST)

    const updating = store.update(1, { id: 1, name: "Mine" })
    await store.onWs([{ id: 1, name: "Theirs" }], RemoteEvent.UPDATED)

    pending[0].settle(Response.json({ id: 1, name: "Mine" }))
    await updating

    // Nothing here can be ordered, so this store behaves exactly as it did before the rule existed.
    // That is the price of the rule, and it is the reason a model that wants its writes ordered
    // against other people's has to carry `updatedAt`.
    expect(store.state.value.list[0].name).toBe("Mine")
  })

  it("asks the application's own freshness check whether our answer may land", async () => {
    const { impl, pending } = deferredFetch()
    const seen: Array<[string, string]> = []
    const store = buildTimedStore(impl, {
      // A model versioned some other way than by a clock: this one trusts nothing this client
      // produced. The store must ask it rather than compare timestamps itself.
      isNewer: (incoming, existing) => {
        seen.push([incoming.name, existing.name])
        return incoming.name !== "Mine"
      },
    })
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    await store.onWs([stampedRow(1, "Theirs", EARLIER)], RemoteEvent.UPDATED)

    // Our answer is far the later of the two by the clock, and it still loses, because the
    // application said so.
    pending[0].settle(Response.json(stampedRow(1, "Mine", LATER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Theirs")
    // Both comparisons went through the port, and our own answer is the incoming side of it.
    expect(seen).toEqual([["Theirs", "North"], ["Mine", "Theirs"]])
  })

  it("files the error and tells the caller when our write fails against a remote change", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildTimedStore(impl, { toast: toast.port })
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    await store.onWs([stampedRow(1, "Theirs", LATER)], RemoteEvent.UPDATED)

    pending[0].settle(Response.json({ error: "conflict" }, { status: 409 }))
    const answer = await updating

    // A failure writes nothing into the list whatever the clock says, so the remote change stands;
    // the promise that the caller learns its own outcome holds for a failure exactly as it does
    // for a success.
    expect(store.state.value.list[0].name).toBe("Theirs")
    expect(answer.error?.type).toBe(ErrType.SERVER)
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.error?.type).toBe(ErrType.SERVER)
    expect(toast.messages).toEqual([{ title: "Failed to update zone", body: "conflict" }])
  })

  it("lets the later of the two win for every operation against every remote event", async () => {
    // The four places an answer is written into the list are `create`, `update`, `delete` and
    // `undelete`; create has its own pair of tests below, because a created row has no id to race
    // over until the server answers. The other three are here against both events, each way round,
    // so no operation can be the one that forgot the comparison. Two of the twelve are the cases
    // the issue asks about by name: an undelete answering after a remote delete, and a delete
    // answering after a remote event that carries no `deletedAt`.
    for (const kind of ["update", "delete", "undelete"] as const) {
      for (const event of [RemoteEvent.UPDATED, RemoteEvent.DELETED] as const) {
        for (const oursIsLater of [false, true]) {
          const where = `${kind} against a remote ${event}, ours ${oursIsLater ? "later" : "older"}`
          const ourStamp = oursIsLater ? LATER : EARLIER
          const theirStamp = oursIsLater ? EARLIER : LATER

          const { impl, pending } = deferredFetch()
          const store = buildTimedStore(impl)
          await store.onWs([stampedRow(1, "start", LOADED_AT)], RemoteEvent.LIST)

          const running = kind === "update"
            ? store.update(1, { name: "ours" })
            : kind === "delete"
            ? store.delete(1)
            : store.undelete(1)

          const theirs = event === RemoteEvent.DELETED
            ? archivedAt(stampedRow(1, "theirs", theirStamp), theirStamp)
            : stampedRow(1, "theirs", theirStamp)
          await store.onWs([theirs], event)
          expect(store.state.value.list[0].name, `${where}: the event itself`).toBe("theirs")

          const ours = kind === "delete"
            ? archivedAt(stampedRow(1, "ours", ourStamp), ourStamp)
            : stampedRow(1, "ours", ourStamp)
          pending[0].settle(Response.json(ours))
          const outcome = await running

          const kept = oursIsLater ? ours : theirs
          const held = store.state.value.list[0]
          expect(held.name, where).toBe(kept.name)
          expect(Boolean(held.deletedAt), `${where}: deleted`).toBe(kept.deletedAt !== null)
          // Whichever way the comparison went, the slot settles and its flag drops: a spinner left
          // up here would outlive every write that lost one of these races.
          const slot = kind === "delete" ? store.op.delete(1).value : store.op.update(1).value
          expect(slot?.inProgress, `${where}: in flight`).toBe(false)
          expect(slot?.result?.name, `${where}: the slot's result`).toBe("ours")
          expect(outcome.result?.name, `${where}: the caller's answer`).toBe("ours")
        }
      }
    }
  })

  it("compares our answer against the later of two remote events", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    // Two people saved while our write was outstanding. Only the later of them is still in the
    // list by the time our answer lands, so that is the one our answer is measured against — a
    // store that remembered the first event instead would let our answer through.
    await store.onWs([stampedRow(1, "Theirs", LATER)], RemoteEvent.UPDATED)
    await store.onWs([stampedRow(1, "Also theirs", EARLIER)], RemoteEvent.UPDATED)
    expect(store.state.value.list[0].name).toBe("Theirs")

    pending[0].settle(Response.json(stampedRow(1, "Mine", EARLIER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Theirs")
  })

  it("holds both rules at once when a remote change lands between two of our writes", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildTimedStore(impl, { toast: toast.port })
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const first = store.update(1, { name: "First" })
    await store.onWs([stampedRow(1, "Theirs", LATER)], RemoteEvent.UPDATED)
    const second = store.update(1, { name: "Second" })

    // The newer of our two writes answers first and loses to the remote change on the clock; the
    // older one answers last and is already stale by its row's counter, so it never reaches the
    // comparison at all. Neither rule can stand in for the other: dropping the clock would leave
    // "Second" in the list, and dropping the counter would leave "First".
    pending[1].settle(Response.json(stampedRow(1, "Second", EARLIER)))
    await second
    pending[0].settle(Response.json(stampedRow(1, "First", EARLIER)))
    await first

    expect(store.state.value.list[0].name).toBe("Theirs")
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.result?.name).toBe("Second")
    // One announcement, for the write that settled the slot: the stale one says nothing, as it did
    // before, and the one that lost to the remote change still succeeded at the server.
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("orders a remote change whose timestamps arrive as ISO strings", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    // The row schema accepts a `Date` or an ISO string, and a feed that hands `onWs` the parsed
    // JSON of a websocket frame hands it strings. Every other test here passes `Date`s, so this is
    // the one that would catch a comparison reading the raw column rather than the parsed row.
    await store.onWs(
      [{ id: 1, name: "North", createdAt: CREATED_AT, updatedAt: LOADED_AT, deletedAt: null }],
      RemoteEvent.LIST,
    )

    const updating = store.update(1, { name: "Mine" })
    await store.onWs(
      [{ id: 1, name: "Theirs", createdAt: CREATED_AT, updatedAt: LATER, deletedAt: null }],
      RemoteEvent.UPDATED,
    )

    pending[0].settle(Response.json(stampedRow(1, "Mine", EARLIER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Theirs")
  })

  it("is undone by our own later answer when a remote delete did not move updatedAt", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Mine" })
    // A server whose `DELETE` writes `deleted_at` directly and leaves `updatedAt` alone. The event
    // is applied whatever the clock says, but the row it leaves carries the instant it had before.
    await store.onWs([archivedAt(stampedRow(1, "North", LOADED_AT), LATER)], RemoteEvent.DELETED)
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])

    // Our own `PATCH` did move it, so this answer is strictly later than the row the delete left —
    // not a tie — and it wins, which puts the row back undeleted. This test pins documented
    // behaviour rather than behaviour anybody wants: see "What the clock rule costs you" in
    // `signals/README.md`. Its mirror below is why the rule is not changed to fix it.
    pending[0].settle(Response.json(stampedRow(1, "Mine", LATER)))
    await updating

    expect(store.state.value.list[0].name).toBe("Mine")
    expect(store.list.deleted.value).toEqual([])
  })

  it("lands our undelete on a deleted row stamped the same instant as our answer", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs(
      [archivedAt(stampedRow(1, "North", LOADED_AT), LOADED_AT)],
      RemoteEvent.LIST,
    )

    const restoring = store.undelete(1)
    // The mirror of the test above, and the reason the tie rule stays as it is. A server that does
    // not move `updatedAt` when it restores a row answers with the same instant the held row
    // carries. Giving a deleted held row the tie would refuse this answer, and the user's own
    // restore would simply not appear, with no error and no notification to explain it.
    //
    // Measured, because the two tests are not red under the same changes. Giving a deleted held
    // row the tie turns this one red and leaves the one above green — our answer there is strictly
    // later, so a tie rule never reaches it. Refusing any answer that would restore a deleted held
    // row, which is the change that would actually fix the one above, turns both red at once.
    pending[0].settle(Response.json(stampedRow(1, "North", LOADED_AT)))
    await restoring

    expect(store.list.deleted.value).toEqual([])
    expect(store.state.value.list[0].name).toBe("North")
  })

  it("does not show a row twice when its remote create beats our own answer back", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const creating = store.create({ name: "Mine" })
    // The server broadcast the row it had just made before answering the client that asked for it.
    // Appending our answer blindly would leave the same id in the list twice.
    await store.onWs([stampedRow(2, "Mine", EARLIER)], RemoteEvent.CREATED)

    pending[0].settle(Response.json(stampedRow(2, "Mine, as the server answered", LATER)))
    const answer = await creating

    expect(store.state.value.list.map((r) => r.id)).toEqual([1, 2])
    expect(store.state.value.list[1].name).toBe("Mine, as the server answered")
    expect(answer.result?.id).toBe(2)
  })

  it("keeps a later remote create when our own create answers with an older row", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildTimedStore(impl)
    await store.onWs([stampedRow(1, "North", LOADED_AT)], RemoteEvent.LIST)

    const creating = store.create({ name: "Mine" })
    // Somebody edited the new row between the server writing it and our answer getting back, so
    // the event carries a later version of the same row than the answer does.
    await store.onWs([stampedRow(2, "Mine, since edited", LATER)], RemoteEvent.CREATED)

    pending[0].settle(Response.json(stampedRow(2, "Mine", EARLIER)))
    await creating

    expect(store.state.value.list.map((r) => r.id)).toEqual([1, 2])
    expect(store.state.value.list[1].name).toBe("Mine, since edited")
    expect(store.op.create.value.inProgress).toBe(false)
    expect(store.op.create.value.result?.name).toBe("Mine")
  })
})

/**
 * Every combination of the two timestamp columns, on both rows.
 *
 * The named tests above each fix one arrangement; this enumerates all 625 of them, because the
 * axis is small enough to enumerate. It is what catches a rule that treats a `null` column as an
 * old timestamp rather than as no timestamp, which every fixture here happens to agree with.
 */
const STAMPS = ["absent", "null", "early", "middle", "late"] as const
type Stamp = typeof STAMPS[number]
type Stamps = readonly [Stamp, Stamp]

const AT: Record<string, string> = {
  early: "2023-01-01T00:00:00.000Z",
  middle: "2024-01-01T00:00:00.000Z",
  late: "2025-01-01T00:00:00.000Z",
}

const PAIRS: Stamps[] = STAMPS.flatMap((createdAt) =>
  STAMPS.map((updatedAt) => [createdAt, updatedAt] as const)
)

const stampedSchema = type({
  id: "number",
  name: "string",
  "createdAt?": dateSchema.or("null"),
  "updatedAt?": dateSchema.or("null"),
})

function stamped(name: string, [createdAt, updatedAt]: Stamps): Record<string, unknown> {
  return {
    id: 1,
    name,
    ...(createdAt === "absent" ? {} : { createdAt: value(createdAt) }),
    ...(updatedAt === "absent" ? {} : { updatedAt: value(updatedAt) }),
  }
}

const value = (stamp: Stamp): Date | null => stamp === "null" ? null : new Date(AT[stamp])

/** Milliseconds a stamp compares as, or `null` when it carries no usable time. */
const millis = (stamp: Stamp): number | null =>
  stamp === "absent" || stamp === "null" ? null : Date.parse(AT[stamp])

/**
 * The documented rule, restated: prefer `updatedAt`, fall back to `createdAt`, and accept the
 * incoming row wherever the two cannot be ordered. Written out rather than imported, so that a
 * change to the implementation cannot quietly change what is expected of it.
 */
function shouldAccept(incoming: Stamps, held: Stamps): boolean {
  for (const column of [1, 0] as const) {
    const incomingAt = millis(incoming[column])
    const heldAt = millis(held[column])
    if (incomingAt === null && heldAt === null) continue
    if (incomingAt === null || heldAt === null) return true
    return incomingAt >= heldAt
  }
  return true
}

describe("buildModelStore remote update freshness", () => {
  it("accepts an update whose updatedAt moved while createdAt stood still", async () => {
    const { impl } = queueFetch()
    const store = buildTimedStore(impl)
    await store.onWs(
      [timedRow(1, "North", "2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z")],
      RemoteEvent.LIST,
    )

    // An edit moves `updatedAt` and leaves `createdAt` exactly where it was, which is why a check
    // that reads `createdAt` answers "not newer" for every real update.
    await store.onWs(
      [timedRow(1, "Edited", "2024-01-01T00:00:00.000Z", "2024-06-01T00:00:00.000Z")],
      RemoteEvent.UPDATED,
    )

    expect(store.state.value.list[0].name).toBe("Edited")
  })

  it("accepts an update stamped the same instant as the row it holds", async () => {
    const { impl } = queueFetch()
    const store = buildTimedStore(impl)
    const at = "2024-06-01T00:00:00.000Z"
    await store.onWs([timedRow(1, "North", "2024-02-01T00:00:00.000Z", at)], RemoteEvent.LIST)

    // The two `createdAt` values differ, and the incoming row's is the older of them: a tie on
    // `updatedAt` that fell through to the fallback column would drop this event, and a fixture
    // whose columns both tie cannot tell those two behaviours apart.
    await store.onWs([timedRow(1, "Edited", "2023-01-01T00:00:00.000Z", at)], RemoteEvent.UPDATED)

    expect(store.state.value.list[0].name).toBe("Edited")
  })

  it("ignores an update whose updatedAt is older, however late its createdAt is", async () => {
    const { impl } = queueFetch()
    const store = buildTimedStore(impl)
    await store.onWs(
      [timedRow(1, "North", "2024-01-01T00:00:00.000Z", "2024-06-01T00:00:00.000Z")],
      RemoteEvent.LIST,
    )

    // The two columns point in opposite directions: `createdAt` says the incoming row is newer,
    // `updatedAt` says it is older. Only the second one is an answer about the edit.
    await store.onWs(
      [timedRow(1, "Stale", "2024-09-01T00:00:00.000Z", "2024-02-01T00:00:00.000Z")],
      RemoteEvent.UPDATED,
    )

    expect(store.state.value.list[0].name).toBe("North")
  })

  it("falls back to createdAt when neither row carries an updatedAt", async () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    const stored: Row = { ...row(1, "North"), createdAt: new Date("2024-05-01T00:00:00.000Z") }
    await store.onWs([stored], RemoteEvent.LIST)

    await store.onWs(
      [{ ...row(1, "Stale"), createdAt: new Date("2024-01-01T00:00:00.000Z") }],
      RemoteEvent.UPDATED,
    )
    expect(store.state.value.list[0].name).toBe("North")

    await store.onWs(
      [{ ...row(1, "Fresh"), createdAt: new Date("2024-06-01T00:00:00.000Z") }],
      RemoteEvent.UPDATED,
    )
    expect(store.state.value.list[0].name).toBe("Fresh")
  })

  it("accepts an update when only the incoming row carries a timestamp", async () => {
    const { impl } = queueFetch()
    const store = buildLooseStore(impl)
    await store.onWs([{ id: 1, name: "North" }], RemoteEvent.LIST)

    await store.onWs(
      [{ id: 1, name: "Edited", updatedAt: new Date("2024-06-01T00:00:00.000Z") }],
      RemoteEvent.UPDATED,
    )

    expect(store.state.value.list[0].name).toBe("Edited")
  })

  it("accepts an update when only the stored row carries a timestamp", async () => {
    const { impl } = queueFetch()
    const store = buildLooseStore(impl)
    await store.onWs(
      [{ id: 1, name: "North", updatedAt: new Date("2024-06-01T00:00:00.000Z") }],
      RemoteEvent.LIST,
    )

    // The mirror of the test above: the side that carries the column is the one already held, and
    // the two still cannot be ordered, so the event is applied.
    await store.onWs([{ id: 1, name: "Edited" }], RemoteEvent.UPDATED)

    expect(store.state.value.list[0].name).toBe("Edited")
  })

  it("accepts an update for a model with no timestamp column at all", async () => {
    const { impl } = queueFetch()
    const bare = type({ id: "number", name: "string" })
    const store = buildModelStore({
      model: "tag",
      endpoint: "/api/tags",
      schemas: { full: bare, create: bare, update: bare },
      fetch: impl,
    })
    await store.onWs([{ id: 1, name: "North" }], RemoteEvent.LIST)

    await store.onWs([{ id: 1, name: "Edited" }], RemoteEvent.UPDATED)

    expect(store.state.value.list[0].name).toBe("Edited")
  })

  it("honours a custom freshness check", async () => {
    const { impl } = queueFetch()
    const store = buildModelStore({
      model: "zone",
      endpoint: "/api/zones",
      schemas: { full: timedRowSchema, create: createSchema, update: updateSchema },
      fetch: impl,
      isNewer: () => true,
    })
    await store.onWs(
      [timedRow(1, "North", "2024-01-01T00:00:00.000Z", "2024-06-01T00:00:00.000Z")],
      RemoteEvent.LIST,
    )

    await store.onWs(
      [timedRow(1, "Older but trusted", "2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z")],
      RemoteEvent.UPDATED,
    )

    expect(store.state.value.list[0].name).toBe("Older but trusted")
  })
})

describe("buildModelStore session lifecycle", () => {
  it("clears the store when the session goes away", async () => {
    const { impl } = queueFetch()
    const session = signal<unknown>({ id: 1 })
    let resets = 0
    const store = buildStore({ fetch: impl, session, onReset: () => resets++ })
    const dispose = store.init()
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    session.value = null

    expect(store.state.value.list).toEqual([])
    expect(store.op.create.value.inProgress).toBe(false)
    expect(resets).toBe(1)
    dispose()
  })

  it("does not clear a fresh store when the session starts empty", () => {
    const { impl } = queueFetch()
    const session = signal<unknown>(null)
    const store = buildStore({ fetch: impl, session })
    store.init()
    expect(store.state.value.list).toEqual([])
    session.value = { id: 2 }
    expect(store.state.value.list).toEqual([])
  })

  it("stops watching after dispose", async () => {
    const { impl } = queueFetch()
    const session = signal<unknown>({ id: 1 })
    const store = buildStore({ fetch: impl, session })
    const dispose = store.init()
    await store.onWs([row(1, "North")], RemoteEvent.LIST)

    dispose()
    session.value = null

    expect(store.state.value.list.map((r) => r.id)).toEqual([1])
  })

  it("is a no-op without a session flag", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    expect(() => store.init()()).not.toThrow()
    store.dispose()
  })
})

/**
 * What a request still on the wire may do once the store has been reset.
 *
 * `reset()` is what an application calls when somebody signs out, so every one of these is the same
 * story: a save was in flight, the user signed out, somebody else signed in, and the answer came
 * back. The case worth being exact about is a row id that names a different row in the two
 * sessions, which is what happens where ids restart per tenant. There the older answer does not
 * merely show a stale name — it writes one tenant's values over another tenant's row, the editor
 * pre-fills from it, and the next save makes the mix-up permanent. So these give the new session a
 * row under the same id with different values and assert that row is untouched, rather than
 * asserting only that the list is not the old value.
 *
 * Each test also checks the other half of the promise: the caller that started the operation still
 * learns what the server said about its own request.
 */
describe("buildModelStore across a reset", () => {
  const ARCHIVED_AT = new Date("2024-03-01T00:00:00.000Z")

  it("disowns a request left in flight when the session watch signs the user out", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const session = signal<unknown>({ id: 1 })
    const store = buildStore({ fetch: impl, toast: toast.port, session })
    const dispose = store.init()
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    // The way an application actually signs out: the watched flag goes falsy and the effect clears
    // the store. It has to reach the generation by the same path a hand-written `reset()` does, or
    // this rule protects only the applications that clear the store themselves.
    session.value = null
    session.value = { id: 2 }
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(1, "Renamed")))
    const answer = await updating

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Renamed")
    dispose()
  })

  it("leaves the row now under that id alone when a delete from before the reset answers", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(1, "First tenant zone", ARCHIVED_AT)))
    const answer = await deleting

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
    expect(store.list.deleted.value).toEqual([])
    expect(store.op.delete(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("First tenant zone")
    expect(Boolean(answer.result?.deletedAt)).toBe(true)
  })

  it("leaves the row now under that id alone when an undelete from before the reset answers", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    store.reset()
    // The new session's row under that id is archived too, so an answer that landed would revive a
    // row the second tenant archived on purpose.
    await store.onWs([row(1, "Second tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(1, "First tenant zone")))
    const answer = await restoring

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.deletedAt).toBeNull()
  })

  it("does not write an update into the list when two resets have happened since it was made", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    store.reset()
    await store.onWs([row(1, "Third tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(1, "Renamed")))
    const answer = await updating

    // One reset behind and two behind are the same thing: the generation is compared, not counted
    // down, so an answer does not become current again by being overtaken twice.
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Third tenant zone"])
    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Renamed")
  })

  it("says nothing about an update whose row the new session does not hold", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(7, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(7, { name: "Renamed" })
    store.reset()
    await store.onWs([row(8, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(7, "Renamed")))
    const answer = await updating

    // Nothing in the list could have moved, because row 7 is not in it — so here the list says
    // nothing either way, and the notification and the operation slot are what show whether the
    // answer was acted on.
    expect(store.state.value.list.map((r) => r.id)).toEqual([8])
    expect(toast.messages).toEqual([])
    expect(store.op.update(7).value).toBeUndefined()
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Renamed")
  })

  it("does not add a row created before the reset to the next session's list", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const creating = store.create({ name: "First tenant zone" })
    store.reset()
    await store.onWs([row(2, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json(row(1, "First tenant zone")))
    const answer = await creating

    // A create appends whether or not it settles the shared slot, so the list is the whole of what
    // the generation has to stop here.
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
    expect(store.op.create.value).toEqual({ inProgress: false, error: null, result: null })
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.id).toBe(1)
  })

  it("disowns the old session even when a subscriber throws while the store is cleared", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })

    // Application code that watches the store and fails when the list goes empty. A cleanup that
    // throws at sign-out is ordinary, and it is what makes the order inside `reset()` load-bearing:
    // the generation is raised on the first line, so it is already raised when this throw escapes.
    // Raise it after the slices are cleared, or after `onReset`, and this throw carries the old
    // session into the new one — which is the failure this whole change exists to prevent.
    let threw = 0
    const stop = effect(() => {
      if (store.state.value.list.length === 0 && threw === 0) {
        threw += 1
        throw new Error("subscriber failed during reset")
      }
    })

    expect(() => store.reset()).toThrow("subscriber failed during reset")
    expect(threw).toBe(1)
    // The slices were cleared before the throw escaped, so there is a real next session here. This
    // is what stops the test passing for the other reason — a reset abandoned before it did
    // anything would leave the first tenant's row in place and protect nothing.
    expect(store.state.value.list).toEqual([])

    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    pending[0].settle(Response.json(row(1, "Renamed")))
    const answer = await updating

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Renamed")
    stop()
  })

  it("disowns the old session even when onReset throws", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({
      fetch: impl,
      toast: toast.port,
      onReset: () => {
        throw new Error("app cleanup failed")
      },
    })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })

    // The same point said more plainly: `onReset` is the application's own cleanup, it runs last,
    // and the generation must already be raised by the time it can fail.
    expect(() => store.reset()).toThrow("app cleanup failed")
    expect(store.state.value.list).toEqual([])

    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    pending[0].settle(Response.json(row(1, "Renamed")))
    const answer = await updating

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Renamed")
  })

  it("applies the answer to an update issued from inside onReset", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    let issued: Promise<unknown> | null = null
    // Reloading what the new session needs is the ordinary thing an application does from here, so
    // a request made in `onReset` belongs to the session starting rather than to the one just left.
    // The generation is raised on the first line of `reset()`, before the slices are cleared and
    // before this runs, which is what makes that true. Move the raise below them — into a `finally`
    // around the body, say — and this request is made in the old generation and disowned when it
    // answers: the list stays as the new session loaded it and the flag raised here is left up with
    // nothing that can lower it. Nothing else in this file notices that move.
    // Annotated rather than inferred: `onReset` reads `store`, and inference cannot resolve a type
    // that refers to the value being declared.
    const store: ReturnType<typeof buildStore> = buildStore({
      fetch: impl,
      toast: toast.port,
      onReset: () => {
        issued = store.update(1, { name: "Reloaded" })
      },
    })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    expect(store.op.update(1).value?.inProgress).toBe(true)

    pending[0].settle(Response.json(row(1, "Reloaded")))
    await issued

    expect(store.state.value.list.map((r) => r.name)).toEqual(["Reloaded"])
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.op.update(1).value?.result?.name).toBe("Reloaded")
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
  })

  it("two creates either side of a reset, old answered first, leave the new one in flight", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const before = store.create({ name: "First tenant zone" })
    store.reset()
    const after = store.create({ name: "Second tenant zone" })

    pending[0].settle(Response.json(row(1, "First tenant zone")))
    const oldAnswer = await before

    // A create has no id to be numbered against, so the single `createOp` slot is the whole of what
    // two creates contend for. The disowned one must not touch it: lowering the flag here would
    // tell the form that the create the user is waiting on has finished.
    expect(store.op.create.value.inProgress).toBe(true)
    expect(store.op.create.value.result).toBeNull()
    expect(store.state.value.list).toEqual([])
    expect(toast.messages).toEqual([])

    pending[1].settle(Response.json(row(2, "Second tenant zone")))
    const newAnswer = await after

    expect(store.op.create.value.inProgress).toBe(false)
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
    expect(toast.messages).toEqual([{ body: "zone was created" }])
    // Each caller is told about its own request, whichever session it belonged to.
    expect(oldAnswer.result?.id).toBe(1)
    expect(newAnswer.result?.id).toBe(2)
  })

  it("two creates either side of a reset, new answered first, keep the new one's result", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const before = store.create({ name: "First tenant zone" })
    store.reset()
    const after = store.create({ name: "Second tenant zone" })

    pending[1].settle(Response.json(row(2, "Second tenant zone")))
    const newAnswer = await after

    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])

    pending[0].settle(Response.json(row(1, "First tenant zone")))
    const oldAnswer = await before

    // The other arrival order. Nothing about the settled slot moves, and the disowned row is not
    // appended behind the one the new session made.
    expect(store.op.create.value.inProgress).toBe(false)
    expect(store.op.create.value.result?.id).toBe(2)
    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
    expect(toast.messages).toEqual([{ body: "zone was created" }])
    expect(oldAnswer.result?.id).toBe(1)
    expect(newAnswer.result?.id).toBe(2)
  })

  it("files no error and says nothing when an update from before the reset fails", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const updating = store.update(1, { name: "Renamed" })
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json({ error: "Conflict" }, { status: 409 }))
    const answer = await updating

    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error?.type).toBe(ErrType.SERVER)
    expect(answer.result).toBeNull()
  })

  it("files no error and says nothing when a create from before the reset fails", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })

    const creating = store.create({ name: "First tenant zone" })
    store.reset()
    await store.onWs([row(2, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json({ error: "Conflict" }, { status: 409 }))
    const answer = await creating

    // A create's failure is announced whichever create in flight it belongs to, so it is the
    // loudest of the four operations and the one where a missing generation check shows first.
    expect(store.op.create.value).toEqual({ inProgress: false, error: null, result: null })
    expect(toast.messages).toEqual([])
    expect(answer.error?.type).toBe(ErrType.SERVER)
    expect(answer.result).toBeNull()
  })

  it("files no error and says nothing when a delete from before the reset fails", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const deleting = store.delete(1)
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)

    pending[0].settle(Response.json({ error: "Conflict" }, { status: 409 }))
    const answer = await deleting

    expect(store.op.delete(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error?.type).toBe(ErrType.SERVER)
    expect(answer.result).toBeNull()
  })

  it("files no error and says nothing when an undelete from before the reset fails", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)

    const restoring = store.undelete(1)
    store.reset()
    await store.onWs([row(1, "Second tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)

    pending[0].settle(Response.json({ error: "Conflict" }, { status: 409 }))
    const answer = await restoring

    expect(store.op.update(1).value).toBeUndefined()
    expect(toast.messages).toEqual([])
    expect(answer.error?.type).toBe(ErrType.SERVER)
    expect(answer.result).toBeNull()
  })

  it("does not lower the in-flight flag of a delete made after the reset", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const before = store.delete(1)
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    const after = store.delete(1)

    pending[0].settle(Response.json(row(1, "First tenant zone", ARCHIVED_AT)))
    await before

    // The row ids match, so a disowned answer that settled would lower the flag of a delete the
    // second tenant is still waiting on, and archive their row on the strength of the first
    // tenant's request.
    expect(store.op.delete(1).value?.inProgress).toBe(true)
    expect(store.list.deleted.value).toEqual([])
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])

    pending[1].settle(Response.json(row(1, "Second tenant zone", ARCHIVED_AT)))
    await after
    expect(store.op.delete(1).value?.inProgress).toBe(false)
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
  })

  it("does not lower the in-flight flag of an undelete made after the reset", async () => {
    const { impl, pending } = deferredFetch()
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "First tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)

    const before = store.undelete(1)
    store.reset()
    await store.onWs([row(1, "Second tenant zone", ARCHIVED_AT)], RemoteEvent.LIST)
    const after = store.undelete(1)

    pending[0].settle(Response.json(row(1, "First tenant zone")))
    await before

    expect(store.op.update(1).value?.inProgress).toBe(true)
    expect(store.list.deleted.value.map((r) => r.id)).toEqual([1])
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])

    pending[1].settle(Response.json(row(1, "Second tenant zone")))
    await after
    expect(store.op.update(1).value?.inProgress).toBe(false)
    expect(store.list.deleted.value).toEqual([])
  })

  it("keeps the value of a request made after the reset when the older one answers last", async () => {
    const { impl, pending } = deferredFetch()
    const toast = toastRecorder()
    const store = buildStore({ fetch: impl, toast: toast.port })
    await store.onWs([row(1, "First tenant zone")], RemoteEvent.LIST)

    const before = store.update(1, { name: "Before" })
    store.reset()
    await store.onWs([row(1, "Second tenant zone")], RemoteEvent.LIST)
    const after = store.update(1, { name: "After" })

    pending[1].settle(Response.json(row(1, "After")))
    await after
    expect(store.state.value.list.map((r) => r.name)).toEqual(["After"])

    pending[0].settle(Response.json(row(1, "Before")))
    const answer = await before

    // This arrival order is already covered by the request counter — the older answer is stale for
    // its row whether or not a reset happened — so it stays green with the generation check
    // removed. It is here so both orders are written down; the order that needs the generation is
    // the other one, in `does not let an answer from before a reset settle a request made after
    // it` above, where the older answer arrives first and nothing newer has been applied yet.
    //
    // It is not a dead test. It is also green with the counters cleared on reset, and red when both
    // are done at once — the only test that tells those two states apart, which is exactly the
    // second line of defence the comment above `rowRequests` says is being kept on purpose.
    expect(store.state.value.list.map((r) => r.name)).toEqual(["After"])
    expect(store.op.update(1).value?.result?.name).toBe("After")
    expect(toast.messages).toEqual([{ body: "zone was updated" }])
    expect(answer.error).toBeNull()
    expect(answer.result?.name).toBe("Before")
  })

  /**
   * A store whose `extraOps` hold the session rule through the context ports.
   *
   * The store has no collection fetch of its own — `listOp` is resolved by a remote event or by a
   * loader the application owns — so this is what the README tells an application to write, and
   * testing it is how the two ports themselves are tested.
   */
  function storeWithLoader(fetchImpl: typeof fetch) {
    return buildModelStore({
      model: "zone",
      endpoint: "/api/zones",
      schemas: { full: rowSchema, create: createSchema, update: updateSchema },
      fetch: fetchImpl,
      extraOps: (context) => ({
        generationNow: () => context.generation(),
        load: async () => {
          const issuedIn = context.generation()
          context.patch({ listOp: { inProgress: true, error: null, result: null } })
          const outcome = await context.request("/api/zones", { method: "GET" }, rowSchema.array())
          if (!context.isCurrentGeneration(issuedIn)) return outcome
          context.patch({
            list: outcome.result ?? [],
            listOp: { inProgress: false, error: outcome.error, result: outcome.result },
          })
          return outcome
        },
      }),
    })
  }

  it("lets an app-owned list load turn away the answer from before the reset and keep the one after", async () => {
    const { impl, pending } = deferredFetch()
    const store = storeWithLoader(impl)

    const stale = store.load()
    store.reset()
    const fresh = store.load()

    pending[0].settle(Response.json([row(1, "First tenant zone")]))
    const staleAnswer = await stale

    // Both halves matter. A port that answered "still current" to everything would let this one
    // land; a port that answered "not current" to everything would turn the next one away too, and
    // leave every loader written from the README spinning for a list that never arrives.
    expect(store.state.value.list).toEqual([])
    expect(store.op.list.value.inProgress).toBe(true)
    expect(staleAnswer.result?.map((r) => r.name)).toEqual(["First tenant zone"])

    pending[1].settle(Response.json([row(2, "Second tenant zone")]))
    const freshAnswer = await fresh

    expect(store.state.value.list.map((r) => r.id)).toEqual([2])
    expect(store.op.list.value.inProgress).toBe(false)
    expect(store.op.list.value.result?.map((r) => r.id)).toEqual([2])
    expect(freshAnswer.result?.map((r) => r.name)).toEqual(["Second tenant zone"])
  })

  it("raises the generation by exactly one per reset", () => {
    const { impl } = deferredFetch()
    const store = storeWithLoader(impl)

    // The context documents this as a count of resets, so it is asserted as a count. A store that
    // moved it by two per reset would still turn every stale answer away, and every other test
    // here would stay green — the number is part of the port's contract, so it is pinned.
    expect(store.generationNow()).toBe(0)
    store.reset()
    expect(store.generationNow()).toBe(1)
    store.reset()
    expect(store.generationNow()).toBe(2)
  })
})

/**
 * The application's subscription to the feed, as a double.
 *
 * `arrive` delivers the frame immediately when the subscription is attached and drops it when it is
 * not, because that is the only thing an application controls. A frame the server has written
 * reaches the callback at a moment nobody chooses, so a test says where in the sign-out it lands by
 * writing `arrive` at that line — and a double that queued frames until the test asked for them
 * would make every order below come out the same, which is exactly the defect these tests replace.
 */
function fakeFeed(store: { onWs: (items: unknown[], event: RemoteEvent) => Promise<void> }) {
  let attached = false
  return {
    /** Attach the subscription, as `openFeed` does in the README. */
    open: () => {
      attached = true
    },
    /** Tear it down. A closed socket calls nobody back, which is the whole of the protection. */
    close: () => {
      attached = false
    },
    /** The server's frame arrives now, at this line. */
    arrive: async (items: unknown[], event: RemoteEvent) => {
      if (attached) await store.onWs(items, event)
    },
  }
}

/**
 * The sign-out order the README asks an application to follow, run against a real store.
 *
 * The store cannot close this gap itself — a remote event carries nothing saying which session it
 * was sent for, and only the application owns the subscription — so the README is the whole of the
 * protection and these tests are what keep it honest. Each one puts the old session's frame at a
 * different line of the sign-out, which is the only variable that matters: the application cannot
 * choose when the frame arrives, only whether the subscription is still attached when it does.
 *
 * The old session's row is stamped later than the new session's throughout, so the freshness rule
 * would let it through wherever it lands. The subscription's state is the only thing keeping it out.
 */
describe("buildModelStore feed lifecycle around a reset", () => {
  const OLD_SESSION = "2024-12-01T00:00:00.000Z"

  /** Sign in a store and hand back its feed, with the first session's list already loaded. */
  async function signedIn() {
    const { impl } = queueFetch()
    const store = buildTimedStore(impl)
    const server = fakeFeed(store)
    server.open()
    await server.arrive([stampedRow(1, "First tenant zone", LOADED_AT)], RemoteEvent.LIST)
    return { store, server }
  }

  it("closes the feed before resetting, so a frame arriving mid-sign-out is dropped", async () => {
    const { store, server } = await signedIn()

    // Sign-out, in the documented order: close, then reset. The old session's frame arrives in
    // between, which is the worst moment for it and the moment the order exists to cover.
    server.close()
    await server.arrive(
      [stampedRow(2, "First tenant zone, made elsewhere", OLD_SESSION)],
      RemoteEvent.CREATED,
    )
    store.reset()

    // Nothing of the old session survived into the empty store the next sign-in starts from.
    expect(store.state.value.list).toEqual([])

    await store.onWs([stampedRow(1, "Second tenant zone", LOADED_AT)], RemoteEvent.LIST)
    server.open()
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])

    // And the subscription really is live, so the assertions above did not pass because nothing
    // was listening: a frame for the session the store has now arrives exactly as it should.
    await server.arrive([stampedRow(1, "Second tenant zone, edited", LATER)], RemoteEvent.UPDATED)
    expect(store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone, edited"])
  })

  it("shows the old session's rows when the reset happens before the close", async () => {
    const { store, server } = await signedIn()

    // The same two lines the other way round. The frame arrives in the window that opens, and the
    // subscription is still attached, so it is applied to the store the next session will use.
    store.reset()
    await server.arrive(
      [stampedRow(2, "First tenant zone, made elsewhere", OLD_SESSION)],
      RemoteEvent.CREATED,
    )
    server.close()

    // One tenant's row sitting in the next tenant's store, on screen until the new list arrives.
    // A `"created"` frame is the one that shows it: an `"updated"` or `"deleted"` frame delivered
    // here is folded into the empty list and discarded, which is why this test uses a create.
    expect(store.state.value.list.map((r) => r.name)).toEqual(["First tenant zone, made elsewhere"])
  })

  it("lets the old session's event overwrite the new session's row when the feed is not closed", async () => {
    const { store, server } = await signedIn()

    // The sign-out with no close at all: the subscription outlives the session it belonged to, and
    // the frame arrives once the next session's list is in place.
    store.reset()
    await store.onWs([stampedRow(1, "Second tenant zone", LOADED_AT)], RemoteEvent.LIST)
    await server.arrive(
      [stampedRow(1, "First tenant zone, edited", OLD_SESSION)],
      RemoteEvent.UPDATED,
    )

    // One tenant's row under the other tenant's id, which is exactly the failure the generation
    // number prevents for requests and cannot prevent for events.
    expect(store.state.value.list.map((r) => r.name)).toEqual(["First tenant zone, edited"])
  })

  it("reaches the same list whether the feed is attached before or after the list loads", async () => {
    const madeElsewhere = [stampedRow(2, "Made elsewhere", OLD_SESSION)]
    const list = [stampedRow(1, "Second tenant zone", LOADED_AT)]

    const early = await signedIn()
    early.store.reset()
    early.server.open()
    // Attached first: the frame is applied, and a `"created"` row really does appear.
    await early.server.arrive(madeElsewhere, RemoteEvent.CREATED)
    expect(early.store.state.value.list.map((r) => r.name)).toEqual(["Made elsewhere"])
    await early.store.onWs(list, RemoteEvent.LIST)

    const late = await signedIn()
    late.store.reset()
    late.server.close()
    // Attached after: the same frame reaches nobody, so nothing appears in the meantime.
    await late.server.arrive(madeElsewhere, RemoteEvent.CREATED)
    expect(late.store.state.value.list).toEqual([])
    await late.store.onWs(list, RemoteEvent.LIST)
    late.server.open()

    // The two orders end in the same list, because the `"list"` event replaces it outright either
    // way. So attaching first is not unsafe, it just shows a row and takes it away again — which
    // is why the README calls loading first the simpler order rather than the required one.
    expect(early.store.state.value.list.map((r) => r.name))
      .toEqual(late.store.state.value.list.map((r) => r.name))
    expect(late.store.state.value.list.map((r) => r.name)).toEqual(["Second tenant zone"])
  })
})

describe("buildModelStore extensions", () => {
  it("merges extraOps and selectors onto the store", async () => {
    const { impl, calls } = queueFetch(Response.json(row(1, "North")))
    const store = buildModelStore({
      model: "zone",
      endpoint: "/api/zones",
      schemas: { full: rowSchema, create: createSchema, update: updateSchema },
      fetch: impl,
      selectors: ({ state }) => ({
        count: () => state.value.list.length,
      }),
      extraOps: (context) => ({
        ping: async (id: number) => {
          context.setUpdateOp(id, { inProgress: true, error: null, result: null })
          const outcome = await context.request(
            `${context.endpoint}/${id}/ping`,
            { method: "POST" },
            rowSchema,
          )
          if (outcome.error) return false
          context.setUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
          return true
        },
      }),
    })

    await store.onWs([row(1, "North")], RemoteEvent.LIST)
    expect(store.count()).toBe(1)
    expect(await store.ping(1)).toBe(true)
    expect(calls[0].url).toBe("/api/zones/1/ping")
    expect(store.op.update(1).value?.result?.name).toBe("North")
  })

  it("keeps domain operations out of the generic surface", () => {
    const { impl } = queueFetch()
    const store = buildStore({ fetch: impl })
    // The generic store knows nothing about greenhouses: no `turn`, no `dimming`.
    expect("turn" in store).toBe(false)
    expect("setPassword" in store).toBe(false)
  })
})

describe("buildModelStore freshness over every timestamp combination", () => {
  it("decides by updatedAt, then createdAt, and accepts whatever it cannot order", async () => {
    for (const held of PAIRS) {
      for (const incoming of PAIRS) {
        const store = buildModelStore({
          model: "zone",
          endpoint: "/api/zones",
          schemas: { full: stampedSchema, create: updateSchema, update: updateSchema },
          fetch: (() => Promise.reject(new Error("no request expected"))) as typeof fetch,
        })
        await store.onWs([stamped("held", held)], RemoteEvent.LIST)
        await store.onWs([stamped("incoming", incoming)], RemoteEvent.UPDATED)

        expect(
          store.state.value.list[0].name,
          `held [createdAt ${held[0]}, updatedAt ${held[1]}], ` +
            `incoming [createdAt ${incoming[0]}, updatedAt ${incoming[1]}]`,
        ).toBe(shouldAccept(incoming, held) ? "incoming" : "held")
      }
    }
  })
})
