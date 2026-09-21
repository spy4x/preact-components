import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { signal } from "@preact/signals"
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
function buildTimedStore(fetchImpl: typeof fetch) {
  return buildModelStore({
    model: "zone",
    endpoint: "/api/zones",
    schemas: { full: timedRowSchema, create: createSchema, update: updateSchema },
    fetch: fetchImpl,
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
})

describe("buildModelStore requests answered out of order", () => {
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
    await store.onWs([timedRow(1, "North", "2024-01-01T00:00:00.000Z", at)], RemoteEvent.LIST)

    await store.onWs([timedRow(1, "Edited", "2024-01-01T00:00:00.000Z", at)], RemoteEvent.UPDATED)

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
