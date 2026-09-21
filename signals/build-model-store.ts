import { computed, effect, type ReadonlySignal, signal } from "@preact/signals"
import { Type, type } from "arktype"
import { deleteMapEntry, setMapEntry } from "./map-entry.ts"
import {
  ErrType,
  type Model,
  type OperationResult,
  type OperationState,
  RemoteEvent,
  type RequestError,
  type ToastPort,
  type ValidationError,
} from "./types.ts"
import {
  connectionError,
  firstIssueMessage,
  isSilentError,
  responseError,
  type SchemaInput,
  type SchemaOutput,
  validate,
} from "./validate.ts"

/**
 * `@preact-components/signals/build-model-store` — a signals CRUD store for one REST collection.
 *
 * Ported from `gb/libs/shared/helpers.ts:289-530`, with these changes, none of them cosmetic:
 *
 * - **arktype in, not zod.** Schemas are arktype `Type`s, a payload is parsed once rather than
 *   twice, and the row type is derived from the full schema instead of declared beside it.
 * - **Immutable updates.** Per-row operation state lives in `Map`s that are copied on every write,
 *   so a signal's value never mutates in place and a consumer can compare identity to know what
 *   changed.
 * - **No domain in the generic type.** `turn`, `dimming`, `resetEnergy`, `resetRunningTime`,
 *   `switchControlBySensor` and `setPassword` were hardcoded into the "generic" store; they are
 *   gone, and `extraOps` is where they belong.
 * - **Honest lookups.** `op.delete` is not optional, and `one.byId` says `undefined` when the row is
 *   absent, which is what removed the nine `as XStore & {op: …}` casts downstream.
 * - **Ordered by request, not by arrival.** Every write to a row is numbered, and an answer that
 *   belongs to a request older than one already answered is dropped rather than applied. Without
 *   it, two quick edits leave whichever answer came back last in the store, and an operation's
 *   "in progress" flag drops while a later write is still outstanding.
 * - **Scoped to a session.** The store counts its resets, and an answer to a request issued before
 *   a reset writes nothing after it. Without that, a save still on the wire when the user signed
 *   out landed in the next session's list under the same row id.
 * - **One clock over the list.** An `"updated"` remote event and the answer to this client's own
 *   request are both weighed against the row the list holds, by the same freshness check, and the
 *   later of the two wins. Without it our own answer always won, so a row another user deleted
 *   while our write was on the wire came back on screen when the write answered. A `"deleted"` or
 *   a `"list"` event is weighed against nothing and replaces what it names outright, as before.
 */

/** Payload and row schemas for a model. */
export interface ModelSchemas<F extends Type<Model>, C extends Type, U extends Type> {
  /** Full row: every response body and every remote item is parsed through it. */
  full: F
  /** Create payload, without the server-owned columns. */
  create: C
  /** Update payload; its fields are typically all optional. */
  update: U
}

/**
 * Errors an operation that carries a payload settles with.
 *
 * `create` and `update` differ only in which schema produced the rejection; the error itself has no
 * schema in its type, because arktype reports nested failures as dotted paths that no `keyof` of the
 * schema produces.
 */
export type InputError = ValidationError | RequestError

/**
 * State a model store keeps.
 *
 * The store owns this shape. An application adds its own signals for its own operations rather than
 * widening this one — widening is what forced the casts the original type needed.
 */
export interface ModelStoreState<
  M extends Model,
  CreateError = RequestError,
  ItemError = RequestError,
> {
  /** Rows as received. Never reordered, never spliced by a read. */
  list: M[]
  /** Status of the collection load. `onWs` resolves it; an app-owned loader may too. */
  listOp: OperationState<M[], RequestError>
  /** Status of the last create. */
  createOp: OperationState<M, CreateError>
  /** Per-row update status, keyed by row id. */
  updateOps: ReadonlyMap<number, OperationState<M, ItemError>>
  /** Per-row delete status, keyed by row id. */
  deleteOps: ReadonlyMap<number, OperationState<M, RequestError>>
}

/** State of a store built for a given row schema. */
export type StoreStateOf<F extends Type<Model>> = ModelStoreState<
  SchemaOutput<F>,
  InputError,
  InputError
>

/**
 * Fetch, parse and normalise one request. Never throws, never returns a partial result.
 *
 * `schema` parses the body, so a response whose shape drifted from the model is reported as a
 * payload error instead of reaching the UI as a mistyped row.
 */
export interface ModelStoreRequest {
  <R extends Type>(
    url: string,
    init: RequestInit,
    schema: R,
  ): Promise<OperationResult<SchemaOutput<R>, RequestError>>
}

/**
 * What an `extraOps` or `selectors` callback receives.
 *
 * Everything a domain operation needs to behave exactly like a built-in one: where the state lives,
 * how to patch it immutably, and the already-configured request port.
 */
