/**
 * `@preact-components/system` — application chrome and platform integration.
 *
 * Everything here is props-and-ports: no component imports an app's state singleton, and the few
 * pieces that do touch the browser (`SWUpdater`) expose their logic as pure functions so it can be
 * tested and replaced. Import a single component from its own subpath
 * (`@preact-components/system/calendar`) when the barrel would pull in more than you need.
 */

export {
  BlogImageEnhancer,
  type BlogImageEnhancerProps,
  type ImageElementLike,
  type LightboxImage,
  resolveImage,
} from "./blog-image-enhancer.tsx"
export {
  Calendar,
  type CalendarDay,
  type CalendarDayReason,
  type CalendarLabels,
  type CalendarProps,
  describeCalendarDay,
} from "./calendar.tsx"
export {
  addDaysIso,
  isoDateInTz,
  isoToday,
  isValidTimeZone,
  monthFirstWeekday,
  monthLabel,
  shiftMonth,
  startOfMonth,
  weekdayLabels,
} from "./date.ts"
export {
  breadcrumbFromCanonical,
  type BreadcrumbListItem,
  type BreadcrumbListJsonLd,
  breadcrumbListJsonLd,
  type BreadcrumbOptions,
  breadcrumbsFromCanonical,
  canonicalUrl,
  createHeadStore,
  type Crumb,
  type HeadStore,
  humanizeSlug,
  type OgType,
  type PageHead,
  pathSegments,
} from "./head.ts"
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
  type RegistrationLike,
  reloadOnControllerChange,
  serviceWorkerContainer,
  type ServiceWorkerHost,
  skipWaiting,
  SWUpdater,
  type SWUpdaterProps,
  type UpdateWatcher,
  watchForUpdate,
  type WorkerLike,
} from "./sw-updater.tsx"
