import { cn } from "@preact-components/cn"
import { useSignal } from "@preact/signals"
import { useEffect, useId, useRef } from "preact/hooks"
import { Button, buttonClasses } from "./button.tsx"
import {
  type DateRange,
  type DateRangePreset,
  isValidDateRange,
  rangeForPreset,
} from "./date-range.ts"

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
}

/** The English every label falls back to. */
const defaultLabels: Required<DateRangePickerLabels> = {
  menuLabel: "Date range",
  placeholder: "Any dates",
  from: "From",
  to: "To",
  apply: "Apply",
  cancel: "Cancel",
}

export interface DateRangePickerProps {
  /** Controlled value; `null` until the caller has a range. */
  range: DateRange | null
  /** Called with the new inclusive range when a preset or the custom panel commits. */
  onChange: (range: DateRange) => void
  /** IANA zone that resolves "today". Required: the server's zone is not the visitor's. */
  timeZone: string
  /** Preset list in render order, each with the caller's label. Include `"custom"` to show the fields. */
  presets: readonly DateRangePresetOption[]
  /** User-facing copy. Every entry defaults to English, so this and each key in it are optional. */
  labels?: DateRangePickerLabels
  /** Preset to highlight, e.g. from {@link presetForRange}. */
  selectedPreset?: DateRangePreset
  /** Instant the presets resolve against; defaults to the clock, read when a button is pressed. */
  now?: Date
  /** Renders the chosen range in the trigger. Defaults to `from → to` (ISO). */
  formatRange?: (range: DateRange) => string
  /** Extra utilities for the root container. */
  class?: string
  /** Sets `data-e2e` on the trigger. */
  dataE2E?: string
}

const panelClasses =
  "absolute z-10 mt-2 w-80 rounded-md bg-white p-3 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-gray-600"

const dateInputClasses =
  "mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"

const fieldLabelClasses = "block text-xs font-medium text-gray-700 dark:text-gray-300"

const pressedPresetClasses = "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"

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
 * A close driven from outside it does not, and there are two of those. An outside click leaves
 * focus on whatever was clicked. And an Escape press is only a return when focus was still inside
 * the component: the panel stays open behind a Tab — focus merely leaving it is not a close here,
 * as it never has been — so Escape can arrive from somewhere the person has since walked to, and
 * pulling them back there would be one more way to lose their place rather than a way to keep it.
 *
 * @param props See {@link DateRangePickerProps}.
 */
export function DateRangePicker(
  {
    range,
    onChange,
    timeZone,
    presets,
    labels,
    selectedPreset,
    now,
    formatRange,
    class: className,
    dataE2E,
  }: DateRangePickerProps,
) {
  const isOpen = useSignal(false)
  const usingCustom = useSignal(false)
  const draftFrom = useSignal(range?.from ?? "")
  const draftTo = useSignal(range?.to ?? "")
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
  }

  const showsCustom = presets.some((option) => option.preset === "custom")
  const draft = { from: draftFrom.value, to: draftTo.value }
  const canApply = isValidDateRange(draft)

  // `Custom…` is pressed exactly while the custom fields are the live choice: the caller says the
  // chosen range is the custom one, or the person has reached for the fields in this panel — by
  // activating the button, or by typing into either of them. Reading the button's state off the
  // same signal the fields write is what stops the announced state and the visible one disagreeing.
  const customPressed = usingCustom.value || selectedPreset === "custom"
  const isPressed = (preset: DateRangePreset) =>
    preset === "custom" ? customPressed : preset === selectedPreset

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
      // The same question the outside-click branch asks, and for the same reason. A Tab out leaves
      // this panel open behind the person, so an Escape press can arrive from somewhere they have
      // since walked to; returning focus then would drag them back across the page, which is the
      // defect this component was fixed for rather than a fix for it. Focus goes back only when
      // they were still inside when they pressed the key.
      closePanel(rootRef.current?.contains(document.activeElement) === true)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  /** Opens the panel, seeding the draft from the controlled value so typing resumes where it left off. */
  const openPanel = () => {
    draftFrom.value = range?.from ?? ""
    draftTo.value = range?.to ?? ""
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
    if (preset === "custom") {
      // Nothing opens the panel here. This button is rendered inside the panel, which carries
      // `hidden` while the panel is closed, so it cannot be pressed unless the panel is open
      // already — the branch #106 described was unreachable.
      usingCustom.value = true
      fromRef.current?.focus()
      return
    }
    usingCustom.value = false
    onChange(rangeForPreset(preset, { now: instant(), timeZone }))
    closePanel(true)
  }

  const applyCustom = () => {
    if (!canApply) return
    onChange(rangeForPreset("custom", { now: instant(), timeZone, custom: draft }))
    closePanel(true)
  }

  const cancelCustom = () => {
    draftFrom.value = range?.from ?? ""
    draftTo.value = range?.to ?? ""
    usingCustom.value = false
    closePanel(true)
  }

  const triggerText = range
    ? formatRange?.(range) ?? `${range.from} → ${range.to}`
    : text.placeholder

  return (
    <div class={cn("relative inline-flex text-left", className)} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        class={buttonClasses("outline", "sm", "min-w-48 justify-between gap-2 truncate")}
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
          {presets.map((option) => {
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
          <div class="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-600">
            <div>
              <label class={fieldLabelClasses} for={fromId}>{text.from}</label>
              <input
                id={fromId}
                ref={fromRef}
                type="date"
                class={dateInputClasses}
                value={draftFrom.value}
                onInput={(event) => {
                  draftFrom.value = event.currentTarget.value
                  usingCustom.value = true
                }}
                data-e2e="date-range-from"
              />
            </div>
            <div>
              <label class={fieldLabelClasses} for={toId}>{text.to}</label>
              <input
                id={toId}
                type="date"
                class={dateInputClasses}
                value={draftTo.value}
                onInput={(event) => {
                  draftTo.value = event.currentTarget.value
                  usingCustom.value = true
                }}
                data-e2e="date-range-to"
              />
            </div>
            <div class="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelCustom}>{text.cancel}</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={applyCustom}
                disabled={!canApply}
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