export interface ModelStoreContext<F extends Type<Model>> {
  /** Read-only access to the store state. */
  state: ReadonlySignal<StoreStateOf<F>>
  /** Immutably merge a patch into the state. */
  patch: (patch: Partial<StoreStateOf<F>>) => void
  /** Write one row's update slot. Copies the `Map` rather than mutating it in place. */
  setUpdateOp: (id: number, state: OperationState<SchemaOutput<F>, InputError>) => void
  /** Write one row's delete slot. Copies the `Map` rather than mutating it in place. */
  setDeleteOp: (id: number, state: OperationState<SchemaOutput<F>, RequestError>) => void
  /** Fetch, parse and normalise; returns an error object instead of throwing. */
  request: ModelStoreRequest
  /**
   * The store's generation: how many times `reset()` has run.
   *
   * A domain operation that awaits a request reads this before it starts and passes what it read to
   * {@link ModelStoreContext.isCurrentGeneration} when the answer arrives. An operation that skips
   * that comparison writes an answer belonging to a session the application has already left — a
   * save still on the wire when the user signed out — into the session it has now, which is exactly
   * what the built-in operations no longer do.
   */
  generation: () => number
  /**
   * True while the generation handed in is still the store's own: no `reset()` since it was read.
   *
   * False means the answer in hand belongs to a session that is over. Return it to whoever asked
   * for the operation and write nothing — not the list, not an operation slot, not a notification.
   */
  isCurrentGeneration: (captured: number) => boolean
  /** The notification port the store reports through. */
  toast: ToastPort
  /** Entity name used in copy, for example `"zone"`. */
  model: string
  /** Collection endpoint. */
  endpoint: string
  /** URL of one row. */
  pathFor: (id: number) => string
}

/** Configuration for {@link buildModelStore}. */
export interface BuildModelStoreConfig<
  F extends Type<Model>,
  C extends Type,
  U extends Type,
  Extra = object,
  Selected = object,
> {
  /** Entity name used in notification copy, for example `"zone"`. */
  model: string
  /** Collection endpoint, for example `"/api/zones"`. */
  endpoint: string
  /** Payload and row schemas. */
  schemas: ModelSchemas<F, C, U>
  /** Ordering of `list.all`. The stored array itself is never reordered. */
  sort?: (a: SchemaOutput<F>, b: SchemaOutput<F>) => number
  /** Notification port. Omitted, the store stays silent. */
  toast?: ToastPort
  /** Injected `fetch`, so a test never touches the network. Defaults to the global one. */
  fetch?: typeof fetch
  /** Row URLs, when they differ from the collection convention. */
  paths?: {
    /** Defaults to `` `${endpoint}/${id}` ``. */
    one?: (id: number) => string
    /** Defaults to `` `${endpoint}/${id}/undelete` ``. */
    undelete?: (id: number) => string
  }
  /**
   * Freshness check between a row arriving and the row the list holds; the older one is ignored.
   *
   * It is asked about the two incoming rows that are weighed at all, so one clock orders them
   * against each other: an `"updated"` remote event, and the answer to one of this client's own
   * requests. It is not asked about a `"deleted"` or a `"list"` event, each of which replaces what
   * it names outright. The default compares `updatedAt`, falls back to `createdAt` for a model that
   * has neither side
   * stamped with an `updatedAt`, and accepts the incoming row whenever the two cannot be ordered —
   * including when the model carries no timestamp column at all. See {@link defaultIsNewer}.
   */
  isNewer?: (incoming: SchemaOutput<F>, existing: SchemaOutput<F>) => boolean
  /**
   * Session flag watched by `init()` — a signal, or a getter.
   *
   * While it is truthy the store is considered live. When it goes falsy after having been truthy,
   * `init`'s effect clears the store. This collapses the seventeen byte-identical `init()` bodies in
   * `gb/apps/web/state` into one watched flag, and — unlike them — the effect has a disposer.
   */
  session?: ReadonlySignal<unknown> | (() => unknown)
  /**
   * Runs after `reset()` has cleared the store-owned slices; clear app-owned state here.
   *
   * A request issued from here — or by an effect reacting to the list being cleared — belongs to
   * the **new** session and its answer is applied normally. The generation has already risen by the
   * time either runs, so such a request captures the new number rather than the one being left
   * behind; disowning it would strand its in-progress flag with nothing left to lower it.
   */
  onReset?: () => void
  /** Domain operations, merged onto the returned store. */
  extraOps?: (context: ModelStoreContext<F>) => Extra
  /** Derived signals, merged onto the returned store. */
  selectors?: (context: ModelStoreContext<F>) => Selected
}

