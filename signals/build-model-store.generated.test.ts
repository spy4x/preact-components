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
 * request is made after an answer has already landed in 805 of the 1,200 cases, while two requests
 * are outstanding on one row at once in 614 of them and an answer is actually dropped as stale in
 * 242 — see {@link MAKE_BIAS}.
 *
 * It also resets the store mid-case, which is what an application does when somebody signs out: 714
 * cases reset at least once, and in all 714 an answer arrives for a request that was issued before
 * a reset. In 278 of those the answer has two resets behind it rather than one; in 272 the row it
 * names is one the next session did not load at all; and in 344 the answer would have been written
 * into the next session's list under the rule this store had before it counted its resets — see
 * {@link RESET_CHANCE}. The list the next session loads carries the same ids under different names,
 * so an answer that lands where it should not is visible rather than merely redundant.
 *
 * And somebody else changes a row through the feed while this client is working on it: 1,066 cases
 * carry at least one remote event. Every count below is per case — a case counts once no matter how
 * many qualifying events or answers it carries — using three readings taken straight off the
 * replay: a row is "changed" when its observed name, `updatedAt` or `deleted` flag differs after
 * the step; a row is "busy" when it has a request outstanding (made, not yet answered — by a plain
 * count, not by which answer would settle a slot) the moment the event is delivered; and a row is
 * "remotely written" when the last step that changed it was a remote event rather than this
 * client's own answer. An event is delivered for a busy row in 971 cases, and in 846 of those it
 * actually changes the row — the rest are refused: an `"updated"` event the freshness check judges
 * no later than what is held, or an older `"deleted"` event that lands on a row already archived.
 * This client's own answer is refused by the clock in
 * 505 cases — in 276 of those the row it lost to was one a remote event had written — and accepted
 * over a remotely written row in 191. See {@link REMOTE_CHANCE} and {@link STAMPS}.
 *
 * A `"deleted"` event lands on a row the current session still holds 1,554 times, and 694 of those
 * carry a stamp older than the one the store already has for that row — delayed in transit, or
 * from a client whose own clock is behind. Judged newer, the event replaces the row wholesale, name
 * included, exactly like an `"updated"` one; judged older, it archives the row and leaves every
 * other column, `updatedAt` included, exactly where it was. #201 is the bug the older half
 * replaced, where an older delete overwrote a newer row wholesale and wound its clock back with it;
 * the newer half is what lets an application's own freshness check over a version column defend a
 * delete against an older answer of its own, which advancing only a stamp the check never reads
 * could not.
 *
 * After every step it checks each row's name, its `updatedAt`, whether it is soft-deleted, both
 * operation flags, whether each slot carries an error, and the notifications so far.
 *
 * **What it does not cover.** The freshness rule's own axes — which timestamp columns each side
 * carries, and a model that carries none — are bounded and enumerated beside the fixtures instead;
 * every row here carries `updatedAt` and nothing else, so what this file varies is the instants
 * rather than the columns. Nor does it cover: creates, including a remote `"created"` event for a
 * row a create is outstanding for; `extraOps`; the session watch; `remove`; a batch carrying more
 * than one row; a remote event arriving after a reset; an application-supplied `isNewer`; the body
 * text of a failure notification, only its title; calls made re-entrantly from an effect; and
 * anything about timing beyond the order in which things happen.
 *
 * Three of those are covered by named tests instead, and deliberately. **Creates** have no row
 * identity for a model to key on, and the one thing two creates contend for — the single `createOp`
 * slot — has an enumerable set of orders rather than an open one, so `two creates either side of a
 * reset` in `build-model-store.test.ts` writes both of them out by hand. **The session watch**
 * reaches `reset()` by the same path this file drives directly, and that it does so is pinned by
 * `disowns a request left in flight when the session watch signs the user out`. **What an operation
 * returns to its caller** is read by the named tests for every operation and both outcomes; this
 * file reads only the list and the operation slots, never a returned value and never the `result` a
 * slot carries.
 *
 * The cap of five rows is a cap, not a proof: a store that forgot a row's counter only once six
 * rows had been written to would pass every case here, exactly as one that forgot at four passed
 * while the cap was four. The same goes for the cap of two resets per case. And this file is not a
 * description of the store: it says the rules hold across these axes, never what they are, and a
 * reader who wants to know what the store promises should read the named tests.
 *
 * **Reproducing a failure.** Every case comes from `SEED + index` and nothing else, so it is the
 * same on every machine and every run, and a failed assertion prints that number with the plan it
 * produced: the rows, every request with the answer waiting for it and the instant that answer is
 * stamped, and the interleaving of making, answering, resetting and remote events that the case
 * runs.
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
 * At 0.7 over 1,200 cases: two requests overlap on one row in 614 cases, an answer is actually
 * dropped as stale for its row in 242, and 805 make a request after an answer has already landed.
 * Lowering any of these is how this file stops testing what it is for; the counts are cheap to
 * re-measure and worth re-measuring after any change to the draw.
 *
 * {@link CASES} went from 600 to 1,200 when resets joined the draw. A reset step is a step spent on
 * neither making nor answering, and an answer that crosses one is judged by the generation rather
 * than by its row's counter, so at 600 cases the three counts above fell to 300, 140 and 411. The
 * counts above are what they are because there are twice as many cases, and a smaller share of each
 * case is now about the counter; the suite still runs in well under a second.
 *
 * Remote events, drawn at {@link REMOTE_CHANCE}, are a third kind of step that is neither, and they
 * moved these three counts again — they stood at 599, 273 and 818 before the draw included them.
 * Every number in this file's header was re-measured when that happened rather than carried over,
 * which is the only way any of them stays true.
 */
