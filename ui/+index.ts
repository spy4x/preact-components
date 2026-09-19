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
export {
  clampConfidence,
  ConfidenceMeter,
  type ConfidenceMeterProps,
  type ConfidenceTier,
} from "./confidence-meter.tsx"
export { CopyButton, type CopyButtonProps } from "./copy-button.tsx"
export { Dropdown, type DropdownProps } from "./dropdown.tsx"
export { ErrorState, type ErrorStateProps } from "./error-state.tsx"
export { GeoButton, type GeoButtonProps, type GeoCoordinates } from "./geo-button.tsx"
export { LoadingScreen, type LoadingScreenProps } from "./loading-screen.tsx"
export { LoadingSkeleton, type LoadingSkeletonProps } from "./loading-skeleton.tsx"
export { LoadingSpinner, type LoadingSpinnerProps, type SpinnerSize } from "./loading-spinner.tsx"
export { OnOffButtons, type OnOffButtonsProps } from "./on-off-buttons.tsx"
export { PageTitle, type PageTitleProps } from "./page-title.tsx"
export { Table, type TableProps } from "./table.tsx"
export { type ToastItem, Toastr, type ToastrProps, type ToastVariant } from "./toastr.tsx"
export { ToggleSwitch, type ToggleSwitchProps } from "./toggle-switch.tsx"
