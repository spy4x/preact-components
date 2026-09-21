/**
 * Generated cases for `buildModelStore`: the axes a fixture holds still.
 *
 * `build-model-store.test.ts` names one behaviour per test and holds every other axis constant —
 * three small row ids, two requests at a time, four statuses, a list of one or two rows. A rule
 * that reads an axis no fixture varies cannot fail when it breaks, which is how a freshness check
 * reading the wrong column and a request counter shared by every row both survived a green suite.
 * This file varies those axes instead, and checks the store against a model of the rules.
 *
 * **What it covers.** One to five rows, each with at least one request, with ids up to 100,000.
 * Two to six `update`, `delete` and `undelete` requests in any mix, answered with a row that may
 * carry a deletion whichever operation asked for it, with one of nine reported statuses, a 500, a
 * connection failure, or a body the schema rejects. Making and answering are interleaved, so a
 * request is made after an answer has already landed in 818 of the 1,200 cases, while two requests
 * are outstanding on one row at once in 599 of them and an answer is actually dropped as stale in
 * 273 — see {@link MAKE_BIAS}.
 *
 * It also resets the store mid-case, which is what an application does when somebody signs out: 625
 * cases reset at least once, and in all 625 an answer arrives for a request that was issued before
 * a reset. In 188 of those the answer has two resets behind it rather than one; in 269 the row it
 * names is one the next session did not load at all; and in 313 the answer would have been written
 * into the next session's list under the rule this store had before it counted its resets — see
 * {@link RESET_CHANCE}. The list the next session loads carries the same ids under different names,
 * so an answer that lands where it should not is visible rather than merely redundant.
 *
 * After every step it checks each row's name, whether it is soft-deleted, both operation flags,
 * whether each slot carries an error, and the notifications so far.
 *
 * **What it does not cover.** The freshness rule, whose axes are bounded and enumerated beside the
 * fixtures instead; creates, which have no row identity to vary; `extraOps`; the session watch,
 * which reaches `reset()` by the same path this draws directly; `remove`; remote events, including
 * what one does when it arrives after a reset; the body text of a failure notification, only its
 * title; calls made re-entrantly from an effect; and anything about timing beyond the order in
 * which things happen. The cap of five rows is a cap, not a proof: a store that forgot a row's
 * counter only once six rows had been written to would pass every case here, exactly as one that
 * forgot at four passed while the cap was four. The same goes for the cap of two resets per case.
 * It reads only what the store shows — the list and the operation slots — never the value an
 * operation returns to its caller or the `result` a slot carries, so the promise that an answer
 * from a finished session still reaches whoever asked for it is pinned by the named tests and not
 * here. It is also not a description of the store: it says the rules hold across these axes, never
 * what they are, and a reader who wants to know what the store promises should read the named
 * tests.
 *
 * **Reproducing a failure.** Every case comes from `SEED + index` and nothing else, so it is the
 * same on every machine and every run, and a failed assertion prints that number with the plan it
 * produced: the rows, every request with the answer waiting for it, and the interleaving of making,
 * answering and resetting that the case runs.
 */
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type } from "arktype"
import { buildModelStore } from "./build-model-store.ts"
import { RemoteEvent, type ToastMessage } from "./types.ts"

const SEED = 20240921

/**
 * How often a step makes a new request rather than answering an outstanding one.
 *
 * It is the dial between the two shapes this file exists to draw. Biased towards answering, cases
 * are mostly one request at a time and the sequencing rule is never exercised; biased towards
 * making, every request is outstanding at once and a row is never written to twice in sequence.
 * At 0.7 over 1,200 cases: two requests overlap on one row in 599 cases, an answer is actually
 * dropped as stale for its row in 273, and 818 make a request after an answer has already landed.
 * Lowering any of these is how this file stops testing what it is for; the counts are cheap to
 * re-measure and worth re-measuring after any change to the draw.
 *
 * {@link CASES} went from 600 to 1,200 when resets joined the draw. A reset step is a step spent on
 * neither making nor answering, and an answer that crosses one is judged by the generation rather
 * than by its row's counter, so at 600 cases the three counts above fell to 300, 140 and 411. The
 * counts above are what they are because there are twice as many cases, and a smaller share of each
 * case is now about the counter; the suite still runs in well under a second.
 */
const MAKE_BIAS = 0.7
const CASES = 1200

/**
 * How often a step resets the store while an answer is still on the wire.
 *
 * A reset is what an application does when somebody signs out, and the case this file exists to
 * draw around it is an answer arriving after it — so a reset is only ever drawn while at least one
 * request is outstanding. At 0.1, with at most {@link MAX_RESETS} per case, 625 of the 1,200 cases
 * reset at least once, and every one of those 625 has an answer arriving for a request issued
 * before a reset. In 313 of them at least one such answer would have reached the next session's
 * list under the rule this store had before it counted its resets — that number is the one to
 * watch, because it counts the cases that can tell the two rules apart, and if it falls this file
 * has stopped testing what it was extended for. Raising the chance raises it and costs coverage of
 * the per-row counters, which is the trade {@link MAKE_BIAS} describes.
 */