const MAKE_BIAS = 0.7
const CASES = 1200

/**
 * How often a step resets the store while an answer is still on the wire.
 *
 * A reset is what an application does when somebody signs out, and the case this file exists to
 * draw around it is an answer arriving after it — so a reset is only ever drawn while at least one
 * request is outstanding. At 0.1, with at most {@link MAX_RESETS} per case, 714 of the 1,200 cases
 * reset at least once, and every one of those 714 has an answer arriving for a request issued
 * before a reset. In 344 of them at least one such answer would have reached the next session's
 * list under the rule this store had before it counted its resets — that number is the one to
 * watch, because it counts the cases that can tell the two rules apart, and if it falls this file
 * has stopped testing what it was extended for. Raising the chance raises it and costs coverage of
 * the per-row counters, which is the trade {@link MAKE_BIAS} describes.
 *
 * **What 344 counts, exactly**, because the number depends on the definition. A crossing answer
 * counts when it succeeded, when it was fresh by the old numbering, **and when the next session's
 * list held its row** — so the write it would have made was a real one rather than a `replaceRow`
 * over a list with no such id. Dropping that third condition counts 416 instead, and 416 is the
 * number of answers that would have been *numbered*, not the number that would have been *seen*.
 *
 * Measure it by replaying these plans against the **old** store, not by reasoning about the current
 * one. Under the old rule every answer was numbered, including one from an earlier session, so it
 * advanced its row's counter and could make a later answer stale; the old store had no clock
 * either, so the replay must not apply one. Counting a crossing answer as fresh without that
 * advance — which is how the current store numbers — gives a different number again, and it is the
 * answer to a question nobody asked.
 */
const RESET_CHANCE = 0.1
/** At most this many resets per case, so a case still spends most of its steps on requests. */
const MAX_RESETS = 2
/** Chance that a row the store knew about is loaded again by the session after a reset. */
const SESSION_KEEP = 0.75

