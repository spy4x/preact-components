import {
  dropdownAutoDirectionChecks,
  dropdownChecks,
  dropdownItemDisabledDangerCheck,
  dropdownItemRouteChecks,
} from "./ui/dropdown.ts"
import { toggleSwitchChecks } from "./ui/toggle-switch.ts"
import { onOffButtonsChecks } from "./ui/on-off-buttons.ts"
import { fieldChecks, fieldErrorContrastCheck } from "./ui/field.ts"
import { refForwardingChecks } from "./ui/forward-ref.ts"
import {
  roundCheckboxChecks,
  roundCheckboxColourChecks,
  roundCheckboxFocusRingChecks,
} from "./ui/round-checkbox.ts"
import {
  busyButtonChecks,
  busySubmitChecks,
  buttonLinkChecks,
  hotkeyPropChecks,
  primaryButtonFillCheck,
} from "./ui/button.ts"
import { useSucceededChecks } from "./ui/use-succeeded.ts"
import { linkChecks, linkFocusRingChecks } from "./ui/link.ts"
import { copyBlockChecks, copyBlockNeverClipsCheck } from "./ui/copy-block.ts"
import { copyButtonStatusChecks } from "./ui/copy-button.ts"
import { pageHeaderLayoutChecks, pageHeaderNameCheck } from "./ui/page-header.ts"
import { tooltipChecks } from "./ui/tooltip.ts"
import { comboboxChecks } from "./ui/combobox.ts"
import { toastrChecks } from "./ui/toastr.ts"
import { unsavedGuardChecks } from "./ui/unsaved-guard.ts"
import { dateRangeChecks } from "./ui/date-range-picker.ts"
import { dateRangeTimeChecks } from "./ui/date-range-picker-time.ts"
import { paginationChecks } from "./ui/pagination.ts"
import { dataTableChecks } from "./ui/data-table.ts"
import {
  enhancedFormAsyncFailureCheck,
  enhancedFormBackForwardCacheCheck,
  enhancedFormFailureColourCheck,
  enhancedFormResultChecks,
  enhancedFormsHoneypotChecks,
  enhancedFormsNoScriptChecks,
  enhancedFormSynchronousThrowCheck,
} from "./ui/enhanced-form.ts"
import {
  signUpFormBlurWhileSendingCheck,
  signUpFormDoubleClickCheck,
  signUpFormFocusElsewhereCheck,
  signUpFormRequestSubmitGuardCheck,
} from "./ui/sign-up-form.ts"
import {
  contactFormFailureRetryChecks,
  contactFormHoneypotCheck,
  contactFormStaleSubmitCheck,
} from "./ui/contact-form.ts"
import {
  controlledFormBusyGuardCheck,
  controlledFormFailureFocusCheck,
} from "./ui/controlled-form.ts"
import { dropdownHydrationUpgradeChecks, dropdownNoScriptChecks } from "./ui/dropdown-no-script.ts"
import {
  imageGalleryChecks,
  imageGalleryStripChecks,
  imageGalleryStripNavChecks,
  imageGalleryStripSizeChecks,
} from "./ui/image-gallery.ts"
import { lightboxOptionsChecks, lightboxRefusesEmptyCheck } from "./ui/lightbox.ts"
import { zoomableImagesChecks, zoomableImagesReadErrorsCheck } from "./ui/zoomable-images.ts"
import { moneyInputChecks, moneyInputPreHydrationChecks } from "./ui/money-input.ts"
import { fileInputChecks } from "./ui/file-input.ts"
import { inlineEditHeadingNameCheck, inlineEditInterruptionChecks } from "./ui/inline-edit.ts"
import { shortcutsChecks } from "./ui/shortcuts-dialog.ts"
import { kbdSequenceNameChecks } from "./ui/kbd.ts"
import { toggleChipsChecks } from "./ui/toggle-chips.ts"
import { compositionTagInputCheck, tagInputChecks } from "./ui/tag-input.ts"
import { outlineBadgeContrastCheck } from "./ui/badge.ts"
import { errorStateDangerCheck } from "./ui/error-state.ts"
import { noticeToneCheck } from "./ui/notice.ts"
import { errorBoundaryChecks } from "./ui/error-boundary.ts"
import { kanbanBoardChecks } from "./ui/kanban-board.ts"
import { sortableListChecks } from "./ui/sortable-list.ts"
import { themeToggleChecks } from "./ui/theme-toggle.ts"
import { billingChecks } from "./ui/billing.ts"
import { onboardingChecklistChecks } from "./ui/onboarding-checklist.ts"
import {
  commandPaletteChecks,
  compositionCommandPaletteChecks,
  compositionRemotePaletteCheck,
} from "./ui/command-palette.ts"
import { tourChecks } from "./ui/tour.ts"
import { comparisonTableChecks } from "./ui/comparison-table.ts"
import { modalChecks, sharedScrollLockChecks } from "./ui/modal.ts"
import type { Devtools } from "./harness.ts"

