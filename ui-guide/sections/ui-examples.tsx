/**
 * Examples of the helpers `ui/` exports beside its components.
 *
 * Each card runs the real export when it renders; see `example.tsx`. A helper written for the
 * browser — one that takes an element, an event or `navigator` — is run here against the smallest
 * plain object it accepts, so the card shows the decision it makes without touching the page, and
 * the server render and the browser render print the same output.
 */

import {
  activeDescendant,
  addDays,
  applyScrollLock,
  avatarFace,
  backdropClickDismisses,
  buttonClasses,
  calendarDateInZone,
  CANCEL_LABEL,
  clampConfidence,
  clampProgress,
  clientWidthWithoutScrollbar,
  columnWidthPercents,
  comboboxKey,
  comboboxKeyAction,
  comboboxListboxId,
  comboboxOptionId,
  CONFIRM_LABEL,
  confirmVariant,
  counterText,
  dateRangePresets,
  defaultGetLabel,
  defaultToastDuration,
  describedImages,
  dialogHeldFocus,
  dialogTitleId,
  DISMISS_KEY,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  filterItems,
  fold,
  formatBytes,
  formatIsoDate,
  formatProgressPercent,
  groupLabel,
  groupSplit,
  hasQuestion,
  HONEYPOT_FIELD_NAME,
  honeypotField,
  honeypotFilled,
  initials,
  isBackdropClick,
  isDismissKey,
  isSameDay,
  isValidDateRange,
  isValidDateTimeRange,
  labelOr,
  leavesCombobox,
  listboxContent,
  matchesAccept,
  matchesQuery,
  naming,
  nextComboboxState,
  nextMenuIndex,
  nextTabIndex,
  normalizeCiStatus,
  openingState,
  pageRange,
  parseIsoDate,
  presetForRange,
  presetForTimeRange,
  progressWidthPercent,
  rangeForPreset,
  rangeForTimePreset,
  resolveDuration,
  resolveMoneyInputEdit,
  restoreFocus,
  rowKeyAttribute,
  scrollLockPadding,
  selectableIndex,
  shiftMonth,
  shouldRetargetFocus,
  SKELETON_METRICS,
  skeletonCount,
  skeletonStatusRole,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  tableGeometry,
  tableHeaderHeightRem,
  tableRowHeightRem,
  textGeometry,
  timeRangePresets,
  typingState,
  wrapIndex,
} from "@spy4x/preact-ui"
import { failedAfterSrcChange } from "@spy4x/preact-ui/avatar"
import { copyToClipboard } from "@spy4x/preact-ui/copy-button"
import { enhancedFormMessage } from "@spy4x/preact-ui/enhanced-form"
import { labelTarget } from "@spy4x/preact-ui/field"
import { classifyFiles, resolveLabels } from "@spy4x/preact-ui/file-input"
import { requestGeolocation } from "@spy4x/preact-ui/geo-button"
import { thumbnailKey } from "@spy4x/preact-ui/image-gallery"
import {
  backdropDismissesByDefault,
  bindEscapeClose,
  escapeCloseStrategy,
  platformCloseHandler,
  supportsClosedBy,
} from "@spy4x/preact-ui/modal"
import { editableText } from "@spy4x/preact-ui/money-input"
import { barHeightRem, lineBoxRem } from "@spy4x/preact-ui/skeletons"
import type { ExampleFragment } from "../example.tsx"
import { toExampleDemos } from "../example.tsx"

/** The instant every date example resolves against, so its output never follows the clock. */
const NOW = "2026-03-18T10:30:00Z"