/**
 * How often a step delivers a remote event — somebody else changing a row through the feed.
 *
 * The shape this file was extended for is an event overlapping one of this client's own writes, so
 * the event is aimed at a row with a request outstanding {@link REMOTE_ON_BUSY_ROW} of the time
 * and at any of the case's rows otherwise; a plain event with nothing in flight still happens, and
 * still has to be applied correctly. At 0.25 over 1,200 cases — counted per case, a row "changed"
 * by its observed name/`updatedAt`/`deleted` differing and "busy" by a plain outstanding-request
 * count, both read at the moment an event is delivered; see the module header for the full method —
 * 1,066 cases carry at least one event, 971 deliver one for a busy row, and in 846 of those the
 * event changes the row.
 *
 * The two counts to watch are the ones that can tell this rule from the one it replaced: this
 * client's own answer is refused by the clock in 505 cases, 276 of them losing to a row a remote
 * event had written, and accepted over a remotely written row in 191. A store that kept the old
 * "our own answer always wins" would disagree with the model in the first group; one that made a
 * remote event always win would disagree in the second. If either falls, this file has stopped
 * testing what it was extended for.
 */
const REMOTE_CHANCE = 0.25
/** How often a drawn event names a row with a request outstanding rather than any row. */
const REMOTE_ON_BUSY_ROW = 0.8

const dateSchema = type("Date | string.date.iso.parse")
const rowSchema = type({
  id: "number",
  name: "string",
  updatedAt: dateSchema,
  deletedAt: dateSchema.or("null"),
})
const namePayload = type({ name: "string" })

/**
 * Instants a row can be stamped `updatedAt` with.
 *
 * The clock decides which of two changes to a row the list keeps, so a file that stamped every row
 * the same instant would exercise only the tie. A list loads at {@link LOADED_STAMP}, in the middle
 * of the range, and every answer and every event draws uniformly from all five — so each is earlier
 * than a freshly loaded row two times in five, later two times in five, and a tie the rest.
 */
const STAMPS = [0, 1, 2, 3, 4].map((day) => Date.UTC(2024, 4, 1 + day))
/** The stamp every row carries when a session's list loads. */
const LOADED_STAMP = 2

/** The `updatedAt` a drawn stamp index becomes on the wire. */
function stampedAt(index: number): Date {
  return new Date(STAMPS[index])
}

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
 * One request. `seq` is its position in its own row's sequence; `name`, `deletedAt` and `stamp` are
 * the row a successful answer carries back, which is what the store weighs against the held row.
 */
interface Planned {
  row: number
  kind: Kind
  seq: number
  answer: Answer
  name: string
  deletedAt: Date | null
  stamp: number
}

/**
 * One remote event: what somebody else did to a row, arriving through the feed.
 *
 * It carries a single row, because a batch adds nothing the model would not already say — every
 * row in a batch is folded in independently — and costs every case a wider plan to print.
 */
