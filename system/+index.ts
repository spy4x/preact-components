/**
 * `@spy4x/preact-system` — application chrome and platform integration.
 *
 * Everything here is props-and-ports: no component imports an app's state singleton, and the few
 * pieces that do touch the browser (`SWUpdater`) expose their logic as pure functions so it can be
 * tested and replaced. Import a single component from its own subpath
 * (`@spy4x/preact-system/calendar`) when the barrel would pull in more than you need.
 */

export {
  type AuthCredentials,
  AuthForm,
  type AuthFormError,
  type AuthFormErrorField,
  type AuthFormLabels,
  type AuthFormNames,
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
  ConflictChooser,
  type ConflictChooserLabelOverrides,
  type ConflictChooserLabels,
  type ConflictChooserProps,
  type ConflictItem,
  type ConflictKind,
  DEFAULT_CONFLICT_CHOOSER_LABELS,
  offersKeepMine,
} from "./conflict-chooser.tsx"
export { createHeadStore, type HeadStore, type OgType, type PageHead } from "./head.ts"
export {
  DEFAULT_INSTALL_PROMPT_LABELS,
  InstallPrompt,
  type InstallPromptLabels,
  type InstallPromptProps,
} from "./install-prompt.tsx"
export {
  DEFAULT_PUSH_SETTINGS_LABELS,
  PushSettings,
  type PushSettingsAction,
  type PushSettingsLabels,
  type PushSettingsProps,
  type PushSettingsStatus,
} from "./push-settings.tsx"
export {
  SettingsLayout,
  type SettingsLayoutLabels,
  type SettingsLayoutProps,
  type SettingsSection,
} from "./settings-layout.tsx"
export { pageHeading, type RouteAnnouncerOptions, useRouteAnnouncer } from "./route-announcer.ts"
export {
  AccountMenu,
  type AccountMenuItem,
  type AccountMenuLabels,
  type AccountMenuProps,
  type AccountMenuTheme,
  type AccountMenuUser,
  AccountTag,
} from "./account-menu.tsx"
export {
  Rail,
  RailCell,
  type RailCellProps,
  type RailCurrent,
  RailEntry,
  type RailEntryProps,
  railFocusRing,
  type RailItem,
  type RailLabels,
  type RailMoreTab,
  type RailPlace,
  type RailProps,
  type RailVariant,
  TAB_BAR_SLOTS,
  tabBarSlots,
  type TabBarSplit,
} from "./rail.tsx"
export {
  AppShell,
  type AppShellAccount,
  type AppShellConnection,
  type AppShellItem,
  type AppShellLabels,
  type AppShellNotifications,
  type AppShellProps,
} from "./app-shell.tsx"
export {
  RailShell,
  type RailShellItem,
  type RailShellLabels,
  type RailShellMoreTab,
  type RailShellProps,
  type RailShellSidebarPlace,
} from "./rail-shell.tsx"
export {
  Shell,
  type ShellLabels,
  type ShellNavItem,
  type ShellNavItemAction,
  type ShellProps,
  type ShellSidebarPlace,
  type ShellUser,
  type ShellUserMenuItem,
} from "./shell.tsx"
export {
  DEFAULT_SAVED_COPY_NOTICE_LABELS,
  SavedCopyNotice,
  type SavedCopyNoticeLabels,
  type SavedCopyNoticeProps,
} from "./saved-copy-notice.tsx"
export { type HeadTag, type HeadTagName, SEOHead, seoHeadJsonLd, seoHeadTags } from "./seo-head.tsx"
export {
  SiteFooter,
  type SiteFooterGroup,
  type SiteFooterLink,
  type SiteFooterProps,
} from "./site-footer.tsx"
export {
  isCurrentLink,
  SiteHeader,
  type SiteHeaderLabels,
  type SiteHeaderLink,
  type SiteHeaderProps,
} from "./site-header.tsx"
export {
  readStateInit,
  StateInit,
  type StateInitElementLike,
  type StateInitProps,
  type StateInitSourceLike,
  stateInitText,
} from "./state-init.tsx"
export {
  DEFAULT_SYNC_STATUS_LABELS,
  type SyncState,
  syncState,
  type SyncStateInput,
  SyncStatus,
  type SyncStatusLabels,
  type SyncStatusProps,
} from "./sync-status.tsx"
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
export {
  DEFAULT_UNSENT_CHANGES_DIALOG_LABELS,
  UnsentChangesDialog,
  type UnsentChangesDialogLabels,
  type UnsentChangesDialogProps,
  type UnsentChangesState,
} from "./unsent-changes-dialog.tsx"
