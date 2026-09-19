/**
 * `@preact-components/ui` — Preact + Tailwind primitives.
 *
 * Every component in here takes what it needs through props or ports; none of them import an
 * application's state singleton. Import a single component from its own subpath
 * (`@preact-components/ui/badge`) when the barrel would pull in more than you need.
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
  initials,
} from "./avatar.tsx"
export { Badge, type BadgeColor, type BadgeProps, type BadgeType } from "./badge.tsx"
export {
  Button,
  buttonClasses,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./button.tsx"
export { Checkbox, type CheckboxProps } from "./checkbox.tsx"
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
  clampConfidence,
  ConfidenceMeter,
  type ConfidenceMeterProps,
  type ConfidenceTier,
} from "./confidence-meter.tsx"
export {
  ConfirmDialog,
  type ConfirmDialogProps,
  confirmVariant,
  requireLabel,
} from "./confirm-dialog.tsx"
export { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
export { CopyableText, type CopyableTextProps } from "./copyable-text.tsx"
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
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePickerProps,
  type DateRangePresetOption,
} from "./date-range-picker.tsx"
export {
  addDays,
  calendarDateInZone,
  type DateRange,
  type DateRangePreset,
  dateRangePresets,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatIsoDate,
  isSameDay,
  isValidDateRange,
  parseIsoDate,
  presetForRange,
  type PresetForRangeOptions,
  rangeForPreset,
  type RangeForPresetOptions,
  shiftMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "./date-range.ts"
export { Dropdown, type DropdownProps } from "./dropdown.tsx"
export { EmptyState, type EmptyStateProps } from "./empty-state.tsx"
export { ErrorState, type ErrorStateProps } from "./error-state.tsx"
export {
  Field,
  type FieldChild,
  type FieldControlWiring,
  type FieldProps,
  type FieldWiring,
} from "./field.tsx"
export { GeoButton, type GeoButtonProps, type GeoCoordinates } from "./geo-button.tsx"
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
export { LoadingScreen, type LoadingScreenProps } from "./loading-screen.tsx"
export { LoadingSkeleton, type LoadingSkeletonProps } from "./loading-skeleton.tsx"
export { LoadingSpinner, type LoadingSpinnerProps, type SpinnerSize } from "./loading-spinner.tsx"
export {
  applyScrollLock,
  backdropClickDismisses,
  type BackdropHitTarget,
  clientWidthWithoutScrollbar,
  dialogHeldFocus,
  type DialogRect,
  dialogTitleId,
  type DialogTone,
  DISMISS_KEY,
  type FocusableElement,
  isBackdropClick,
  isDismissKey,
  Modal,
  type ModalProps,
  restoreFocus,
  type ScrollLock,
  type ScrollLockHost,
  scrollLockPadding,
  type ScrollLockTarget,
  shouldRetargetFocus,
} from "./modal.tsx"
export { OnOffButtons, type OnOffButtonsProps } from "./on-off-buttons.tsx"
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
export { Table, type TableProps } from "./table.tsx"
export { nextTabIndex, type TabItem, type TabOrientation, Tabs, type TabsProps } from "./tabs.tsx"
export { type ToastItem, Toastr, type ToastrProps, type ToastVariant } from "./toastr.tsx"
export { ToggleSwitch, type ToggleSwitchProps } from "./toggle-switch.tsx"
export { Tooltip, type TooltipPlacement, type TooltipProps } from "./tooltip.tsx"
