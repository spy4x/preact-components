/**
 * `@spy4x/preact-ui` — Preact + Tailwind primitives.
 *
 * Every component in here takes what it needs through props or ports; none of them import an
 * application's state singleton. Import a single component from its own subpath
 * (`@spy4x/preact-ui/badge`) when the barrel would pull in more than you need.
 */

export {
  Avatar,
  type AvatarFace,
  avatarFace,
  type AvatarFaceInput,
  AvatarGroup,
  type AvatarGroupProps,
  type AvatarMember,
  type AvatarProps,
  type AvatarSize,
  groupLabel,
  type GroupSplit,
  groupSplit,
} from "./avatar.tsx"
export {
  Badge,
  badgeClasses,
  type BadgeColor,
  type BadgeElementProps,
  type BadgeProps,
  type BadgeType,
} from "./badge.tsx"
export {
  type BillingHeadingLevel,
  BillingInterval,
  defaultPlanCardLabels,
  defaultPricingTableLabels,
  defaultUpgradePromptLabels,
  PlanCard,
  type PlanCardLabels,
  type PlanCardProps,
  type PlanPrice,
  type PricingPlan,
  PricingTable,
  type PricingTableLabels,
  type PricingTableProps,
  SubscriptionStatus,
  UpgradePrompt,
  type UpgradePromptLabels,
  type UpgradePromptProps,
} from "./billing.tsx"
export {
  Button,
  buttonClasses,
  type ButtonLinkProps,
  type ButtonOverloads,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./button.tsx"
export { Checkbox, type CheckboxProps, type CheckboxShape } from "./checkbox.tsx"
export {
  Coachmark,
  type CoachmarkCloseReason,
  type CoachmarkPlacement,
  type CoachmarkProps,
  type CoachmarkTarget,
} from "./coachmark.tsx"
export {
  Card,
  CardBody,
  type CardBodyProps,
  CardFooter,
  type CardFooterProps,
  CardHeader,
  type CardHeaderProps,
  type CardProps,
} from "./card.tsx"
export {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  ConfirmDialog,
  type ConfirmDialogProps,
  confirmVariant,
  hasQuestion,
  labelOr,
} from "./confirm-dialog.tsx"
export { CopyBlock, type CopyBlockProps } from "./copy-block.tsx"
export { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
export {
  activeDescendant,
  Combobox,
  type ComboboxKey,
  comboboxKey,
  type ComboboxKeyAction,
  comboboxKeyAction,
  type ComboboxKeyResult,
  type ComboboxListboxContent,
  comboboxListboxId,
  type ComboboxNamingProps,
  comboboxOptionId,
  type ComboboxOptionState,
  type ComboboxProps,
  type ComboboxState,
  defaultGetLabel,
  filterItems,
  fold,
  leavesCombobox,
  listboxContent,
  matchesQuery,
  naming,
  nextComboboxState,
  openingState,
  selectableIndex,
  typingState,
} from "./combobox.tsx"
export {
  DataTable,
  type DataTableBaseProps,
  type DataTableClientProps,
  type DataTableColumn,
  type DataTableColumnAlign,
  type DataTableDataColumn,
  type DataTableDisplayColumn,
  type DataTableMode,
  type DataTablePaging,
  type DataTablePagingBase,
  type DataTableProps,
  type DataTableServerPaging,
  type DataTableServerProps,
  rowKeyAttribute,
} from "./data-table.tsx"
export {
  type AnyDateRangePickerProps,
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePickerProps,
  type DateRangePickerTimeProps,
  type DateRangePresetOption,
} from "./date-range-picker.tsx"
export {
  type DateRangePreset,
  dateRangePresets,
  type DateTimeOccurrences,
  type DateTimeRange,
  type ExactDateTimeRange,
  exactDateTimeRange,
  isValidDateTimeRange,
  occurrenceOf,
  presetForRange,
  type PresetForRangeOptions,
  presetForTimeRange,
  type PresetForTimeRangeOptions,
  rangeForPreset,
  type RangeForPresetOptions,
  rangeForTimePreset,
  type RangeForTimePresetOptions,
  resolveDateTime,
  type ResolvedDateTime,
  type TimeRangePreset,
  timeRangePresets,
  type WallClockOccurrence,
} from "./date-range.ts"
export {
  Dropdown,
  type DropdownBaseProps,
  DropdownItem,
  type DropdownItemProps,
  type DropdownProps,
  type DropdownTriggerName,
  nextMenuIndex,
} from "./dropdown.tsx"
export { EmptyState, type EmptyStateProps } from "./empty-state.tsx"
export {
  EnhancedForm,
  type EnhancedFormLabels,
  type EnhancedFormProps,
  type EnhancedFormStatus,
} from "./enhanced-form.tsx"
export { ErrorBoundary, type ErrorBoundaryProps } from "./error-boundary.tsx"
export { ErrorState, type ErrorStateProps } from "./error-state.tsx"
export {
  Field,
  type FieldChild,
  type FieldControlWiring,
  type FieldProps,
  type FieldWiring,
} from "./field.tsx"
export {
  FileInput,
  type FileInputLabels,
  type FileInputProps,
  type FileRejection,
  matchesAccept,
} from "./file-input.tsx"
export { honeypotField } from "./honeypot.tsx"
export { ImageGallery, type ImageGalleryImage, type ImageGalleryProps } from "./image-gallery.tsx"
export {
  Input,
  type InputProps,
  Select,
  type SelectOption,
  type SelectProps,
  Textarea,
  type TextareaProps,
} from "./input.tsx"
export { InputButton, type InputButtonProps } from "./input-button.tsx"
export {
  Cluster,
  type ClusterAlign,
  type ClusterJustify,
  type ClusterProps,
  Grid,
  type GridColumnWidth,
  type GridProps,
  type LayoutElement,
  Page,
  type PageProps,
  Section,
  type SectionElement,
  type SectionHeadingLevel,
  type SectionProps,
  Stack,
  type StackProps,
} from "./layout.tsx"
export {
  counterText,
  describedImages,
  Lightbox,
  type LightboxImage,
  type LightboxProps,
  SWIPE_MIN_PX,
  swipeStep,
  wrapIndex,
} from "./lightbox.tsx"
export {
  type ClickModifiers,
  followLinkClick,
  isPlainClick,
  Link,
  type LinkClickEvent,
  type LinkClickTarget,
  type LinkProps,
} from "./link.tsx"
export { LoadingSkeleton, type LoadingSkeletonProps } from "./loading-skeleton.tsx"
export { LoadingSpinner, type LoadingSpinnerProps, type SpinnerSize } from "./loading-spinner.tsx"
export {
  backdropClickDismisses,
  type BackdropHitTarget,
  dialogHeldFocus,
  type DialogRect,
  type DialogRole,
  dialogTitleId,
  type DialogTone,
  DISMISS_KEY,
  type FocusableElement,
  isBackdropClick,
  isDismissKey,
  Modal,
  type ModalProps,
  restoreFocus,
  shouldRetargetFocus,
} from "./modal.tsx"
export { MoneyDisplay, type MoneyDisplayProps } from "./money-display.tsx"
export {
  MoneyInput,
  type MoneyInputBounds,
  type MoneyInputEdit,
  type MoneyInputProps,
  type MoneyInputRangeMessage,
  resolveMoneyInputEdit,
} from "./money-input.tsx"
export { Notice, type NoticeProps, type NoticeTone } from "./notice.tsx"
export {
  OnboardingChecklist,
  type OnboardingChecklistProps,
  type OnboardingStep,
  type OnboardingStepAction,
  type OnboardingStepButton,
  type OnboardingStepLink,
} from "./onboarding-checklist.tsx"
export { OnOffButtons, type OnOffButtonsProps } from "./on-off-buttons.tsx"
export {
  MoreMenu,
  type MoreMenuProps,
  PageAction,
  type PageActionProps,
  PageHeader,
  type PageHeaderProps,
  TOUCH_TARGET,
} from "./page-header.tsx"
export { PageTitle, type PageTitleProps } from "./page-title.tsx"
export { pageRange, type PageRangeItem, Pagination, type PaginationProps } from "./pagination.tsx"
export {
  clampProgress,
  formatProgressPercent,
  Progress,
  type ProgressProps,
  type ProgressTone,
  progressWidthPercent,
} from "./progress.tsx"
export {
  Radio,
  RadioGroup,
  type RadioGroupProps,
  type RadioOption,
  type RadioProps,
} from "./radio.tsx"
export {
  acquireScrollLock,
  applyScrollLock,
  clientWidthWithoutScrollbar,
  type ScrollLock,
  type ScrollLockHost,
  scrollLockPadding,
  type ScrollLockTarget,
} from "./scroll-lock.ts"
export {
  SettingGroup,
  type SettingGroupProps,
  SettingList,
  type SettingListProps,
  SettingRow,
  type SettingRowProps,
} from "./setting-row.tsx"
export {
  type ComparisonRow,
  ComparisonTable,
  type ComparisonTableLabels,
  type ComparisonTableProps,
  type ComparisonValue,
  defaultComparisonTableLabels,
} from "./comparison-table.tsx"
export { StatusMark, type StatusMarkProps, type StatusMarkStatus } from "./status-mark.tsx"
export { Table, type TableProps } from "./table.tsx"
export { nextTabIndex, type TabItem, Tabs, type TabsProps } from "./tabs.tsx"
export {
  addTags,
  type AddTagsResult,
  splitTagText,
  TagInput,
  type TagInputKeyAction,
  tagInputKeyAction,
  type TagInputProps,
  tagSuggestions,
} from "./tag-input.tsx"
export {
  defaultToastActionDuration,
  defaultToastDuration,
  resolveDuration,
  type ToastAction,
  type ToastCorner,
  type ToastId,
  type ToastItem,
  Toastr,
  type ToastrProps,
  type ToastVariant,
} from "./toastr.tsx"
export { ToggleField, type ToggleFieldProps } from "./toggle-field.tsx"
export { ToggleSwitch, type ToggleSwitchProps } from "./toggle-switch.tsx"
export { Tooltip, type TooltipPlacement, type TooltipProps } from "./tooltip.tsx"
export { Tour, type TourCloseReason, type TourProps, type TourStep } from "./tour.tsx"
export {
  type ImageElementLike,
  resolveImage,
  ZoomableImages,
  type ZoomableImagesProps,
} from "./zoomable-images.tsx"
export {
  ariaKeyShortcuts,
  clickByHotkey,
  firesInFields,
  type HotkeyBinding,
  hotkeyClickBinding,
  type HotkeyPress,
  type HotkeyProps,
  pickHotkey,
  useApplePlatform,
  useHotkeyClick,
  useHotkeys,
  type UseHotkeysOptions,
} from "./hotkeys.ts"
export { useSucceeded } from "./use-succeeded.ts"
export { Kbd, KBD_LABELS, type KbdLabels, type KbdProps, type KeyFace, keyFaces } from "./kbd.tsx"
export {
  groupShortcuts,
  type Shortcut,
  type ShortcutGroup,
  ShortcutsDialog,
  type ShortcutsDialogProps,
} from "./shortcuts-dialog.tsx"
export {
  CommandPalette,
  type CommandPaletteBaseProps,
  type CommandPaletteGroup,
  type CommandPaletteLabels,
  type CommandPaletteLocalProps,
  type CommandPaletteOption,
  type CommandPaletteProps,
  type CommandPaletteRemoteProps,
  defaultCommandPaletteLabels,
  groupOptions,
  rankOptions,
} from "./command-palette.tsx"
export { InlineEdit, inlineEditCommit, type InlineEditProps } from "./inline-edit.tsx"
export {
  type ToggleChipOption,
  ToggleChips,
  toggleChipSelection,
  type ToggleChipsMultipleProps,
  type ToggleChipsProps,
  type ToggleChipsSingleProps,
} from "./toggle-chips.tsx"
export {
  defaultKanbanLabels,
  KanbanBoard,
  type KanbanBoardLabels,
  type KanbanBoardProps,
  type KanbanColumn,
  type KanbanItem,
  type KanbanMove,
  type KanbanPlace,
  type KanbanSlot,
  moveKanbanItem,
  nextKanbanSlot,
} from "./kanban-board.tsx"
export {
  defaultSortableListLabels,
  edgeScrollStep,
  type SortableBox,
  type SortableItem,
  SortableList,
  type SortableListLabels,
  type SortableListProps,
  sortableOffsets,
  type SortablePlace,
  sortableTarget,
} from "./sortable-list.tsx"
export {
  defaultThemeToggleLabels,
  ThemeToggle,
  type ThemeToggleLabels,
  type ThemeToggleProps,
  type ThemeToggleStore,
} from "./theme-toggle.tsx"
export {
  createLeaveGuard,
  defaultUnsavedGuardLabels,
  guardedHref,
  type LeaveGuard,
  type UnsavedClick,
  UnsavedGuard,
  type UnsavedGuardLabels,
  type UnsavedGuardProps,
  type UnsavedLink,
} from "./unsaved-guard.tsx"
