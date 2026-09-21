/**
 * Generated cases for `buildModelStore`: the axes a fixture holds still.
 *
 * `build-model-store.test.ts` names one behaviour per test and holds everything else constant —
 * three small row ids, two requests at a time, four statuses, a list of one or two rows. A rule
 * that reads an axis no fixture varies cannot fail when it breaks, which is how a freshness check
 * reading the wrong column and a request counter shared by every row both survived a green suite.
 * This file varies those axes instead of naming behaviours, and checks what the store holds against
 * a model of the rule rather than against a remembered example.
 *
 * **What it covers.** Concurrency: one to four rows with ids up to 100,000, two to six `update`,
 * `delete` and `undelete` requests in any mix, each answered with a row, one of nine reported
 * statuses, a 500, a connection failure, or a body the schema rejects, in a shuffled answer order.
 * After every answer it checks each row's name, whether it is soft-deleted, both of its operation
 * flags, whether each slot carries an error, and the sequence of notifications so far. Freshness:
 * all 625 combinations of absent, null, early, middle and late for `createdAt` and `updatedAt` on
 * both the stored and the incoming row.
 *
 * **What it does not cover.** Creates, which have no row identity to vary; `extraOps`; the session
 * watch; `remove` and `reset`; the body text of a failure notification, only its title; calls made
 * re-entrantly from an effect; and anything about timing beyond the order in which answers arrive.
 * It is also not a description of the store: it says the rule holds across these axes, never what
 * the rule is, and a reader who wants to know what the store promises should read the named tests.
 *
 * **Reproducing a failure.** Every case comes from `SEED + index` and nothing else, so a case is
 * the same on every machine and every run. A failed assertion prints that number and the whole plan
 * it produced — the rows, the requests in the order they were made, each one's answer, and the
 * order the answers arrived in.
 */
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import { buildModelStore } from "./build-model-store.ts"
import { RemoteEvent, type ToastMessage } from "./types.ts"

const SEED = 20240921
const CASES = 300

const dateSchema = type("Date | string.date.iso.parse")
const rowSchema = type({ id: "number", name: "string", deletedAt: dateSchema.or("null") })
const namePayload = type({ name: "string" })

type Row = typeof rowSchema.infer

const KINDS = ["update", "delete", "undelete"] as const
type Kind = typeof KINDS[number]

/** Statuses the store reports. A 500 and a connection failure are silent; a bad payload is loud. */
const LOUD = [400, 401, 403, 404, 409, 412, 422, 429, 503]
const SUCCESS = {
  update: "zone was updated",
  delete: "zone was deleted",
  undelete: "zone was restored",
}
const FAILURE = {
  update: "Failed to update zone",
  delete: "Failed to delete zone",
  undelete: "Failed to restore zone",
}

type Answer =
  | { sort: "row" }
  | { sort: "status"; status: number }
  | { sort: "offline" }
  | { sort: "malformed" }

interface Planned {
  row: number
  kind: Kind
  /** Position in this row's own sequence, counted at the moment the request is made. */
  seq: number
  answer: Answer
  /** The row a successful answer carries. */
  result: Row
}

