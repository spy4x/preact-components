import { cn } from "@spy4x/preact-cn"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Button, buttonClasses } from "./button.tsx"
import { type DateRange, isValidDateRange } from "@spy4x/time/date"
import {
  type DateRangePreset,
  type DateTimeRange,
  type ExactDateTimeRange,
  exactDateTimeRange,
  isValidDateTimeRange,
  occurrenceOf,
  rangeForPreset,
  rangeForTimePreset,
  resolveDateTime,
  type ResolvedDateTime,
  type TimeRangePreset,
  timeRangePresets,
  type WallClockOccurrence,
} from "./date-range.ts"
import { tzOffsetMinutes, WallClockKind } from "@spy4x/time/tz"

/** One option of the preset list: the maths identifier plus the caller's label for it. */
export interface DateRangePresetOption {
  preset: DateRangePreset
  /**
   * User-facing copy, and the one string on this component with no default. The caller decides
   * which presets to show and how to word each of them for its own audience — "Last 7 days" or
   * "Past week" is part of choosing the option, not a translation of a fixed one — so the wording
   * arrives with the option.
   */
  label: string
}

/**
 * Every string the panel renders.
 *
 * Each entry has an English default, so the object and every key in it are optional: a caller who
 * says nothing gets English, and a caller who needs one word changed passes that one word.
 */
export interface DateRangePickerLabels {
  /**
   * Accessible name of the panel, applied as `aria-label` on it. The trigger takes its name from
   * its own visible text instead — WCAG 2.5.3 needs the accessible name to contain the visible
   * label, and an `aria-label` here would replace the range the user sees. Same split as
   * `Dropdown`, which spells it out as a required prop: `triggerNamedByContent` is this case, and
   * `triggerLabel` is the icon-trigger case this component does not have.
   */
  menuLabel?: string
  /** Trigger text while no range is chosen. */
  placeholder?: string
  /** Label of the start-date field. */
  from?: string
  /** Label of the end-date field. */
  to?: string
  /** Text of the button that commits the custom range. */
  apply?: string
  /** Text of the button that discards the custom draft. */
  cancel?: string
  /** Text of the "last hour" preset. Rendered only when `withTime` is on. */
  lastHour?: string
  /** Text of the "last 24 hours" preset. Rendered only when `withTime` is on. */
  last24Hours?: string
  /**
   * Legend of the choice shown under a `withTime` field whose value happens twice that day, because
   * the clocks go back.
   */
  repeatedTime?: string
  /** The choice for the first of a repeated time's two passes; its UTC offset follows it. */
  earlierOccurrence?: string
  /** The choice for the second of a repeated time's two passes; its UTC offset follows it. */
  laterOccurrence?: string
  /**
   * The note shown under a `withTime` field whose value the clocks skip. Handed the
   * `YYYY-MM-DDTHH:mm` value the time is read as instead (see `resolveDateTime`).
   */
  skippedTime?: (readsAs: string) => string
  /**
   * The note shown above Apply in `withTime` mode when both ends resolve but `from` comes after
   * `to` — for instance because a skipped `from` was read forward past `to`.
   */
  outOfOrder?: string
}

/** The English every label falls back to. */
const defaultLabels: Required<DateRangePickerLabels> = {
  menuLabel: "Date range",
  placeholder: "Any dates",
  from: "From",
  to: "To",
  apply: "Apply",
  cancel: "Cancel",
  lastHour: "Last hour",
  last24Hours: "Last 24 hours",
  repeatedTime: "This time happens twice that day",
  earlierOccurrence: "First, before the clocks go back",
  laterOccurrence: "Second, after the clocks go back",
  skippedTime: (readsAs) =>
    `The clocks skip this time that day, so it is read as ${readsAs.replace("T", " ")}.`,
  outOfOrder: "From comes after To, so there is nothing to apply.",
}

