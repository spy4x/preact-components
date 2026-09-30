import { cn } from "@spy4x/preact-cn"
import { IconPencilSquare } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import { buttonClasses } from "./button.tsx"
import { Input } from "./input.tsx"

export interface InlineEditProps {
  /** The saved text. The field shows it, and an edit starts from it. */
  value: string
  /**
   * Called with the trimmed new text when an edit is saved. Never called for an empty text or for
   * the text `value` already holds. Return a promise to keep the field busy until it settles; a
   * rejection keeps the field open with the typed text and shows {@link errorMessage}.
   */
  onSave: (value: string) => void | Promise<void>
  /** Accessible name of the button that starts an edit. Defaults to `` `Edit ${value}` ``. */
  editLabel?: (value: string) => string
  /** Accessible name of the text field. Defaults to `"New name"`. */
  inputLabel?: string
  /** Shown, and announced, while a returned promise runs. Defaults to `"Saving…"`. */
  savingLabel?: string
  /** Words a rejected save. Defaults to `"Could not save. Try again."` whatever the error. */
  errorMessage?: (error: unknown) => string
  /**
   * Turns the value's button off. Turning it on while the field is open cancels the edit, as Escape
   * would, unless a save is already running; that save still finishes.
   */
  disabled?: boolean
  class?: string
}

/**
 * What an edit saves: the trimmed draft, or `null` when there is nothing to save because the draft
 * is empty or matches the current value.
 *
 * @param draft The text in the field.
 * @param value The value the field was opened with.
 * @returns The text to hand to `onSave`, or `null` to close the field without saving.
 */
export function inlineEditCommit(draft: string, value: string): string | null {
  const next = draft.trim()
  return next === "" || next === value ? null : next
}

const defaultEditLabel = (value: string): string => `Edit ${value}`
const defaultErrorMessage = (): string => "Could not save. Try again."

/**
 * A value shown as text that turns into a text field in place, for renaming a list, a tag or a
 * column where it stands.
 *
 * Pressing the text opens the field with the whole value selected. Enter saves, and so does moving
 * focus away; Escape cancels and puts the old value back. An empty or unchanged text closes the
 * field without calling `onSave`. When the field closes while it holds focus — Enter, Escape, a
 * save that finishes while focus stayed — focus goes back to the text button; after a save that
 * started because focus moved away, focus stays where the user put it.
 *
 * While a promise returned by `onSave` runs, the field is read-only, `aria-busy`, and says
 * {@link InlineEditProps.savingLabel}; Enter, Escape and blur are ignored. A rejected promise leaves
 * the field open with the typed text and an error under it, so the user can retry or cancel.
 *
 * Removing the component while its field is open saves nothing: the typed text is dropped. Chromium
 * fires `blur` on a focused field that leaves the page, and a row deleted by a shortcut or a list
 * that re-renders must not send a rename nobody confirmed. Enter and Escape pressed while an input
 * method is composing a word are left to the input method.
 *
 * The draft is read from the field itself when saving, not only from state: the field exists only
 * after a press, so text can never be typed before the bundle runs, but a save reading the element
 * cannot disagree with what the user sees.
 */
export function InlineEdit(
  {
    value,
    onSave,
    editLabel = defaultEditLabel,
    inputLabel = "New name",
    savingLabel = "Saving…",
    errorMessage = defaultErrorMessage,
    disabled = false,
    class: className,
  }: InlineEditProps,
): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  // Refs, not state, because a blur can arrive between a state update and the render that shows
  // it: the field being removed must not read as a blur that saves.
  const open = useRef(false)
  const saving = useRef(false)
  const returnFocus = useRef(false)
  const mounted = useRef(true)
  const errorId = useId()

  useEffect(() => () => {
    mounted.current = false
  }, [])

  useEffect(() => {
    if (disabled && open.current && !saving.current) {
      open.current = false
      setError(null)
      setEditing(false)
    }
  }, [disabled])

  useEffect(() => {
    if (editing) {
      field.current?.focus()
      field.current?.select()
    } else if (returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus()
    }
  }, [editing])

  function start(): void {
    open.current = true
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  function close(): void {
    returnFocus.current = field.current !== null && document.activeElement === field.current
    open.current = false
    setError(null)
    setEditing(false)
  }

  async function save(): Promise<void> {
    // `mounted` first: the blur Chromium fires on a focused field being removed arrives after the
    // effect cleanups have run, and it must not save.
    if (!mounted.current || !open.current || saving.current) return
    const next = inlineEditCommit(field.current?.value ?? draft, value)
    if (next === null) return close()
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      if (!mounted.current) return
      saving.current = false
      setBusy(false)
      close()
    } catch (reason) {
      if (!mounted.current) return
      saving.current = false
      setBusy(false)
      setError(errorMessage(reason))
    }
  }

  function onKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>): void {
    // An input method confirms or cancels a word with these keys; the word is not finished yet.
    // Safari sends the Enter that ends a composition with `isComposing` false and keyCode 229, the
    // code every browser gives a key press an input method has taken.
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === "Enter") {
      // Inside a form, Enter would submit it as well.
      event.preventDefault()
      void save()
    } else if (event.key === "Escape") {
      // Inside a dialog or a menu, Escape would close that as well.
      event.preventDefault()
      event.stopPropagation()
      if (!saving.current) close()
    }
  }

  if (!editing) {
    return (
      <span class={cn("inline-flex max-w-full min-w-0", className)}>
        <button
          ref={trigger}
          type="button"
          class={buttonClasses("ghost", "md", "min-w-0 max-w-full justify-start px-2 py-1")}
          aria-label={editLabel(value)}
          disabled={disabled}
          onClick={start}
        >
          <span class="truncate">{value}</span>
          <span aria-hidden="true" class="text-placeholder">
            <IconPencilSquare class="size-4" />
          </span>
        </button>
      </span>
    )
  }

  return (
    <span class={cn("inline-flex max-w-full min-w-0 flex-col gap-1", className)}>
      <Input
        ref={field}
        type="text"
        value={draft}
        aria-label={inputLabel}
        aria-busy={busy ? "true" : undefined}
        aria-invalid={error === null ? undefined : "true"}
        aria-describedby={error === null ? undefined : errorId}
        readOnly={busy}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
      />
      <span role="status" class={busy ? "text-sm text-muted" : "sr-only"}>
        {busy ? savingLabel : ""}
      </span>
      {error !== null && (
        <span id={errorId} role="alert" class="text-sm text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </span>
  )
}
