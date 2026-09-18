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
  BookingSubmit,
  type BookingSubmitProps,
  emailProblem,
  type FieldProblem,
  fieldProblem,
  type FieldReader,
  type FieldRule,
  type FormValidator,
  gateSubmit,
  resolveTimeZone,
  type SubmitGate,
} from "./booking-submit.tsx"
export { Breadcrumb, type BreadcrumbProps } from "./breadcrumb.tsx"
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
  flattenRoutes,
  hrefSegments,
  orderedRoutes,
  type RouteNode,
  routeSpecificity,
  sortRoutes,
} from "./flatten-routes.ts"
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
export {
  nextThemeMode,
  type ThemeMode,
  ThemeToggle,
  themeToggleLabel,
  type ThemeToggleProps,
} from "./theme-toggle.tsx"
export {
  groupSlotsByPeriod,
  periodFor,
  type TimeSlot,
  type TimeSlotGroup,
  type TimeSlotPeriod,
  timeSlotPeriodLabels,
  TimeSlots,
  type TimeSlotsProps,
} from "./time-slots.tsx"