/** Props shared by both of {@link AnyDateRangePickerProps}'s two shapes. */
interface DateRangePickerSharedProps {
  /** IANA zone that resolves "today". Required: the server's zone is not the visitor's. */
  timeZone: string
  /** User-facing copy. Every entry defaults to English, so this and each key in it are optional. */
  labels?: DateRangePickerLabels
  /** Instant the presets resolve against; defaults to the clock, read when a button is pressed. */
  now?: Date
  /** Extra utilities for the root container. */
  class?: string
  /** Sets `data-e2e` on the trigger. */
  dataE2E?: string
}

/**
 * Props for {@link DateRangePicker} with `withTime` off (the default): calendar days, no time of
 * day. This is the name and the shape the component has always had — `withTime` only adds the
 * optional `withTime?: false` field, which every caller from before this option existed already
 * satisfies by not setting it — so `Omit<DateRangePickerProps, "timeZone">` wrappers, a bare
 * `props.presets` read, and `DateRangePickerProps["onChange"]` all keep compiling unchanged.
 * `date-range-picker.test.tsx` compiles exactly those three shapes as its own proof.
 *
 * {@link AnyDateRangePickerProps} is the type {@link DateRangePicker} itself takes, because it also
 * has to accept {@link DateRangePickerTimeProps}; this interface is what a caller who only ever uses
 * the day-only shape — the common case — still names.
 */
export interface DateRangePickerProps extends DateRangePickerSharedProps {
  withTime?: false
  /** Controlled value; `null` until the caller has a range. */
  range: DateRange | null
  /** Called with the new inclusive range when a preset or the custom panel commits. */
  onChange: (range: DateRange) => void
  /** Preset list in render order, each with the caller's label. Include `"custom"` to show the fields. */
  presets: readonly DateRangePresetOption[]
  /** Preset to highlight, e.g. from {@link presetForRange}. */
  selectedPreset?: DateRangePreset
  /** Renders the chosen range in the trigger. Defaults to `from → to` (ISO). */
  formatRange?: (range: DateRange) => string
}

/**
 * {@link AnyDateRangePickerProps} with `withTime` on: From and To are `datetime-local` fields, and
 * the panel also offers `"last-hour"` and `"last-24-hours"`, the two presets that only make sense
 * with a time of day.
 *
 * No `presets` prop: unlike the day list, these two are the component's own, named and ordered the
 * way `labels`' fixed strings are — an English default per entry, overridden through `labels` — so
 * there is nothing for a caller to assemble. The custom From/To fields are always present in this
 * mode, for the same reason: a timed value can only come from typing one or from a preset, and with
 * only two fixed presets a picker that could not also be typed into would cover very little.
 */
export interface DateRangePickerTimeProps extends DateRangePickerSharedProps {
  withTime: true
  /**
   * Controlled value; `null` until the caller has a range. When it carries `fromInstant` and
   * `toInstant`, the panel reopens on the pass of a repeated hour they name.
   */
  range: DateTimeRange | null
  /**
   * Called with the new inclusive range when a preset or the custom fields commit. It always
   * carries `fromInstant` and `toInstant`, the exact moments the two wall-clock strings mean: read
   * those to query by the range, because a string alone cannot say which of a repeated hour it is.
   */
  onChange: (range: ExactDateTimeRange) => void
  /** Preset to highlight, e.g. from {@link presetForTimeRange}, or `"custom"` for the typed fields. */
  selectedPreset?: TimeRangePreset | "custom"
  /** Renders the chosen range in the trigger. Defaults to `from → to` (ISO wall clock). */
  formatRange?: (range: DateTimeRange) => string
}

/**
 * Every shape {@link DateRangePicker} itself accepts, chosen by `withTime`: the default,
 * {@link DateRangePickerProps}, carries a calendar-day {@link DateRange}, and `withTime: true`
 * carries a timed {@link DateTimeRange} instead — see {@link DateRangePickerTimeProps}. Named
 * separately from {@link DateRangePickerProps} so that name can keep meaning what it always has —
 * see its own doc — rather than becoming a union an existing type reference against it would not
 * expect.
 */