const RESET_CHANCE = 0.1
/** At most this many resets per case, so a case still spends most of its steps on requests. */
const MAX_RESETS = 2
/** Chance that a row the store knew about is loaded again by the session after a reset. */
const SESSION_KEEP = 0.75

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

/** One row of the list the session loads after a reset. */
interface SessionRow {
  id: number
  name: string
}

/**
 * A request is made, one already made is answered, or the store is reset and a new session loads.
 *
 * `make` and `answer` index `requests`. `reset` carries the rows the next session's list holds,
 * which is a subset of the case's ids — so an answer can arrive for a row the new session has under
 * a different name, and for a row it does not have at all.
 */
type Step = { make: number } | { answer: number } | { reset: SessionRow[] }

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
  let resets = 0
  // The loop used to be bounded by `requests.length * 2`, which counts one make and one answer per
  // request. A reset is a step that is neither, so the bound is now the condition it stood for.
  while (made < requests.length || outstanding.length > 0) {
    // Only ever reset with something on the wire: a reset with nothing outstanding tests the same
    // clearing the named tests already cover, and spends a case on it.
    if (outstanding.length > 0 && resets < MAX_RESETS && next() < RESET_CHANCE) {
      resets += 1
      const session = resets
      steps.push({
        reset: ids
          .filter(() => next() < SESSION_KEEP)
          .map((id) => ({ id, name: `session${session}-row-${id}` })),
      })
      continue
    }
    const mustMake = outstanding.length === 0
    const mustAnswer = made === requests.length
    if (!mustAnswer && (mustMake || next() < MAKE_BIAS)) {
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
  const order = steps.map((step) =>
    "make" in step
      ? `make ${step.make}`
      : "answer" in step
      ? `answer ${step.answer}`
      : `reset→session of [${step.reset.map((entry) => entry.id).join("/")}]`
  )
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
 * The rules, restated as a model.
 *
 * Two of them. **Within a session**: an answer older than one already applied is dropped, and only
 * a request with nothing newer behind it settles a slot, which releases the row's other slot too.
 * **Across sessions**: an answer to a request issued before a `reset()` does nothing at all — it
 * touches neither slot, nor the list, nor the notifications — because the session it belongs to is
 * over and the id it names may belong to a different row in the session the store has now.
 *
 * The sequence numbers are deliberately *not* wound back by a reset, because the store does not
 * wind them back either: a model that cleared them would agree with a store that cleared them, and
 * the point of a model is to disagree.
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
  /** Ids the current session's list holds. The list a row is not in cannot show a change to it. */
  const present = new Set<number>(plan.ids)
  const issued = new Map<number, number>()
  const applied = new Map<number, number>()
  const madeIn = new Map<Planned, number>()
  const said: string[] = []
  let generation = 0
  return {
    rows,
    said,
    /** Fold in one request being made, remembering the session it was made in. */
    make(request: Planned) {
      const { row: id, kind, seq } = request
      madeIn.set(request, generation)
      issued.set(id, seq)
      const row = rows.get(id)!
      row.busy[slotOf(kind)] = true
      row.failed[slotOf(kind)] = false
    },
    /** Fold in a reset and the list the next session loads. */
    reset(loaded: SessionRow[]) {
      generation += 1
      const byId = new Map(loaded.map((entry) => [entry.id, entry.name]))
      present.clear()
      for (const [id, row] of rows) {
        // Every slot is cleared outright rather than settled, and the new list decides every name:
        // a row the next session does not load is simply not there.
        row.busy = [false, false]
        row.failed = [false, false]
        row.deleted = false
        const name = byId.get(id)
        row.name = name ?? "missing"
        if (name !== undefined) present.add(id)
      }
    },
    /** Fold in one answer, in the order the answers arrive. */
    answer(request: Planned) {
      const { row: id, kind, seq, answer, name, deletedAt } = request
      // The answer belongs to a session the store has left. It is returned to its caller, which
      // this file never reads, and changes nothing the store shows.
      if (madeIn.get(request) !== generation) return

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
      // that a response body replaces the held row, whichever operation asked for it. A row the
      // current session never loaded is not in the list, so there is nothing to replace — the
      // store still announces the write, because the request itself succeeded.
      if (present.has(id)) {
        row.name = name
        row.deleted = deletedAt !== null
      }
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
        } else if ("answer" in step) {
          settlers[settlerOf.get(step.answer)!](responseFor(plan.requests[step.answer]))
          await running.get(step.answer)
          model.answer(plan.requests[step.answer])
        } else {
          // Somebody signed out and somebody else signed in: the store is cleared and the next
          // session's list arrives, carrying its own rows under the same ids.
          store.reset()
          await store.onWs(
            step.reset.map(({ id, name }) => ({ id, name, deletedAt: null })),
            RemoteEvent.LIST,
          )
          model.reset(step.reset)
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
