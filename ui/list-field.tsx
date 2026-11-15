import { join } from "@spy4x/preact-cn/join"
import { IconPlus, IconXMark } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { isImeKeyPress } from "./ime.ts"
import { Input } from "./input.tsx"
import { TOUCH_TARGET } from "./touch-target.ts"
import { useLabels } from "./i18n.tsx"

/** The words a {@link ListField} shows. */
export interface ListFieldLabels {
  /** One line's accessible name, by its 1-based position. Default: `"Item 2"`. */
  item: (position: number) => string
  /** The remove button's accessible name, by the line's 1-based position. Default: `"Remove item 2"`. */
  remove: (position: number) => string
  /** The add button's text. Default: `"Add item"`. */
  add: string
  /** How many lines there are of the most allowed. Default: `"3 of 5"`. */
  count: (count: number, max: number) => string
}

/** The English words {@link ListField} shows when the caller passes none. */
export const LIST_FIELD_LABELS: ListFieldLabels = {
  item: (position) => `Item ${position}`,
  remove: (position) => `Remove item ${position}`,
  add: "Add item",
  count: (count, max) => `${count} of ${max}`,
}

/** Props of {@link ListField}. */
export interface ListFieldProps {
  /** `id` of the first line's input; the other lines get `{id}-{index}`, the messages `{id}-error` and `{id}-hint`. */
  id: string
  /** The group's name, rendered as its `<legend>`. */
  label: ComponentChildren
  /** The lines, in order. */
  value: readonly string[]
  /** Called with the whole new list on every change: a keystroke, an added or a removed line. */
  onChange: (value: string[]) => void
  /** The most lines allowed. At the limit the add button goes away and Enter adds nothing. */
  max?: number
  /** The most characters one line takes, as the inputs' `maxLength`. */
  maxLength?: number
  /** Set as `name` on every input, so a native form posts each line under it. */
  name?: string
  /** Placeholder of an empty line. */
  placeholder?: string
  /** Helper text under the list. */
  hint?: ComponentChildren
  /** Message under the list; marks every line `aria-invalid`. Empty renders nothing. */
  error?: string | null
  /** Disables the whole group. */
  disabled?: boolean
  /** The words shown; see {@link LIST_FIELD_LABELS}. */
  labels?: Partial<ListFieldLabels>
  /** Utilities on the group. */
  class?: string
}

/** Where focus goes once the next list has rendered. */
type FocusTarget = { index: number; atEnd: boolean } | "add" | null

/**
 * An ordered list of short lines, such as an article's key points: one input per line, a remove
 * button on each, and an "Add item" button under them, up to `max` lines.
 *
 * From the keyboard, Enter in a line adds an empty line after it and moves there (it does not
 * submit the form), and Backspace in an empty line other than the first removes it and returns to
 * the end of the line before. Removing a line with its button moves focus to the line that took its
 * place, else the one before, else the add button, so focus never falls to the page.
 *
 * A `<fieldset>` named by its `<legend>`; each input is named by its position, and the error and the
 * hint are tied to the group with `aria-describedby`. Controlled: it keeps no copy of the lines.
 *
 * @param props The lines and options, see {@link ListFieldProps}.
 */
export function ListField(
  {
    id,
    label,
    value,
    onChange,
    max,
    maxLength,
    name,
    placeholder,
    hint,
    error,
    disabled,
    labels,
    class: className,
  }: ListFieldProps,
): JSX.Element {
  const words = useLabels("ListField", LIST_FIELD_LABELS, labels, {
    item: ["position"],
    remove: ["position"],
    count: ["count", "max"],
  })
  const list = useRef<HTMLOListElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<FocusTarget>(null)
  const full = max !== undefined && value.length >= max
  const message = typeof error === "string" && error.length > 0 ? error : undefined
  const errorId = message === undefined ? undefined : `${id}-error`
  const hintId = hint === undefined || hint === null || hint === false || hint === ""
    ? undefined
    : `${id}-hint`
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null
    if (target === null) return
    if (target === "add") {
      addButton.current?.focus()
      return
    }
    const input = list.current?.querySelectorAll("input")[target.index]
    if (!input) {
      addButton.current?.focus()
      return
    }
    input.focus()
    if (target.atEnd) input.setSelectionRange(input.value.length, input.value.length)
  }, [value])

  const insertAfter = (index: number) => {
    if (full) return
    focusNext.current = { index: index + 1, atEnd: false }
    onChange([...value.slice(0, index + 1), "", ...value.slice(index + 1)])
  }

  const remove = (index: number, backTo: "next" | "previous") => {
    const rest = value.filter((_, at) => at !== index)
    focusNext.current = rest.length === 0
      ? "add"
      : backTo === "previous" || index >= rest.length
      ? { index: Math.max(0, index - 1), atEnd: true }
      : { index, atEnd: false }
    onChange(rest)
  }

  const onKeyDown = (index: number) => (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (isImeKeyPress(event)) return
    if (event.key === "Enter") {
      event.preventDefault()
      insertAfter(index)
    } else if (event.key === "Backspace" && index > 0 && event.currentTarget.value === "") {
      event.preventDefault()
      remove(index, "previous")
    }
  }

  return (
    <fieldset class={join("min-w-0", className)} aria-describedby={describedBy} disabled={disabled}>
      <legend class={join("pc-label", disabled && "opacity-50")}>{label}</legend>
      {value.length > 0 && (
        <ol ref={list} class="mt-2 flex flex-col gap-2" data-e2e="list-field-lines">
          {value.map((line, index) => (
            <li key={index} class="flex items-center gap-2">
              <Input
                id={index === 0 ? id : `${id}-${index}`}
                name={name}
                value={line}
                placeholder={placeholder}
                maxLength={maxLength}
                aria-label={words.item(index + 1)}
                aria-invalid={message !== undefined ? true : undefined}
                class="min-w-0 flex-1"
                onInput={(event) => {
                  const next = [...value]
                  next[index] = event.currentTarget.value
                  onChange(next)
                }}
                onKeyDown={onKeyDown(index)}
              />
              <Button
                type="button"
                variant="icon"
                size="sm"
                class={`shrink-0 ${TOUCH_TARGET}`}
                aria-label={words.remove(index + 1)}
                onClick={() => remove(index, "next")}
              >
                <IconXMark class="size-5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        {!full && (
          <Button
            ref={addButton}
            type="button"
            variant="ghost"
            size="sm"
            class="min-h-11 sm:min-h-9"
            onClick={() => {
              focusNext.current = { index: value.length, atEnd: false }
              onChange([...value, ""])
            }}
          >
            <IconPlus class="size-4" aria-hidden="true" />
            {words.add}
          </Button>
        )}
        {max !== undefined && (
          <span class="ms-auto text-sm text-muted tabular-nums">
            {words.count(value.length, max)}
          </span>
        )}
      </div>
      {message !== undefined && (
        <p id={errorId} class="mt-2 text-sm text-danger" aria-live="polite">{message}</p>
      )}
      {hintId !== undefined && <p id={hintId} class="mt-2 text-sm text-muted">{hint}</p>}
    </fieldset>
  )
}
