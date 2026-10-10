import { useSignal } from "@preact/signals"
import { IconPlus } from "@spy4x/preact-icons"
import {
  parseQuickAdd,
  QuickAddPriority,
  type QuickAddResult,
} from "@spy4x/platform/universal/quick-add"
import type { JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Badge } from "./badge.tsx"
import { Button } from "./button.tsx"
import { Input } from "./input.tsx"

/** Every string {@link QuickAdd} shows or speaks apart from its `label`, `placeholder` and `hint`. */
export interface QuickAddLabels {
  /** The accessible name of the submit button. */
  submit: string
  /** The accessible name of the list of badges. */
  recognised: string
  /** Shown and spoken when a line is sent that leaves no title, such as `#work !high`. */
  noTitle: string
  /** The badge of a `#tag`. */
  tag: (name: string) => string
  /** The badge of an `@context`. */
  context: (name: string) => string
  /** The badge of a due date: the day as `dueLabel` words it, and the time as typed, if any. */
  due: (day: string, time?: string) => string
  /** The badge of a priority. */
  priority: (priority: QuickAddPriority) => string
}

const PRIORITY_LABEL: Record<QuickAddPriority, string> = {
  [QuickAddPriority.High]: "High priority",
  [QuickAddPriority.Medium]: "Medium priority",
  [QuickAddPriority.Low]: "Low priority",
}

/** The English defaults of {@link QuickAddLabels}. */
export const defaultQuickAddLabels: QuickAddLabels = {
  submit: "Add",
  recognised: "Recognised in your line",
  noTitle: "Add a title first",
  tag: (name) => `Tag ${name}`,
  context: (name) => `Context ${name}`,
  due: (day, time) => time === undefined ? `Due ${day}` : `Due ${day} ${time}`,
  priority: (priority) => PRIORITY_LABEL[priority],
}

/**
 * Words a due day for a badge.
 *
 * @param date The day, `YYYY-MM-DD`.
 * @param now The clock the line was read with.
 * @param zone The time zone the line was read in.
 */
export type QuickAddDueLabel = (date: string, now: Date, zone: string) => string

/**
 * The default {@link QuickAddDueLabel}: the day in short English, such as `Mon, Oct 12`.
 *
 * @param date The day, `YYYY-MM-DD`.
 */
