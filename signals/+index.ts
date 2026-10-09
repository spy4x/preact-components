/**
 * `@spy4x/preact-signals` — the signals state layer.
 *
 * Everything here is either a pure function or a factory that takes its outside world through a
 * port. Nothing imports an application's state singleton, and nothing reads `window`, `document` or
 * `localStorage` before a caller asks for it — {@link createThemeStore} does not touch the DOM until
 * `attach()`.
 *
 * Import one module from its own subpath (`@spy4x/preact-signals/build-model-store`) when the
 * barrel would pull in more than you need. Importing it changes nothing globally: this package
 * renders nothing, augments no prototype and registers no listener.
 */

export {
  buildModelStore,
  type BuildModelStoreConfig,
  DEFAULT_MODEL_STORE_MESSAGES,
  type InputError,
  type ModelSchemas,
  type ModelStore,
  type ModelStoreBase,
  type ModelStoreContext,
  type ModelStoreMessages,
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
export {
  createOnlineStatus,
  type OnlineNavigator,
  type OnlinePorts,
  type OnlineStatus,
  type OnlineTarget,
} from "./online.ts"
export { patchSignal } from "./patch-signal.ts"
export {
  createThemeStore,
  type Theme,
  type ThemeBootstrapOptions,
  themeBootstrapScript,
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
  type Model,
  RemoteEvent,
  type ToastId,
  type ToastMessage,
  type ToastPort,
  type ToastVariant,
} from "./types.ts"
export {
  type FilterField,
  resolveFilterValue,
  shouldPersistFilter,
  type UrlFilters,
  useUrlFilters,
} from "./use-url-filters.ts"
