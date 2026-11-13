import { useSignal } from "@preact/signals"
import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Badge } from "./badge.tsx"
import { Button } from "./button.tsx"
import { Field } from "./field.tsx"
import { HotkeyHint } from "./hotkey-hint.tsx"
import { ariaKeyShortcuts, hotkeyActionBinding, useApplePlatform, useHotkeys } from "./hotkeys.ts"
import { useLabels } from "./i18n.tsx"
import { Textarea } from "./input.tsx"

/** One answer a {@link DecisionCard} offers. */
export interface DecisionCardOption {
  /** Stable id, used as the option's key. */
  id: string
  /** The answer, as the button shows it. */
  label: string
  /** A muted line under the label, such as what choosing it leads to. */
  description?: string
  /** Puts the option first and marks it "Recommended" in text. Give it to one option at most. */
  recommended?: boolean
}

/** The words a {@link DecisionCard} shows. Every one has an English default. */
export interface DecisionCardLabels {
  /** Beside the recommended option's label. */
  recommended: string
  /** The toggle that unfolds a long context. */
  more: string
  /** The same toggle once the context is unfolded. */
  less: string
  /** The disclosure for a note, when the card has no `onSend`. */
  addNote: string
  /** The disclosure for a note or an own answer, when the card has options and `onSend`. */
  addNoteOrAnswer: string
  /** The textarea's label behind {@link DecisionCardLabels.addNote}. */
  note: string
  /** The textarea's label behind {@link DecisionCardLabels.addNoteOrAnswer}. */
  noteOrAnswer: string
  /** Sends the textarea's text instead of an option. */
  sendOwnAnswer: string
  /** The open textarea's label on a card without options. */
  answer: string
  /** Sends the open textarea's text on a card without options. */
  sendAnswer: string
  /** Calls `onDone`. */
  markDone: string
}

const DECISION_CARD_LABELS: DecisionCardLabels = {
  recommended: "Recommended",
  more: "More",
  less: "Less",
  addNote: "Add a note",
  addNoteOrAnswer: "Add a note or your own answer",
  note: "Note",
  noteOrAnswer: "Note or your own answer",
  sendOwnAnswer: "Send own answer",
  answer: "Your answer",
  sendAnswer: "Send answer",
  markDone: "Mark done",
}

/** The heading level of a {@link DecisionCard}'s question. */
export type DecisionCardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface DecisionCardProps {
  /** The question, drawn as the card's heading. */
  title: string
  /** A quiet badge above the question that names the item's kind, such as "Decision". */
  kind?: string
  /** Where the item sits in the caller's queue, such as "Decision 1 of 36". */
  position?: ComponentChildren
  /** A muted line under the question, such as who asked and when. */
  meta?: ComponentChildren
  /** Plain text under the question, never read as HTML. Folded past 6 lines behind "More". */
  context?: string
  /**
   * The answers, one button each, all drawn alike. The recommended one comes first; none is
   * preselected. The first nine are pressed with `1` to `9`. Needs `onChoose`.
   */
  options?: readonly DecisionCardOption[]
  /** Called with the chosen option and the note's trimmed text (empty without one). */
  onChoose?: (option: DecisionCardOption, note: string) => void
  /**
   * Called with the trimmed text a person typed as their own answer. Without options the card shows
   * the answer field open; with options it sits behind "Add a note or your own answer".
   */
  onSend?: (text: string) => void
  /** Adds "Mark done", pressed with `e`, and is called with the note's trimmed text. */
  onDone?: (note: string) => void
  /** A quiet line at the bottom, such as where an answer goes. */
  notice?: ComponentChildren
  /** Disables every action while the caller saves an answer. */
  pending?: boolean
  /** The question's heading level. Defaults to `2`; pass `1` when the card is the page. */
  headingLevel?: DecisionCardHeadingLevel
  /**
   * Moves focus to the question when the card mounts, so the next item is read and answered from
   * the keyboard. Give each item its own `key`, so the next one mounts afresh. Defaults to `false`.
   */
  autoFocus?: boolean
  /**
   * Whether `1` to `9`, `n`, `e` and `mod+enter` work. Defaults to `true`; pass `false` when the
   * reader turned single-key shortcuts off, or for a card that is not the one being answered.
   */
  hotkeys?: boolean
  /** Replaces any of the English words. */
  labels?: Partial<DecisionCardLabels>
  class?: string
}