export function quickAddDueLabel(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** What {@link quickAddParts} needs besides the parsed line. */
export interface QuickAddPartsOptions {
  /** The clock the line was read with; handed to `dueLabel`. */
  now: Date
  /** The time zone the line was read in; handed to `dueLabel`. */
  zone: string
  /** Overrides for any of {@link defaultQuickAddLabels}. */
  labels?: Partial<QuickAddLabels>
  /** Words the due day. Defaults to {@link quickAddDueLabel}. */
  dueLabel?: QuickAddDueLabel
}

/**
 * The recognised parts of a line, as the words a badge and the screen reader share: tags, then
 * contexts, the due date, the priority.
 *
 * The day is worded from the date alone and the time is shown as typed, because that is what
 * `onAdd` receives: a time inside a daylight-saving gap must not show as the next hour.
 *
 * @param parsed What `parseQuickAdd` read.
 * @param options The clock, the zone and the wording.
 */
export function quickAddParts(parsed: QuickAddResult, options: QuickAddPartsOptions): string[] {
  const text: QuickAddLabels = { ...defaultQuickAddLabels, ...options.labels }
  const parts = [...parsed.tags.map(text.tag), ...parsed.contexts.map(text.context)]
  if (parsed.due) {
    const day = (options.dueLabel ?? quickAddDueLabel)(parsed.due.date, options.now, options.zone)
    parts.push(text.due(day, parsed.due.time))
  }
  if (parsed.priority !== undefined) parts.push(text.priority(parsed.priority))
  return parts
}

/** How long the typing must pause before the live region reads the recognised parts out. */
export const QUICK_ADD_ANNOUNCE_PAUSE_MS = 600

/** Props of {@link QuickAdd}. */
export interface QuickAddProps {
  /**
   * Called with what the line says when the form is sent: the title without its tokens, tags,
   * contexts, due and priority. Never called while `busy` or when the line leaves no title.
   */
  onAdd: (parsed: QuickAddResult) => void
  /**
   * The viewer's IANA time zone: "tomorrow" and "3pm" are read in it. Defaults to the zone of
   * the device the component runs on.
   */
  zone?: string
  /** The clock; a test passes a fixed one. */
  now?: () => Date
  /** The field's accessible name. Defaults to `"New item"`. */
  label?: string
  /** Defaults to `"Add an item"`. */
  placeholder?: string
  /**
   * A quiet line under the field, such as where the new item goes. A function reads the parsed
   * line, so the hint can follow what is typed.
   */
  hint?: string | ((parsed: QuickAddResult) => string)
  /** An item is being created: the field keeps its text and a send adds nothing. */
  busy?: boolean
  /** Overrides for any of {@link defaultQuickAddLabels}. */
  labels?: Partial<QuickAddLabels>
  /** Words the due day in its badge. Defaults to {@link quickAddDueLabel}. */
  dueLabel?: QuickAddDueLabel
  /**
   * The `data-e2e` of the form, and the prefix of its parts' (`-input`, `-submit`, `-chips`,
   * `-live`). Defaults to `"quick-add"`.
   */
  dataE2E?: string
}

/**
 * One field that adds an item to a list: type, press Enter. The field empties and keeps the focus,
 * so several items go in one after another.
 *
 * The line may carry `#tag`, `@context`, a date, a time and `!high`, as `parseQuickAdd` reads
 * them. Each recognised part shows as a badge under the field while typing, and a polite live
 * region reads the same words out once the typing pauses. A line that leaves no title is refused
 * with a message, and focus goes back to the field.
 */
export function QuickAdd(
  {
    onAdd,
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    now = () => new Date(),
    label = "New item",
    placeholder = "Add an item",
    hint,
    busy = false,
    labels,
    dueLabel,
    dataE2E = "quick-add",
  }: QuickAddProps,
): JSX.Element {
  const text: QuickAddLabels = { ...defaultQuickAddLabels, ...labels }
  const field = useRef<HTMLInputElement>(null)
  const line = useSignal("")
  const id = useId()
  const parsed = parseQuickAdd(line.value, { now: now(), timeZone: zone })
  const parts = quickAddParts(parsed, { now: now(), zone, labels, dueLabel })
  const hintText = typeof hint === "function" ? hint(parsed) : hint
  const hintId = hintText ? `${id}-hint` : undefined
  // The badges follow every keystroke; the live region waits for a pause, so a screen reader hears
  // "Tag work" once and not "Tag w", "Tag wo", "Tag wor".
  const announced = useSignal("")
  const notice = useSignal("")
  const spoken = parts.join(", ")
  useEffect(() => {
    if (spoken === "") {
      announced.value = ""
      return
    }
    const timer = setTimeout(() => announced.value = spoken, QUICK_ADD_ANNOUNCE_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [spoken])

  const submit = (event: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault()
    const input = field.current
    if (busy || !input) return
    const result = parseQuickAdd(input.value, { now: now(), timeZone: zone })
    if (result.title === "") {
      if (input.value.trim() !== "") notice.value = text.noTitle
      input.focus()
      return
    }
    onAdd(result)
    input.value = ""
    line.value = ""
    notice.value = ""
    input.focus()
  }

  return (
    <form onSubmit={submit} class="flex flex-col gap-1" data-e2e={dataE2E}>
      <div class="flex items-center gap-2">
        <Input
          ref={field}
          type="text"
          name="title"
          aria-label={label}
          aria-describedby={hintId}
          placeholder={placeholder}
          autocomplete="off"
          enterKeyHint="done"
          readOnly={busy}
          onInput={(event) => {
            line.value = event.currentTarget.value
            notice.value = ""
          }}
          class="min-h-11 flex-1"
          data-e2e={`${dataE2E}-input`}
        />
        <Button
          type="submit"
          variant="primary"
          size="none"
          disabled={busy}
          class="min-h-11 min-w-11 shrink-0 justify-center px-3"
          data-e2e={`${dataE2E}-submit`}
        >
          <IconPlus class="size-5" aria-hidden="true" />
          <span class="sr-only">{text.submit}</span>
        </Button>
      </div>
      {parts.length > 0 && (
        <ul class="flex flex-wrap gap-1" aria-label={text.recognised} data-e2e={`${dataE2E}-chips`}>
          {parts.map((part) => (
            <li key={part}>
              <Badge text={part} />
            </li>
          ))}
        </ul>
      )}
      <p class="sr-only" role="status" aria-live="polite" data-e2e={`${dataE2E}-live`}>
        {notice.value || announced.value}
      </p>
      {notice.value && <p class="text-sm text-muted" aria-hidden="true">{notice.value}</p>}
      {hintText && <p id={hintId} class="text-sm text-muted">{hintText}</p>}
    </form>
  )
}
