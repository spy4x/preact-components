import { join } from "@spy4x/preact-cn/join"
import { hhmmInTz, isoDateInTz, validTimeZoneOr, zonedDateTime, zoneLabel } from "@spy4x/time/tz"
import type { ComponentChildren, JSX } from "preact"
import { Field } from "./field.tsx"
import { Input } from "./input.tsx"
import { useLabels } from "./i18n.tsx"

/** The words a {@link DateTimeField} shows. */
export interface DateTimeFieldLabels {
  /** The line naming the zone the time is read in. Default: `"Time zone: Berlin, Europe · GMT+1"`. */
  zone: (zone: string) => string
}

/** The English words {@link DateTimeField} shows when the caller passes none. */
export const DATE_TIME_FIELD_LABELS: DateTimeFieldLabels = {
  zone: (zone) => `Time zone: ${zone}`,
}

/** Props of {@link DateTimeField}. */
export interface DateTimeFieldProps {
  /** `id` of the input; the zone line is `{id}-zone`. */
  id: string
  /** The field's label. */
  label: ComponentChildren
  /** The moment, as an ISO 8601 instant, or `null` for none. */
  value: string | null
  /** Called with the new moment as an ISO 8601 instant (`toISOString()`), or `null` once cleared. */
  onChange: (value: string | null) => void
  /** The IANA zone the date and time are typed in, such as `"Europe/Berlin"`. An unknown zone falls back to UTC. */
  timeZone: string
  /** The earliest moment the browser's picker offers, as an ISO 8601 instant. */
  min?: string
  /** The latest moment the browser's picker offers, as an ISO 8601 instant. */
  max?: string
  /** Helper text under the field. */
  hint?: ComponentChildren
  /** Message under the field; marks the input `aria-invalid`. */
  error?: string | null
  /** Draws the `*` and sets `required` on the input. */
  required?: boolean
  /** Disables the input. */
  disabled?: boolean
  /** The words shown; see {@link DATE_TIME_FIELD_LABELS}. */
  labels?: Partial<DateTimeFieldLabels>
  /** Utilities on the field. */
  class?: string
}

/**
 * One date and time, typed in a named time zone that the field shows beside the input: the
 * browser's own `datetime-local` picker, read and written as an instant, so the caller stores
 * `2026-10-25T08:30:00.000Z` while the person types 09:30 in Berlin.
 *
 * The zone line carries the offset at the chosen moment (or now, before one is chosen), so a time
 * past a clock change shows its own offset. A time a clock change skips moves forward by the gap,
 * and a time it repeats is the earlier of the two (`zonedDateTime` from `@spy4x/time/tz`).
 * Minutes only: seconds are dropped.
 *
 * Built on `Field`, so the label, the error and the hint are wired to the input; the zone line is
 * part of its description.
 *
 * @param props The moment, its zone and options, see {@link DateTimeFieldProps}.
 */
export function DateTimeField(
  {
    id,
    label,
    value,
    onChange,
    timeZone,
    min,
    max,
    hint,
    error,
    required,
    disabled,
    labels,
    class: className,
  }: DateTimeFieldProps,
): JSX.Element {
  const words = useLabels("DateTimeField", DATE_TIME_FIELD_LABELS, labels, { zone: ["zone"] })
  const zone = validTimeZoneOr(timeZone, "UTC")
  const instant = toInstant(value)
  const zoneId = `${id}-zone`
  const invalid = typeof error === "string" && error.length > 0
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      class={className}
    >
      {(wiring) => (
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Input
            id={wiring.id}
            type="datetime-local"
            step={60}
            value={instant ? wallClock(instant, zone) : ""}
            min={localBound(min, zone)}
            max={localBound(max, zone)}
            required={required}
            disabled={disabled}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={join(zoneId, wiring["aria-describedby"])}
            class="w-auto max-w-full"
            onInput={(event) => onChange(fromWallClock(event.currentTarget.value, zone))}
          />
          <span id={zoneId} class="text-sm text-muted">
            {words.zone(zoneLabel(zone, instant ?? new Date()))}
          </span>
        </div>
      )}
    </Field>
  )
}

/** The instant in `value`, or `null` when it is missing or cannot be read. */
function toInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `YYYY-MM-DDTHH:MM`, the value a `datetime-local` input holds, as `zone`'s clock reads `instant`. */
function wallClock(instant: Date, zone: string): string {
  return `${isoDateInTz(instant, zone)}T${hhmmInTz(instant, zone)}`
}

/** A `min`/`max` bound as a `datetime-local` value, or `undefined` when there is none. */
function localBound(value: string | undefined, zone: string): string | undefined {
  const instant = toInstant(value)
  return instant ? wallClock(instant, zone) : undefined
}

/**
 * The instant a `datetime-local` value names in `zone`, as an ISO string, or `null` for an empty
 * or unreadable value (a browser that is still between keystrokes reports `""`).
 */
function fromWallClock(text: string, zone: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(text)
  if (!match) return null
  try {
    return zonedDateTime(match[1], match[2], zone).toISOString()
  } catch {
    return null
  }
}