/** The part of a model store that is the same for every model. */
export interface ModelStoreBase<F extends Type<Model>, C extends Type, U extends Type> {
  /** Read-only state, for code that needs more than the signals below. */
  state: ReadonlySignal<StoreStateOf<F>>
  list: {
    /** Every row, ordered by `sort` when one was given. */
    all: ReadonlySignal<SchemaOutput<F>[]>
    /** Rows carrying a truthy `deletedAt`. */
    deleted: ReadonlySignal<SchemaOutput<F>[]>
    /** Rows with no `deletedAt`, including models that have no such column. */
    nonDeleted: ReadonlySignal<SchemaOutput<F>[]>
  }
  one: {
    /** `undefined` when no such row is loaded — the honest result of a `find`. */
    byId: (id: number) => ReadonlySignal<SchemaOutput<F> | undefined>
  }
  op: {
    list: ReadonlySignal<OperationState<SchemaOutput<F>[], RequestError>>
    create: ReadonlySignal<OperationState<SchemaOutput<F>, InputError>>
    update: (id: number) => ReadonlySignal<OperationState<SchemaOutput<F>, InputError> | undefined>
    delete: (
      id: number,
    ) => ReadonlySignal<OperationState<SchemaOutput<F>, RequestError> | undefined>
    /** Same slot as `update`: an undelete is an update of the row. */
    undelete: (
      id: number,
    ) => ReadonlySignal<OperationState<SchemaOutput<F>, InputError> | undefined>
  }
  /** Validate, `POST`, and append the created row. */
  create: (data: SchemaInput<C>) => Promise<OperationResult<SchemaOutput<F>, InputError>>
  /** Validate, `PATCH`, and replace the row in place. */
  update: (
    id: number,
    data: SchemaInput<U>,
  ) => Promise<OperationResult<SchemaOutput<F>, InputError>>
  /** `DELETE` one row. The server soft-deletes, so the row stays in the list. */
  delete: (id: number) => Promise<OperationResult<SchemaOutput<F>, RequestError>>
  /** `POST` to the undelete path and replace the row in place. */
  undelete: (id: number) => Promise<OperationResult<SchemaOutput<F>, InputError>>
  /** Drop a row from the local list and clear its operation slots. Sends no request. */
  remove: (id: number) => void
  /** Apply a remote feed event. A batch that fails to parse is rejected whole. */
  onWs: (items: unknown[], event: RemoteEvent) => Promise<void>
  /**
   * Start a new session: clear the store-owned slices, then run `onReset`.
   *
   * Every request already on the wire is disowned by the same call. Its answer is returned to
   * whoever asked for the operation and changes nothing here, so a save made before a sign-out
   * cannot land in the list the next sign-in loads.
   */
  reset: () => void
  /** Start the session watch. Returns its disposer; safe to call twice. */
  init: () => () => void
  /** Run the disposer from `init`. Idempotent. */
  dispose: () => void
}

/** A built store: the common base, plus whatever `extraOps` and `selectors` added. */
export type ModelStore<
  F extends Type<Model>,
  C extends Type,
  U extends Type,
  Extra = object,
  Selected = object,
> = ModelStoreBase<F, C, U> & Extra & Selected

const silentToast: ToastPort = { success: () => {}, error: () => {} }

/**
 * Build a CRUD store for one collection.
 *
 * The row type is derived from `schemas.full`, so no type arguments are needed: the schemas are
 * passed as values and inference does the rest.
 *
 * @example
 * ```ts
 * const dateSchema = type("Date | string.date.iso.parse")
 * const zoneSchema = type({ id: "number", createdAt: dateSchema, deletedAt: dateSchema.or("null"), name: "string" })
 * const zoneCreateSchema = type({ name: "1 <= string <= 255" })
 * const zoneUpdateSchema = type({ name: "string?" })
 *
 * export const zone = buildModelStore({
 *   model: "zone",
 *   endpoint: "/api/zones",
 *   schemas: { full: zoneSchema, create: zoneCreateSchema, update: zoneUpdateSchema },
 *   toast,
 *   sort: (a, b) => a.name.localeCompare(b.name),
 *   session: () => auth.user.value,
 *   extraOps: ({ request, setUpdateOp }) => ({
 *     turn: async (id: number, isOn: boolean) => { … },
 *   }),
 * })
 * ```
 */
export function buildModelStore<
  F extends Type<Model>,
  C extends Type,
  U extends Type,
  Extra = object,
  Selected = object,
