/**
 * Shapes shared by the signals state layer.
 *
 * These are plain data types with no imports: the row contract, the remote feed's
 * event kinds, the toast port the store notifies through. Nothing here reaches for
 * an application singleton — every external concern arrives as a port or a config
 * value. The store's errors and operation state come from `@spy4x/platform/universal/errors`
 * and `@spy4x/validation`.
 */

/**
 * The minimum a row must have for the store to manage it.
 *
 * Only `id` is load-bearing: it is how rows are matched, replaced, and keyed in the
 * per-row operation maps. The soft-delete column (`deletedAt`) and the freshness columns
 * (`updatedAt`, and `createdAt` behind it) are read structurally and deliberately left
 * `unknown` — a row may carry either, both or neither — and the open index signature is
 * what lets a schema carrying a morph (`"string.date.iso.parse"`) satisfy
 * `F extends Type<Model>` — arktype's `Type` exposes the morph function in its own
 * structure, so a narrowly typed field would reject every parsing schema.
 */
export interface Model {
  id: number
  [key: string]: unknown
}

/** Event kinds a remote (websocket) feed can announce. */
export enum RemoteEvent {
  /** Full replacement of the collection. */
  LIST = "list",
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
}

/** Kind of a toast, selecting its colour and glyph. Matches `ToastVariant` in `@preact-components/ui`. */
export type ToastVariant = "success" | "error" | "info" | "warning"

/** Notification content the store hands to its toast port. */
export interface ToastMessage {
  /**
   * Caller-supplied id. Reusing one replaces that toast in place — appending would leave two entries
   * a `remove(id)` cannot tell apart. Generated when omitted.
   */
  id?: string
  title?: string
  body: string
  type?: ToastVariant
  /**
   * Auto-dismiss delay in milliseconds, spelled the way `Toastr` spells it in
   * `@preact-components/ui` — one name on both sides of that boundary, so a delay set here is the
   * delay the component runs. `0` keeps the toast until somebody dismisses it.
   *
   * Omitting it leaves the delay to whatever renders the toast; `Toastr` uses five seconds.
   */
  duration?: number
  /**
   * @deprecated Renamed to `duration`, which is what `Toastr` reads. Still accepted for one
   * release so a caller written against the old name keeps working; when both are given,
   * `duration` wins.
   */
  timeout?: number
}

/**
 * Notification port.
 *
 * `buildModelStore` reports through this instead of importing a toast store, so
 * the caller decides where notifications go. {@link createToastStore} satisfies it.
 */
export interface ToastPort {
  success(toast: ToastMessage): void
  error(toast: ToastMessage): void
}
