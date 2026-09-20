/**
 * `TimeSlots` — availability chips grouped by time of day, with the same dual-mode render as
 * {@link Calendar}: `<button>` when `onSelectSlot` is supplied, `<a href>` when it is not, so the
 * no-JS path and the island render from one definition.
 *
 * Grouping uses `displayTime` when the caller supplies it (the visitor's own zone) and falls back
 * to `time` (the host-local value the server books against), so the bucket always agrees with the
 * string on the chip.
 */

import { cn } from "@preact-components/cn"

/** The three buckets a slot can fall into. */
export type TimeSlotPeriod = "morning" | "afternoon" | "evening"

export interface TimeSlot {
  /** Host-local `HH:MM` — the authoritative value the server books against. */
  time: string
  available: boolean
  /** Optional visitor-zone `HH:MM`. Displayed and grouped by when present. */
  displayTime?: string
}

/** Slots of one period, in the order the caller supplied them. */
export interface TimeSlotGroup {
  period: TimeSlotPeriod
  slots: TimeSlot[]
}

/**
 * Bucket a `HH:MM` string.
 *
 * Boundaries: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–04:59 — the evening
 * bucket is the one that wraps midnight. (The source version documented the same boundaries but
 * bucketed 00:00–04:59 as morning; this is the documented behaviour, not the coded one.)
 */
export function periodFor(time: string): TimeSlotPeriod {
  const hour = Number.parseInt(time.slice(0, 2), 10)
  if (!Number.isFinite(hour)) throw new Error(`expected an HH:MM time, received: ${time}`)
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}

const periodOrder: TimeSlotPeriod[] = ["morning", "afternoon", "evening"]

/** Group slots into non-empty periods, in morning → afternoon → evening order. */
export function groupSlotsByPeriod(slots: readonly TimeSlot[]): TimeSlotGroup[] {
  const buckets: Record<TimeSlotPeriod, TimeSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  }
  for (const slot of slots) {
    buckets[periodFor(slot.displayTime ?? slot.time)].push(slot)
  }
  return periodOrder
    .filter((period) => buckets[period].length > 0)
    .map((period) => ({ period, slots: buckets[period] }))
}

/** Period heading copy. */
export const timeSlotPeriodLabels: Record<TimeSlotPeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

export interface TimeSlotsProps {
  /** `YYYY-MM-DD` the slots belong to, passed back to `onSelectSlot` and into the default href. */
  date: string
  /** Pre-formatted heading, e.g. `"Thursday, 28 August 2026"`. */
  dateLabel: string
  slots: readonly TimeSlot[]
  /** Host-local `HH:MM` of the selected slot. */
  selectedSlot?: string | null
  /**
   * Called when an available slot is picked. Supplying it switches the chips from `<a href>` to
   * `<button>` — the dual-mode contract shared with {@link Calendar}.
   */
  onSelectSlot?: (date: string, slot: string) => void
  /** Slot href in link mode. Defaults to `?date=…&slot=…`, preserving the current path. */
  slotHref?: (date: string, slot: string) => string
  /** Shown when there is nothing to pick. Defaults to `No available times on ${dateLabel}.` */
  emptyMessage?: string
  /** Heading copy per period. */
  periodLabels?: Partial<Record<TimeSlotPeriod, string>>
  /** Utilities for the outer container. */
  class?: string
}

const containerClass =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
const chipBase =
  "inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 dark:focus-visible:ring-purple-400 dark:focus-visible:ring-offset-gray-800"
const chipIdle =
  "border-gray-200 bg-white text-gray-900 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-purple-500 dark:hover:bg-purple-900/30 dark:hover:text-purple-200"
const chipSelected =
  "cursor-default border-purple-900 bg-purple-900 font-semibold text-white dark:border-purple-700 dark:bg-purple-700"
const chipUnavailable =
  "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through decoration-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"

export function TimeSlots(
  {
    date,
    dateLabel,
    slots,
    selectedSlot,
    onSelectSlot,
    slotHref = (slotDate, slot) => `?date=${slotDate}&slot=${encodeURIComponent(slot)}`,
    emptyMessage = `No available times on ${dateLabel}.`,
    periodLabels,
    class: className,
  }: TimeSlotsProps,
) {
  if (slots.length === 0) {
    return (
      <div
        class={cn(
          containerClass,
          "px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400",
          className,
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  const labels = { ...timeSlotPeriodLabels, ...periodLabels }

  return (
    <div class={cn(containerClass, className)}>
      <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{dateLabel}</h3>
      </div>

      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {groupSlotsByPeriod(slots).map((group) => (
          <div key={group.period} class="px-5 py-4">
            <h4 class="mb-3 text-[11px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500">
              {labels[group.period]}
            </h4>
            <div class="flex flex-wrap gap-2">
              {group.slots.map((slot) => (
                <TimeSlotChip
                  key={slot.time}
                  date={date}
                  slot={slot}
                  selected={selectedSlot === slot.time}
                  onSelect={onSelectSlot}
                  href={slotHref}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimeSlotChip(
  { date, slot, selected, onSelect, href }: {
    date: string
    slot: TimeSlot
    selected: boolean
    onSelect?: (date: string, slot: string) => void
    href: (date: string, slot: string) => string
  },
) {
  // What the visitor sees, which is also what the period was derived from.
  const shown = slot.displayTime ?? slot.time

  if (selected) {
    return (
      <span aria-current="true" title="Selected" class={cn(chipBase, chipSelected)}>{shown}</span>
    )
  }

  if (!slot.available) {
    return (
      <span aria-disabled="true" title="Already booked" class={cn(chipBase, chipUnavailable)}>
        {shown}
      </span>
    )
  }

  return onSelect
    ? (
      <button
        type="button"
        onClick={() => onSelect(date, slot.time)}
        class={cn(chipBase, chipIdle)}
      >
        {shown}
      </button>
    )
    : <a href={href(date, slot.time)} class={cn(chipBase, chipIdle)}>{shown}</a>
}