const examples: ExampleFragment = {
  formatBytes: {
    title: "formatBytes()",
    wide: false,
    summary:
      "A byte count as a short size label, in binary units, with one decimal only when it is not whole.",
    snippet: `import { formatBytes } from "@spy4x/preact-ui"

[formatBytes(512), formatBytes(1536), formatBytes(5 * 1024 ** 2)]`,
    covers: ["formatBytes"],
    run: () => [formatBytes(512), formatBytes(1536), formatBytes(5 * 1024 ** 2)],
  },

  buttonClasses: {
    title: "buttonClasses()",
    wide: false,
    summary:
      "The classes a `Button` wears, for a link or any other element that has to look like one.",
    snippet: `import { buttonClasses } from "@spy4x/preact-ui/button"

buttonClasses("outline", "sm", "w-full")`,
    covers: ["buttonClasses"],
    run: () => buttonClasses("outline", "sm", "w-full"),
  },

  // Calendar dates.

  parseIsoDate: {
    title: "Calendar date arithmetic",
    wide: false,
    summary:
      "Steps a `YYYY-MM-DD` date by days or months without drifting across a daylight-saving change.",
    snippet:
      `import { addDays, formatIsoDate, isSameDay, parseIsoDate, shiftMonth } from "@spy4x/preact-ui"

const ms = parseIsoDate("2026-03-31")
;({
  roundTrip: formatIsoDate(ms),
  weekLater: addDays("2026-03-31", 7),
  monthBefore: shiftMonth("2026-03-31", -1),
  same: isSameDay("2026-03-31", formatIsoDate(ms)),
})`,
    covers: ["parseIsoDate", "formatIsoDate", "addDays", "shiftMonth", "isSameDay"],
    run: () => {
      const ms = parseIsoDate("2026-03-31")
      return {
        roundTrip: formatIsoDate(ms),
        weekLater: addDays("2026-03-31", 7),
        monthBefore: shiftMonth("2026-03-31", -1),
        same: isSameDay("2026-03-31", formatIsoDate(ms)),
      }
    },
  },

  startOfMonth: {
    title: "Month, quarter and year bounds",
    wide: false,
    summary: "The first and last day of the month, quarter and year a date falls in.",
    snippet: `import {
  endOfMonth, endOfQuarter, endOfYear, startOfMonth, startOfQuarter, startOfYear,
} from "@spy4x/preact-ui"

const day = "2028-02-10"
;({
  month: [startOfMonth(day), endOfMonth(day)],
  quarter: [startOfQuarter(day), endOfQuarter(day)],
  year: [startOfYear(day), endOfYear(day)],
})`,
    covers: [
      "startOfMonth",
      "endOfMonth",
      "startOfQuarter",
      "endOfQuarter",
      "startOfYear",
      "endOfYear",
    ],
    run: () => {
      const day = "2028-02-10"
      return {
        month: [startOfMonth(day), endOfMonth(day)],
        quarter: [startOfQuarter(day), endOfQuarter(day)],
        year: [startOfYear(day), endOfYear(day)],
      }
    },
  },

  rangeForPreset: {
    title: "Date range presets",
    wide: false,
    summary:
      "Resolves a preset such as `last-7-days` into an inclusive date range from an injected `now` and zone, and finds the preset a range matches.",
    snippet: `import {
  calendarDateInZone, dateRangePresets, isValidDateRange, presetForRange, rangeForPreset,
} from "@spy4x/preact-ui"

const now = new Date("${NOW}")
const timeZone = "Europe/Paris"
const week = rangeForPreset("last-7-days", { now, timeZone })
;({
  presets: dateRangePresets.length,
  today: calendarDateInZone(now, timeZone),
  week,
  matches: presetForRange(week, { now, timeZone }),
  reversedIsValid: isValidDateRange({ from: week.to, to: week.from }),
})`,
    covers: [
      "rangeForPreset",
      "dateRangePresets",
      "calendarDateInZone",
      "presetForRange",
      "isValidDateRange",
    ],
    run: () => {
      const now = new Date(NOW)
      const timeZone = "Europe/Paris"
      const week = rangeForPreset("last-7-days", { now, timeZone })
      return {
        presets: dateRangePresets.length,
        today: calendarDateInZone(now, timeZone),
        week,
        matches: presetForRange(week, { now, timeZone }),
        reversedIsValid: isValidDateRange({ from: week.to, to: week.from }),
      }
    },
  },

  rangeForTimePreset: {
    title: "Time range presets",
    wide: false,
    summary:
      "The sub-day counterpart of the date presets: the last hour or the last 24 hours as wall-clock times in a zone.",
    snippet: `import {
  isValidDateTimeRange, presetForTimeRange, rangeForTimePreset, timeRangePresets,
} from "@spy4x/preact-ui"

const now = new Date("${NOW}")
const timeZone = "Europe/Paris"
const hour = rangeForTimePreset("last-hour", { now, timeZone })
;({
  presets: timeRangePresets,
  hour,
  matches: presetForTimeRange(hour, { now, timeZone }),
  valid: isValidDateTimeRange({ from: "2026-02-31T10:00", to: "2026-03-01T10:00" }),
})`,
    covers: [
      "rangeForTimePreset",
      "timeRangePresets",
      "presetForTimeRange",
      "isValidDateTimeRange",
    ],
    run: () => {
      const now = new Date(NOW)
      const timeZone = "Europe/Paris"
      const hour = rangeForTimePreset("last-hour", { now, timeZone })
      return {
        presets: timeRangePresets,
        hour,
        matches: presetForTimeRange(hour, { now, timeZone }),
        valid: isValidDateTimeRange({ from: "2026-02-31T10:00", to: "2026-03-01T10:00" }),
      }
    },
  },

  // Combobox.

  filterItems: {
    title: "Combobox search",
    wide: false,
    summary:
      "How a combobox matches what was typed: accents and case are folded away before a substring test.",
    snippet: `import { defaultGetLabel, filterItems, fold, matchesQuery } from "@spy4x/preact-ui"

const cities = ["São Paulo", "Sapporo", "Zürich"]
;({
  folded: fold("São Paulo"),
  label: defaultGetLabel(42),
  one: matchesQuery("Zürich", "zur"),
  many: filterItems(cities, "sa"),
})`,
    covers: ["filterItems", "fold", "defaultGetLabel", "matchesQuery"],
    run: () => {
      const cities = ["São Paulo", "Sapporo", "Zürich"]
      return {
        folded: fold("São Paulo"),
        label: defaultGetLabel(42),
        one: matchesQuery("Zürich", "zur"),
        many: filterItems(cities, "sa"),
      }
    },
  },

  comboboxKeyAction: {
    title: "Combobox keys",
    wide: false,
    summary:
      "Turns a key press into the combobox's next state: which option is active, whether the list is open, and what Enter selects.",
    snippet: `import { comboboxKey, comboboxKeyAction, nextComboboxState } from "@spy4x/preact-ui"

const key = comboboxKey({ key: "ArrowDown", altKey: false })
const open = { activeIndex: 1, isOpen: true }
;({
  key,
  down: key && nextComboboxState(open, key, 3),
  unknown: comboboxKey({ key: "a", altKey: false }),
  enter: comboboxKeyAction("Enter", open, 3),
})`,
    covers: ["comboboxKeyAction", "comboboxKey", "nextComboboxState"],
    run: () => {
      const key = comboboxKey({ key: "ArrowDown", altKey: false })
      const open = { activeIndex: 1, isOpen: true }
      return {
        key,
        down: key && nextComboboxState(open, key, 3),
        unknown: comboboxKey({ key: "a", altKey: false }),
        enter: comboboxKeyAction("Enter", open, 3),
      }
    },
  },

  comboboxListboxId: {
    title: "Combobox ids and naming",
    wide: false,
    summary:
      "The ids that tie a combobox's input to its list and its active option, and which attribute gives it an accessible name.",
    snippet: `import {
  activeDescendant, comboboxListboxId, comboboxOptionId, naming,
} from "@spy4x/preact-ui"

;({
  listbox: comboboxListboxId("city"),
  option: comboboxOptionId("city", 2),
  active: activeDescendant("city", { activeIndex: 2, isOpen: true }),
  closed: activeDescendant("city", { activeIndex: 2, isOpen: false }),
  named: naming({ ariaLabel: "City" }),
  unnamed: naming({}),
})`,
    covers: ["comboboxListboxId", "comboboxOptionId", "activeDescendant", "naming"],
    run: () => ({
      listbox: comboboxListboxId("city"),
      option: comboboxOptionId("city", 2),
      active: activeDescendant("city", { activeIndex: 2, isOpen: true }),
      closed: activeDescendant("city", { activeIndex: 2, isOpen: false }),
      named: naming({ ariaLabel: "City" }),
      unnamed: naming({}),
    }),
  },

  openingState: {
    title: "Combobox opening and closing",
    wide: false,
    summary:
      "The state a combobox opens in, which option it lands on when some are disabled, what the list shows when nothing matches, and when focus has left it.",
    snippet: `import {
  leavesCombobox, listboxContent, openingState, selectableIndex, typingState,
} from "@spy4x/preact-ui"

const sizes = ["Small", "Medium", "Large"]
const soldOut = (size: string) => size === "Small"
const input = { isSameNode: (node: unknown) => node === input }
;({
  opening: openingState(sizes, 2, sizes, soldOut),
  typing: typingState(sizes, soldOut),
  firstUsable: selectableIndex(sizes, 0, soldOut),
  empty: listboxContent([], "xl"),
  leaves: {
    toAnotherElement: leavesCombobox(input, {} as Node),
    toNowhere: leavesCombobox(input, null),
  },
})`,
    covers: ["openingState", "typingState", "selectableIndex", "listboxContent", "leavesCombobox"],
    run: () => {
      const sizes = ["Small", "Medium", "Large"]
      const soldOut = (size: string) => size === "Small"
      const input = { isSameNode: (node: unknown) => node === input }
      return {
        opening: openingState(sizes, 2, sizes, soldOut),
        typing: typingState(sizes, soldOut),
        firstUsable: selectableIndex(sizes, 0, soldOut),
        empty: listboxContent([], "xl"),
        leaves: {
          toAnotherElement: leavesCombobox(input, {} as Node),
          toNowhere: leavesCombobox(input, null),
        },
      }
    },
  },

  // Keyboard navigation elsewhere.

  nextMenuIndex: {
    title: "nextMenuIndex()",
    wide: false,
    summary:
      "The menu item a `Dropdown` moves to on an arrow, Home or End key, wrapping at both ends.",
    snippet: `import { nextMenuIndex } from "@spy4x/preact-ui"

[nextMenuIndex("ArrowDown", 2, 3), nextMenuIndex("ArrowUp", 0, 3), nextMenuIndex("End", 0, 3), nextMenuIndex("x", 0, 3)]`,
    covers: ["nextMenuIndex"],
    run: () => [
      nextMenuIndex("ArrowDown", 2, 3),
      nextMenuIndex("ArrowUp", 0, 3),
      nextMenuIndex("End", 0, 3),
      nextMenuIndex("x", 0, 3),
    ],
  },

  nextTabIndex: {
    title: "nextTabIndex()",
    wide: false,
    summary:
      "The tab an arrow key moves to, following the tab list's orientation and skipping disabled tabs.",
    snippet: `import { nextTabIndex } from "@spy4x/preact-ui"

const disabled = [false, true, false]
;({
  right: nextTabIndex("ArrowRight", 0, 3, "horizontal", disabled),
  down: nextTabIndex("ArrowDown", 0, 3, "vertical", disabled),
  wrongAxis: nextTabIndex("ArrowDown", 0, 3, "horizontal", disabled),
})`,
    covers: ["nextTabIndex"],
    run: () => {
      const disabled = [false, true, false]
      return {
        right: nextTabIndex("ArrowRight", 0, 3, "horizontal", disabled),
        down: nextTabIndex("ArrowDown", 0, 3, "vertical", disabled),
        wrongAxis: nextTabIndex("ArrowDown", 0, 3, "horizontal", disabled),
      }
    },
  },

  // Modal.

  isBackdropClick: {
    title: "Backdrop clicks",
    wide: false,
    summary:
      "Whether a click landed on a dialog's dimmed backdrop rather than its content, and whether that click should close it.",
    snippet: `import { backdropClickDismisses, isBackdropClick } from "@spy4x/preact-ui"
import { backdropDismissesByDefault } from "@spy4x/preact-ui/modal"

const dialog = {}
const rect = { left: 100, top: 100, right: 500, bottom: 400 }
const click = { target: dialog, clientX: 20, clientY: 20 } as MouseEvent
;({
  outside: isBackdropClick({ target: dialog, dialog }, rect, 20, 20),
  inside: isBackdropClick({ target: dialog, dialog }, rect, 300, 250),
  byDefault: backdropDismissesByDefault,
  refused: backdropClickDismisses(click, rect, dialog, false),
})`,
    covers: ["isBackdropClick", "backdropClickDismisses", "backdropDismissesByDefault"],
    run: () => {
      const dialog = {}
      const rect = { left: 100, top: 100, right: 500, bottom: 400 }
      const click = { target: dialog, clientX: 20, clientY: 20 } as MouseEvent
      return {
        outside: isBackdropClick({ target: dialog, dialog }, rect, 20, 20),
        inside: isBackdropClick({ target: dialog, dialog }, rect, 300, 250),
        byDefault: backdropDismissesByDefault,
        refused: backdropClickDismisses(click, rect, dialog, false),
      }
    },
  },

  applyScrollLock: {
    title: "Scroll lock",
    wide: false,
    summary:
      "Stops the page scrolling behind an open dialog and pads the body by the scrollbar's width, so nothing slides sideways.",
    snippet: `import {
  applyScrollLock, clientWidthWithoutScrollbar, scrollLockPadding,
} from "@spy4x/preact-ui"

const html = {
  style: { overflow: "" },
  get clientWidth() { return this.style.overflow === "hidden" ? 1000 : 985 },
}
const body = { style: { overflow: "", paddingRight: "" } }
const padding = scrollLockPadding(html.clientWidth, clientWidthWithoutScrollbar(html))
const lock = applyScrollLock({ scrollingElement: html, body }, padding)
const locked = { html: html.style.overflow, body: { ...body.style } }
lock.release()
;({ padding, locked, released: body.style })`,
    covers: ["applyScrollLock", "clientWidthWithoutScrollbar", "scrollLockPadding"],
    run: () => {
      const html = {
        style: { overflow: "" },
        get clientWidth() {
          return this.style.overflow === "hidden" ? 1000 : 985
        },
      }
      const body = { style: { overflow: "", paddingRight: "" } }
      const padding = scrollLockPadding(html.clientWidth, clientWidthWithoutScrollbar(html))
      const lock = applyScrollLock({ scrollingElement: html, body }, padding)
      const locked = { html: html.style.overflow, body: { ...body.style } }
      lock.release()
      return { padding, locked, released: body.style }
    },
  },

  isDismissKey: {
    title: "Escape closes a dialog",
    wide: false,
    summary: "The key that asks a `Modal` to close, and the check its key handler makes.",
    snippet: `import { DISMISS_KEY, isDismissKey } from "@spy4x/preact-ui"

;({
  key: DISMISS_KEY,
  open: isDismissKey({ key: "Escape" }, true),
  closed: isDismissKey({ key: "Escape" }, false),
  other: isDismissKey({ key: "Enter" }, true),
})`,
    covers: ["isDismissKey", "DISMISS_KEY"],
    run: () => ({
      key: DISMISS_KEY,
      open: isDismissKey({ key: "Escape" }, true),
      closed: isDismissKey({ key: "Escape" }, false),
      other: isDismissKey({ key: "Enter" }, true),
    }),
  },

  escapeCloseStrategy: {
    title: "Escape on each browser",
    wide: false,
    summary:
      "Picks and wires how a `Modal` handles Escape: asking its close port first where the browser honours `closedby`, and only telling it where the browser closes the dialog itself.",
    snippet: `import {
  bindEscapeClose, escapeCloseStrategy, platformCloseHandler, supportsClosedBy,
} from "@spy4x/preact-ui/modal"

// A browser's dialog prototype: one that knows \`closedby\` has a \`closedBy\` property.
function plan(dialogPrototype: object) {
  const log: string[] = []
  const dialog = {
    addEventListener: (type: string) => log.push("add " + type),
    removeEventListener: (type: string) => log.push("remove " + type),
  }
  const strategy = escapeCloseStrategy(supportsClosedBy(dialogPrototype))
  const unbind = bindEscapeClose(dialog, strategy, { keydown: () => {}, cancel: () => {} })
  unbind()
  platformCloseHandler({
    refusalHolds: strategy.refusalHolds,
    onClose: () => false,
    settleOpen: (open) => log.push("open " + open),
  })()
  return { strategy, log }
}
;({ withClosedBy: plan({ closedBy: "none" }), withoutClosedBy: plan({}) })`,
    covers: ["escapeCloseStrategy", "supportsClosedBy", "bindEscapeClose", "platformCloseHandler"],
    run: () => {
      function plan(dialogPrototype: object) {
        const log: string[] = []
        const dialog = {
          addEventListener: (type: string) => log.push("add " + type),
          removeEventListener: (type: string) => log.push("remove " + type),
        }
        const strategy = escapeCloseStrategy(supportsClosedBy(dialogPrototype))
        const unbind = bindEscapeClose(dialog, strategy, { keydown: () => {}, cancel: () => {} })
        unbind()
        platformCloseHandler({
          refusalHolds: strategy.refusalHolds,
          onClose: () => false,
          settleOpen: (open) => log.push("open " + open),
        })()
        return { strategy, log }
      }
      return { withClosedBy: plan({ closedBy: "none" }), withoutClosedBy: plan({}) }
    },
  },

  restoreFocus: {
    title: "Focus after a dialog closes",
    wide: false,
    summary:
      "Decides whether focus goes back to the element that opened a dialog, and moves it there.",
    snippet: `import { dialogHeldFocus, restoreFocus, shouldRetargetFocus } from "@spy4x/preact-ui"

const log: string[] = []
const trigger = { focus: () => log.push("trigger focused") }
const field = {}
const dialog = { contains: (element: unknown) => element === field }
;({
  held: dialogHeldFocus(dialog, field),
  retarget: shouldRetargetFocus(trigger),
  noTrigger: shouldRetargetFocus(null),
  moved: restoreFocus(trigger),
  log,
})`,
    covers: ["restoreFocus", "dialogHeldFocus", "shouldRetargetFocus"],
    run: () => {
      const log: string[] = []
      const trigger = { focus: () => log.push("trigger focused") }
      const field = {}
      const dialog = { contains: (element: unknown) => element === field }
      return {
        held: dialogHeldFocus(dialog, field),
        retarget: shouldRetargetFocus(trigger),
        noTrigger: shouldRetargetFocus(null),
        moved: restoreFocus(trigger),
        log,
      }
    },
  },

  dialogTitleId: {
    title: "dialogTitleId()",
    wide: false,
    summary:
      "The id of a dialog's title element, which the dialog names itself by through `aria-labelledby`.",
    snippet: `import { dialogTitleId } from "@spy4x/preact-ui"

dialogTitleId("P0-1")`,
    covers: ["dialogTitleId"],
    run: () => dialogTitleId("P0-1"),
  },

  // Confirm dialog.

  labelOr: {
    title: "Confirm dialog labels",
    wide: false,
    summary:
      "The English button labels a `ConfirmDialog` falls back to, and the rule that a blank label falls back too.",
    snippet: `import { CANCEL_LABEL, CONFIRM_LABEL, labelOr } from "@spy4x/preact-ui"

[labelOr("Delete", CONFIRM_LABEL), labelOr("   ", CONFIRM_LABEL), labelOr(undefined, CANCEL_LABEL)]`,
    covers: ["labelOr", "CONFIRM_LABEL", "CANCEL_LABEL"],
    run: () => [
      labelOr("Delete", CONFIRM_LABEL),
      labelOr("   ", CONFIRM_LABEL),
      labelOr(undefined, CANCEL_LABEL),
    ],
  },

  hasQuestion: {
    title: "Confirm dialog body and tone",
    wide: false,
    summary:
      "Whether a dialog body says anything a screen reader can announce, and which button variant a tone asks for.",
    snippet: `import { confirmVariant, hasQuestion } from "@spy4x/preact-ui"

;({
  blank: hasQuestion(["", "  "]),
  asked: hasQuestion("Delete this file?"),
  danger: confirmVariant("danger"),
  plain: confirmVariant("default"),
})`,
    covers: ["hasQuestion", "confirmVariant"],
    run: () => ({
      blank: hasQuestion(["", "  "]),
      asked: hasQuestion("Delete this file?"),
      danger: confirmVariant("danger"),
      plain: confirmVariant("default"),
    }),
  },

  // Avatar.

  avatarFace: {
    title: "Avatar faces",
    wide: false,
    summary:
      "Picks what an avatar shows: its image, else the name's initials, else a generic icon.",
    snippet: `import { avatarFace, initials } from "@spy4x/preact-ui"
import { failedAfterSrcChange } from "@spy4x/preact-ui/avatar"

;({
  initials: [initials("Ada Lovelace"), initials("John Paul Smith"), initials("王小明")],
  image: avatarFace({ src: "/a.png", name: "Ada" }),
  broken: avatarFace({ src: "/a.png", failed: true, name: "Ada" }),
  nameless: avatarFace({}),
  sameSrc: failedAfterSrcChange("/a.png", "/a.png", true),
  newSrc: failedAfterSrcChange("/a.png", "/b.png", true),
})`,
    covers: ["avatarFace", "initials", "failedAfterSrcChange"],
    run: () => ({
      initials: [initials("Ada Lovelace"), initials("John Paul Smith"), initials("王小明")],
      image: avatarFace({ src: "/a.png", name: "Ada" }),
      broken: avatarFace({ src: "/a.png", failed: true, name: "Ada" }),
      nameless: avatarFace({}),
      sameSrc: failedAfterSrcChange("/a.png", "/a.png", true),
      newSrc: failedAfterSrcChange("/a.png", "/b.png", true),
    }),
  },

  groupSplit: {
    title: "Avatar groups",
    wide: false,
    summary: "How many avatars a group shows before a `+N` badge, and the group's accessible name.",
    snippet: `import { groupLabel, groupSplit } from "@spy4x/preact-ui"

;({ split: groupSplit(7, 3), label: groupLabel("Reviewers", 7), fallback: groupLabel(null, 7) })`,
    covers: ["groupSplit", "groupLabel"],
    run: () => ({
      split: groupSplit(7, 3),
      label: groupLabel("Reviewers", 7),
      fallback: groupLabel(null, 7),
    }),
  },

  // Progress and meters.

  clampProgress: {
    title: "Progress values",
    wide: false,
    summary:
      "Clamps a progress value into its range, then turns the fraction into a bar width and a whole-percent label that never rounds up to 100% early.",
    snippet:
      `import { clampProgress, formatProgressPercent, progressWidthPercent } from "@spy4x/preact-ui"

const { fraction } = clampProgress(59.96, 60)
;({
  over: clampProgress(130),
  fraction,
  width: progressWidthPercent(fraction),
  label: formatProgressPercent(fraction ?? 0),
})`,
    covers: ["clampProgress", "progressWidthPercent", "formatProgressPercent"],
    run: () => {
      const { fraction } = clampProgress(59.96, 60)
      return {
        over: clampProgress(130),
        fraction,
        width: progressWidthPercent(fraction),
        label: formatProgressPercent(fraction ?? 0),
      }
    },
  },

  clampConfidence: {
    title: "clampConfidence()",
    wide: false,
    summary:
      "A confidence score clamped to 0–100 and sorted into the low, medium or high tier the meter colours by.",
    snippet: `import { clampConfidence } from "@spy4x/preact-ui"

[clampConfidence(42), clampConfidence(80), clampConfidence(140), clampConfidence(null)]`,
    covers: ["clampConfidence"],
    run: () => [
      clampConfidence(42),
      clampConfidence(80),
      clampConfidence(140),
      clampConfidence(null),
    ],
  },

  normalizeCiStatus: {
    title: "normalizeCiStatus()",
    wide: false,
    summary: "Reads a build status from any source into one of the four states the pill shows.",
    snippet: `import { normalizeCiStatus } from "@spy4x/preact-ui"

[normalizeCiStatus(" Passing "), normalizeCiStatus("RUNNING"), normalizeCiStatus("cancelled")]`,
    covers: ["normalizeCiStatus"],
    run: () => [
      normalizeCiStatus(" Passing "),
      normalizeCiStatus("RUNNING"),
      normalizeCiStatus("cancelled"),
    ],
  },

  // Skeletons.

  SKELETON_METRICS: {
    title: "Skeleton metrics",
    wide: false,
    summary:
      "The sizes, in rem, a loading skeleton copies from the real text and table it stands in for, so the page does not jump when the content arrives.",
    snippet: `import {
  SKELETON_METRICS, tableHeaderHeightRem, tableRowHeightRem,
} from "@spy4x/preact-ui"
import { barHeightRem, lineBoxRem } from "@spy4x/preact-ui/skeletons"

;({
  lineHeight: SKELETON_METRICS.lineHeightRem,
  line: lineBoxRem(),
  bar: barHeightRem(),
  row: tableRowHeightRem(),
  header: tableHeaderHeightRem(),
})`,
    covers: [
      "SKELETON_METRICS",
      "lineBoxRem",
      "barHeightRem",
      "tableRowHeightRem",
      "tableHeaderHeightRem",
    ],
    run: () => ({
      lineHeight: SKELETON_METRICS.lineHeightRem,
      line: lineBoxRem(),
      bar: barHeightRem(),
      row: tableRowHeightRem(),
      header: tableHeaderHeightRem(),
    }),
  },

  tableGeometry: {
    title: "Skeleton geometry",
    wide: false,
    summary:
      "How many placeholder lines, rows and cells a skeleton draws, and how wide each one is.",
    snippet: `import {
  columnWidthPercents, skeletonCount, tableGeometry, textGeometry,
} from "@spy4x/preact-ui"

;({
  count: [skeletonCount(undefined, 3), skeletonCount(2.7, 3), skeletonCount(-1, 3)],
  columns: columnWidthPercents([2, 1, 1]),
  text: textGeometry(3, ["full", 60]),
  table: tableGeometry({ rows: 2, widths: [2, 1] }),
})`,
    covers: ["tableGeometry", "skeletonCount", "columnWidthPercents", "textGeometry"],
    run: () => ({
      count: [skeletonCount(undefined, 3), skeletonCount(2.7, 3), skeletonCount(-1, 3)],
      columns: columnWidthPercents([2, 1, 1]),
      text: textGeometry(3, ["full", 60]),
      table: tableGeometry({ rows: 2, widths: [2, 1] }),
    }),
  },

  skeletonStatusRole: {
    title: "skeletonStatusRole()",
    wide: false,
    summary:
      "The ARIA role a skeleton carries, so a screen reader hears that something is loading.",
    snippet: `import { skeletonStatusRole } from "@spy4x/preact-ui"

skeletonStatusRole()`,
    covers: ["skeletonStatusRole"],
    run: () => skeletonStatusRole(),
  },

  // Files and forms.

  classifyFiles: {
    title: "Accepting files",
    wide: false,
    summary:
      "Splits the files a person chose into the ones a `FileInput` keeps and the ones it refuses, with the reason for each refusal.",
    snippet: `import { matchesAccept } from "@spy4x/preact-ui"
import { classifyFiles } from "@spy4x/preact-ui/file-input"

const photo = new File(["12345"], "photo.png", { type: "image/png" })
const notes = new File(["1"], "notes.txt", { type: "text/plain" })
const poster = new File(["1234567890"], "poster.png", { type: "image/png" })
const { accepted, rejected } = classifyFiles([photo, notes, poster], {
  accept: "image/*",
  maxSize: 8,
})
;({
  pdf: matchesAccept(new File([], "report.PDF"), ".pdf"),
  accepted: accepted.map((file) => file.name),
  rejected: rejected.map(({ file, reason }) => [file.name, reason]),
})`,
    covers: ["classifyFiles", "matchesAccept"],
    run: () => {
      const photo = new File(["12345"], "photo.png", { type: "image/png" })
      const notes = new File(["1"], "notes.txt", { type: "text/plain" })
      const poster = new File(["1234567890"], "poster.png", { type: "image/png" })
      const { accepted, rejected } = classifyFiles([photo, notes, poster], {
        accept: "image/*",
        maxSize: 8,
      })
      return {
        pdf: matchesAccept(new File([], "report.PDF"), ".pdf"),
        accepted: accepted.map((file) => file.name),
        rejected: rejected.map(({ file, reason }) => [file.name, reason]),
      }
    },
  },

  resolveLabels: {
    title: "File input labels",
    wide: false,
    summary:
      "Fills in the English default for every file input message the caller did not override.",
    snippet: `import { resolveLabels } from "@spy4x/preact-ui/file-input"

const labels = resolveLabels({ wrongType: (name) => name + " is not an image" })
;[labels.wrongType("notes.txt"), labels.tooLarge("poster.png", 1024), labels.removeFile("photo.png")]`,
    covers: ["resolveLabels"],
    run: () => {
      const labels = resolveLabels({ wrongType: (name) => name + " is not an image" })
      return [
        labels.wrongType("notes.txt"),
        labels.tooLarge("poster.png", 1024),
        labels.removeFile("photo.png"),
      ]
    },
  },

  honeypotFilled: {
    title: "Honeypot field",
    wide: false,
    summary:
      "A hidden field that bots fill in and people never see, so a filled one marks a submission to drop.",
    snippet: `import { HONEYPOT_FIELD_NAME, honeypotField, honeypotFilled } from "@spy4x/preact-ui"

const field = honeypotField(HONEYPOT_FIELD_NAME, "Leave this empty")
const person = new FormData()
const bot = new FormData()
bot.set(HONEYPOT_FIELD_NAME, "https://example.com")
;({
  name: HONEYPOT_FIELD_NAME,
  hidden: field.props["aria-hidden"],
  person: honeypotFilled(person),
  bot: honeypotFilled(bot),
})`,
    covers: ["honeypotFilled", "HONEYPOT_FIELD_NAME", "honeypotField"],
    run: () => {
      const field = honeypotField(HONEYPOT_FIELD_NAME, "Leave this empty")
      const person = new FormData()
      const bot = new FormData()
      bot.set(HONEYPOT_FIELD_NAME, "https://example.com")
      return {
        name: HONEYPOT_FIELD_NAME,
        hidden: field.props["aria-hidden"],
        person: honeypotFilled(person),
        bot: honeypotFilled(bot),
      }
    },
  },

  enhancedFormMessage: {
    title: "enhancedFormMessage()",
    wide: false,
    summary:
      "The status line an `EnhancedForm` announces while it sends, after it succeeds and after it fails.",
    snippet: `import { enhancedFormMessage } from "@spy4x/preact-ui/enhanced-form"

const labels = { sending: "Sending…", done: "Thanks, we got it.", failed: "Please try again." }
;(["idle", "sending", "done", "failed"] as const).map((status) => enhancedFormMessage(status, labels))`,
    covers: ["enhancedFormMessage"],
    run: () => {
      const labels = {
        sending: "Sending…",
        done: "Thanks, we got it.",
        failed: "Please try again.",
      }
      return (["idle", "sending", "done", "failed"] as const).map((status) =>
        enhancedFormMessage(status, labels)
      )
    },
  },

  labelTarget: {
    title: "labelTarget()",
    wide: false,
    summary:
      "Which element a `Field`'s label points at: its own control, another id, or none when the control names itself.",
    snippet: `import { labelTarget } from "@spy4x/preact-ui/field"

[labelTarget(undefined, "email"), labelTarget("email-input", "email"), labelTarget(false, "email")]`,
    covers: ["labelTarget"],
    run: () => [
      labelTarget(undefined, "email"),
      labelTarget("email-input", "email"),
      labelTarget(false, "email"),
    ],
  },

  resolveMoneyInputEdit: {
    title: "Money input",
    wide: false,
    summary:
      "What a `MoneyInput` shows for an amount in minor units, and what it makes of the text a person types: a value, or a message.",
    snippet: `import { resolveMoneyInputEdit } from "@spy4x/preact-ui"
import { editableText } from "@spy4x/preact-ui/money-input"

const bounds = { min: 0, max: 100000 }
;({
  shown: editableText(123456, "EUR", "de-DE"),
  typed: resolveMoneyInputEdit("12,50", "EUR", "de-DE", bounds, "Enter an amount"),
  invalid: resolveMoneyInputEdit("twelve", "EUR", "de-DE", bounds, "Enter an amount"),
  tooMuch: resolveMoneyInputEdit("5000", "EUR", "de-DE", bounds, "Enter an amount"),
})`,
    covers: ["resolveMoneyInputEdit", "editableText"],
    run: () => {
      const bounds = { min: 0, max: 100000 }
      return {
        shown: editableText(123456, "EUR", "de-DE"),
        typed: resolveMoneyInputEdit("12,50", "EUR", "de-DE", bounds, "Enter an amount"),
        invalid: resolveMoneyInputEdit("twelve", "EUR", "de-DE", bounds, "Enter an amount"),
        tooMuch: resolveMoneyInputEdit("5000", "EUR", "de-DE", bounds, "Enter an amount"),
      }
    },
  },

  copyToClipboard: {
    title: "copyToClipboard()",
    wide: false,
    summary:
      "Copies text through the caller's port when one is given, or else through the browser clipboard.",
    snippet: `import { copyToClipboard } from "@spy4x/preact-ui/copy-button"

const copied: string[] = []
copyToClipboard("deno add jsr:@std/path", (text) => {
  copied.push(text)
})
copied`,
    covers: ["copyToClipboard"],
    run: () => {
      const copied: string[] = []
      copyToClipboard("deno add jsr:@std/path", (text) => {
        copied.push(text)
      })
      return copied
    },
  },

  requestGeolocation: {
    title: "requestGeolocation()",
    wide: false,
    summary: "Asks for the device's position and hands back plain coordinates or an error message.",
    snippet: `import { requestGeolocation } from "@spy4x/preact-ui/geo-button"

const results: unknown[] = []
const stub = {
  getCurrentPosition: (found: (position: { coords: { latitude: number; longitude: number } }) => void) =>
    found({ coords: { latitude: 48.8584, longitude: 2.2945 } }),
} as unknown as Geolocation
requestGeolocation((position) => results.push(position), (message) => results.push(message), stub)
results`,
    covers: ["requestGeolocation"],
    run: () => {
      const results: unknown[] = []
      const stub = {
        getCurrentPosition: (
          found: (position: { coords: { latitude: number; longitude: number } }) => void,
        ) => found({ coords: { latitude: 48.8584, longitude: 2.2945 } }),
      } as unknown as Geolocation
      requestGeolocation(
        (position) => results.push(position),
        (message) => results.push(message),
        stub,
      )
      return results
    },
  },

  // Lists, tables and galleries.

  pageRange: {
    title: "pageRange()",
    wide: false,
    summary:
      "The page numbers a `Pagination` shows around the current page, with gaps where pages are left out.",
    snippet: `import { pageRange } from "@spy4x/preact-ui"

pageRange(6, 20).map((item) => "page" in item ? item.page : "…")`,
    covers: ["pageRange"],
    run: () => pageRange(6, 20).map((item) => "page" in item ? item.page : "…"),
  },

  rowKeyAttribute: {
    title: "rowKeyAttribute",
    wide: false,
    summary:
      "The attribute a `DataTable` writes each row's key into, so a script or a test can find one row.",
    snippet: `import { rowKeyAttribute } from "@spy4x/preact-ui"

"tr[" + rowKeyAttribute + '="42"]'`,
    covers: ["rowKeyAttribute"],
    run: () => "tr[" + rowKeyAttribute + '="42"]',
  },

  thumbnailKey: {
    title: "thumbnailKey()",
    wide: false,
    summary:
      "A stable key for each gallery thumbnail, which stays unique when the same image appears twice.",
    snippet: `import { thumbnailKey } from "@spy4x/preact-ui/image-gallery"

const images = [{ src: "/a.jpg" }, { src: "/b.jpg" }, { src: "/a.jpg" }]
images.map((_, index) => thumbnailKey(images, index))`,
    covers: ["thumbnailKey"],
    run: () => {
      const images = [{ src: "/a.jpg" }, { src: "/b.jpg" }, { src: "/a.jpg" }]
      return images.map((_, index) => thumbnailKey(images, index))
    },
  },

  wrapIndex: {
    title: "Lightbox navigation",
    wide: false,
    summary:
      "Which image a lightbox moves to, wrapping at both ends, the counter it reads out, and the images it shows at all — only those with a description.",
    snippet: `import { counterText, describedImages, wrapIndex } from "@spy4x/preact-ui"

const images = [
  { src: "/1.jpg", alt: "Harbour at dawn" },
  { src: "/2.jpg", alt: "" },
  { src: "/3.jpg", alt: "Market street" },
]
const shown = describedImages(images)
;({
  shown: shown.length,
  back: wrapIndex(0, shown.length, -1),
  counter: counterText(2, shown.length),
})`,
    covers: ["wrapIndex", "counterText", "describedImages"],
    run: () => {
      const images = [
        { src: "/1.jpg", alt: "Harbour at dawn" },
        { src: "/2.jpg", alt: "" },
        { src: "/3.jpg", alt: "Market street" },
      ]
      const shown = describedImages(images)
      return {
        shown: shown.length,
        back: wrapIndex(0, shown.length, -1),
        counter: counterText(2, shown.length),
      }
    },
  },

  resolveDuration: {
    title: "Toast duration",
    wide: false,
    summary:
      "How long a toast stays before it closes itself, where a duration of `0` keeps it until closed.",
    snippet: `import { defaultToastDuration, resolveDuration } from "@spy4x/preact-ui"

;({
  defaultToastDuration,
  unset: resolveDuration({}),
  sticky: resolveDuration({ duration: 0 }),
  short: resolveDuration({ duration: 2000 }),
})`,
    covers: ["resolveDuration", "defaultToastDuration"],
    run: () => ({
      defaultToastDuration,
      unset: resolveDuration({}),
      sticky: resolveDuration({ duration: 0 }),
      short: resolveDuration({ duration: 2000 }),
    }),
  },
}

/** The `ui/` helper examples, as registry cards. */
export const uiExamples = toExampleDemos(examples)