interface RemoteChange {
  event: RemoteEvent.UPDATED | RemoteEvent.DELETED
  id: number
  name: string
  stamp: number
  deleted: boolean
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
 * A request is made, one already made is answered, a remote event arrives, or the store is reset
 * and a new session loads.
 *
 * `make` and `answer` index `requests`. `reset` carries the rows the next session's list holds,
 * which is a subset of the case's ids — so an answer can arrive for a row the new session has under
 * a different name, and for a row it does not have at all. `remote` is somebody else's change,
 * usually to a row this client has a request outstanding on.
 */
type Step =
  | { make: number }
  | { answer: number }
  | { reset: SessionRow[] }
  | { remote: RemoteChange }

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
    const stamp = Math.floor(next() * STAMPS.length)
    requests.push({ row, kind, seq, answer, name: `answer-${index}`, deletedAt, stamp })
  }

  // Requests are made and answered in one interleaved order, so a row can be written to again
  // after its first write has settled — which is the ordinary thing a user does, and something a
  // plan that made every request up front could never produce.
  const steps: Step[] = []
  const outstanding: number[] = []
  let made = 0
  let resets = 0
  let events = 0
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
    // Somebody else changes a row, usually one this client is mid-write on. A remote event is
    // neither a make nor an answer, so it cannot stop the loop making progress; the bound is the
    // condition above.
    if (next() < REMOTE_CHANCE) {
      const busy = outstanding.map((index) => requests[index].row)
      const id = busy.length > 0 && next() < REMOTE_ON_BUSY_ROW ? pick(busy) : pick(ids)
      const event = next() < 0.5 ? RemoteEvent.UPDATED : RemoteEvent.DELETED
      steps.push({
        remote: {
          event,
          id,
          name: `remote-${events++}`,
          stamp: Math.floor(next() * STAMPS.length),
          // An `"updated"` event may archive a row or restore one — the scaffold's archive checkbox
          // is an update — so the deletion is drawn rather than implied by the kind of event.
          deleted: event === RemoteEvent.DELETED || next() < 0.25,
        },
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
    `${i}:${r.kind}(row ${r.row}, seq ${r.seq})→${JSON.stringify(r.answer)}@${r.stamp}${
      r.deletedAt ? "+deleted" : ""
    }`
  )
  const order = steps.map((step) =>
    "make" in step
      ? `make ${step.make}`
      : "answer" in step
      ? `answer ${step.answer}`
      : "remote" in step
      ? `remote ${step.remote.event}(row ${step.remote.id})@${step.remote.stamp}${
        step.remote.deleted ? "+deleted" : ""
      }`
      : `reset→session of [${step.reset.map((entry) => entry.id).join("/")}]`
  )
  return `seed ${seed}; rows ${ids.join("/")}; ${made.join(", ")}; ${order.join(" → ")}`
}

/** Slot a kind writes: 0 is the update slot, which an undelete shares; 1 is the delete slot. */
function slotOf(kind: Kind): 0 | 1 {
  return kind === "delete" ? 1 : 0
}

/**
 * One row as the model and the store should both describe it. `busy` and `failed` are by slot.
 *
 * `stamp` is the held row's `updatedAt` in milliseconds, `null` when the list does not hold the row
 * at all. It is compared as well as the name because the clock rule turns on it: a store that kept
 * the right name while leaving the stamp behind would judge the next change against the wrong
 * instant, and a comparison of names alone would not notice until that next change.
 */
interface RowState {
  name: string
  deleted: boolean
  stamp: number | null
  busy: [boolean, boolean]
  failed: [boolean, boolean]
}

/**
 * The rules, restated as a model.
 *
 * Three of them govern this client's own answer. **Within a session**: an answer older than one
 * already applied is dropped, and only a request with nothing newer behind it settles a slot, which
 * releases the row's other slot too. **Across sessions**: an answer to a request issued before a
 * `reset()` does nothing at all — it touches neither slot, nor the list, nor the notifications —
 * because the session it belongs to is over and the id it names may belong to a different row in
 * the session the store has now. **Against the clock**: the held row is replaced wholesale only by
 * something at least as late as it, whether that something is a remote `"updated"` event or this
 * client's own answer, and where the two are the same instant the incoming one wins.
 *
 * A `"deleted"` event is judged by the same clock, but not held to the same replacement: judged
 * later, it too replaces the held row wholesale; judged older, it is narrower — a claim about
 * archiving only, so it moves `deleted` and leaves the name and the stamp exactly as held. See
 * #201.
 *
 * The three apply in that order and each can only refuse, which is why the model can apply them in
 * that order too: a disowned answer never reaches the counter, an answer stale by the counter never
 * reaches the clock, and an answer the clock refuses still settles its slot and still announces
 * itself, because the write did happen at the server.
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
      stamp: STAMPS[LOADED_STAMP],
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
        row.stamp = name === undefined ? null : STAMPS[LOADED_STAMP]
        if (name !== undefined) present.add(id)
      }
    },
    /**
     * Fold in one remote event: somebody else's change, arriving through the feed.
     *
     * It touches neither an operation slot nor the notifications — the store writes only the list
     * for an event — and a row the current session's list does not hold has nothing to change.
     */
    remote({ event, id, name, stamp, deleted }: RemoteChange) {
      if (!present.has(id)) return
      const row = rows.get(id)!
      // An `"updated"` event is weighed against the held row wholesale: an older one changes
      // nothing, a later one replaces the name and the stamp together.
      if (event === RemoteEvent.UPDATED) {
        if (STAMPS[stamp] < row.stamp!) return
        row.name = name
        row.deleted = deleted
        row.stamp = STAMPS[stamp]
        return
      }
      // A `"deleted"` event judged later than the held row is adopted wholesale, exactly like an
      // `"updated"` one — its columns are the newest known state of the row, not an old copy.
      if (STAMPS[stamp] >= row.stamp!) {
        row.name = name
        row.deleted = deleted
        row.stamp = STAMPS[stamp]
        return
      }
      // Judged older, it may only turn an unarchived row into an archived one — the name and the
      // stamp are left exactly as held either way, and an old copy of the row must not ride in on
      // a delayed delete. The guard mirrors the store's: an already-archived row keeps its own
      // `deletedAt` rather than the event's. Neither that guard nor an older event with nothing to
      // archive (`deleted: false`, which the generator never draws) can move this model's
      // `deleted`, a boolean with no instant of its own to compare — every synthetic `deletedAt`
      // in this file is the one constant `DELETED_AT` — so both are pinned by name only, in
      // `build-model-store.test.ts`. See #201.
      if (!row.deleted && deleted) row.deleted = true
    },
    /** Fold in one answer, in the order the answers arrive. */
    answer(request: Planned) {
      const { row: id, kind, seq, answer, name, deletedAt, stamp } = request
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
      //
      // The clock is the last of the three rules and it governs the list alone: an answer older
      // than the row the list now holds — a remote event landed while this was on the wire —
      // changes nothing there, and still settles its slot above and still announces itself below.
      if (present.has(id) && STAMPS[stamp] >= row.stamp!) {
        row.name = name
        row.deleted = deletedAt !== null
        row.stamp = STAMPS[stamp]
      }
      said.push(WORDS[kind][0])
    },
  }
}