/** Deterministic 32-bit generator (mulberry32), so a case never depends on the host. */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function planCase(seed: number): { ids: number[]; requests: Planned[]; order: number[] } {
  const next = rng(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
  // Drawn once. Redrawing the bound on every pass would stop the loop as soon as it came up short,
  // which makes four-row cases rare and hides anything that only shows with four rows in flight.
  const rowCount = 1 + Math.floor(next() * 4)
  const ids: number[] = []
  while (ids.length < rowCount) {
    const id = 1 + Math.floor(next() * 100_000)
    if (!ids.includes(id)) ids.push(id)
  }

  const issued = new Map<number, number>()
  const requests: Planned[] = []
  const total = 2 + Math.floor(next() * 5)
  for (let index = 0; index < total; index++) {
    const row = pick(ids)
    const kind = pick(KINDS)
    const seq = (issued.get(row) ?? 0) + 1
    issued.set(row, seq)
    const roll = next()
    const answer: Answer = roll < 0.45
      ? { sort: "row" }
      : roll < 0.75
      ? { sort: "status", status: pick(LOUD) }
      : roll < 0.85
      ? { sort: "status", status: 500 }
      : roll < 0.93
      ? { sort: "offline" }
      : { sort: "malformed" }
    const deletedAt = kind === "delete" ? new Date("2024-03-01T00:00:00.000Z") : null
    requests.push({
      row,
      kind,
      seq,
      answer,
      result: { id: row, name: `${kind}-${index}`, deletedAt },
    })
  }

  const order = requests.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { ids, requests, order }
}

function describeCase(seed: number, plan: ReturnType<typeof planCase>): string {
  const made = plan.requests
    .map((r, i) => `${i}:${r.kind}(row ${r.row}, seq ${r.seq})→${describeAnswer(r.answer)}`)
    .join(", ")
  return `seed ${seed}; rows ${plan.ids.join("/")}; made ${made}; answered ${plan.order.join(",")}`
}

function describeAnswer(answer: Answer): string {
  return answer.sort === "status" ? `${answer.status}` : answer.sort
}

/** Slot a kind writes: an undelete is an update of the row, so it shares that slot. */
function slotOf(kind: Kind): "update" | "delete" {
  return kind === "delete" ? "delete" : "update"
}

interface RowModel {
  name: string
  deleted: boolean
  busy: { update: boolean; delete: boolean }
  failed: { update: boolean; delete: boolean }
}

/** What the store should hold, derived from the rule rather than from the implementation. */
function modelCase(plan: ReturnType<typeof planCase>) {
  const rows = new Map<number, RowModel>()
  for (const id of plan.ids) {
    rows.set(id, {
      name: `row-${id}`,
      deleted: false,
      busy: { update: false, delete: false },
      failed: { update: false, delete: false },
    })
  }
  const issued = new Map<number, number>()
  for (const request of plan.requests) {
    issued.set(request.row, Math.max(issued.get(request.row) ?? 0, request.seq))
    const row = rows.get(request.row)!
    row.busy[slotOf(request.kind)] = true
    row.failed[slotOf(request.kind)] = false
  }

  const applied = new Map<number, number>()
  const toasts: string[] = []
  return {
    rows,
    toasts,
    /** Fold one answer in, in the order the answers arrive. */
    answer(request: Planned) {
      const row = rows.get(request.row)!
      const slot = slotOf(request.kind)
      const fresh = request.seq > (applied.get(request.row) ?? 0)
      if (fresh) applied.set(request.row, request.seq)
      const settles = request.seq === issued.get(request.row)
      const failed = request.answer.sort !== "row"
      const silent = request.answer.sort === "offline" ||
        (request.answer.sort === "status" && request.answer.status === 500)

      if (failed) {
        if (settles) {
          row.busy[slot] = false
          row.failed[slot] = true
          row.busy[slot === "update" ? "delete" : "update"] = false
        }
        if (fresh && !silent) toasts.push(FAILURE[request.kind])
        return
      }
      if (!fresh) return
      if (settles) {
        row.busy[slot] = false
        row.failed[slot] = false
        row.busy[slot === "update" ? "delete" : "update"] = false
      }
      row.name = request.result.name
      row.deleted = request.result.deletedAt !== null
      toasts.push(SUCCESS[request.kind])
    },
  }
}

interface Settler {
  settle: (answer: Response | Error) => void
}

/** A `fetch` that holds every request open until the case answers it. */
function heldFetch(): { impl: typeof fetch; pending: Settler[] } {
  const pending: Settler[] = []
  const impl = (() =>
    new Promise<Response>((resolve, reject) => {
      pending.push({
        settle: (answer) => answer instanceof Error ? reject(answer) : resolve(answer),
      })
    })) as typeof fetch
  return { impl, pending }
}

function responseFor(request: Planned): Response | Error {
  switch (request.answer.sort) {
    case "row":
      return Response.json(request.result)
    case "status":
      return Response.json({ error: "rejected" }, { status: request.answer.status })
    case "offline":
      return new Error("network down")
    case "malformed":
      return Response.json({ id: "not a number" })
  }
}

/** The label a notification is compared by: its title when it failed, its body when it did not. */
function labelOf(message: ToastMessage): string {
  return message.title ?? message.body
}

describe("buildModelStore over generated cases", () => {
  it("holds the answer to the newest request for every row, in every answer order", async () => {
    for (let index = 0; index < CASES; index++) {
      const seed = SEED + index
      const plan = planCase(seed)
      const where = describeCase(seed, plan)
      const { impl, pending } = heldFetch()
      const messages: ToastMessage[] = []
      const store = buildModelStore({
        model: "zone",
        endpoint: "/api/zones",
        schemas: { full: rowSchema, create: namePayload, update: namePayload },
        fetch: impl,
        toast: {
          success: (message: ToastMessage) => messages.push(message),
          error: (message: ToastMessage) => messages.push(message),
        },
      })
      await store.onWs(
        plan.ids.map((id) => ({ id, name: `row-${id}`, deletedAt: null })),
        RemoteEvent.LIST,
      )

      const model = modelCase(plan)
      const running = plan.requests.map((request) =>
        request.kind === "update"
          ? store.update(request.row, { name: request.result.name })
          : request.kind === "delete"
          ? store.delete(request.row)
          : store.undelete(request.row)
      )

      for (const position of plan.order) {
        pending[position].settle(responseFor(plan.requests[position]))
        await running[position]
        model.answer(plan.requests[position])

        for (const id of plan.ids) {
          const expected = model.rows.get(id)!
          const held = store.state.value.list.find((candidate) => candidate.id === id)
          expect({
            name: held?.name,
            deleted: Boolean(held?.deletedAt),
            updateBusy: Boolean(store.op.update(id).value?.inProgress),
            deleteBusy: Boolean(store.op.delete(id).value?.inProgress),
            updateFailed: Boolean(store.op.update(id).value?.error),
            deleteFailed: Boolean(store.op.delete(id).value?.error),
          }, `row ${id} after answer ${position} — ${where}`).toEqual({
            name: expected.name,
            deleted: expected.deleted,
            updateBusy: expected.busy.update,
            deleteBusy: expected.busy.delete,
            updateFailed: expected.failed.update,
            deleteFailed: expected.failed.delete,
          })
        }
        expect(messages.map(labelOf), `notifications after answer ${position} — ${where}`)
          .toEqual(model.toasts)
      }
    }
  })
})

const STAMPS = ["absent", "null", "early", "middle", "late"] as const
type Stamp = typeof STAMPS[number]

const AT: Record<string, string> = {
  early: "2023-01-01T00:00:00.000Z",
  middle: "2024-01-01T00:00:00.000Z",
  late: "2025-01-01T00:00:00.000Z",
}

const stampedSchema = type({
  id: "number",
  name: "string",
  "createdAt?": dateSchema.or("null"),
  "updatedAt?": dateSchema.or("null"),
})

function stamped(name: string, createdAt: Stamp, updatedAt: Stamp): Record<string, unknown> {
  const row: Record<string, unknown> = { id: 1, name }
  if (createdAt !== "absent") row.createdAt = createdAt === "null" ? null : new Date(AT[createdAt])
  if (updatedAt !== "absent") row.updatedAt = updatedAt === "null" ? null : new Date(AT[updatedAt])
  return row
}

/** Milliseconds a stamp compares as, or `null` when it carries no usable time. */
function millis(stamp: Stamp): number | null {
  return stamp === "absent" || stamp === "null" ? null : Date.parse(AT[stamp])
}

/**
 * The documented rule, restated: prefer `updatedAt`, fall back to `createdAt`, and accept the
 * incoming row wherever the two cannot be ordered. Written out rather than imported, so that a
 * change to the implementation cannot quietly change what the expectation is.
 */
function shouldAccept(incoming: [Stamp, Stamp], held: [Stamp, Stamp]): boolean {
  const pairs: Array<[number | null, number | null]> = [
    [millis(incoming[1]), millis(held[1])],
    [millis(incoming[0]), millis(held[0])],
  ]
  for (const [incomingAt, heldAt] of pairs) {
    if (incomingAt === null && heldAt === null) continue
    if (incomingAt === null || heldAt === null) return true
    return incomingAt >= heldAt
  }
  return true
}

describe("buildModelStore freshness over every timestamp combination", () => {
  it("decides by updatedAt, then createdAt, and accepts whatever it cannot order", async () => {
    for (const heldCreated of STAMPS) {
      for (const heldUpdated of STAMPS) {
        for (const incomingCreated of STAMPS) {
          for (const incomingUpdated of STAMPS) {
            const store = buildModelStore({
              model: "zone",
              endpoint: "/api/zones",
              schemas: { full: stampedSchema, create: namePayload, update: namePayload },
              fetch: (() => Promise.reject(new Error("no request expected"))) as typeof fetch,
            })
            await store.onWs([stamped("held", heldCreated, heldUpdated)], RemoteEvent.LIST)
            await store.onWs(
              [stamped("incoming", incomingCreated, incomingUpdated)],
              RemoteEvent.UPDATED,
            )

            const accepted = shouldAccept(
              [incomingCreated, incomingUpdated],
              [heldCreated, heldUpdated],
            )
            expect(
              store.state.value.list[0].name,
              `held createdAt ${heldCreated}, updatedAt ${heldUpdated}; ` +
                `incoming createdAt ${incomingCreated}, updatedAt ${incomingUpdated}`,
            ).toBe(accepted ? "incoming" : "held")
          }
        }
      }
    }
  })
})