>(
  config: BuildModelStoreConfig<F, C, U, Extra, Selected>,
): ModelStore<F, C, U, Extra, Selected> {
  type Row = SchemaOutput<F>
  type State = StoreStateOf<F>

  const { model, endpoint, schemas, sort, paths, onReset, extraOps, selectors } = config
  const toast = config.toast ?? silentToast
  const isNewer = config.isNewer ?? defaultIsNewer
  const request = createRequest(model, config.fetch ?? globalThis.fetch)
  const pathFor = paths?.one ?? ((id: number) => `${endpoint}/${id}`)
  const undeletePathFor = paths?.undelete ?? ((id: number) => `${endpoint}/${id}/undelete`)

  const state = signal<State>({
    list: [],
    listOp: idle(),
    createOp: idle(),
    updateOps: new Map(),
    deleteOps: new Map(),
  })

  /**
   * Merge a patch into the state without touching the previous value.
   *
   * Every caller builds its patch from copies, so `state.value` is a fresh object each time and a
   * `computed` or `effect` reading it always fires.
   */
  const patch = (update: Partial<State>): void => {
    state.value = { ...state.value, ...update }
  }

  const setUpdateOp = (id: number, op: OperationState<Row, InputError>): void => {
    patch({ updateOps: setMapEntry(state.value.updateOps, id, op) })
  }

  const setDeleteOp = (id: number, op: OperationState<Row, RequestError>): void => {
    patch({ deleteOps: setMapEntry(state.value.deleteOps, id, op) })
  }

  /**
   * Request sequences, one per row.
   *
   * Update, undelete and delete of a row draw from the same counter, so the ordering holds across
   * kinds of request: a delete that answers before an older update is the newer request, and the
   * update's answer is dropped instead of resurrecting the row.
   *
   * Entries are never dropped, neither by `remove` nor by `reset`. That used to be the only thing
   * standing between an answer issued before a reset and the slot of a request issued after it;
   * since the store took a generation number such an answer is turned away before it is numbered at
   * all, so surviving a reset is now the second line rather than the first. It is kept because it
   * costs one small object per row the store has ever written to and it still holds if a request
   * path is ever written that forgets to compare generations. See {@link generation}.
   */
  const rowRequests = new Map<number, RequestSequence>()

  /**
   * How many times this store has been reset.
   *
   * Every operation reads it when it issues its request and compares it when the answer arrives.
   * An answer whose reading no longer matches belongs to a session the application has left — the
   * ordinary case is a save still on the wire when the user signed out — so the store writes
   * nothing for it: not the list, not an operation slot, not a notification. The caller that
   * started the operation is still told what the server said, because the promise it is waiting on
   * is about its own request and not about what the store now holds.
   *
   * The counters above order two requests against each other within one session; this orders a
   * request against the session it was made in. Only the second one protects the list, because an
   * answer from the previous session is still the newest thing the store has heard about that row.
   */
  let generation = 0

  /** The store's generation, read when a request is issued. See {@link generation}. */
  const generationNow = (): number => generation

  /** True while `captured` is still the store's generation — no `reset()` has run since. */
  const isCurrentGeneration = (captured: number): boolean => captured === generation

  /**
   * The sequence every create draws from.
   *
   * A create has no id until the server answers, so "the same row" cannot mean a row here. Two
   * creates in flight make two different rows and both belong in the list, so this sequence never
   * suppresses the append — it guards only the one thing the two contend for, the single `createOp`
   * slot, which only the newest create settles.
   */
  const createRequests: RequestSequence = { issued: 0, applied: 0 }

  const sequenceOf = (id: number): RequestSequence => {
    const existing = rowRequests.get(id)
    if (existing) return existing
    const started: RequestSequence = { issued: 0, applied: 0 }
    rowRequests.set(id, started)
    return started
  }

  /**
   * Write a row's update slot, and release its delete slot.
   *
   * Only an answer that settles calls this — the newest request for the row, with nothing newer
   * outstanding. A delete slot still flagged in progress at that moment belongs to a request whose
   * answer will be dropped as stale, and nothing else would ever lower its flag.
   */
  const settleUpdateOp = (id: number, op: OperationState<Row, InputError>): void => {
    patch({
      updateOps: setMapEntry(state.value.updateOps, id, op),
      deleteOps: released(state.value.deleteOps, id),
    })
  }

  /** Write a row's delete slot, and release its update slot. See {@link settleUpdateOp}. */
  const settleDeleteOp = (id: number, op: OperationState<Row, RequestError>): void => {
    patch({
      deleteOps: setMapEntry(state.value.deleteOps, id, op),
      updateOps: released(state.value.updateOps, id),
    })
  }

  /** Report a failed request, unless it is one the host already surfaces. */
  const notify = (error: RequestError, title: string): void => {
    if (isSilentError(error)) return
    toast.error({ title, body: error.message })
  }

  const replaceRow = (row: Row): Row[] =>
    state.value.list.map((existing) => existing.id === row.id ? row : existing)

  /**
   * True when `answer` — the row our own request came back with — may be written over the row the
   * list holds under its id.
   *
   * It is the same `isNewer` a remote `"updated"` event is judged by, and an application that
   * supplied its own is obeyed here too, so one clock decides between everything that can change a
   * row: what this client asked for, and what somebody else did while it was asking. Without it the
   * answer to a request that was already outstanding overwrote a remote change that arrived first,
   * however much later that change was, and a row somebody else had deleted came back on screen.
   *
   * Our own answer is the incoming row, so where the two cannot be ordered — stamps at the same
   * instant, a model carrying no timestamp column at all — it wins. That is the choice that keeps a
   * model with no usable clock behaving exactly as it did before this rule existed, rather than
   * quietly refusing every write; it also matches what the same check does for a remote event.
   *
   * A row the list does not hold is outranked by nothing, because there is nothing to compare
   * against. What the caller does with such an answer still differs: `create` appends it, and the
   * other operations write nothing, since a replacement needs a row to replace. No test can tell
   * that branch from its opposite, and it is written this way for the reader rather than for the
   * behaviour: `create` only asks once it has found the row, and for the other three a
   * `replaceRow` over a list with no such id is a copy of the same list either way.
   */
  const outranksHeldRow = (answer: Row): boolean => {
    const held = state.value.list.find((existing) => existing.id === answer.id)
    return held === undefined || isNewer(answer, held)
  }

  async function create(data: SchemaInput<C>): Promise<OperationResult<Row, InputError>> {
    const { error, data: payload } = validate(schemas.create, data)
    if (error) {
      patch({ createOp: { inProgress: false, error, result: null } })
      toast.error({ body: error.message })
      return { error, result: null }
    }

    const seq = beginRequest(createRequests)
    const issuedIn = generationNow()
    patch({ createOp: { inProgress: true, error: null, result: null } })
    const outcome = await request(endpoint, jsonRequest("POST", payload), schemas.full)
    // Reset while this was on the wire. The row the server made belongs to the session that ended,
    // so appending it would put one session's row in the next session's list.
    if (!isCurrentGeneration(issuedIn)) return outcome
    const answer = answerRights(createRequests, seq)
    if (outcome.error) {
      // Only the shared slot is contended here, so only `settles` is read: a create's own failure
      // is its own news, and is reported whichever of the creates in flight it belongs to.
      if (answer.settles) {
        patch({ createOp: { inProgress: false, error: outcome.error, result: null } })
      }
      notify(outcome.error, `Failed to create ${model}`)
      return { error: outcome.error, result: null }
    }

    // The row is appended whichever create this is: two creates in flight are two different rows,
    // and only the shared `createOp` slot has to pick one of them. The one way the list already
    // holds this id is a remote `"created"` event for this very row arriving first; appending then
    // would show the row twice, so the clock picks between the two copies instead.
    const list = state.value.list.some((existing) => existing.id === outcome.result.id)
      ? outranksHeldRow(outcome.result) ? replaceRow(outcome.result) : state.value.list
      : [...state.value.list, outcome.result]
    patch(
      answer.settles
        ? { createOp: { inProgress: false, error: null, result: outcome.result }, list }
        : { list },
    )
    toast.success({ body: `${model} was created` })
    return { error: null, result: outcome.result }
  }

  async function update(
    id: number,
    data: SchemaInput<U>,
  ): Promise<OperationResult<Row, InputError>> {
    const { error, data: payload } = validate(schemas.update, data)
    if (error) {
      setUpdateOp(id, { inProgress: false, error, result: null })
      toast.error({ body: error.message })
      return { error, result: null }
    }

    const sequence = sequenceOf(id)
    const seq = beginRequest(sequence)
    const issuedIn = generationNow()
    setUpdateOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(pathFor(id), jsonRequest("PATCH", payload), schemas.full)
    // Reset while this was on the wire. `id` may name a different row in the session the store has
    // now, so this answer is returned to its caller and nothing here is written. See `generation`.
    if (!isCurrentGeneration(issuedIn)) return outcome
    const answer = answerRights(sequence, seq)
    if (outcome.error) {
      if (answer.settles) {
        settleUpdateOp(id, { inProgress: false, error: outcome.error, result: null })
      }
      if (answer.fresh) notify(outcome.error, `Failed to update ${model}`)
      return { error: outcome.error, result: null }
    }
    // A newer request for this row has already been answered: this one lost the race it was in,
    // and applying it would put back a value the user has since replaced.
    if (!answer.fresh) return { error: null, result: outcome.result }

    if (answer.settles) {
      settleUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
    }
    // The list keeps whichever of the two is later. A remote event that landed while this was on
    // the wire may already carry a newer version of the row, and writing over it would put back a
    // value somebody else has since changed. The slot above settles either way, because the write
    // did finish, and the notification fires either way, because it did succeed at the server.
    if (outranksHeldRow(outcome.result)) patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was updated` })
    return { error: null, result: outcome.result }
  }

  async function removeRow(id: number): Promise<OperationResult<Row, RequestError>> {
    const sequence = sequenceOf(id)
    const seq = beginRequest(sequence)
    const issuedIn = generationNow()
    setDeleteOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(pathFor(id), { method: "DELETE" }, schemas.full)
    // Reset while this was on the wire; archiving whatever now sits under `id` would archive a row
    // of the new session on the strength of a request belonging to the old one. See `generation`.
    if (!isCurrentGeneration(issuedIn)) return outcome
    const answer = answerRights(sequence, seq)
    if (outcome.error) {
      if (answer.settles) {
        settleDeleteOp(id, { inProgress: false, error: outcome.error, result: null })
      }
      if (answer.fresh) notify(outcome.error, `Failed to delete ${model}`)
      return { error: outcome.error, result: null }
    }
    if (!answer.fresh) return { error: null, result: outcome.result }

    if (answer.settles) {
      settleDeleteOp(id, { inProgress: false, error: null, result: outcome.result })
    }
    // Replaced, not spliced: a delete is a soft delete and the row keeps its place in the list —
    // and replaced only while this answer is the later of it and whatever arrived from elsewhere
    // meanwhile. See the same comparison in `update`.
    if (outranksHeldRow(outcome.result)) patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was deleted` })
    return { error: null, result: outcome.result }
  }

  async function undelete(id: number): Promise<OperationResult<Row, InputError>> {
    const sequence = sequenceOf(id)
    const seq = beginRequest(sequence)
    const issuedIn = generationNow()
    setUpdateOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(undeletePathFor(id), { method: "POST" }, schemas.full)
    // Reset while this was on the wire; restoring whatever now sits under `id` would revive a row
    // of the new session on the strength of a request belonging to the old one. See `generation`.
    if (!isCurrentGeneration(issuedIn)) return outcome
    const answer = answerRights(sequence, seq)
    if (outcome.error) {
      if (answer.settles) {
        settleUpdateOp(id, { inProgress: false, error: outcome.error, result: null })
      }
      if (answer.fresh) notify(outcome.error, `Failed to restore ${model}`)
      return { error: outcome.error, result: null }
    }
    if (!answer.fresh) return { error: null, result: outcome.result }

    if (answer.settles) {
      settleUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
    }
    // A remote change that arrived while this was on the wire and is later than this answer keeps
    // the row: an undelete does not outrank a deletion somebody made after it. See `update`.
    if (outranksHeldRow(outcome.result)) patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was restored` })
    return { error: null, result: outcome.result }
  }

  async function onWs(items: unknown[], event: RemoteEvent): Promise<void> {
    await applyRemote(items, event)
  }

  /**
   * Parse a remote batch and fold it into the list. A batch that fails to parse is dropped.
   *
   * An `"updated"` event is judged against the held row by `isNewer`. A `"deleted"` one is not
   * judged at all: it replaces the held row wholesale, including its `updatedAt`, so a delete
   * carrying an older copy of the row overwrites a newer one and winds that row's clock backwards —
   * which then makes `outranksHeldRow` judge this client's next write against the wrong instant.
   * That is pre-existing behaviour, deliberately left alone here and tracked in #201.
   *
   * What the event leaves in the list is what the answer to any request still on the wire is
   * compared with, so a remote change that arrives first is no longer overwritten by an older
   * answer.
   */
  function applyRemote(items: unknown[], event: RemoteEvent): void {
    const rows: Row[] = []
    for (const item of items) {
      const { error, data } = validate(schemas.full, item)
      if (error) {
        const payloadError: RequestError = {
          type: ErrType.PAYLOAD,
          message: `Malformed ${model} update: ${firstIssueMessage(error) ?? "unknown issue"}`,
        }
        patch({ listOp: { inProgress: false, error: payloadError, result: null } })
        toast.error({ body: payloadError.message })
        return
      }
      rows.push(data)
    }

    switch (event) {
      case RemoteEvent.LIST:
        patch({ list: rows, listOp: { inProgress: false, error: null, result: rows } })
        return
      case RemoteEvent.CREATED:
        patch({
          list: [
            ...state.value.list,
            ...rows.filter((row) => !state.value.list.some((existing) => existing.id === row.id)),
          ],
        })
        return
      case RemoteEvent.UPDATED:
        patch({
          list: state.value.list.map((existing) => {
            const incoming = rows.find((row) => row.id === existing.id)
            return incoming && isNewer(incoming, existing) ? incoming : existing
          }),
        })
        return
      case RemoteEvent.DELETED:
        patch({
          list: state.value.list.map((existing) =>
            rows.find((row) => row.id === existing.id) ?? existing
          ),
        })
    }
  }

  function remove(id: number): void {
    patch({
      list: state.value.list.filter((row) => row.id !== id),
      updateOps: deleteMapEntry(state.value.updateOps, id),
      deleteOps: deleteMapEntry(state.value.deleteOps, id),
    })
  }

  function reset(): void {
    // The one place the generation moves, and the session watch below clears the store by calling
    // this rather than by clearing the slices itself, so there is one way to start a new session.
    //
    // This line stays first. Clearing the slices notifies every subscriber, and `onReset` is the
    // application's own cleanup; either can throw, and a throw from either would leave the number
    // unraised if it were moved below them — so the old session's save would land in the new
    // session's list, which is the failure this counter exists to prevent. Two tests in
    // `buildModelStore across a reset` hold the order.
    generation += 1
    patch({
      list: [],
      listOp: idle(),
      createOp: idle(),
      updateOps: new Map(),
      deleteOps: new Map(),
    })
    onReset?.()
  }

  let stopSession: (() => void) | null = null

  function dispose(): void {
    stopSession?.()
    stopSession = null
  }

  function init(): () => void {
    dispose()
    const session = config.session
    if (!session) return noop

    let wasActive = false
    stopSession = effect(() => {
      const active = Boolean(typeof session === "function" ? session() : session.value)
      if (active) {
        wasActive = true
        return
      }
      // Only a live-then-cleared session clears the store: the first run must not wipe a fresh one.
      if (wasActive) {
        wasActive = false
        reset()
      }
    })
    return dispose
  }

  const all = computed(() => {
    const rows = state.value.list
    // A sorted copy: sorting in place reordered the stored array and so defeated the signal.
    return sort ? [...rows].sort(sort) : rows
  })

  const context: ModelStoreContext<F> = {
    state,
    patch,
    setUpdateOp,
    setDeleteOp,
    request,
    generation: generationNow,
    isCurrentGeneration,
    toast,
    model,
    endpoint,
    pathFor,
  }

  const base: ModelStoreBase<F, C, U> = {
    state,
    list: {
      all,
      deleted: computed(() => all.value.filter((row) => Boolean(row.deletedAt))),
      nonDeleted: computed(() => all.value.filter((row) => !row.deletedAt)),
    },
    one: {
      byId: (id: number) => computed(() => state.value.list.find((row) => row.id === id)),
    },
    op: {
      list: computed(() => state.value.listOp),
      create: computed(() => state.value.createOp),
      update: (id: number) => computed(() => state.value.updateOps.get(id)),
      delete: (id: number) => computed(() => state.value.deleteOps.get(id)),
      undelete: (id: number) => computed(() => state.value.updateOps.get(id)),
    },
    create,
    update,
    delete: removeRow,
    undelete,
    remove,
    onWs,
    reset,
    init,
    dispose,
  }

  // `base` is checked against `ModelStoreBase` above; what follows is only the merge of two
  // optional, caller-supplied objects. TypeScript cannot verify a spread of `Extra | undefined`
  // against the generic `Extra`, so the assertion below stands in for that check. It is the only
  // assertion in this package that cannot be reduced to local narrowing inside one function, and it
  // licenses nothing about the runtime shape: `base` is complete, and the spread adds only what the
  // caller's own callbacks returned.
  return {
    ...base,
    ...selectors?.(context),
    ...extraOps?.(context),
  } as ModelStore<F, C, U, Extra, Selected>
}

/** Build the request port over an injected `fetch`. */
function createRequest(model: string, fetchImpl: typeof fetch): ModelStoreRequest {
  return async function request<R extends Type>(url: string, init: RequestInit, schema: R) {
    let response: Response
    try {
      response = await fetchImpl(url, init)
    } catch (error) {
      return { error: connectionError(errorMessage(error)), result: null }
    }

    if (!response.ok) {
      return { error: await responseError(response), result: null }
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      return { error: malformed(model, errorMessage(error)), result: null }
    }

    const parsed = schema(body)
    if (parsed instanceof type.errors) {
      return { error: malformed(model, parsed.summary), result: null }
    }
    return { error: null, result: parsed }
  }
}

function malformed(model: string, detail: string): RequestError {
  return { type: ErrType.PAYLOAD, message: `Malformed ${model} response: ${detail}` }
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

/** A settled, empty operation slot. */
function idle<T, E>(): OperationState<T, E> {
  return { inProgress: false, error: null, result: null }
}

/**
 * Sequence numbers for one contested slot — one row, or the collection's create slot.
 *
 * `issued` is the number given to the most recently started request; `applied` is the number of the
 * newest request whose answer the store has acted on. Both only ever go up, which is what lets an
 * answer be judged by the request it belongs to rather than by the moment it happens to arrive.
 */
interface RequestSequence {
  issued: number
  applied: number
}

/**
 * What the store may do with an answer that has just arrived.
 *
 * `fresh` is false when a newer request for the same row has already been answered: that answer is
 * the store's truth and this one is discarded. `settles` is true only when no newer request was
 * ever issued, which is the one condition under which an operation slot may stop saying "in
 * progress" — a slot cleared while a newer write is outstanding tells the user the work is
 * finished when it is not.
 *
 * Both are about this client's own requests and neither is the last word on the list. An answer
 * both fresh and settling is still compared against the row the list holds, because something that
 * did not come from this client may have changed it meanwhile; see `outranksHeldRow`. The order is
 * fixed: the session first, then this, then the clock, and each of the three can only refuse.
 */
interface AnswerRights {
  fresh: boolean
  settles: boolean
}

/** Number the next request drawn from `sequence`. */
function beginRequest(sequence: RequestSequence): number {
  sequence.issued += 1
  return sequence.issued
}

/**
 * Decide what the answer to request `seq` may do, and record it.
 *
 * Call it exactly once per answer the store is willing to act on: a fresh answer advances the
 * sequence, so a second ask about the same answer reports it as stale. An answer turned away for
 * belonging to an earlier generation never gets here, and nothing depends on it having been
 * recorded — every request issued after a reset draws a higher number than every request issued
 * before it, because the sequences are never wound back.
 *
 * `settles` implies `fresh`, because the newest request issued is answered at most once and nothing
 * later can have been applied before it.
 */
function answerRights(sequence: RequestSequence, seq: number): AnswerRights {
  const fresh = seq > sequence.applied
  if (fresh) sequence.applied = seq
  return { fresh, settles: seq === sequence.issued }
}

/**
 * The same map with `id`'s in-progress flag lowered.
 *
 * Returns the map itself when there is nothing to lower, so a slot nobody is waiting on does not
 * churn the signal's identity.
 */
function released<T, E>(
  ops: ReadonlyMap<number, OperationState<T, E>>,
  id: number,
): ReadonlyMap<number, OperationState<T, E>> {
  const op = ops.get(id)
  return op?.inProgress ? setMapEntry(ops, id, { ...op, inProgress: false }) : ops
}

/**
 * Columns the default freshness check reads, in the order it prefers them.
 *
 * `updatedAt` first, because that is the column an edit moves. `createdAt` is the fallback for a
 * model that has no `updatedAt` at all, and it is a weak one: it never moves after the row is
 * written, so it can only order two rows that were created at different moments. An edit leaves it
 * standing still, the two values compare equal, and the tie rule below lets the incoming row
 * through — which is why a model that wants its edits ordered has to carry `updatedAt`.
 */
const FRESHNESS_COLUMNS = ["updatedAt", "createdAt"] as const

/**
 * Default freshness check between an incoming row and the one the list holds.
 *
 * The incoming row is an `"updated"` remote event, or the answer to one of this client's own
 * requests; the check does not know which, and that is the point of it being one check.
 *
 * It compares the first of `updatedAt`, `createdAt` that either row carries a usable value for, and
 * accepts the incoming row when that value is at least as late as the stored one. Every other case
 * accepts the incoming row: a pair where neither side carries a usable timestamp at all, and a pair
 * where only one side carries the column being compared. Either kind of incoming row is the server
 * saying this is what the row now is, so where the two cannot be ordered the incoming one wins —
 * dropping it because the model has no clock loses the write, which is what this check exists to
 * prevent, and for a model with no timestamp column that is the whole of the rule.
 *
 * Equal timestamps accept the incoming row too. Two rows stamped the same instant should be the
 * same row, and where they are not, the one that has just arrived is the authority.
 */
function defaultIsNewer<M extends Model>(incoming: M, existing: M): boolean {
  for (const column of FRESHNESS_COLUMNS) {
    const incomingAt = timestamp(incoming[column])
    const existingAt = timestamp(existing[column])
    if (incomingAt === null && existingAt === null) continue
    if (incomingAt === null || existingAt === null) return true
    return incomingAt >= existingAt
  }
  return true
}

/** Best-effort timestamp for an `unknown` row column. `null` when it cannot be read as one. */
function timestamp(value: unknown): number | null {
  if (value instanceof Date) return finite(value.getTime())
  if (typeof value === "number") return finite(value)
  if (typeof value === "string") return finite(new Date(value).getTime())
  return null
}

/** The millisecond count, or `null` when it is `NaN` or infinite. */
function finite(milliseconds: number): number | null {
  return Number.isFinite(milliseconds) ? milliseconds : null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function noop(): void {}
