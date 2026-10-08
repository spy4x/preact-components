import { cn } from "@spy4x/preact-cn"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import {
  activeDescendant,
  comboboxKey,
  comboboxKeyAction,
  comboboxListboxId,
  comboboxOptionId,
  type ComboboxState,
  filterItems,
  leavesCombobox,
} from "./combobox.tsx"
import { isImeKeyPress } from "./ime.ts"
import { CrossGlyph, listboxClasses, listboxOptionClass } from "./listbox-parts.tsx"

/** The comparison key of a tag: trimmed and lower-cased, so `" Work"` and `"work"` are one tag. */
function tagKey(text: string): string {
  return text.trim().toLowerCase()
}

/** What {@link addTags} did with the texts it was given. */
export interface AddTagsResult {
  /** The tags after adding: the input array itself when nothing was added. */
  tags: readonly string[]
  /** Each tag that was added, trimmed, in order. */
  added: string[]
  /** Each text that was left out because the list already held it, trimmed. */
  duplicates: string[]
}

/**
 * Add typed texts to a tag list: each is trimmed, a blank one is skipped, and one the list already
 * holds — compared without regard to case — is left out and reported.
 *
 * Case-insensitive on purpose: `"Work"` and `"work"` are the same tag to a person, and a list
 * holding both reads as a mistake. The spelling that arrived first is kept. Comparison is
 * `toLowerCase()` and nothing more: accents are kept, so `"résumé"` and `"resume"` stay two tags.
 *
 * @param tags The current tags.
 * @param texts Texts to add, in order; a later one is compared against the earlier ones too.
 */
export function addTags(tags: readonly string[], texts: readonly string[]): AddTagsResult {
  const keys = new Set(tags.map(tagKey))
  const added: string[] = []
  const duplicates: string[] = []
  for (const text of texts) {
    const tag = text.trim()
    if (tag === "") continue
    const key = tagKey(tag)
    if (keys.has(key)) {
      duplicates.push(tag)
      continue
    }
    keys.add(key)
    added.push(tag)
  }
  return { tags: added.length === 0 ? tags : [...tags, ...added], added, duplicates }
}

/**
 * Split the input's text at commas: every part before the last comma is a finished tag, and the
 * part after it is still being typed.
 *
 * This is what makes a comma add a tag when no key event says so — a paste of `"a, b, c"`, or an
 * Android keyboard, whose key events carry no key name.
 *
 * @param text The input's whole text.
 * @returns The finished parts, trimmed with blanks dropped, and the unfinished rest as typed.
 */
export function splitTagText(text: string): { tags: string[]; rest: string } {
  const parts = text.split(",")
  const rest = parts.pop() ?? ""
  return { tags: parts.map((part) => part.trim()).filter((part) => part !== ""), rest }
}

/**
 * The suggestions to offer for a query: matching ones, minus the tags already chosen, each spelling
 * once.
 *
 * Matching is `Combobox`'s ({@link filterItems}): a substring of the folded text, so `"sao"` finds
 * `"São Paulo"`. A suggestion counts as chosen when a tag matches it without regard to case, the
 * same rule {@link addTags} uses, so picking `"work"` hides `"Work"` too.
 *
 * @param suggestions Every suggestion, in the caller's order.
 * @param tags The tags already chosen.
 * @param query The text typed so far.
 */
