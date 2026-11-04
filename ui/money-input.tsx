import { cn } from "@spy4x/preact-cn"
import { useSignal } from "@preact/signals"
import {
  currencyDecimals,
  formatMoney,
  moneyDecimalString,
  parseMoney,
} from "@spy4x/platform/universal/money"
import type { JSX } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"
import type { Translator } from "@spy4x/platform/universal/i18n"
import { useFormat } from "./format.tsx"
import { ENGLISH, translate, useT } from "./i18n.tsx"

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
  /**
   * ISO 4217 code, e.g. `"EUR"`, `"JPY"`, `"KWD"`, or an app's own code such as `"BTC"`. Shown
   * inside the field, at its inline end.
   */
  currency: string
  /**
   * BCP 47 locale used to format the shown text and to parse what is typed. Defaults to the region
   * format of the nearest `FormatContext` (`useFormat().locale`), so `1.234,56` reads as `123456`
   * cents for a person in Germany whatever language the words are in.
   */
  locale?: string
  /**
   * How many decimals the smallest unit has: `8` for `BTC`. Defaults to the ISO 4217 table, which
   * a code it lacks cannot rely on.
   */
  decimals?: number
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
  /** Id of the visible control. Generated when left out; inside `Field`, the field's `id` is used. */
  id?: string
  disabled?: boolean
  /**
   * Refuses a form submit while the field is empty, through the visible input's native `required`.
   * `Field` sets it from its own `required`.
   */
  required?: boolean
  placeholder?: string
  /** Shown, and announced, when the typed text cannot be parsed as an amount. */
  invalidMessage?: string
  /** Shown, and announced, when a parsed amount falls outside `min`/`max`. */
  rangeMessage?: MoneyInputRangeMessage
  /**
   * Shown, and announced, when the typed amount has more decimals than the currency takes.
   * English default: `"EUR takes up to 2 decimal places"`, `"JPY takes whole amounts only"`.
   */
  decimalsMessage?: MoneyInputDecimalsMessage
  /** Utilities for the bordered box that holds the input and the currency code. */
  class?: string
  "aria-describedby"?: string
  /**
   * Marks the field invalid for a reason the caller knows; `Field` sets it while it carries an
   * error. A message of this component's own marks it too, whatever this says.
   */
  "aria-invalid"?: boolean | string
}

/**
 * A {@link MoneyInputProps.rangeMessage} function. `decimals` is the caller's
 * {@link MoneyInputProps.decimals}, for formatting the bounds.
 */
export type MoneyInputRangeMessage = (
  bounds: MoneyInputBounds,
  currency: string,
  locale: string,
  decimals?: number,
) => string

/**
 * A {@link MoneyInputProps.decimalsMessage} function: `decimals` is how many the currency takes,
 * `0` for one with whole amounts only.
 */
export type MoneyInputDecimalsMessage = (decimals: number, currency: string) => string

function defaultRangeMessage(
  bounds: MoneyInputBounds,
  currency: string,
  locale: string,
  decimals?: number,
): string {
  return rangeWords(ENGLISH, bounds, currency, locale, decimals)
}

/** The range message in `translator`'s words, the amounts in `locale`'s money format. */
function rangeWords(
  translator: Translator<string>,
  { min, max }: MoneyInputBounds,
  currency: string,
  locale: string,
  decimals?: number,
): string {
  const money = (amount: number) => formatMoney(amount, currency, locale, { decimals })
  if (min !== undefined && max !== undefined) {
    return translate(
      translator,
      "MoneyInput.rangeBetween",
      `Enter an amount between ${money(min)} and ${money(max)}`,
      { min: money(min), max: money(max) },
    )
  }
  if (min !== undefined) {
    return translate(
      translator,
      "MoneyInput.rangeMin",
      `Enter ${money(min)} or more`,
      { min: money(min) },
    )
  }
  return translate(
    translator,
    "MoneyInput.rangeMax",
    `Enter ${money(max as number)} or less`,
    { max: money(max as number) },
  )
}

/** The decimals message in `translator`'s words. */
function decimalsWords(translator: Translator<string>, decimals: number, currency: string): string {
  if (decimals === 0) {
    return translate(
      translator,
      "MoneyInput.decimalsNone",
      `${currency} takes whole amounts only`,
      { code: currency },
    )
  }
  return translate(
    translator,
    "MoneyInput.decimalsMax",
    `${currency} takes up to ${decimals} decimal ${decimals === 1 ? "place" : "places"}`,
    { code: currency, count: decimals },
  )
}

