/**
 * `@preact-components/system` — application chrome and platform integration.
 *
 * Everything here is props-and-ports: no component imports an app's state singleton, and the few
 * pieces that do touch the browser (`SWUpdater`) expose their logic as pure functions so it can be
 * tested and replaced. Import a single component from its own subpath
 * (`@preact-components/system/calendar`) when the barrel would pull in more than you need.
 */

export {
  type AuthCredentials,
  AuthForm,
  type AuthFormError,
  type AuthFormErrorField,
  type AuthFormLabels,
  type AuthFormProps,
  type AuthMode,
  type AuthStep,
} from "./auth-form.tsx"
export {
  Calendar,
  type CalendarDay,
  type CalendarDayReason,
  type CalendarLabels,
  type CalendarProps,
  describeCalendarDay,
} from "./calendar.tsx"
export {
  breadcrumbItems,
  type BreadcrumbListItem,
  type BreadcrumbListJsonLd,
  breadcrumbListJsonLd,
  canonicalUrl,
  createHeadStore,
  type Crumb,
  type HeadStore,
  normalizeCanonical,
  type OgType,
  type PageHead,
} from "./head.ts"
export {
  type ImageElementLike,
  ImageLightbox,
  type ImageLightboxProps,
  type LightboxImage,
  resolveImage,
} from "./image-lightbox.tsx"
export {
  type HeadTag,
  type HeadTagName,
  jsonLdText,
  SEOHead,
  seoHeadJsonLd,
  seoHeadTags,
} from "./seo-head.tsx"
export {
  type ContainerLike,
  DEFAULT_UPDATE_MESSAGE,
  type RegistrationLike,
  reloadOnControllerChange,
  serviceWorkerContainer,
  type ServiceWorkerHost,
  skipWaiting,
  startUpdates,
  SWUpdater,
  type SWUpdaterProps,
  type UpdateStart,
  type UpdateWatcher,
  watchForUpdate,
  type WorkerLike,
} from "./sw-updater.tsx"
