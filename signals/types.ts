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

/**
 * Kind of a toast, selecting its colour and glyph. Matches `ToastVariant` in `@spy4x/preact-ui`.
 */
export type ToastVariant = "success" | "error" | "info" | "warning"

/**
 * What identifies one toast: the type `ToastStore.remove` takes. Matches `ToastId` in
 * `@spy4x/preact-ui`, which is the type `Toastr`'s `onDismiss` is called with, so the store's
 * `remove` is that port as it stands. The store's own ids are strings; a number is compared as its
 * string form.
 */
export type ToastId = string | number

/**
 * A button on a toast, such as "Undo" after a delete. Matches `ToastAction` in `@spy4x/preact-ui`,
 * which renders it.
 */
export interface ToastAction {
  /** The button's visible text, which is also its accessible name. */
  label: string
  /**
   * Runs when the button is pressed. `Toastr` calls it at most once per toast and then dismisses
   * that toast.
   */
  onAction: () => void
}

/** Notification content the store hands to its toast port. */
export interface ToastMessage {
  /**
   * Caller-supplied id. Reusing one replaces that toast in place — appending would leave two entries
   * a `remove(id)` cannot tell apart. Generated when omitted.
   */
  id?: string
  /**
   * Heading shown above the body by `Toastr`. Omitted, the store fills in its default for the
   * toast's kind; `""` means no heading.
   */
  title?: string
  body: string
  type?: ToastVariant
  /**
   * Auto-dismiss delay in milliseconds, spelled the way `Toastr` spells it in
   * `@spy4x/preact-ui` — one name on both sides of that boundary, so a delay set here is the
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
  /**
   * Test hook: `Toastr` in `@spy4x/preact-ui` puts it on this toast's own element as `data-e2e`,
   * so a test can wait for this one message. Omitted, the toast carries no such attribute.
   */
  dataE2E?: string
  /**
   * A button on the toast, such as "Undo". Under `Toastr` a toast with an action and no `duration`
   * stays ten seconds instead of five, so there is time to reach the button.
   */
  action?: ToastAction
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
