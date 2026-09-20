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
  /** User-facing copy. The library ships none, so this is required. */
  label: string
}

/** Every string the panel renders. Passed in so the library stays locale-free. */
export interface DateRangePickerLabels {
  /**
   * Accessible name of the panel, applied as `aria-label` on it. The trigger takes its name from
   * its own visible text instead — WCAG 2.5.3 needs the accessible name to contain the visible
   * label, and an `aria-label` here would replace the range the user sees. Same split as
   * `Dropdown`, which spells it out as a required prop: `triggerNamedByContent` is this case, and
   * `triggerLabel` is the icon-trigger case this component does not have.
   */
  menuLabel: string
  /** Trigger text while no range is chosen. */
  placeholder: string
  /** Label of the start-date field. */
  from: string
  /** Label of the end-date field. */
  to: string
  /** Text of the button that commits the custom range. */
  apply: string
  /** Text of the button that discards the custom draft. */
  cancel: string
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
  /** All user-facing copy. */
  labels: DateRangePickerLabels
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

/**
 * Preset menu plus a custom from/to panel over {@link rangeForPreset}.
 *
 * Props and ports only: the value is controlled (`range` in, `onChange` out), copy and the preset
 * list come from the caller, and the clock is either injected (`now`) or read inside a click
 * handler — never during render, which keeps the first render deterministic and server-renderable.
 * Open/closed and the in-progress draft are local visual state.
 *
 * The panel is hand-written rather than built on `Dropdown`: that primitive wraps its panel in
 * `role="menu"`, and a menu may not contain the form controls the custom range needs. The
 * outside-click and Escape handling follow the same handler-only-`document` pattern, and so does
 * naming: `labels.menuLabel` labels the panel, while the trigger is named by its content — the
 * placeholder or the chosen range — so its accessible name contains its visible text (WCAG 2.5.3,
 * Label in Name). An `aria-label` on the trigger would override that text instead of extending it.
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
  const draftFrom = useSignal(range?.from ?? "")
  const draftTo = useSignal(range?.to ?? "")
  const rootRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const panelId = `${id}-panel`
  const fromId = `${id}-from`
  const toId = `${id}-to`

  const showsCustom = presets.some((option) => option.preset === "custom")
  const draft = { from: draftFrom.value, to: draftTo.value }
  const canApply = isValidDateRange(draft)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!isOpen.value) return
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        isOpen.value = false
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen.value && event.key === "Escape") isOpen.value = false
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
    isOpen.value = true
  }

  const togglePanel = () => {
    if (isOpen.value) isOpen.value = false
    else openPanel()
  }

  const instant = () => now ?? new Date()

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      if (!isOpen.value) openPanel()
      fromRef.current?.focus()
      return
    }
    onChange(rangeForPreset(preset, { now: instant(), timeZone }))
    isOpen.value = false
  }

  const applyCustom = () => {
    if (!canApply) return
    onChange(rangeForPreset("custom", { now: instant(), timeZone, custom: draft }))
    isOpen.value = false
  }

  const cancelCustom = () => {
    draftFrom.value = range?.from ?? ""
    draftTo.value = range?.to ?? ""
    isOpen.value = false
  }

  const triggerText = range
    ? formatRange?.(range) ?? `${range.from} → ${range.to}`
    : labels.placeholder

  return (
    <div class={cn("relative inline-flex text-left", className)} ref={rootRef}>
      <button
        type="button"
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
        hidden={!isOpen.value}
        role="group"
        aria-label={labels.menuLabel}
        class={panelClasses}
      >
        <div class="flex flex-wrap gap-1">
          {presets.map((option) => (
            <button
              key={option.preset}
              type="button"
              class={buttonClasses(
                "ghost",
                "sm",
                option.preset === selectedPreset
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                  : undefined,
              )}
              aria-pressed={option.preset === selectedPreset}
              onClick={() => selectPreset(option.preset)}
              data-e2e={`date-range-preset-${option.preset}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {showsCustom && (
          <div class="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-600">
            <div>
              <label class={fieldLabelClasses} for={fromId}>{labels.from}</label>
              <input
                id={fromId}
                ref={fromRef}
                type="date"
                class={dateInputClasses}
                value={draftFrom.value}
                onInput={(event) => draftFrom.value = event.currentTarget.value}
                data-e2e="date-range-from"
              />
            </div>
            <div>
              <label class={fieldLabelClasses} for={toId}>{labels.to}</label>
              <input
                id={toId}
                type="date"
                class={dateInputClasses}
                value={draftTo.value}
                onInput={(event) => draftTo.value = event.currentTarget.value}
                data-e2e="date-range-to"
              />
            </div>
            <div class="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelCustom}>{labels.cancel}</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={applyCustom}
                disabled={!canApply}
                data-e2e="date-range-apply"
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
