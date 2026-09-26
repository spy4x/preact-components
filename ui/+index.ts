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
  type CiStatus,
  CiStatusPill,
  type CiStatusPillProps,
  normalizeCiStatus,
} from "./ci-status-pill.tsx"
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
  CANCEL_LABEL,
  CONFIRM_LABEL,
  ConfirmDialog,
  type ConfirmDialogProps,
  confirmVariant,
  hasQuestion,
  labelOr,
} from "./confirm-dialog.tsx"
export {
  ContactForm,
  type ContactFormLabels,
  type ContactFormProps,
  type ContactMessage,
} from "./contact-form.tsx"
export { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
export {
  CopyableText,
  CopyableTextBody,
  type CopyableTextBodyProps,
  type CopyableTextProps,
} from "./copyable-text.tsx"
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
  type DataTableColumn,
  type DataTableColumnAlign,
  type DataTableDataColumn,
  type DataTableDisplayColumn,
  type DataTablePaging,
  type DataTableProps,
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
  addDays,
  calendarDateInZone,
  type DateRange,
  type DateRangePreset,
  dateRangePresets,
  type DateTimeRange,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatIsoDate,
  isSameDay,
  isValidDateRange,
  isValidDateTimeRange,
  parseIsoDate,
  presetForRange,
  type PresetForRangeOptions,
  presetForTimeRange,
  type PresetForTimeRangeOptions,
  rangeForPreset,
  type RangeForPresetOptions,
  rangeForTimePreset,
  type RangeForTimePresetOptions,
  shiftMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  type TimeRangePreset,
  timeRangePresets,
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
export { ErrorState, type ErrorStateProps } from "./error-state.tsx"
export { ExportButton, type ExportButtonColumn, type ExportButtonProps } from "./export-button.tsx"
export { type Fact, FactCard, type FactCardProps } from "./fact-card.tsx"
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
  formatBytes,
  matchesAccept,
} from "./file-input.tsx"
export { GeoButton, type GeoButtonProps, type GeoCoordinates } from "./geo-button.tsx"
export { HONEYPOT_FIELD_NAME, honeypotField, honeypotFilled } from "./honeypot.tsx"
export { ImageGallery, type ImageGalleryImage, type ImageGalleryProps } from "./image-gallery.tsx"
export { InstallBox, type InstallBoxProps } from "./install-box.tsx"
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
  wrapIndex,
} from "./lightbox.tsx"
export { LoadingScreen, type LoadingScreenProps } from "./loading-screen.tsx"
export { LoadingSkeleton, type LoadingSkeletonProps } from "./loading-skeleton.tsx"
export { LoadingSpinner, type LoadingSpinnerProps, type SpinnerSize } from "./loading-spinner.tsx"
export { MarginNote, type MarginNoteProps } from "./margin-note.tsx"
export {
  applyScrollLock,
  backdropClickDismisses,
  type BackdropHitTarget,
  clientWidthWithoutScrollbar,
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
  type ScrollLock,
  type ScrollLockHost,
  scrollLockPadding,
  type ScrollLockTarget,
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
export {
  NewsletterForm,
  type NewsletterFormLabels,
  type NewsletterFormProps,
} from "./newsletter-form.tsx"
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
export { StatusMark, type StatusMarkProps, type StatusMarkStatus } from "./status-mark.tsx"
export { Table, type TableProps } from "./table.tsx"
export {
  columnWidthPercents,
  SKELETON_METRICS,
  SkeletonCards,
  type SkeletonCardsProps,
  skeletonCount,
  type SkeletonLineWidth,
  SkeletonStatus,
  type SkeletonStatusProps,
  skeletonStatusRole,
  SkeletonTable,
  type SkeletonTableProps,
  SkeletonText,
  type SkeletonTextProps,
  type TableColumnWidth,
  type TableGeometry,
  tableGeometry,
  tableHeaderHeightRem,
  tableRowHeightRem,
  type TextGeometry,
  textGeometry,
} from "./skeletons.tsx"
export { nextTabIndex, type TabItem, type TabOrientation, Tabs, type TabsProps } from "./tabs.tsx"
export {
  defaultToastDuration,
  resolveDuration,
  type ToastItem,
  Toastr,
  type ToastrProps,
  type ToastVariant,
} from "./toastr.tsx"
export { ToggleField, type ToggleFieldProps } from "./toggle-field.tsx"
export { ToggleSwitch, type ToggleSwitchProps } from "./toggle-switch.tsx"
export { Tooltip, type TooltipPlacement, type TooltipProps } from "./tooltip.tsx"