function defaultDecimalsMessage(decimals: number, currency: string): string {
  return decimalsWords(ENGLISH, decimals, currency)
}

/** The optional inputs of {@link resolveMoneyInputEdit}. */
export interface MoneyInputEditOptions {
  /** The currency's decimals, as {@link MoneyInputProps.decimals}. */
  decimals?: number
  /** The message for too many decimals. Default: the English of {@link MoneyInputProps.decimalsMessage}. */
  decimalsMessage?: MoneyInputDecimalsMessage
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
 * The input's text, with text that is only spaces removed from the input itself. Blank text means
 * "no amount", but the browser's `required` check reads the raw text and would take three spaces
 * for a value, so Enter would submit a required field with no amount in it.
 */
function withoutBlankText(input: HTMLInputElement | null): string {
  if (!input) return ""
  if (input.value !== "" && input.value.trim() === "") input.value = ""
  return input.value
}

/**
 * The whole decision one edit of {@link MoneyInput}'s text makes, as a pure function with no
 * signal, ref or DOM in it — everything {@link MoneyInput} itself does with an edit is call this
 * and apply the result. Kept separate so every rule below is a plain, fast unit test instead of a
 * simulated keystroke: empty text clears the value; more fraction digits than the currency takes
 * reports `options.decimalsMessage`; other text {@link parseMoney} refuses (a letter, an amount
 * beyond `Number.MAX_SAFE_INTEGER`, …) reports `invalidMessage`; a parsed amount outside `bounds`
 * reports `rangeMessage`. Each of those leaves the value where it was. Anything else reports the
 * parsed value and clears the message.
 */
export function resolveMoneyInputEdit(
  text: string,
  currency: string,
  locale: string,
  bounds: MoneyInputBounds,
  invalidMessage: string,
  rangeMessage: MoneyInputRangeMessage = defaultRangeMessage,
  options: MoneyInputEditOptions = {},
): MoneyInputEdit {
  if (text.trim() === "") return { value: null, message: undefined }

  const { decimals, decimalsMessage = defaultDecimalsMessage } = options
  const result = parseMoney(text, currency, locale, { decimals })
  if (!result.ok) {
    if (result.error.type === "too-many-decimals") {
      return { message: decimalsMessage(result.error.maxDecimals, currency) }
    }
    return { message: invalidMessage }
  }

  const { min, max } = bounds
  if ((min !== undefined && result.value < min) || (max !== undefined && result.value > max)) {
    return { message: rangeMessage(bounds, currency, locale, decimals) }
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
export function editableText(
  value: number | null,
  currency: string,
  locale: string,
  decimals?: number,
): string {
  if (value === null) return ""
  const digits = currencyDecimals(currency, locale, { decimals })
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(moneyDecimalString(value, digits) as unknown as number)
}

/**
 * The currency's name in `language`, `"Euro"` for `EUR` in `en`, or `undefined` for a code `Intl`
 * has no name for, such as an app's own `"USDT"`.
 */
function currencyName(currency: string, language: string): string | undefined {
  if (!/^[A-Za-z]{3}$/.test(currency)) return undefined
  try {
    return new Intl.DisplayNames(language, { type: "currency", fallback: "none" }).of(currency)
  } catch {
    // An unknown language tag: the code alone still names the currency.
    return undefined
  }
}

/**
 * A text field for an amount in `currency`'s smallest unit: `value`/`onChange` carry the integer,
 * exactly the way `MoneyDisplay` renders it. `inputmode="decimal"` brings up the numeric keyboard
 * on a phone, and typing understands `locale`'s own decimal mark — `"12,5"` with `locale="de"`
 * becomes `1250`, the same way it would for `EUR`'s two decimals typed in German.
 *
 * **The field always says which currency it is in.** The code (`EUR`, not `€`, which names a dozen
 * currencies) sits at the inline end of one bordered box, muted and never truncated; the input
 * shrinks instead. It describes the input through `aria-describedby`, with the currency's name for
 * a screen reader when `Intl` knows it ("Currency: Euro (EUR)"). It is not a Tab stop; a click on
 * it focuses the input.
 *
 * **Typing something that does not parse — a letter, a second decimal mark, more fraction digits
 * than the currency allows — leaves `value` exactly where it was** and shows `invalidMessage`
 * (`decimalsMessage` for too many fraction digits, `rangeMessage` when the amount parses but sits
 * outside `min`/`max`) in a live region that is
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
    locale: localeProp,
    decimals,
    min,
    max,
    name,
    id: callerId,
    disabled,
    required,
    placeholder,
    invalidMessage: invalidMessageProp,
    rangeMessage: rangeMessageProp,
    decimalsMessage: decimalsMessageProp,
    class: className,
    "aria-describedby": callerDescribedBy,
    "aria-invalid": callerInvalid,
  }: MoneyInputProps,
): JSX.Element {
  const translator = useT()
  // Read whether or not `locale` is given: a hook is never called conditionally.
  const region = useFormat().locale
  const locale = localeProp ?? region
  const invalidMessage = invalidMessageProp ??
    translate(translator, "MoneyInput.invalidMessage", "Enter a valid amount")
  const rangeMessage: MoneyInputRangeMessage = rangeMessageProp ??
    ((bounds, code, format, digits) => rangeWords(translator, bounds, code, format, digits))
  const editOptions: MoneyInputEditOptions = {
    decimals,
    decimalsMessage: decimalsMessageProp ??
      ((digits, code) => decimalsWords(translator, digits, code)),
  }
  const generatedId = useId()
  const id = callerId ?? generatedId
  const statusId = `${id}-status`
  const currencyId = `${id}-currency`
  const currencyLabel = currencyName(currency, translator.language)

  const inputRef = useRef<HTMLInputElement>(null)
  const draft = useSignal(editableText(value, currency, locale, decimals))
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
    const text = withoutBlankText(inputRef.current)
    draft.value = text
    const edit = resolveMoneyInputEdit(
      text,
      currency,
      locale,
      { min, max },
      invalidMessage,
      rangeMessage,
      editOptions,
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

  // An amount, currency or locale changed from outside re-formats the text, unless the visitor is
  // editing it. In a layout effect, not the render body: writing a signal during render re-renders
  // forever (#300), and a plain effect would paint the old text for one frame. It skips the mount,
  // which the hydration effect above settles: the amount that one resolved from pre-hydration text
  // reaches `value` only on the caller's next render.
  const resyncs = useRef(false)
  useLayoutEffect(() => {
    if (!resyncs.current) {
      resyncs.current = true
      return
    }
    const last = synced.current
    if (focused.current) return
    if (last.value === value && last.currency === currency && last.locale === locale) return
    draft.value = editableText(value, currency, locale, decimals)
    message.value = undefined
    synced.current = { value, currency, locale }
  }, [value, currency, locale, decimals])

  function handleInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const text = withoutBlankText(event.currentTarget)
    draft.value = text

    const edit = resolveMoneyInputEdit(
      text,
      currency,
      locale,
      { min, max },
      invalidMessage,
      rangeMessage,
      editOptions,
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
      draft.value = editableText(value, currency, locale, decimals)
      synced.current = { value, currency, locale }
    }
  }

  const describedBy = [callerDescribedBy, currencyId, message.value ? statusId : undefined]
    .filter(Boolean).join(" ")
  const invalid = Boolean(message.value) || callerInvalid === true || callerInvalid === "true"

  return (
    <>
      <div
        class={cn(
          "flex h-12 w-full items-center gap-2 rounded-primary border bg-surface pe-3 focus-within:ring-2 focus-within:ring-focus",
          invalid ? "border-danger" : "border-control",
          disabled && "opacity-50",
          className,
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autocomplete="off"
          value={draft.value}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          class="h-full min-w-0 flex-1 rounded-primary bg-transparent ps-3 text-foreground outline-none placeholder:text-placeholder disabled:cursor-not-allowed"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <span
          id={currencyId}
          class="shrink-0 select-none text-sm tabular-nums text-muted"
          // A pointer on the unit means the field; it is text, not a control, so the keyboard
          // never stops here.
          onMouseDown={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          {currencyLabel === undefined ? currency : (
            <>
              <span aria-hidden="true">{currency}</span>
              <span class="sr-only">
                {translate(
                  translator,
                  "MoneyInput.currency",
                  `Currency: ${currencyLabel} (${currency})`,
                  { name: currencyLabel, code: currency },
                )}
              </span>
            </>
          )}
        </span>
      </div>
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
