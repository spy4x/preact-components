/**
 * Generated cases for `buildModelStore`: the axes a fixture holds still.
 *
 * `build-model-store.test.ts` names one behaviour per test and holds every other axis constant —
 * three small row ids, two requests at a time, four statuses, a list of one or two rows. A rule
 * that reads an axis no fixture varies cannot fail when it breaks, which is how a freshness check
 * reading the wrong column and a request counter shared by every row both survived a green suite.
 * This file varies those axes instead, and checks the store against a model of the rule.
 *
 * **What it covers.** Concurrency: one to four rows with ids up to 100,000, two to six `update`,
 * `delete` and `undelete` requests in any mix, each answered with a row, one of nine reported
 * statuses, a 500, a connection failure, or a body the schema rejects, in a shuffled answer order.
 * After every answer it checks each row's name, whether it is soft-deleted, both operation flags,
 * whether each slot carries an error, and the notifications so far.
 *
 * **What it does not cover.** The freshness rule, whose axes are bounded and enumerated beside
 * the fixtures instead; creates, which have no row identity to vary; `extraOps`; the session
 * watch; `remove` and `reset`; the body text of a failure notification, only its title; calls made
 * re-entrantly from an effect; and anything about timing beyond the order answers arrive in. It is
 * also not a description of the store: it says the rule holds across these axes, never what the
 * rule is, and a reader who wants to know what the store promises should read the named tests.
 *
 * **Reproducing a failure.** Every case comes from `SEED + index` and nothing else, so it is the
 * same on every machine and every run, and a failed assertion prints that number with the plan it
 * produced: the rows, the requests in the order they were made, their answers, and the answer
 * order.
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

const KINDS = ["update", "delete", "undelete"] as const
type Kind = typeof KINDS[number]

/** Statuses the store reports. A 500 and a connection failure are silent; a bad payload is loud. */
const LOUD = [400, 401, 403, 404, 409, 412, 422, 429, 503]
/** What the store says: `[after it worked, after it failed]`, per kind. */
const WORDS = {
  update: ["zone was updated", "Failed to update zone"],
  delete: ["zone was deleted", "Failed to delete zone"],
  undelete: ["zone was restored", "Failed to restore zone"],
}

type Answer = { status: number } | "offline" | "malformed" | "row"