/** Every ui check in run order, each with its file under `checks/ui/`, without `.ts`. */
const UI_CHECKS:
  readonly (readonly [file: string, run: (devtools: Devtools) => void | Promise<void>])[] = [
    ["dropdown", dropdownChecks],
    ["dropdown", dropdownAutoDirectionChecks],
    ["toggle-switch", toggleSwitchChecks],
    ["on-off-buttons", onOffButtonsChecks],
    ["field", fieldChecks],
    ["forward-ref", refForwardingChecks],
    ["round-checkbox", roundCheckboxChecks],
    ["round-checkbox", roundCheckboxColourChecks],
    ["round-checkbox", roundCheckboxFocusRingChecks],
    ["button", busyButtonChecks],
    ["button", busySubmitChecks],
    ["use-succeeded", useSucceededChecks],
    ["link", linkChecks],
    ["button", buttonLinkChecks],
    ["dropdown", dropdownItemRouteChecks],
    ["dropdown", dropdownItemDisabledDangerCheck],
    ["copy-block", copyBlockChecks],
    ["copy-block", copyBlockNeverClipsCheck],
    ["copy-button", copyButtonStatusChecks],
    ["page-header", pageHeaderLayoutChecks],
    ["page-header", pageHeaderNameCheck],
    ["tooltip", tooltipChecks],
    ["combobox", comboboxChecks],
    ["toastr", toastrChecks],
    ["unsaved-guard", unsavedGuardChecks],
    ["date-range-picker", dateRangeChecks],
    ["date-range-picker-time", dateRangeTimeChecks],
    ["pagination", paginationChecks],
    ["data-table", dataTableChecks],
    ["enhanced-form", enhancedFormAsyncFailureCheck],
    ["enhanced-form", enhancedFormFailureColourCheck],
    ["enhanced-form", enhancedFormSynchronousThrowCheck],
    ["enhanced-form", enhancedFormResultChecks],
    ["sign-up-form", signUpFormDoubleClickCheck],
    ["sign-up-form", signUpFormRequestSubmitGuardCheck],
    ["sign-up-form", signUpFormFocusElsewhereCheck],
    ["sign-up-form", signUpFormBlurWhileSendingCheck],
    ["enhanced-form", enhancedFormsHoneypotChecks],
    ["contact-form", contactFormHoneypotCheck],
    ["contact-form", contactFormStaleSubmitCheck],
    ["enhanced-form", enhancedFormBackForwardCacheCheck],
    ["contact-form", contactFormFailureRetryChecks],
    ["controlled-form", controlledFormBusyGuardCheck],
    ["controlled-form", controlledFormFailureFocusCheck],
    ["enhanced-form", enhancedFormsNoScriptChecks],
    ["dropdown-no-script", dropdownNoScriptChecks],
    ["dropdown-no-script", dropdownHydrationUpgradeChecks],
    ["image-gallery", imageGalleryChecks],
    ["image-gallery", imageGalleryStripChecks],
    ["image-gallery", imageGalleryStripSizeChecks],
    ["image-gallery", imageGalleryStripNavChecks],
    ["lightbox", lightboxRefusesEmptyCheck],
    ["lightbox", lightboxOptionsChecks],
    ["zoomable-images", zoomableImagesChecks],
    ["money-input", moneyInputChecks],
    ["money-input", moneyInputPreHydrationChecks],
    ["file-input", fileInputChecks],
    ["inline-edit", inlineEditInterruptionChecks],
    ["inline-edit", inlineEditHeadingNameCheck],
    ["shortcuts-dialog", shortcutsChecks],
    ["kbd", kbdSequenceNameChecks],
    ["toggle-chips", toggleChipsChecks],
    ["tag-input", tagInputChecks],
    ["tag-input", compositionTagInputCheck],
    ["badge", outlineBadgeContrastCheck],
    ["field", fieldErrorContrastCheck],
    ["error-state", errorStateDangerCheck],
    ["notice", noticeToneCheck],
    ["error-boundary", errorBoundaryChecks],
    ["link", linkFocusRingChecks],
    ["button", primaryButtonFillCheck],
    ["kanban-board", kanbanBoardChecks],
    ["sortable-list", sortableListChecks],
    ["theme-toggle", themeToggleChecks],
    ["button", hotkeyPropChecks],
    ["billing", billingChecks],
    ["onboarding-checklist", onboardingChecklistChecks],
    ["command-palette", commandPaletteChecks],
    ["command-palette", compositionCommandPaletteChecks],
    ["command-palette", compositionRemotePaletteCheck],
    ["tour", tourChecks],
    ["comparison-table", comparisonTableChecks],
    // Last on purpose: a Modal that refuses to close would sit in the top layer over everything,
    // so a failure here cannot take an unrelated check down with it.
    ["modal", modalChecks],
    ["modal", sharedScrollLockChecks],
    ["zoomable-images", zoomableImagesReadErrorsCheck],
  ]