export type AnyDateRangePickerProps = DateRangePickerProps | DateRangePickerTimeProps

const panelClasses =
  "absolute z-10 mt-2 w-80 rounded-md bg-surface p-3 shadow-popover ring-1 ring-subtle"

/**
 * The From and To fields. They carry their own utilities rather than the theme's `.pc-input`, which is
 * `h-12` and would crowd a compact popover, so they also set the dark `color-scheme` themselves: the
 * browser draws a native date field's calendar icon from it, and without it the icon is black on
 * the dark field (#379).
 */
const dateInputClasses =
  "mt-1 block w-full rounded-md border border-control bg-surface px-2 py-1 text-sm text-foreground dark:[color-scheme:dark]"

const fieldLabelClasses = "block text-xs font-medium text-foreground"

/** Important (`!`): they replace the `ghost` button's own fill and weight, which `Button` appends to. */
const pressedPresetClasses = "bg-hover! font-semibold!"

const occurrenceClasses = "mt-1 space-y-1 text-xs text-foreground"

const occurrenceOptionClasses = "flex items-center gap-2"

/** `UTC+02:00` for the offset `timeZone` is at on `instant`. */
function utcOffsetText(instant: string, timeZone: string): string {
  const minutes = tzOffsetMinutes(new Date(instant), timeZone)
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, "0")
  const mm = String(abs % 60).padStart(2, "0")
  return `UTC${sign}${hh}:${mm}`
}

/** {@link resolveDateTime}, or `null` for a value that is incomplete or cannot be resolved. */
function resolveOrNull(value: string, timeZone: string): ResolvedDateTime | null {
  try {
    return resolveDateTime(value, timeZone)
  } catch {
    return null
  }
}

/**
 * The trigger's text for a chosen range: the caller's formatter, or `from → to` (ISO) when there is
 * none. Generic over the range shape so the one fallback string lives in one place; the two call
 * sites in {@link DateRangePicker} still branch on `withTime`, because a union of two `formatRange`
 * signatures cannot be called with a union of their two argument types — only TypeScript's own
 * narrowing on the discriminant lets each call see one concrete shape.
 */
function rangeText<R extends { from: string; to: string }>(
  range: R,
  formatRange: ((range: R) => string) | undefined,
): string {
  return formatRange?.(range) ?? `${range.from} → ${range.to}`
}

/**
 * Preset menu plus a custom from/to panel over {@link rangeForPreset}.
 *
 * Props and ports only: the value is controlled (`range` in, `onChange` out), the preset list comes
 * from the caller, copy is optional and falls back to English, and the clock is either injected
 * (`now`) or read inside a click handler — never during render, which keeps the first render
 * deterministic and server-renderable. Open/closed and the in-progress draft are local visual state.
 *
 * The panel is hand-written rather than built on `Dropdown`: that primitive wraps its panel in
 * `role="menu"`, and a menu may not contain the form controls the custom range needs. The
 * outside-click and Escape handling follow the same handler-only-`document` pattern, and so does
 * naming: `labels.menuLabel` labels the panel, while the trigger is named by its content — the
 * placeholder or the chosen range — so its accessible name contains its visible text (WCAG 2.5.3,
 * Label in Name). An `aria-label` on the trigger would override that text instead of extending it.
 *
 * **Focus follows the panel**, which is the difference between a keyboard user keeping their place
 * and losing it. Opening moves focus inside; a close the person drove **from inside** the panel
 * hands focus back to the trigger, because the next render hides the element their focus is on.
 *
 * A close driven from outside it does not, and there are three of those. An outside click leaves
 * focus on whatever was clicked. Focus leaving the component — a Tab out of the panel — closes it
 * and leaves focus where the Tab went, discarding an unapplied custom range as Cancel does (#198).
 * And an Escape press is only a return when focus was still inside the component: with focus on the
 * page itself the panel is still open, and pulling focus onto the trigger from there would move the
 * person somewhere they did not go.
 *
 * `withTime` changes what From and To accept and what the custom fields hand back — `datetime-local`
 * inputs and a {@link DateTimeRange} — and adds the two presets that only make sense with a time of
 * day, `"last-hour"` and `"last-24-hours"`. Everything else in this doc, the whole focus contract
 * included, holds in that mode too: it is driven by open/closed and by where focus is, neither of
 * which `withTime` touches.
 *
 * @param props See {@link AnyDateRangePickerProps}.
 */