/** How many options get a number key: `1` to `9`. */
const NUMBERED = 9

/** How many lines of context show before "More". */
const FOLDED_LINES = 6

/** Every option button's classes, so the recommended one can never look bigger or brighter. */
const OPTION_CLASS = "w-full min-h-11 justify-start! text-start"

/** The quiet toggles' classes: a 44 px target on a phone. */
const TOGGLE_CLASS = "self-start max-sm:min-h-11"

/**
 * The options in the order a {@link DecisionCard} draws them: the recommended ones first, the rest
 * in the caller's order.
 */
function orderDecisionOptions(
  options: readonly DecisionCardOption[],
): DecisionCardOption[] {
  return [
    ...options.filter((option) => option.recommended === true),
    ...options.filter((option) => option.recommended !== true),
  ]
}

/**
 * One item of a queue a person answers: a decision with options, a question with an open answer,
 * or a to-do to mark done. The question takes focus when the card mounts with `autoFocus`; `1` to
 * `9` choose an option, `n` opens and focuses the note, `e` marks it done and `mod+enter` sends
 * the typed answer. The keys match the physical key, so they work on any layout, and do nothing
 * in a field (except `mod+enter`) or with a modifier.
 *
 * The card owns no queue, data or toast: the app wraps it (a `Modal` on a desktop, a page on a
 * phone), saves the answer through the ports and moves to the next item itself. It draws no
 * border, so it sits in a `Modal`, a `Card` or a page alike.
 *
 * @throws {Error} When `options` are given without `onChoose`, or the card has no action at all.
 */