/** One request: `seq` is its position in its own row's sequence, `name` what a success returns. */
interface Planned {
  row: number
  kind: Kind
  seq: number
  answer: Answer
  name: string
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

/** `order` holds positions in `requests`, in the order their answers arrive. */
interface Plan {
  ids: number[]
  requests: Planned[]
  order: number[]
}

function planCase(seed: number): Plan {
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
  for (let index = 2 + Math.floor(next() * 5); index > 0; index--) {
    const row = pick(ids)
    const seq = (issued.get(row) ?? 0) + 1
    issued.set(row, seq)
    const roll = next()
    const answer: Answer = roll < 0.45
      ? "row"
      : roll < 0.75
      ? { status: pick(LOUD) }
      : roll < 0.85
      ? { status: 500 }
      : roll < 0.93
      ? "offline"
      : "malformed"
    requests.push({ row, kind: pick(KINDS), seq, answer, name: `answer-${requests.length}` })
  }

  const order = requests.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { ids, requests, order }
}

function describePlan(seed: number, { ids, requests, order }: Plan): string {
  const made = requests.map((r, i) =>
    `${i}:${r.kind}(row ${r.row}, seq ${r.seq})→${JSON.stringify(r.answer)}`
  )
  return `seed ${seed}; rows ${ids.join("/")}; made ${made.join(", ")}; answered ${order.join(",")}`
}

/** Slot a kind writes: 0 is the update slot, which an undelete shares; 1 is the delete slot. */
function slotOf(kind: Kind): 0 | 1 {
  return kind === "delete" ? 1 : 0
}

/** One row as the model and the store should both describe it. `busy` and `failed` are by slot. */
interface RowState {
  name: string
  deleted: boolean
  busy: [boolean, boolean]
  failed: [boolean, boolean]
}

/**
 * The rule, restated as a model: an answer older than one already applied is dropped, and only a
 * request with nothing newer behind it settles a slot, which releases the row's other slot too.
 */
function modelCase(plan: Plan) {
  const rows = new Map<number, RowState>(
    plan.ids.map((id) => [id, {
      name: `row-${id}`,
      deleted: false,
      busy: [false, false],
      failed: [false, false],
    }]),
  )
  const issued = new Map<number, number>()
  for (const request of plan.requests) {
    issued.set(request.row, request.seq)
    const row = rows.get(request.row)!
    row.busy[slotOf(request.kind)] = true
    row.failed[slotOf(request.kind)] = false
  }

  const applied = new Map<number, number>()
  const said: string[] = []
  return {
    rows,
    said,
    /** Fold in one answer, in the order the answers arrive. */
    answer({ row: id, kind, seq, answer, name }: Planned) {
      const row = rows.get(id)!
      const slot = slotOf(kind)
      const fresh = seq > (applied.get(id) ?? 0)
      if (fresh) applied.set(id, seq)
      const settles = seq === issued.get(id)
      if (settles) row.busy = [false, false]

      if (answer !== "row") {
        if (settles) row.failed[slot] = true
        const silent = answer === "offline" ||
          (typeof answer === "object" && answer.status === 500)
        if (fresh && !silent) said.push(WORDS[kind][1])
        return
      }
      if (!fresh) return
      if (settles) row.failed[slot] = false
      row.name = name
      row.deleted = kind === "delete"
      said.push(WORDS[kind][0])
    },
  }
}

const DELETED_AT = new Date("2024-03-01T00:00:00.000Z")

function responseFor({ kind, row, name, answer }: Planned): Response | Error {
  if (answer === "offline") return new Error("network down")
  if (answer === "malformed") return Response.json({ id: "not a number" })
  if (answer !== "row") return Response.json({ error: "rejected" }, { status: answer.status })
  return Response.json({ id: row, name, deletedAt: kind === "delete" ? DELETED_AT : null })
}

/** What the store shows for one row, in the shape the model describes. */
function observe(store: ReturnType<typeof storeFor>, id: number): RowState {
  const held = store.state.value.list.find((candidate) => candidate.id === id)
  const update = store.op.update(id).value
  const remove = store.op.delete(id).value
  return {
    name: held?.name ?? "missing",
    deleted: Boolean(held?.deletedAt),
    busy: [Boolean(update?.inProgress), Boolean(remove?.inProgress)],
    failed: [Boolean(update?.error), Boolean(remove?.error)],
  }
}

function storeFor(fetchImpl: typeof fetch, said: string[]) {
  const record = (message: ToastMessage) => said.push(message.title ?? message.body)
  return buildModelStore({
    model: "zone",
    endpoint: "/api/zones",
    schemas: { full: rowSchema, create: namePayload, update: namePayload },
    fetch: fetchImpl,
    toast: { success: record, error: record },
  })
}

describe("buildModelStore over generated cases", () => {
  it("holds the answer to the newest request for every row, in every answer order", async () => {
    for (let index = 0; index < CASES; index++) {
      const plan = planCase(SEED + index)
      const where = describePlan(SEED + index, plan)
      const settlers: Array<(answer: Response | Error) => void> = []
      const impl = (() =>
        new Promise<Response>((resolve, reject) => {
          settlers.push((answer) => answer instanceof Error ? reject(answer) : resolve(answer))
        })) as typeof fetch

      const said: string[] = []
      const store = storeFor(impl, said)
      await store.onWs(
        plan.ids.map((id) => ({ id, name: `row-${id}`, deletedAt: null })),
        RemoteEvent.LIST,
      )

      const model = modelCase(plan)
      const running = plan.requests.map((request) =>
        request.kind === "update"
          ? store.update(request.row, { name: request.name })
          : request.kind === "delete"
          ? store.delete(request.row)
          : store.undelete(request.row)
      )

      for (const position of plan.order) {
        settlers[position](responseFor(plan.requests[position]))
        await running[position]
        model.answer(plan.requests[position])

        for (const id of plan.ids) {
          expect(observe(store, id), `row ${id} after answer ${position} — ${where}`)
            .toEqual(model.rows.get(id))
        }
        expect(said, `notifications after answer ${position} — ${where}`).toEqual(model.said)
      }
    }
  })
})
