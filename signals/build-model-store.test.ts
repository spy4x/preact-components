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
    const store = buildStore({ fetch: impl })
    await store.onWs([row(1, "North", new Date("2024-03-01T00:00:00.000Z"))], RemoteEvent.LIST)

    const result = await store.undelete(1)

    expect(calls[0].url).toBe("/api/zones/1/undelete")
    expect(calls[0].init.method).toBe("POST")
    expect(result.error).toBeNull()
    expect(store.list.nonDeleted.value.map((r) => r.id)).toEqual([1])
    expect(store.list.deleted.value).toEqual([])
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
    const looseSchema = type({ id: "number", name: "string", "updatedAt?": dateSchema })
    const store = buildModelStore({
      model: "zone",
      endpoint: "/api/zones",
      schemas: { full: looseSchema, create: looseSchema, update: looseSchema },
      fetch: impl,
    })
    await store.onWs([{ id: 1, name: "North" }], RemoteEvent.LIST)

    await store.onWs(
      [{ id: 1, name: "Edited", updatedAt: new Date("2024-06-01T00:00:00.000Z") }],
      RemoteEvent.UPDATED,
    )

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
