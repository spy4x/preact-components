/**
 * `@preact-components/signals` — the signals state layer.
 *
 * Everything here is either a pure function or a factory that takes its outside world through a
 * port. Nothing imports an application's state singleton, and nothing reads `window`, `document` or
 * `localStorage` before a caller asks for it — {@link createThemeStore} does not touch the DOM until
 * `attach()`.
 *
 * Import one module from its own subpath (`@preact-components/signals/build-model-store`) when the
 * barrel would pull in more than you need. Importing this barrel also evaluates `+signals.tsx`,
 * which patches `Signal.prototype.map` — see that module's JSDoc.
 */

export {
  buildModelStore,
  type BuildModelStoreConfig,
  type InputError,
  type ModelSchemas,
  type ModelStore,
  type ModelStoreBase,
  type ModelStoreContext,
  type ModelStoreRequest,
  type ModelStoreState,
  type StoreStateOf,
} from "./build-model-store.ts"
export {
  CLIPBOARD_UNAVAILABLE,
  type ClipboardPort,
  type ClipboardStore,
  type CopyFeedback,
  createClipboard,
} from "./clipboard.ts"
export { deleteMapEntry, setMapEntry } from "./map-entry.ts"
export { For, Show } from "./+signals.tsx"
export {
  parseSort,
  removeSortRule,
  serializeSort,
  type SortDirection,
  sortRows,
  type SortRule,
  toggleSort,
} from "./table-state.ts"
export {
  createThemeStore,
  type Theme,
  type ThemeMediaQuery,
  type ThemeMediaSource,
  type ThemePorts,
  type ThemePreference,
  type ThemeStorage,
  type ThemeStore,
  ThemeValue,
} from "./theme.ts"
export { createToastStore, type ToastEntry, type ToastOptions, type ToastStore } from "./toast.ts"
export {
  type ConnectionError,
  ErrType,
  type FieldIssue,
  type Model,
  type OperationResult,
  type OperationState,
  type PayloadError,
  RemoteEvent,
  type RequestError,
  type ResponseError,
  type ServerError,
  type StoreError,
  type ToastMessage,
  type ToastPort,
  type ToastVariant,
  type ValidationError,
  type ValidationIssues,
} from "./types.ts"
export {
  type FilterField,
  resolveFilterValue,
  shouldPersistFilter,
  type UrlFilters,
  useUrlFilters,
} from "./use-url-filters.ts"
export {
  connectionError,
  firstIssueMessage,
  isSilentError,
  responseError,
  type SchemaInput,
  type SchemaOutput,
  toValidationError,
  validate,
  type ValidationResult,
} from "./validate.ts"