export function DecisionCard(
  {
    title,
    kind,
    position,
    meta,
    context,
    options = [],
    onChoose,
    onSend,
    onDone,
    notice,
    pending = false,
    headingLevel = 2,
    autoFocus = false,
    hotkeys = true,
    labels,
    class: className,
  }: DecisionCardProps,
): JSX.Element {
  const choosing = options.length > 0
  if (choosing && onChoose === undefined) {
    throw new Error("DecisionCard: `options` need `onChoose`")
  }
  if (!choosing && onSend === undefined && onDone === undefined) {
    throw new Error("DecisionCard: give it `options`, `onSend` or `onDone`")
  }
  const words = useLabels("DecisionCard", DECISION_CARD_LABELS, labels)
  const id = useId()
  const headingId = `${id}-title`
  const contextId = `${id}-context`
  const noteId = `${id}-note`
  const root = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const noteField = useRef<HTMLTextAreaElement>(null)
  const focusNote = useRef(false)
  const contextBox = useRef<HTMLParagraphElement>(null)
  const apple = useApplePlatform()

  // Without options and with `onSend`, the answer field is the card's main action, so it is open.
  const answering = !choosing && onSend !== undefined
  const noteOpen = useSignal(answering)
  const text = useSignal("")
  const folded = useSignal(true)
  const overflowing = useSignal((context ?? "").split("\n").length > FOLDED_LINES)
  const trimmed = text.value.trim()

  useEffect(() => {
    if (autoFocus) heading.current?.focus()
  }, [])

  // Hard line breaks are counted during render; a long line that wraps is measured here.
  useEffect(() => {
    const element = contextBox.current
    if (element === null || !folded.value) return
    const measure = () => {
      overflowing.value = element.scrollHeight > element.clientHeight + 1
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [context, folded.value])

  useEffect(() => {
    const field = noteField.current
    if (field === null) return
    // Text typed before hydration is in the field, and no `input` event tells the signal.
    if (text.value === "" && field.value !== "") text.value = field.value
    if (focusNote.current) {
      focusNote.current = false
      field.focus()
    }
  })

  useHotkeys(
    [hotkeyActionBinding("n", () => {
      focusNote.current = true
      if (noteOpen.value) noteField.current?.focus()
      else noteOpen.value = true
    }, () => root.current)],
    { enabled: hotkeys },
  )

  const Heading = `h${headingLevel}` as "h2"
  const noteLabel = answering
    ? words.answer
    : onSend !== undefined
    ? words.noteOrAnswer
    : words.note
  const sendKey = hotkeys ? "mod+enter" : undefined

  return (
    <section
      ref={root}
      aria-labelledby={headingId}
      class={join("flex flex-col gap-6", className)}
    >
      <header class="flex flex-col gap-2">
        {(kind !== undefined || position !== undefined) && (
          <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
            {kind !== undefined && <Badge text={kind} color="gray" />}
            {position !== undefined && <span>{position}</span>}
          </div>
        )}
        <Heading
          ref={heading}
          id={headingId}
          tabIndex={-1}
          class="rounded-sm text-lg font-medium text-balance text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
        >
          {title}
        </Heading>
        {meta !== undefined && <div class="text-sm text-muted">{meta}</div>}
      </header>

      {context !== undefined && context !== "" && (
        <div class="flex flex-col gap-2">
          <p
            ref={contextBox}
            id={contextId}
            data-folded={folded.value ? "" : undefined}
            class={join(
              "text-sm whitespace-pre-line text-foreground [overflow-wrap:anywhere]",
              folded.value && "line-clamp-6",
            )}
          >
            {context}
          </p>
          {overflowing.value && (
            <Button
              variant="ghost"
              class={TOGGLE_CLASS}
              aria-expanded={!folded.value}
              aria-controls={contextId}
              onClick={() => folded.value = !folded.value}
            >
              {folded.value ? words.more : words.less}
            </Button>
          )}
        </div>
      )}

      {choosing && (
        <div role="group" aria-labelledby={headingId} class="flex flex-col gap-2">
          {orderDecisionOptions(options).map((option, index) => (
            <Button
              key={option.id}
              variant="outline"
              class={OPTION_CLASS}
              disabled={pending}
              hotkey={hotkeys && index < NUMBERED ? String(index + 1) : undefined}
              onClick={() => onChoose?.(option, trimmed)}
            >
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="flex flex-wrap items-baseline gap-2">
                  <span>{option.label}</span>
                  {option.recommended === true && (
                    <>
                      {" "}
                      <span class="text-xs font-normal text-muted">{words.recommended}</span>
                    </>
                  )}
                </span>
                {option.description !== undefined && (
                  <>
                    {" "}
                    <span class="text-sm font-normal text-muted">{option.description}</span>
                  </>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}

      <div class="flex flex-col gap-3">
        {!answering && (
          <Button
            variant="ghost"
            class={TOGGLE_CLASS}
            aria-expanded={noteOpen.value}
            aria-controls={noteOpen.value ? noteId : undefined}
            aria-keyshortcuts={hotkeys ? ariaKeyShortcuts("n", apple) : undefined}
            onClick={() => {
              focusNote.current = !noteOpen.value
              noteOpen.value = !noteOpen.value
            }}
          >
            {onSend !== undefined && choosing ? words.addNoteOrAnswer : words.addNote}
            {hotkeys && <HotkeyHint keys="n" apple={apple} />}
          </Button>
        )}
        {noteOpen.value && (
          <Field id={noteId} label={noteLabel}>
            <Textarea
              ref={noteField}
              rows={3}
              value={text.value}
              onInput={(event) => text.value = event.currentTarget.value}
            />
          </Field>
        )}
        {(answering || (choosing && onSend !== undefined && noteOpen.value) ||
          onDone !== undefined) && (
          <div class="flex flex-wrap gap-2">
            {onSend !== undefined && (answering || noteOpen.value) && (
              <Button
                variant={answering ? "primary" : "secondary"}
                class="max-sm:min-h-11"
                disabled={pending || trimmed === ""}
                hotkey={sendKey}
                onClick={() => onSend(trimmed)}
              >
                {answering ? words.sendAnswer : words.sendOwnAnswer}
              </Button>
            )}
            {onDone !== undefined && (
              <Button
                variant={choosing || onSend !== undefined ? "secondary" : "primary"}
                class="max-sm:min-h-11"
                disabled={pending}
                hotkey={hotkeys ? "e" : undefined}
                onClick={() => onDone(trimmed)}
              >
                {words.markDone}
              </Button>
            )}
          </div>
        )}
      </div>

      {notice !== undefined && <p class="text-xs text-muted">{notice}</p>}
    </section>
  )
}
