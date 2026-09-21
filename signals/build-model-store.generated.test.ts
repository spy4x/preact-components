/**
 * Generated cases for `buildModelStore`: the axes a fixture holds still.
 *
 * `build-model-store.test.ts` names one behaviour per test and holds every other axis constant —
 * three small row ids, two requests at a time, four statuses, a list of one or two rows. A rule
 * that reads an axis no fixture varies cannot fail when it breaks, which is how a freshness check
 * reading the wrong column and a request counter shared by every row both survived a green suite.
 * This file varies those axes instead, and checks the store against a model of the rule.
 *
 * **What it covers.** One to five rows, each with at least one request, with ids up to 100,000.
 * Two to six `update`, `delete` and `undelete` requests in any mix, answered with a row that may
 * carry a deletion whichever operation asked for it, with one of nine reported statuses, a 500, a
 * connection failure, or a body the schema rejects. Making and answering are interleaved, so a row
 * is often written to again after an earlier write has settled — 238 of the 300 cases make a
 * request after an answer has already arrived. After every step it checks each row's name, whether
 * it is soft-deleted, both operation flags, whether each slot carries an error, and the
 * notifications so far.
 *
 * **What it does not cover.** The freshness rule, whose axes are bounded and enumerated beside the
 * fixtures instead; creates, which have no row identity to vary; `extraOps`; the session watch;
 * `remove` and `reset`; remote events; the body text of a failure notification, only its title;
 * calls made re-entrantly from an effect; and anything about timing beyond the order in which
 * things happen. The cap of five rows is a cap, not a proof: a store that forgot a row's counter
 * only once six rows had been written to would pass every case here, exactly as one that forgot at
 * four passed while the cap was four. It reads only what the store shows — the list and the operation slots — never the
 * value an operation returns to its caller or the `result` a slot carries; the named tests cover
 * those. It is also not a description of the store: it says the rule holds across these axes,
 * never what the rule is, and a reader who wants to know what the store promises should read the
 * named tests.
 *
 * **Reproducing a failure.** Every case comes from `SEED + index` and nothing else, so it is the
 * same on every machine and every run, and a failed assertion prints that number with the plan it
 * produced: the rows, every request with the answer waiting for it, and the interleaving of making
 * and answering that the case runs.
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

/**
 * One request. `seq` is its position in its own row's sequence; `name` and `deletedAt` are the row
 * a successful answer carries back, which is what the store replaces the held row with.
 */
interface Planned {
  row: number
  kind: Kind
  seq: number
  answer: Answer
  name: string
  deletedAt: Date | null
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

/** A request is made, or one already made is answered. `at` indexes `requests`. */
type Step = { make: number } | { answer: number }

interface Plan {
  ids: number[]
  requests: Planned[]
  steps: Step[]
}

function planCase(seed: number): Plan {
  const next = rng(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
  // Drawn once. Redrawing the bound on every pass would stop the loop as soon as it came up short,
  // which makes four-row cases rare and hides anything that only shows with four rows in flight.
  const rowCount = 1 + Math.floor(next() * 5)
  const ids: number[] = []
  while (ids.length < rowCount) {
    const id = 1 + Math.floor(next() * 100_000)
    if (!ids.includes(id)) ids.push(id)
  }

  const issued = new Map<number, number>()
  const requests: Planned[] = []
  const total = Math.max(ids.length, 2 + Math.floor(next() * 5))
  for (let index = 0; index < total; index++) {
    // Every drawn row gets a request of its own before any row gets a second: picking at random
    // throughout left four rows drawn and one row written to in most cases.
    const row = index < ids.length ? ids[index] : pick(ids)
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
    const kind = pick(KINDS)
    // Any answer may carry a deletion: the store's promise is that a response body replaces the
    // row, not that only a delete archives it. The scaffold's archive checkbox is an update.
    const deletedAt = next() < (kind === "delete" ? 0.9 : 0.25) ? DELETED_AT : null
    requests.push({ row, kind, seq, answer, name: `answer-${index}`, deletedAt })
  }

  // Requests are made and answered in one interleaved order, so a row can be written to again
  // after its first write has settled — which is the ordinary thing a user does, and something a
  // plan that made every request up front could never produce.
  const steps: Step[] = []
  const outstanding: number[] = []
  let made = 0
  while (steps.length < requests.length * 2) {
    const mustMake = outstanding.length === 0
    const mustAnswer = made === requests.length
    if (!mustAnswer && (mustMake || next() < 0.55)) {
      outstanding.push(made)
      steps.push({ make: made++ })
      continue
    }
    steps.push({ answer: outstanding.splice(Math.floor(next() * outstanding.length), 1)[0] })
  }
  return { ids, requests, steps }
}

function describePlan(seed: number, { ids, requests, steps }: Plan): string {
  const made = requests.map((r, i) =>
    `${i}:${r.kind}(row ${r.row}, seq ${r.seq})→${JSON.stringify(r.answer)}${
      r.deletedAt ? "+deleted" : ""
    }`
  )
  const order = steps.map((step) => "make" in step ? `make ${step.make}` : `answer ${step.answer}`)
  return `seed ${seed}; rows ${ids.join("/")}; ${made.join(", ")}; ${order.join(" → ")}`
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
  const applied = new Map<number, number>()
  const said: string[] = []
  return {
    rows,
    said,
    /** Fold in one request being made. */
    make({ row: id, kind, seq }: Planned) {
      issued.set(id, seq)
      const row = rows.get(id)!
      row.busy[slotOf(kind)] = true
      row.failed[slotOf(kind)] = false
    },
    /** Fold in one answer, in the order the answers arrive. */
    answer({ row: id, kind, seq, answer, name, deletedAt }: Planned) {
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
      // Read from the row the server sent, not from the kind of request: the store's promise is
      // that a response body replaces the held row, whichever operation asked for it.
      row.name = name
      row.deleted = deletedAt !== null
      said.push(WORDS[kind][0])
    },
  }
}

const DELETED_AT = new Date("2024-03-01T00:00:00.000Z")

function responseFor({ row, name, answer, deletedAt }: Planned): Response | Error {
  if (answer === "offline") return new Error("network down")
  if (answer === "malformed") return Response.json({ id: "not a number" })
  if (answer !== "row") return Response.json({ error: "rejected" }, { status: answer.status })
  return Response.json({ id: row, name, deletedAt })
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
      const running = new Map<number, Promise<unknown>>()
      const settlerOf = new Map<number, number>()

      for (const step of plan.steps) {
        if ("make" in step) {
          const request = plan.requests[step.make]
          settlerOf.set(step.make, settlers.length)
          running.set(
            step.make,
            request.kind === "update"
              ? store.update(request.row, { name: request.name })
              : request.kind === "delete"
              ? store.delete(request.row)
              : store.undelete(request.row),
          )
          model.make(request)
        } else {
          settlers[settlerOf.get(step.answer)!](responseFor(plan.requests[step.answer]))
          await running.get(step.answer)
          model.answer(plan.requests[step.answer])
        }

        for (const id of plan.ids) {
          expect(observe(store, id), `row ${id} after step ${JSON.stringify(step)} — ${where}`)
            .toEqual(model.rows.get(id))
        }
        expect(said, `notifications after step ${JSON.stringify(step)} — ${where}`).toEqual(
          model.said,
        )
      }
    }
  })
})