export function DateRangePicker(props: AnyDateRangePickerProps): JSX.Element {
  const { timeZone, labels, now, class: className, dataE2E } = props
  const isOpen = useSignal(false)
  const usingCustom = useSignal(false)
  const draftFrom = useSignal(props.range?.from ?? "")
  const draftTo = useSignal(props.range?.to ?? "")
  /** Which pass of a repeated hour each field names; read only in `withTime` mode. */
  const timedRange = props.withTime ? props.range : null
  const fromOccurrence = useSignal(seededOccurrence(timedRange, "from", timeZone))
  const toOccurrence = useSignal(seededOccurrence(timedRange, "to", timeZone))
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const fromRef = useRef<HTMLInputElement>(null)
  /** Set by whichever close path wants the trigger focused again; read once by the effect below. */
  const returnsFocus = useRef(false)
  const id = useId()
  const panelId = `${id}-panel`
  const fromId = `${id}-from`
  const toId = `${id}-to`

  // Read entry by entry rather than with a spread, so a caller that passes `{ from: undefined }`
  // gets the English default for that key instead of nothing at all.
  const text: Required<DateRangePickerLabels> = {
    menuLabel: labels?.menuLabel ?? defaultLabels.menuLabel,
    placeholder: labels?.placeholder ?? defaultLabels.placeholder,
    from: labels?.from ?? defaultLabels.from,
    to: labels?.to ?? defaultLabels.to,
    apply: labels?.apply ?? defaultLabels.apply,
    cancel: labels?.cancel ?? defaultLabels.cancel,
    lastHour: labels?.lastHour ?? defaultLabels.lastHour,
    last24Hours: labels?.last24Hours ?? defaultLabels.last24Hours,
    repeatedTime: labels?.repeatedTime ?? defaultLabels.repeatedTime,
    earlierOccurrence: labels?.earlierOccurrence ?? defaultLabels.earlierOccurrence,
    laterOccurrence: labels?.laterOccurrence ?? defaultLabels.laterOccurrence,
    skippedTime: labels?.skippedTime ?? defaultLabels.skippedTime,
    outOfOrder: labels?.outOfOrder ?? defaultLabels.outOfOrder,
  }

  // Time mode has no caller-supplied preset list — see `DateRangePickerTimeProps` — so its custom
  // fields are unconditional; day mode keeps the existing opt-in through a `"custom"` entry.
  const showsCustom = props.withTime || props.presets.some((option) => option.preset === "custom")
  const draft = { from: draftFrom.value, to: draftTo.value }
  // In `withTime` mode the draft is resolved in the picker's zone, with the pass of a repeated hour
  // the person chose for each end, and Apply waits until that resolves to two ordered instants.
  const exactDraft = props.withTime
    ? exactOrNull(draft, timeZone, { from: fromOccurrence.value, to: toOccurrence.value })
    : null
  const canApply = props.withTime
    ? exactDraft !== null && isValidDateTimeRange(exactDraft)
    : isValidDateRange(draft)

  // What each `withTime` field has to say about its own value, resolved once here so the field's
  // `aria-describedby` and the note it points at are decided by the same answer.
  const fromResolved = props.withTime ? resolveOrNull(draftFrom.value, timeZone) : null
  const toResolved = props.withTime ? resolveOrNull(draftTo.value, timeZone) : null
  // Both ends resolve on their own, so the only thing that can have stopped `exactDraft` is order.
  const outOfOrder = fromResolved !== null && toResolved !== null && exactDraft === null
  const fromNoteId = `${fromId}-wall-clock`
  const toNoteId = `${toId}-wall-clock`
  const orderId = `${id}-order`
  /** `aria-describedby` for one `withTime` field: its own note, and the order note, when shown. */
  const describedBy = (resolved: ResolvedDateTime | null, noteId: string) => {
    const ids = [
      ...(hasWallClockNote(resolved) ? [noteId] : []),
      ...(outOfOrder ? [orderId] : []),
    ]
    return ids.length === 0 ? undefined : ids.join(" ")
  }

  // `Custom…` is pressed exactly while the custom fields are the live choice: the caller says the
  // chosen range is the custom one, or the person has reached for the fields in this panel — by
  // activating the button, or by typing into either of them. Reading the button's state off the
  // same signal the fields write is what stops the announced state and the visible one disagreeing.
  const customPressed = usingCustom.value || props.selectedPreset === "custom"
  const isPressed = (preset: DateRangePreset | TimeRangePreset) =>
    preset === "custom" ? customPressed : preset === props.selectedPreset

  /**
   * Close the panel, saying whether the trigger should get focus back.
   *
   * The effect below sees only the open state, and the open state cannot say *why* it changed —
   * which is the whole question, since an outside click and an Escape press leave the panel closed
   * in exactly the same way. The reason is known here, so it is recorded in a ref the effect reads
   * once and clears. Two callers decide `returnFocus` by asking where focus is rather than by
   * knowing: the outside-click branch and the Escape branch, because either can be driven by a
   * person who is no longer inside the component.
   *
   * This closure is also the one the document listeners capture on the first render and keep. That
   * is safe because everything it touches is stable across renders: a ref object and a signal.
   *
   * @param returnFocus `true` for a close the user drove from inside the panel.
   */
  const closePanel = (returnFocus: boolean) => {
    returnsFocus.current = returnFocus
    isOpen.value = false
  }

  /**
   * Move focus into the panel the render has just revealed.
   *
   * The pressed preset comes first, so a screen reader announces the choice the panel opens on —
   * "Last 7 days, pressed" — and a keyboard user starts on the control they are most likely to
   * change. With nothing pressed the first preset says the same sentence without the state. A panel
   * with no presets at all falls back to the group itself, which is why it carries `tabindex="-1"`;
   * that announces the panel's own name rather than a control, which is the least useful of the
   * three and the reason it is last.
   */
  const focusIntoPanel = () => {
    const panel = panelRef.current
    if (panel === null) return
    const pressed = panel.querySelector<HTMLElement>('button[aria-pressed="true"]')
    const target = pressed ?? panel.querySelector<HTMLElement>("button, input") ?? panel
    target.focus()
  }

  // Focus has to move *after* the render that reveals the panel. The panel is rendered with
  // `hidden`, so while it is closed its subtree is `display: none`, and Chromium refuses to focus
  // anything inside one: a `focus()` call in the same tick as the signal write fires no focus event
  // at all. #106 measured exactly that. An effect keyed on the open state runs once the DOM is
  // committed, which is the earliest moment there is something focusable to focus.
  useEffect(() => {
    if (isOpen.value) {
      focusIntoPanel()
      return
    }
    if (!returnsFocus.current) return
    returnsFocus.current = false
    triggerRef.current?.focus()
  }, [isOpen.value])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!isOpen.value) return
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        // No focus return: the person has just put focus on whatever they clicked.
        closePanel(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen.value || event.key !== "Escape") return
      // The same question the outside-click branch asks, and for the same reason. A Tab out closes
      // the panel, but focus can still fall to the page itself with the panel open — a scripted
      // blur, a focused control that vanished — and an Escape press from there is not a press from
      // inside. Focus goes back only when they were still inside when they pressed the key.
      closePanel(rootRef.current?.contains(document.activeElement) === true)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  /**
   * Closes the panel when focus leaves the component, the way `Dropdown` does (#198), and leaves
   * focus wherever it went: the person chose to go there. An unapplied custom range is discarded,
   * as Cancel discards it — the next open reseeds the draft from the caller's value.
   *
   * Focus moving between the panel's own controls, into a date field or back to the trigger stays
   * inside the root and closes nothing. A null `relatedTarget` is either focus going somewhere the
   * event cannot name or focus going nowhere, so that case waits a tick and reads where focus ended
   * up: on the page itself (a scripted blur, a control that vanished) the panel stays open, and so
   * it does while a date field's native picker holds the window's focus, because the field is still
   * the document's active element then.
   */
  const handleFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null
    if (next !== null) {
      if (isOpen.value && !rootRef.current?.contains(next)) closePanel(false)
      return
    }
    setTimeout(() => {
      const root = rootRef.current
      if (!isOpen.value || root === null) return
      const active = document.activeElement
      if (active !== null && active !== document.body && !root.contains(active)) closePanel(false)
    }, 0)
  }

  /** Opens the panel, seeding the draft from the controlled value so typing resumes where it left off. */
  /** Resets the draft, the chosen passes of a repeated hour included, to the caller's value. */
  const reseedDraft = () => {
    draftFrom.value = props.range?.from ?? ""
    draftTo.value = props.range?.to ?? ""
    fromOccurrence.value = seededOccurrence(timedRange, "from", timeZone)
    toOccurrence.value = seededOccurrence(timedRange, "to", timeZone)
  }

  const openPanel = () => {
    reseedDraft()
    // The draft is reseeded from the caller's value, so the pressed state is reseeded from the
    // caller's choice: a custom draft that was abandoned last time does not come back pressed.
    usingCustom.value = false
    isOpen.value = true
  }

  const togglePanel = () => {
    // Closing from the trigger returns focus to the trigger, which is where the person already is.
    if (isOpen.value) closePanel(true)
    else openPanel()
  }

  const instant = () => now ?? new Date()

  const selectPreset = (preset: DateRangePreset) => {
    if (props.withTime) return // day-only presets are not rendered in this mode
    if (preset === "custom") {
      // Nothing opens the panel here. This button is rendered inside the panel, which carries
      // `hidden` while the panel is closed, so it cannot be pressed unless the panel is open
      // already — the branch #106 described was unreachable.
      usingCustom.value = true
      fromRef.current?.focus()
      return
    }
    usingCustom.value = false
    props.onChange(rangeForPreset(preset, { now: instant(), timeZone }))
    closePanel(true)
  }

  /** Selects `"last-hour"` or `"last-24-hours"`, `withTime`'s own two built-in presets. */
  const selectTimePreset = (preset: TimeRangePreset) => {
    if (!props.withTime) return // these buttons are not rendered outside this mode
    usingCustom.value = false
    const timeRange = rangeForTimePreset(preset, { now: instant(), timeZone })
    draftFrom.value = timeRange.from
    draftTo.value = timeRange.to
    fromOccurrence.value = occurrenceOf(timeRange.from, timeRange.fromInstant, timeZone)
    toOccurrence.value = occurrenceOf(timeRange.to, timeRange.toInstant, timeZone)
    props.onChange(timeRange)
    closePanel(true)
  }

  const applyCustom = () => {
    if (!canApply) return
    if (props.withTime) {
      if (exactDraft !== null) props.onChange(exactDraft)
    } else {
      props.onChange(rangeForPreset("custom", { now: instant(), timeZone, custom: draft }))
    }
    closePanel(true)
  }

  const cancelCustom = () => {
    reseedDraft()
    usingCustom.value = false
    closePanel(true)
  }

  const triggerText = !props.range
    ? text.placeholder
    : props.withTime
    ? rangeText(props.range, props.formatRange)
    : rangeText(props.range, props.formatRange)

  return (
    <div
      class={cn("relative inline-flex text-left", className)}
      ref={rootRef}
      onFocusOut={handleFocusOut}
    >
      <button
        type="button"
        ref={triggerRef}
        class={buttonClasses("outline", "sm", "min-w-48 justify-between! truncate")}
        onClick={togglePanel}
        aria-expanded={isOpen.value}
        aria-controls={panelId}
        data-e2e={dataE2E}
      >
        <span>{triggerText}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        hidden={!isOpen.value}
        role="group"
        aria-label={text.menuLabel}
        class={panelClasses}
      >
        <div class="flex flex-wrap gap-1">
          {props.withTime
            ? timeRangePresets.map((preset) => {
              const pressed = isPressed(preset)
              const label = preset === "last-hour" ? text.lastHour : text.last24Hours
              return (
                <button
                  key={preset}
                  type="button"
                  class={buttonClasses("ghost", "sm", pressed ? pressedPresetClasses : undefined)}
                  aria-pressed={pressed}
                  onClick={() => selectTimePreset(preset)}
                  data-e2e={`date-range-preset-${preset}`}
                >
                  {label}
                </button>
              )
            })
            : props.presets.map((option) => {
              const pressed = isPressed(option.preset)
              return (
                <button
                  key={option.preset}
                  type="button"
                  class={buttonClasses("ghost", "sm", pressed ? pressedPresetClasses : undefined)}
                  aria-pressed={pressed}
                  onClick={() => selectPreset(option.preset)}
                  data-e2e={`date-range-preset-${option.preset}`}
                >
                  {option.label}
                </button>
              )
            })}
        </div>
        {showsCustom && (
          <div class="mt-3 space-y-2 border-t border-subtle pt-3">
            <div>
              <label
                class={fieldLabelClasses}
                for={fromId}
                id={props.withTime ? `${fromId}-label` : undefined}
              >
                {text.from}
              </label>
              <input
                id={fromId}
                ref={fromRef}
                type={props.withTime ? "datetime-local" : "date"}
                class={dateInputClasses}
                value={draftFrom.value}
                onInput={(event) => {
                  draftFrom.value = event.currentTarget.value
                  usingCustom.value = true
                }}
                aria-describedby={describedBy(fromResolved, fromNoteId)}
                data-e2e="date-range-from"
              />
              {props.withTime && (
                <WallClockNote
                  resolved={fromResolved}
                  id={fromNoteId}
                  fieldLabelId={`${fromId}-label`}
                  timeZone={timeZone}
                  occurrence={fromOccurrence.value}
                  onOccurrence={(next) => {
                    fromOccurrence.value = next
                    usingCustom.value = true
                  }}
                  name={`${id}-from-occurrence`}
                  text={text}
                  dataE2E="date-range-from"
                />
              )}
            </div>
            <div>
              <label
                class={fieldLabelClasses}
                for={toId}
                id={props.withTime ? `${toId}-label` : undefined}
              >
                {text.to}
              </label>
              <input
                id={toId}
                type={props.withTime ? "datetime-local" : "date"}
                class={dateInputClasses}
                value={draftTo.value}
                onInput={(event) => {
                  draftTo.value = event.currentTarget.value
                  usingCustom.value = true
                }}
                aria-describedby={describedBy(toResolved, toNoteId)}
                data-e2e="date-range-to"
              />
              {props.withTime && (
                <WallClockNote
                  resolved={toResolved}
                  id={toNoteId}
                  fieldLabelId={`${toId}-label`}
                  timeZone={timeZone}
                  occurrence={toOccurrence.value}
                  onOccurrence={(next) => {
                    toOccurrence.value = next
                    usingCustom.value = true
                  }}
                  name={`${id}-to-occurrence`}
                  text={text}
                  dataE2E="date-range-to"
                />
              )}
            </div>
            {outOfOrder && (
              <p id={orderId} class={occurrenceClasses} data-e2e="date-range-order">
                {text.outOfOrder}
              </p>
            )}
            <div class="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelCustom}>{text.cancel}</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={applyCustom}
                disabled={!canApply}
                aria-describedby={outOfOrder ? orderId : undefined}
                data-e2e="date-range-apply"
              >
                {text.apply}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The pass of a repeated hour one end of a controlled value names, `"earlier"` when it names none. */
function seededOccurrence(
  range: DateTimeRange | null,
  end: "from" | "to",
  timeZone: string,
): WallClockOccurrence {
  const instant = end === "from" ? range?.fromInstant : range?.toInstant
  return range === null || instant === undefined
    ? "earlier"
    : occurrenceOf(range[end], instant, timeZone)
}

/** {@link exactDateTimeRange}, or `null` for a draft that is incomplete, unresolvable or reversed. */
function exactOrNull(
  draft: DateTimeRange,
  timeZone: string,
  occurrences: { from: WallClockOccurrence; to: WallClockOccurrence },
): ExactDateTimeRange | null {
  try {
    return exactDateTimeRange(draft, timeZone, occurrences)
  } catch {
    return null
  }
}

/** Whether a resolved value is skipped or repeated, which is when {@link WallClockNote} shows. */
function hasWallClockNote(resolved: ResolvedDateTime | null): boolean {
  return resolved !== null && resolved.kind !== WallClockKind.Unique
}

/** Props of {@link WallClockNote}. */
interface WallClockNoteProps {
  /** The field's draft resolved in the picker's zone, or `null` while it cannot be. */
  resolved: ResolvedDateTime | null
  /** Id of the note or fieldset, which the field's `aria-describedby` names. */
  id: string
  /** Id of the field's own `<label>`, which starts the fieldset's accessible name. */
  fieldLabelId: string
  timeZone: string
  occurrence: WallClockOccurrence
  onOccurrence: (next: WallClockOccurrence) => void
  /** Shared `name` of the two radios, unique per field. */
  name: string
  text: Required<DateRangePickerLabels>
  /** Prefix of the `data-e2e` hooks: `<prefix>-occurrence`, `<prefix>-skipped`. */
  dataE2E: string
}

/**
 * What a `withTime` field needs to say about its value in the picker's zone, rendered under it.
 *
 * A time the clocks repeat gets a choice between its two passes, each named with its UTC offset,
 * because the string alone cannot say which one the person means (#264). A time the clocks skip
 * gets a note saying what it is read as instead; Apply still works, and hands back that reading.
 * An ordinary time, or an incomplete one, renders nothing.
 *
 * Either one carries `id`, which the field's `aria-describedby` names, so a screen reader hears it
 * with the field. The radio group is named by the field's own label followed by its legend
 * ("From This time happens twice that day"), so the From and To groups do not share one name.
 */
function WallClockNote(props: WallClockNoteProps): JSX.Element | null {
  const { resolved, id, fieldLabelId, timeZone, occurrence, onOccurrence, name, text, dataE2E } =
    props
  if (resolved === null || !hasWallClockNote(resolved)) return null

  if (resolved.kind === WallClockKind.Gap) {
    return (
      <p id={id} class={occurrenceClasses} data-e2e={`${dataE2E}-skipped`}>
        {text.skippedTime(resolved.reads)}
      </p>
    )
  }

  const choices: { occurrence: WallClockOccurrence; label: string; instant: string }[] = [
    { occurrence: "earlier", label: text.earlierOccurrence, instant: resolved.instant },
    {
      occurrence: "later",
      label: text.laterOccurrence,
      instant: resolved.later ?? resolved.instant,
    },
  ]
  return (
    <fieldset
      id={id}
      class={occurrenceClasses}
      aria-labelledby={`${fieldLabelId} ${id}-legend`}
      data-e2e={`${dataE2E}-occurrence`}
    >
      <legend id={`${id}-legend`} class="font-medium">{text.repeatedTime}</legend>
      {choices.map((choice) => (
        <label key={choice.occurrence} class={occurrenceOptionClasses}>
          <input
            type="radio"
            name={name}
            value={choice.occurrence}
            checked={occurrence === choice.occurrence}
            onChange={() => onOccurrence(choice.occurrence)}
            data-e2e={`${dataE2E}-${choice.occurrence}`}
          />
          <span>
            {choice.label} ({utcOffsetText(choice.instant, timeZone)})
          </span>
        </label>
      ))}
    </fieldset>
  )
}
