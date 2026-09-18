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
 * Ported from `gb/libs/shared/helpers.ts:289-530`, with four changes that are not cosmetic:
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
   * Freshness check for `"updated"` remote events; a stale event is ignored.
   * Defaults to comparing `createdAt`.
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
  /** Runs after `reset()` has cleared the store-owned slices; clear app-owned state here. */
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
  /** Clear the store-owned slices, then run `onReset`. */
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

  /** Report a failed request, unless it is one the host already surfaces. */
  const notify = (error: RequestError, title: string): void => {
    if (isSilentError(error)) return
    toast.error({ title, body: error.message })
  }

  const replaceRow = (row: Row): Row[] =>
    state.value.list.map((existing) => existing.id === row.id ? row : existing)

  async function create(data: SchemaInput<C>): Promise<OperationResult<Row, InputError>> {
    const { error, data: payload } = validate(schemas.create, data)
    if (error) {
      patch({ createOp: { inProgress: false, error, result: null } })
      toast.error({ body: error.message })
      return { error, result: null }
    }

    patch({ createOp: { inProgress: true, error: null, result: null } })
    const outcome = await request(endpoint, jsonRequest("POST", payload), schemas.full)
    if (outcome.error) {
      patch({ createOp: { inProgress: false, error: outcome.error, result: null } })
      notify(outcome.error, `Failed to create ${model}`)
      return { error: outcome.error, result: null }
    }

    patch({
      createOp: { inProgress: false, error: null, result: outcome.result },
      list: [...state.value.list, outcome.result],
    })
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

    setUpdateOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(pathFor(id), jsonRequest("PATCH", payload), schemas.full)
    if (outcome.error) {
      setUpdateOp(id, { inProgress: false, error: outcome.error, result: null })
      notify(outcome.error, `Failed to update ${model}`)
      return { error: outcome.error, result: null }
    }

    setUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
    patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was updated` })
    return { error: null, result: outcome.result }
  }

  async function removeRow(id: number): Promise<OperationResult<Row, RequestError>> {
    setDeleteOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(pathFor(id), { method: "DELETE" }, schemas.full)
    if (outcome.error) {
      setDeleteOp(id, { inProgress: false, error: outcome.error, result: null })
      notify(outcome.error, `Failed to delete ${model}`)
      return { error: outcome.error, result: null }
    }

    setDeleteOp(id, { inProgress: false, error: null, result: outcome.result })
    // Replaced, not spliced: a delete is a soft delete and the row keeps its place in the list.
    patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was deleted` })
    return { error: null, result: outcome.result }
  }

  async function undelete(id: number): Promise<OperationResult<Row, InputError>> {
    setUpdateOp(id, { inProgress: true, error: null, result: null })
    const outcome = await request(undeletePathFor(id), { method: "POST" }, schemas.full)
    if (outcome.error) {
      setUpdateOp(id, { inProgress: false, error: outcome.error, result: null })
      notify(outcome.error, `Failed to restore ${model}`)
      return { error: outcome.error, result: null }
    }

    setUpdateOp(id, { inProgress: false, error: null, result: outcome.result })
    patch({ list: replaceRow(outcome.result) })
    toast.success({ body: `${model} was restored` })
    return { error: null, result: outcome.result }
  }

  async function onWs(items: unknown[], event: RemoteEvent): Promise<void> {
    await applyRemote(items, event)
  }

  /** Parse a remote batch and fold it into the list. A batch that fails to parse is dropped. */
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
  // against the generic `Extra`, so this one assertion stands in for that check. It licenses nothing
  // about the runtime shape: `base` is complete, and the spread adds only what the caller's own
  // callbacks returned.
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

/** Default freshness check: a remote row is newer when its `createdAt` is later. */
function defaultIsNewer<M extends Model>(incoming: M, existing: M): boolean {
  return timestamp(incoming.createdAt) > timestamp(existing.createdAt)
}

/** Best-effort timestamp for an `unknown` row column. Unusable values compare as `0`. */
function timestamp(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function noop(): void {}
