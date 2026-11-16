import { cn } from "@spy4x/preact-cn"
import { IconChevronLeft, IconChevronRight } from "@spy4x/preact-icons"
import {
  currentPeriod,
  type Period,
  periodLabel,
  type PeriodOptions,
  PeriodUnit,
  shiftPeriod,
} from "@spy4x/time/period"
import type { JSX } from "preact"
import { useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { HotkeyHint } from "./hotkey-hint.tsx"
import { useApplePlatform } from "./hotkeys.ts"
import { useLabels, useT } from "./i18n.tsx"
import { Tooltip } from "./tooltip.tsx"

/** Every word {@link PeriodStepper} shows or announces, one per unit. */
export interface PeriodStepperLabels {
  /** Name of the group while it steps through weeks. */
  groupWeek: string
  /** Name of the group while it steps through months. */
  groupMonth: string
  previousWeek: string
  previousMonth: string
  nextWeek: string
  nextMonth: string
  /** The button back to the week that holds today. */
  currentWeek: string
  /** The button back to the month that holds today. */
  currentMonth: string
}

/** The English words of {@link PeriodStepper}, the same as the `PeriodStepper.*` keys of `i18n/en.ts`. */
export const periodStepperLabels: PeriodStepperLabels = {
  groupWeek: "Week",
  groupMonth: "Month",
  previousWeek: "Previous week",
  previousMonth: "Previous month",
  nextWeek: "Next week",
  nextMonth: "Next month",
  currentWeek: "This week",
  currentMonth: "This month",
}

/** Props of {@link PeriodStepper}. */
export interface PeriodStepperProps {
  /** The week or month on screen, from `@spy4x/time/period`. */
  period: Period
  /** Called with the period to show next. */
  onChange: (period: Period) => void
  /** The current instant. The stepper never reads the clock, so it renders the same everywhere. */
  now: Date
  /** The IANA zone whose calendar decides which period holds today. */
  timeZone: string
  /** How a week is laid out: its first day. Pass the same options the period was made with. */
  options?: PeriodOptions
  /** Overrides for the words; a field left out comes from the catalog or the English default. */
  labels?: Partial<PeriodStepperLabels>
  /** Locale of the period's name. Defaults to the translator's language. */
  locale?: string
  /** The key that goes back to the current period. Defaults to `"t"`. */
  currentHotkey?: string
  /**
   * Whether `[`, `]` and {@link PeriodStepperProps.currentHotkey} step the period. Defaults to
   * `true`; turn it off on a screen with two steppers, or one whose keys already mean something.
   */
  singleKeys?: boolean
  class?: string
}

/** Joined outline arrows: 44 px on a phone, 36 px from `sm`. */
const arrow = "size-11 sm:size-9"

/**
 * The previous arrow's tooltip opens from the arrow's start edge rather than centred on it: the
 * stepper usually starts a row, and a centred bubble there runs past the screen's start on a phone.
 */
const fromStartEdge = "start-0 translate-x-0 [&:dir(rtl)]:translate-x-0"

/**
 * Steps a screen through weeks or months: "This month  ‹ › November 2026".
 *
 * A button back to the current period, two joined arrow buttons and the period's name, which
 * takes its own line below `sm`. The return button comes first and shows only while another
 * period is on screen; on the current period it is hidden but keeps its width, so the arrows and
 * the name never move under the pointer. `[`
 * goes back, `]` forward and `t` to today's period, anywhere outside a text field and an open
 * dialog; each tooltip shows its key. The name is a polite live region, so a screen reader hears
 * the new period after each step. Pressing the return button hides it, so focus moves to the next
 * arrow rather than falling to the page.
 *
 * The period maths is `@spy4x/time/period`; the stepper keeps no state of its own.
 */
export function PeriodStepper({
  period,
  onChange,
  now,
  timeZone,
  options,
  labels,
  locale,
  currentHotkey = "t",
  singleKeys = true,
  class: className,
}: PeriodStepperProps): JSX.Element {
  const words = useLabels("PeriodStepper", periodStepperLabels, labels)
  const language = useT().language
  const apple = useApplePlatform()
  const nextRef = useRef<HTMLButtonElement>(null)
  const returnRef = useRef<HTMLButtonElement>(null)
  const week = period.unit === PeriodUnit.Week
  const current = currentPeriod(period.unit, { now, timeZone, ...options })
  const isCurrent = current.from === period.from && current.to === period.to
  const previous = week ? words.previousWeek : words.previousMonth
  const next = week ? words.nextWeek : words.nextMonth
  const back = week ? words.currentWeek : words.currentMonth

  function goToCurrent(): void {
    const hadFocus = returnRef.current !== null && returnRef.current === document.activeElement
    onChange(current)
    if (hadFocus) nextRef.current?.focus()
  }

  function tip(text: string, key: string): JSX.Element {
    return (
      <span class="inline-flex items-center gap-2 whitespace-nowrap">
        {text}
        {singleKeys && <HotkeyHint keys={key} apple={apple} />}
      </span>
    )
  }

  return (
    <div
      role="group"
      aria-label={week ? words.groupWeek : words.groupMonth}
      class={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      <Button
        ref={returnRef}
        variant="ghost"
        size="sm"
        class={isCurrent ? "invisible" : undefined}
        hotkey={singleKeys && !isCurrent ? currentHotkey : undefined}
        onClick={goToCurrent}
      >
        {back}
        {/* Hidden, it binds no key but keeps the hint the bound key draws, so its width holds. */}
        {isCurrent && singleKeys && <HotkeyHint keys={currentHotkey} apple={apple} />}
      </Button>
      <div class="flex shrink-0">
        <Tooltip
          content={tip(previous, "[")}
          ariaLabel={previous}
          focusable={false}
          contentClass={fromStartEdge}
        >
          <Button
            variant="outline"
            size="none"
            class={cn(arrow, "rounded-e-none")}
            aria-label={previous}
            hotkey={singleKeys ? "[" : undefined}
            hotkeyHint={false}
            onClick={() => onChange(shiftPeriod(period, -1))}
          >
            <IconChevronLeft class="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content={tip(next, "]")} ariaLabel={next} focusable={false}>
          <Button
            ref={nextRef}
            variant="outline"
            size="none"
            class={cn(arrow, "-ms-px rounded-s-none")}
            aria-label={next}
            hotkey={singleKeys ? "]" : undefined}
            hotkeyHint={false}
            onClick={() => onChange(shiftPeriod(period, 1))}
          >
            <IconChevronRight class="size-4" />
          </Button>
        </Tooltip>
      </div>
      {/* Below `sm` the name always takes its own line, so a long month's name cannot wrap alone. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        class="pc-num basis-full text-sm font-semibold sm:basis-auto"
      >
        {periodLabel(period, locale ?? language)}
      </span>
    </div>
  )
}