export function tagSuggestions(
  suggestions: readonly string[],
  tags: readonly string[],
  query: string,
): string[] {
  const seen = new Set(tags.map(tagKey))
  return filterItems(suggestions, query).filter((suggestion) => {
    const key = tagKey(suggestion)
    if (key === "" || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** What the key handler of {@link TagInput} does for one key press. */
export interface TagInputKeyAction {
  /** Next open state and highlight of the suggestion list. */
  state: ComboboxState
  /** Call `preventDefault()`. */
  preventDefault: boolean
  /** Index of the suggestion to add, `-1` for none. */
  pick: number
  /** Add the typed text as a tag. */
  commit: boolean
  /** Remove the last tag. */
  removeLast: boolean
}

/**
 * The whole key table of {@link TagInput}, decided without a DOM.
 *
 * The suggestion list keeps `Combobox`'s keys exactly ({@link comboboxKeyAction}): the arrows move
 * and wrap, `Home` and `End` jump while the list is open, `Escape` closes. Three keys differ:
 *
 * | Key         | Does                                                                      |
 * | ----------- | ------------------------------------------------------------------------- |
 * | `Enter`     | adds the highlighted suggestion, or the typed text when none is highlighted |
 * | `,`         | adds the typed text; the comma itself is never typed                      |
 * | `Backspace` | in an empty field, removes the last tag; otherwise left to the field      |
 *
 * `Enter` is consumed even with nothing to add, as in `Combobox`, so a surrounding form is not
 * submitted by a press that meant to add a tag. A key held with `Ctrl` or `Meta` is never ours:
 * `Ctrl`+`Enter` still reaches the form.
 *
 * @param event The key press, or anything shaped like one.
 * @param state The list's state before the press.
 * @param count How many suggestions are on screen.
 * @param text The input's text before the press.
 * @returns The action, or `undefined` for a key the field leaves to the browser.
 */
export function tagInputKeyAction(
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">,
  state: ComboboxState,
  count: number,
  text: string,
): TagInputKeyAction | undefined {
  if (event.ctrlKey || event.metaKey) return undefined
  const closed: ComboboxState = { activeIndex: -1, isOpen: false }
  const none = { pick: -1, commit: false, removeLast: false }
  if (event.key === "," && !event.altKey) {
    return { ...none, state: closed, preventDefault: true, commit: true }
  }
  if (event.key === "Backspace" && !event.altKey) {
    if (text !== "") return undefined
    return { ...none, state, preventDefault: true, removeLast: true }
  }
  const key = comboboxKey(event)
  if (key === undefined) return undefined
  const action = comboboxKeyAction(key, state, count)
  if (key === "Enter") {
    return {
      ...none,
      state: closed,
      preventDefault: true,
      pick: action.select,
      commit: action.select < 0,
    }
  }
  return { ...none, state: action.state, preventDefault: action.preventDefault }
}

export interface TagInputProps {
  /** The chosen tags, in order. */
  value: readonly string[]
  /** Called with the whole new list after a tag is added or removed. */
  onChange: (value: string[]) => void
  /** Tags to offer while typing. Ones already chosen are hidden. */
  suggestions?: readonly string[]
  /**
   * `id` of the text field, and the base of the listbox and option ids. Pass one when a `Field` or
   * your own `<label for>` points at it; without it a `useId()` value is used.
   */
  id?: string
  /**
   * Visible label above the field. Nested inside `Field`, leave it out: `Field` renders the label
   * and points it at `id`.
   */
  label?: ComponentChildren
  /** Accessible name of the field when there is no visible label at all. */
  ariaLabel?: string
  /** Shown in the empty text field. English default, `"Add a tag…"`. */
  placeholder?: string
  /** Disables typing and every remove button. */
  disabled?: boolean
  /**
   * Message under the field, which also marks it invalid. Nested inside `Field`, pass the error to
   * `Field` instead: it renders the message and marks this field through `aria-invalid`.
   */
  error?: string | null
  /** Set by `Field`'s wiring; your own ids to describe the field by are kept beside it. */
  "aria-describedby"?: string
  /** Set by `Field` while it carries an error. Either this or `error` marks the field invalid. */
  "aria-invalid"?: boolean | string
  /** Name of a chip's remove button. English default, `"Remove tag work"`. */
  removeLabel?: (tag: string) => string
  /** Name of the list of chips. English default, `"Tags"`. */
  tagsLabel?: string
  /** Name of the suggestion list. English default, `"Suggestions"`. */
  suggestionsLabel?: string
  /** Announced after a tag is added. English default, `"Added tag work"`. */
  addedMessage?: (tag: string) => string
  /** Announced after a tag is removed. English default, `"Removed tag work"`. */
  removedMessage?: (tag: string) => string
  /** Announced when a typed tag is already in the list. English default, `"work is already added"`. */
  duplicateMessage?: (tag: string) => string
  /** Utilities for the wrapper. */
  class?: string
}

const fieldClasses =
  "flex min-h-12 w-full flex-wrap items-center gap-1 rounded-primary border border-control bg-surface p-1 focus-within:ring-2 focus-within:ring-focus"
const chipClasses =
  "inline-flex min-w-0 max-w-full items-center rounded-full bg-selected-soft pl-3 text-sm text-selected"
const removeClasses =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-selected-soft-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed"
const inputClasses =
  "h-11 min-w-32 flex-1 bg-transparent px-2 text-foreground outline-none placeholder:text-placeholder disabled:cursor-not-allowed"

/**
 * A text field that collects several tags: type one and press Enter or a comma, or pick one of the
 * suggestions; each tag shows as a chip with its own remove button.
 *
 * The suggestion list is `Combobox`'s: `role="combobox"` on the input with `aria-expanded`,
 * `aria-controls` and `aria-activedescendant`, a `role="listbox"` popup, the same option rows and
 * the same arrow keys ({@link tagInputKeyAction}). Typing does not highlight a suggestion, unlike
 * `Combobox`: here Enter adds what was typed unless an arrow key chose a suggestion first, because a
 * new tag is a normal answer rather than a miss.
 *
 * Tags are trimmed and kept once, compared without regard to case ({@link addTags}). Backspace in
 * the empty field removes the last chip. Every remove button is named `"Remove tag <name>"` and is
 * 44 px square, and after a removal focus goes back to the text field, so the keyboard is never
 * left on a button that no longer exists. Each addition and removal is announced through one
 * polite live region rendered with the field.
 *
 * ```tsx
 * <Field id="tags" label="Tags">
 *   <TagInput value={tags.value} onChange={(next) => tags.value = next} suggestions={used} />
 * </Field>
 * ```
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  id: callerId,
  label,
  ariaLabel,
  placeholder = "Add a tag…",
  disabled = false,
  error,
  "aria-describedby": callerDescribedBy,
  "aria-invalid": callerInvalid,
  removeLabel = (tag) => `Remove tag ${tag}`,
  tagsLabel = "Tags",
  suggestionsLabel = "Suggestions",
  addedMessage = (tag) => `Added tag ${tag}`,
  removedMessage = (tag) => `Removed tag ${tag}`,
  duplicateMessage = (tag) => `${tag} is already added`,
  class: className,
}: TagInputProps): JSX.Element {
  const generatedId = useId()
  const id = callerId ?? generatedId
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  /** Set while focus is moved back after a removal, so that focus does not open the list. */
  const quietFocus = useRef(false)
  const draft = useSignal("")
  const isOpen = useSignal(false)
  const activeIndex = useSignal(-1)
  const announcement = useSignal("")

  const visible = tagSuggestions(suggestions, value, draft.value)
  const shown = isOpen.value && visible.length > 0 && !disabled
  const active = activeIndex.value >= visible.length ? -1 : activeIndex.value
  const listboxId = comboboxListboxId(id)
  const message = typeof error === "string" && error.length > 0 ? error : undefined
  const errorId = message === undefined ? undefined : `${id}-error`
  const describedBy = [callerDescribedBy, errorId].filter(Boolean).join(" ") || undefined
  const invalid = message !== undefined || callerInvalid === true || callerInvalid === "true"

  useEffect(() => {
    // Text typed before the bundle ran is in the field but not in the draft: Preact keeps a field's
    // value while hydrating and fires no `input` event for it.
    const typed = inputRef.current?.value ?? ""
    if (typed !== "" && draft.value === "") draft.value = typed
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keep the highlighted suggestion on screen, as `Combobox` does.
  useEffect(() => {
    if (!shown || active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [shown, active])

  const close = () => {
    isOpen.value = false
    activeIndex.value = -1
  }

  const setDraft = (text: string) => {
    draft.value = text
    // Written to the field as well: when the draft does not change (`""` before a paste of `"a,"`
    // and after it), no render follows to put the field's text back in line with it.
    if (inputRef.current && inputRef.current.value !== text) inputRef.current.value = text
  }

  const add = (texts: readonly string[]) => {
    const result = addTags(value, texts)
    if (result.added.length > 0) onChange([...result.tags])
    const said = [...result.added.map(addedMessage), ...result.duplicates.map(duplicateMessage)]
    if (said.length > 0) announcement.value = said.join(". ")
  }

  const removeAt = (index: number) => {
    const tag = value[index]
    if (tag === undefined) return
    onChange(value.filter((_, position) => position !== index))
    announcement.value = removedMessage(tag)
    if (inputRef.current && document.activeElement !== inputRef.current) {
      quietFocus.current = true
      inputRef.current.focus()
      quietFocus.current = false
    }
  }

  const open = () => {
    if (quietFocus.current || disabled) return
    isOpen.value = true
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    // An input method confirms or cancels a word with Enter and Escape; the word is not finished.
    if (isImeKeyPress(event)) return
    const action = tagInputKeyAction(
      event,
      { activeIndex: active, isOpen: isOpen.value },
      visible.length,
      draft.value,
    )
    if (action === undefined) return
    if (action.preventDefault) event.preventDefault()
    if (action.pick >= 0) {
      const picked = visible[action.pick]
      if (picked !== undefined) add([picked])
      setDraft("")
    } else if (action.commit) {
      add([draft.value])
      setDraft("")
    } else if (action.removeLast) {
      removeAt(value.length - 1)
    } else if (!action.state.isOpen && isOpen.value) {
      // Closing drops the query with the list, as in `Combobox`.
      setDraft("")
    }
    isOpen.value = action.state.isOpen
    activeIndex.value = action.state.activeIndex
  }

  return (
    <div class={cn("relative", className)} ref={rootRef}>
      {label !== undefined && label !== null && (
        <label for={id} class={cn("pc-label mb-2 block", disabled && "opacity-50")}>{label}</label>
      )}
      <div
        class={cn(fieldClasses, invalid && "border-danger", disabled && "opacity-50")}
        // A press on the field's empty space or on a chip's text puts the caret in the text field,
        // as a click inside a plain input would.
        onMouseDown={(event) => {
          const target = event.target as Element
          if (target === inputRef.current || target.closest("button") !== null) return
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        {value.length > 0 && (
          <ul aria-label={tagsLabel} class="flex min-w-0 max-w-full flex-wrap gap-1">
            {value.map((tag, index) => (
              <li key={`${index}-${tag}`} class={chipClasses}>
                <span class="truncate">{tag}</span>
                <button
                  type="button"
                  class={removeClasses}
                  aria-label={removeLabel(tag)}
                  disabled={disabled}
                  // Focus stays in the text field: the button is about to disappear.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    removeAt(index)}
                >
                  <CrossGlyph />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          id={id}
          class={inputClasses}
          type="text"
          role="combobox"
          value={draft.value}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-expanded={shown}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant(id, { activeIndex: active, isOpen: shown })}
          aria-autocomplete="list"
          autocomplete="off"
          onInput={(event) => {
            const split = splitTagText(event.currentTarget.value)
            if (split.tags.length > 0) add(split.tags)
            setDraft(split.rest)
            // The list follows the text, with nothing highlighted: Enter adds what was typed.
            isOpen.value = true
            activeIndex.value = -1
          }}
          onFocus={open}
          onClick={open}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            if (leavesCombobox(event.currentTarget, event.relatedTarget as Node | null)) close()
          }}
        />
      </div>
      <ul
        id={listboxId}
        ref={listRef}
        role="listbox"
        aria-label={suggestionsLabel}
        hidden={!shown}
        class={listboxClasses}
      >
        {visible.map((suggestion, index) => {
          const isActive = index === active
          return (
            <li
              key={suggestion}
              id={comboboxOptionId(id, index)}
              role="option"
              aria-selected={isActive}
              data-active={isActive || undefined}
              class={listboxOptionClass({ active: isActive, selected: false, disabled: false })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                add([suggestion])
                setDraft("")
                close()
              }}
            >
              {suggestion}
            </li>
          )
        })}
      </ul>
      {message !== undefined && <p id={errorId} class="mt-2 text-sm text-danger">{message}</p>}
      <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
        {announcement.value}
      </div>
    </div>
  )
}
