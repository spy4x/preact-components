/**
 * Shapes shared by the signals state layer.
 *
 * These are plain data types with no imports: the model store's errors, the
 * state of an in-flight operation, the toast port it notifies through. Nothing
 * here reaches for an application singleton — every external concern arrives as
 * a port or a config value.
 */

/**
 * Lifecycle of one in-flight operation.
 *
 * `inProgress` is true between the start of a request and its settlement;
 * `result` and `error` are mutually exclusive once it settles.
 */
export interface OperationState<T, E = StoreError> {
  inProgress: boolean
  result: T | null
  error: E | null
}

/** Either a value or an error — never both, never neither. */
export type OperationResult<T, E = StoreError> =
  | { error: null; result: T }
  | { error: E; result: null }

/** Kind of failure a store operation can report. */
export enum ErrType {
  /** Submitted data did not satisfy the schema. Carries per-field issues. */
  VALIDATION = "VALIDATION",
  /** The request never reached the server, or the reply never came back. */
  CONNECTION = "CONNECTION",
  /** The server answered with a failure status. */
  SERVER = "SERVER",
  /** A payload arrived that the schema could not parse — a response body or a feed item. */
  PAYLOAD = "PAYLOAD",
}

/** One schema issue, flattened for display next to a form field. */
export interface FieldIssue {
  /** arktype error code, for example `"domain"` or `"required"`. */
  code: string
  /** Dotted path of the offending value, for example `"body.lower"`. */
  path: string
  /** Explanation for that value alone, for example `"must be a number (was a string)"`. */
  message: string
}

/**
 * Issues keyed by field path.
 *
 * Paths, not field names: arktype reports `{ address: { city } }` as `"address.city"`, which no
 * `keyof` of the schema's output produces. A field with no issue is absent from the record.
 */
export type ValidationIssues = Record<string, FieldIssue[] | undefined>

/** Submitted data failed validation. */
export interface ValidationError {
  type: ErrType.VALIDATION
  message: "Provided data doesn't seem valid. Check the form validation error messages."
  errors: ValidationIssues
}

/** The request failed before the server answered. */
export interface ConnectionError {
  type: ErrType.CONNECTION
  message: string
}

/** The server answered with a failure status. */
export interface ServerError {
  type: ErrType.SERVER
  status: number
  message: string
}

/** A payload the schema rejected: a response body, or a remote feed item. */
export interface PayloadError {
  type: ErrType.PAYLOAD
  message: string
}

/** Every error a store operation can settle with. Discriminate on `type`. */
export type StoreError = ValidationError | ConnectionError | ServerError | PayloadError

/**
 * Errors a request itself can produce.
 *
 * A payload that does not match the model schema counts as unusable server data
 * rather than a transport failure, so it gets its own kind.
 */
export type RequestError = ConnectionError | ServerError | PayloadError

/** Errors from a response that never reached a usable body. */
export type ResponseError = ConnectionError | ServerError

/**
 * The minimum a row must have for the store to manage it.
 *
 * Only `id` is load-bearing: it is how rows are matched, replaced, and keyed in the
 * per-row operation maps. Soft-delete (`deletedAt`) and freshness (`createdAt`) columns
 * are read structurally and deliberately left `unknown`, and the open index signature is
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
  /** Auto-dismiss delay in milliseconds; `0` keeps the toast until it is dismissed. */
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