const DELETED_AT = new Date("2024-03-01T00:00:00.000Z")

function responseFor({ row, name, answer, deletedAt, stamp }: Planned): Response | Error {
  if (answer === "offline") return new Error("network down")
  if (answer === "malformed") return Response.json({ id: "not a number" })
  if (answer !== "row") return Response.json({ error: "rejected" }, { status: answer.status })
  return Response.json({ id: row, name, deletedAt, updatedAt: stampedAt(stamp) })
}

/** What the store shows for one row, in the shape the model describes. */
function observe(store: ReturnType<typeof storeFor>, id: number): RowState {
  const held = store.state.value.list.find((candidate) => candidate.id === id)
  const update = store.op.update(id).value
  const remove = store.op.delete(id).value
  return {
    name: held?.name ?? "missing",
    deleted: Boolean(held?.deletedAt),
    stamp: held ? held.updatedAt.getTime() : null,
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
        plan.ids.map((id) => ({
          id,
          name: `row-${id}`,
          deletedAt: null,
          updatedAt: stampedAt(LOADED_STAMP),
        })),
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
        } else if ("remote" in step) {
          // Somebody else saved or deleted the row, and the feed says so while this client may
          // still be waiting for an answer of its own about it.
          const { event, id, name, stamp, deleted } = step.remote
          await store.onWs(
            [{ id, name, deletedAt: deleted ? DELETED_AT : null, updatedAt: stampedAt(stamp) }],
            event,
          )
          model.remote(step.remote)
        } else {
          // Somebody signed out and somebody else signed in: the store is cleared and the next
          // session's list arrives, carrying its own rows under the same ids.
          store.reset()
          await store.onWs(
            step.reset.map(({ id, name }) => ({
              id,
              name,
              deletedAt: null,
              updatedAt: stampedAt(LOADED_STAMP),
            })),
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