/** `true` when a check in this file belongs to the component `verify --component=` names. */
export function ofComponent(file: string, component: string): boolean {
  return file === component || file.startsWith(`${component}-`)
}

/** The file names {@link uiChecks} can be filtered to. */
export const UI_CHECK_FILES: readonly string[] = [...new Set(UI_CHECKS.map(([file]) => file))]

/**
 * `ui/`'s browser checks: Dropdown's pointer and keyboard contract, ToggleSwitch, OnOffButtons,
 * `Field`, Tooltip, Combobox, Toastr, DateRangePicker's focus contract in both its day-only and
 * `withTime` modes, Pagination's end controls, DataTable's sort-by-header and paging contract,
 * `Link`'s plain-click rule, `ImageGallery`'s thumbnail strip and the shared `Lightbox` it opens,
 * `FileInput`'s keyboard, drag-and-drop, refusal, preview-revocation and plain-form-post contract,
 * `useHotkeys` with `ShortcutsDialog`, `TagInput`'s keys, chips and focus return, and — last —
 * Modal's keyboard and focus contract.
 *
 * Each check lives in the file under `checks/ui/` named first in its row of `UI_CHECKS`.
 *
 * This block runs last of every package's, and Modal's checks run last inside it, for the same
 * reason: Modal opens a real modal dialog, and a dialog that refused to close would sit in the top
 * layer above every check that ran after it. `imageGalleryChecks` opens one too and closes it again
 * unconditionally in its own teardown before this function returns, for the same reason, since
 * `Lightbox`'s checks cannot themselves run last — Modal's have to. See `PACKAGE_BLOCKS` in
 * `pages/verify.ts` for where the run order across every package is fixed.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param component Runs only the checks of `checks/ui/<component>.ts` and of its
 * `<component>-*.ts` files, as `verify --component=` asks; every check when left out.
 */
export async function uiChecks(devtools: Devtools, component?: string): Promise<void> {
  for (const [file, run] of UI_CHECKS) {
    if (component === undefined || ofComponent(file, component)) await run(devtools)
  }
}
