/**
 * Playwright specs for `ui/` components, on the guide's UI page: one file per component under
 * `e2e/ui/`, named after it. `verify --component=<file>` runs one file's specs.
 */
import type { Spec } from "./runner.ts"
import { specs as dialogRow } from "./ui/dialog-row.spec.ts"
import { specs as filterBar } from "./ui/filter-bar.spec.ts"
import { specs as dropdown } from "./ui/dropdown.spec.ts"
import { specs as dashboard } from "./ui/dashboard.spec.ts"
import { specs as explorable } from "./ui/explorable.spec.ts"
import { specs as video } from "./ui/video.spec.ts"
import { specs as button } from "./ui/button.spec.ts"
import { specs as modal } from "./ui/modal.spec.ts"
import { specs as lostInput } from "./ui/lost-input.spec.ts"
import { specs as currencyField } from "./ui/currency-field.spec.ts"
import { specs as moneyInput } from "./ui/money-input.spec.ts"
import { specs as zoomableImages } from "./ui/zoomable-images.spec.ts"
import { specs as comparisonTable } from "./ui/comparison-table.spec.ts"
import { specs as resendButton } from "./ui/resend-button.spec.ts"
import { specs as errorSummary } from "./ui/error-summary.spec.ts"
import { specs as notice } from "./ui/notice.spec.ts"
import { specs as toggleField } from "./ui/toggle-field.spec.ts"
import { specs as copyBlock } from "./ui/copy-block.spec.ts"
import { specs as prose } from "./ui/prose.spec.ts"
import { specs as checklist } from "./ui/checklist.spec.ts"
import { specs as pageHeader } from "./ui/page-header.spec.ts"
import { specs as forwardRef } from "./ui/forward-ref.spec.ts"
import { specs as field } from "./ui/field.spec.ts"
import { specs as onOffButtons } from "./ui/on-off-buttons.spec.ts"
import { specs as loading } from "./ui/loading.spec.ts"
import { specs as unsavedGuard } from "./ui/unsaved-guard.spec.ts"
import { specs as tagInput } from "./ui/tag-input.spec.ts"
import { specs as toggleChips } from "./ui/toggle-chips.spec.ts"
import { specs as radioChips } from "./ui/radio-chips.spec.ts"
import { specs as languagePicker } from "./ui/language-picker.spec.ts"
import { specs as colorField } from "./ui/color-field.spec.ts"
import { specs as iconPicker } from "./ui/icon-picker.spec.ts"
import { specs as comboboxGroup } from "./ui/combobox-group.spec.ts"
import { specs as themePreview } from "./ui/theme-preview.spec.ts"
import { specs as quickAdd } from "./ui/quick-add.spec.ts"
import { specs as confirmDialog } from "./ui/confirm-dialog.spec.ts"
import { specs as decisionCard } from "./ui/decision-card.spec.ts"
import { specs as removal } from "./ui/removal.spec.ts"
import { specs as focusHook } from "./ui/focus-hook.spec.ts"
import { specs as toastr } from "./ui/toastr.spec.ts"
import { specs as coachmark } from "./ui/coachmark.spec.ts"
import { specs as onboardingChecklist } from "./ui/onboarding-checklist.spec.ts"
import { specs as marketingBlocks } from "./ui/marketing-blocks.spec.ts"
import { specs as blogBlocks } from "./ui/blog-blocks.spec.ts"
import { specs as docsBlocks } from "./ui/docs-blocks.spec.ts"
import { specs as storefront } from "./ui/storefront.spec.ts"
import { specs as file } from "./ui/file.spec.ts"
import { specs as statusMark } from "./ui/status-mark.spec.ts"
import { specs as elapsed } from "./ui/elapsed.spec.ts"
import { specs as rowCursor } from "./ui/row-cursor.spec.ts"
import { specs as screenTour } from "./ui/screen-tour.spec.ts"
import { specs as avatar } from "./ui/avatar.spec.ts"
import { specs as commandPalette } from "./ui/command-palette.spec.ts"
import { specs as tabsAndTable } from "./ui/tabs-and-table.spec.ts"
import { specs as tabs } from "./ui/tabs.spec.ts"
import { specs as feedback } from "./ui/feedback.spec.ts"
import { specs as kanbanBoard } from "./ui/kanban-board.spec.ts"
import { specs as combobox } from "./ui/combobox.spec.ts"
import { specs as dismiss } from "./ui/dismiss.spec.ts"
import { specs as smallFixes } from "./ui/small-fixes.spec.ts"
import { specs as segmentedControl } from "./ui/segmented-control.spec.ts"
import { specs as rightToLeft } from "./ui/right-to-left.spec.ts"
import { specs as periodStepper } from "./ui/period-stepper.spec.ts"
import { specs as usageMeter } from "./ui/usage-meter.spec.ts"
import { specs as dateRangePicker } from "./ui/date-range-picker.spec.ts"
import { specs as inlineEdit } from "./ui/inline-edit.spec.ts"
import { specs as copyButton } from "./ui/copy-button.spec.ts"
import { specs as enhancedForm } from "./ui/enhanced-form.spec.ts"

/** Each file's specs, by its name under `e2e/ui/` without `.spec.ts`. */
export const specsByFile: Readonly<Record<string, readonly Spec[]>> = {
  "dialog-row": dialogRow,
  "filter-bar": filterBar,
  dropdown,
  dashboard,
  explorable,
  video,
  button,
  modal,
  "lost-input": lostInput,
  "currency-field": currencyField,
  "money-input": moneyInput,
  "zoomable-images": zoomableImages,
  "comparison-table": comparisonTable,
  "resend-button": resendButton,
  "error-summary": errorSummary,
  notice,
  "toggle-field": toggleField,
  "copy-block": copyBlock,
  prose,
  checklist,
  "page-header": pageHeader,
  "forward-ref": forwardRef,
  field,
  "on-off-buttons": onOffButtons,
  loading,
  "unsaved-guard": unsavedGuard,
  "tag-input": tagInput,
  "toggle-chips": toggleChips,
  "radio-chips": radioChips,
  "language-picker": languagePicker,
  "color-field": colorField,
  "icon-picker": iconPicker,
  "combobox-group": comboboxGroup,
  "theme-preview": themePreview,
  "quick-add": quickAdd,
  "confirm-dialog": confirmDialog,
  "decision-card": decisionCard,
  removal,
  "focus-hook": focusHook,
  toastr,
  coachmark,
  "onboarding-checklist": onboardingChecklist,
  "marketing-blocks": marketingBlocks,
  "blog-blocks": blogBlocks,
  "docs-blocks": docsBlocks,
  storefront,
  file,
  "screen-tour": screenTour,
  avatar,
  "command-palette": commandPalette,
  "tabs-and-table": tabsAndTable,
  tabs,
  feedback,
  "kanban-board": kanbanBoard,
  combobox,
  dismiss,
  "small-fixes": smallFixes,
  "segmented-control": segmentedControl,
  "right-to-left": rightToLeft,
  "period-stepper": periodStepper,
  "usage-meter": usageMeter,
  "date-range-picker": dateRangePicker,
  "inline-edit": inlineEdit,
  "copy-button": copyButton,
  "status-mark": statusMark,
  elapsed,
  "row-cursor": rowCursor,
  "enhanced-form": enhancedForm,
}

export const specs: readonly Spec[] = Object.values(specsByFile).flat()
