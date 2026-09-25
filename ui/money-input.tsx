import { cn } from "@preact-components/cn"
import { useSignal } from "@preact/signals"
import {
  currencyDecimals,
  formatMoney,
  moneyDecimalString,
  parseMoney,
} from "@spy4x/platform/universal/money"
import type { JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"

export interface MoneyInputBounds {
  /** Smallest-unit lower bound, when one is set. */
  min?: number
  /** Smallest-unit upper bound, when one is set. */
  max?: number
}

export interface MoneyInputProps {
  /** Amount in `currency`'s smallest unit, or `null` for an empty field. */
  value: number | null
  onChange: (value: number | null) => void
  /** ISO 4217 code, e.g. `"EUR"`, `"JPY"`, `"KWD"`. */
  currency: string
  /** BCP 47 locale used to format the shown text and to parse what is typed. Defaults to `"en"`. */
  locale?: string
  /** Smallest-unit lower bound. A parsed amount below it is refused, like unparsable text. */
  min?: number
  /** Smallest-unit upper bound. A parsed amount above it is refused, like unparsable text. */
  max?: number
  /**
   * Name of a `<input type="hidden">` this component also renders, carrying the smallest-unit
   * integer (or nothing, when `value` is `null`) — see the class doc for why. Left out, this
   * field posts nothing of its own to a plain form.
   */
  name?: string
  /** Id of the visible control. Generated when left out; pass one to use this inside `Field`. */
  id?: string
  disabled?: boolean
  placeholder?: string
  /** Shown, and announced, when the typed text cannot be parsed as an amount. */
  invalidMessage?: string
  /** Shown, and announced, when a parsed amount falls outside `min`/`max`. */
  rangeMessage?: MoneyInputRangeMessage
  class?: string
  "aria-describedby"?: string
}

/** A {@link MoneyInputProps.rangeMessage} function. */
export type MoneyInputRangeMessage = (
  bounds: MoneyInputBounds,
  currency: string,
  locale: string,
) => string

function defaultRangeMessage(
  { min, max }: MoneyInputBounds,
  currency: string,
  locale: string,
): string {
  if (min !== undefined && max !== undefined) {
    return `Enter an amount between ${formatMoney(min, currency, locale)} and ${
      formatMoney(max, currency, locale)
    }`
  }
  if (min !== undefined) return `Enter an amount of at least ${formatMoney(min, currency, locale)}`
  return `Enter an amount of at most ${formatMoney(max as number, currency, locale)}`
}

/** What one edit of {@link MoneyInput}'s text resolves to — see {@link resolveMoneyInputEdit}. */
export interface MoneyInputEdit {
  /**
   * The new `value` to report through `onChange`. Left out (rather than `undefined` meaning
   * "clear it") when the text does not resolve to a value at all, so a caller can tell "report
   * `null`" apart from "report nothing, the previous value stands" with a plain `"value" in edit`
   * check instead of a second flag.
   */
  value?: number | null
  /** The message to show, or `undefined` to clear whatever was shown before. */
  message: string | undefined
}

/**
 * The whole decision one edit of {@link MoneyInput}'s text makes, as a pure function with no
 * signal, ref or DOM in it — everything {@link MoneyInput} itself does with an edit is call this
 * and apply the result. Kept separate so every rule below is a plain, fast unit test instead of a
 * simulated keystroke: empty text clears the value; text {@link parseMoney} refuses (a letter, too
 * many fraction digits, an amount beyond `Number.MAX_SAFE_INTEGER`, …) reports `invalidMessage` and
 * leaves the value where it was; a parsed amount outside `bounds` reports `rangeMessage` the same
 * way; anything else reports the parsed value and clears the message.
 */
export function resolveMoneyInputEdit(
  text: string,
  currency: string,
  locale: string,
  bounds: MoneyInputBounds,
  invalidMessage: string,
  rangeMessage: MoneyInputRangeMessage = defaultRangeMessage,
): MoneyInputEdit {
  if (text.trim() === "") return { value: null, message: undefined }

  const result = parseMoney(text, currency, locale)
  if (!result.ok) return { message: invalidMessage }

  const { min, max } = bounds
  if ((min !== undefined && result.value < min) || (max !== undefined && result.value > max)) {
    return { message: rangeMessage(bounds, currency, locale) }
  }

  return { value: result.value, message: undefined }
}

/**
 * The text a person edits: the amount's digits and decimal mark in `locale`, with no currency
 * symbol and no grouping — grouping separators would have to be re-parsed back out on every
 * keystroke for no benefit, since {@link parseMoney} already understands them being absent. Built
 * from {@link moneyDecimalString}'s exact decimal string, not a division by a power of ten: that
 * division is not exact for a `value` near `Number.MAX_SAFE_INTEGER` — see
 * `@spy4x/platform/universal/money`'s module doc.
 */
export function editableText(value: number | null, currency: string, locale: string): string {
  if (value === null) return ""
  const decimals = currencyDecimals(currency, locale)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(moneyDecimalString(value, decimals) as unknown as number)
}

/**
 * A text field for an amount in `currency`'s smallest unit: `value`/`onChange` carry the integer,
 * exactly the way `MoneyDisplay` renders it. `inputmode="decimal"` brings up the numeric keyboard
 * on a phone, and typing understands `locale`'s own decimal mark — `"12,5"` with `locale="de"`
 * becomes `1250`, the same way it would for `EUR`'s two decimals typed in German.
 *
 * **Typing something that does not parse — a letter, a second decimal mark, more fraction digits
 * than the currency allows — leaves `value` exactly where it was** and shows `invalidMessage`
 * (or `rangeMessage`, when the amount parses but sits outside `min`/`max`) in a live region that is
 * rendered, empty, from the very first render — the same shape `Combobox` uses for its own
 * status text, and for the same reason: a region that arrives with its message already inside it is
 * commonly not announced at all, only a *change* to a region already being watched is.
 *
 * **A message on screen also blocks a real form submit**, through the visible `<input>`'s own
 * `setCustomValidity`: the browser refuses to submit a form with an invalid control and shows the
 * message itself, the same way a missing `required` value does. The typed text and the message
 * both stay exactly as they are when the field loses focus while one stands — blur does *not*
 * silently revert to the last committed amount and drop the message, which would let a person tab
 * past a rejected `20,00` in a field capped at `10.00` and never learn their entry was thrown away.
 * Blur only re-formats the shown text (to `locale`'s canonical grouping-free form) when the last
 * edit resolved to a value and no message is standing.
 *
 * **A plain form never posts a stale amount, not even before hydration.** The visible `<input>`
 * carries no `name`, so it never posts anything of its own. When `name` is given, a second,
 * `type="hidden"` input carries the smallest-unit integer instead (empty string for `null`) — but
 * it starts out `disabled`, which drops it from `FormData` entirely, because Preact's hydration
 * leaves text typed into the visible field before the bundle ran exactly where the browser put it,
 * unparsed. A mount effect reads that text once, resolves it the same way `handleInput` would, and
 * only then re-enables the hidden input — so a form submitted in the gap before hydration posts no
 * amount at all, never the server-rendered one, and a form submitted right after posts what the
 * visitor actually typed while the page was still loading.
 *
 * A local `draft` signal holds the edited text — the same "purely visual" local state `Input`'s own
 * house rule allows — and is only resynced from `value`/`currency`/`locale` while the field is not
 * focused, so a value the caller pushes in from outside (a reset, a currency switch) is reflected,
 * but a keystroke never races a render carrying the previous `value`.
 */
export function MoneyInput(
  {
    value,
    onChange,
    currency,
    locale = "en",
    min,
    max,
    name,
    id: callerId,
    disabled,
    placeholder,
    invalidMessage = "Enter a valid amount",
    rangeMessage = defaultRangeMessage,
    class: className,
    "aria-describedby": callerDescribedBy,
  }: MoneyInputProps,
): JSX.Element {
  const generatedId = useId()
  const id = callerId ?? generatedId
  const statusId = `${id}-status`

  const inputRef = useRef<HTMLInputElement>(null)
  const draft = useSignal(editableText(value, currency, locale))
  const message = useSignal<string | undefined>(undefined)
  const focused = useRef(false)
  const synced = useRef({ value, currency, locale })
  const mounted = useSignal(false)

  // Keeps the browser's own constraint validation in sync with `message`: while a message stands,
  // a real form submit through this control is refused and the message itself is what the browser
  // shows, the same way a missing `required` value is. An effect, not set inline during render,
  // because `inputRef.current` is not attached to the DOM node yet on the render that first sets
  // `message`.
  useEffect(() => {
    inputRef.current?.setCustomValidity(message.value ?? "")
  }, [message.value])

  // Runs once, after hydration attaches. Preact does not overwrite an input's `value` while
  // hydrating, so whatever a visitor typed before the bundle ran is still sitting in the DOM,
  // untouched by `handleInput` and unknown to `draft`, `value` or the hidden input below — see the
  // class doc. Reading it here and resolving it through the same path `handleInput` uses is what
  // makes that typed text (or its rejection) take effect exactly once, the moment it is safe to.
  useEffect(() => {
    const text = inputRef.current?.value ?? ""
    draft.value = text
    const edit = resolveMoneyInputEdit(
      text,
      currency,
      locale,
      { min, max },
      invalidMessage,
      rangeMessage,
    )
    message.value = edit.message
    // Both set here rather than left to their own paths. The field may already hold focus from
    // before hydration, when no focus handler existed to record it; without this, every later
    // keystroke that changes the amount would re-format the text under the cursor. And validity is
    // set before the hidden input is enabled below, so no render exists in which the hidden input
    // posts while the browser still thinks refused text is valid.
    focused.current = document.activeElement === inputRef.current
    inputRef.current?.setCustomValidity(edit.message ?? "")
    if ("value" in edit) {
      const resolved = edit.value as number | null
      synced.current = { value: resolved, currency, locale }
      if (resolved !== value) onChange(resolved)
    } else {
      synced.current = { value, currency, locale }
    }
    mounted.value = true
  }, [])

  if (
    !focused.current &&
    (synced.current.value !== value || synced.current.currency !== currency ||
      synced.current.locale !== locale)
  ) {
    draft.value = editableText(value, currency, locale)
    message.value = undefined
    synced.current = { value, currency, locale }
  }

  function handleInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const text = event.currentTarget.value
    draft.value = text

    const edit = resolveMoneyInputEdit(
      text,
      currency,
      locale,
      { min, max },
      invalidMessage,
      rangeMessage,
    )
    message.value = edit.message
    if ("value" in edit) onChange(edit.value as number | null)
  }

  function handleFocus() {
    focused.current = true
  }

  function handleBlur() {
    focused.current = false
    // Only re-format when the last edit resolved cleanly. A standing message means the typed text
    // was refused (or fell outside min/max), and blur must not discard it — see the class doc.
    if (message.value === undefined) {
      draft.value = editableText(value, currency, locale)
      synced.current = { value, currency, locale }
    }
  }

  const describedBy = [callerDescribedBy, message.value ? statusId : undefined]
    .filter(Boolean).join(" ") || undefined

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autocomplete="off"
        value={draft.value}
        disabled={disabled}
        placeholder={placeholder}
        class={cn("input", className)}
        aria-describedby={describedBy}
        aria-invalid={message.value ? true : undefined}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {name !== undefined && (
        <input
          type="hidden"
          name={name}
          value={value === null ? "" : String(value)}
          disabled={!mounted.value}
        />
      )}
      <span id={statusId} role="status" aria-live="polite" aria-atomic="true">
        {message.value ?? ""}
      </span>
    </>
  )
}
