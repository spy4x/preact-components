import type { CurrencyOption } from "@spy4x/platform/universal/money-core"
import { searchEntries } from "@spy4x/platform/universal/text"
import type { JSX } from "preact"
import { Combobox } from "./combobox.tsx"
import { useLabels } from "./i18n.tsx"

/** A query with a letter or a digit; anything else is symbols, which a word search folds away. */
const WORDS = /[\p{L}\p{N}]/u

/** The search entry of each option, kept while the option object lives so a keystroke reuses it. */
const entries = new WeakMap<CurrencyOption, { label: string; aliases: string[] }>()

function entryOf(option: CurrencyOption): { label: string; aliases: string[] } {
  let entry = entries.get(option)
  if (!entry) {
    entry = { label: option.name, aliases: option.aliases }
    entries.set(option, entry)
  }
  return entry
}

/**
 * The options `CurrencyField` lists for `query`, best first.
 *
 * - An empty query lists the codes in `recent`, in that order, then every other option in its own
 *   order.
 * - A query with a letter or a digit puts the option whose code it is first, then the rest as
 *   `searchEntries` ranks them over the name and the aliases (the code, the English name and the
 *   symbols): `eur`, `euro` and `EUR` all put EUR first.
 * - A query of symbols only (`€`, `$`) lists the options whose symbol it is, then those whose narrow
 *   symbol it is, since a word search would match every option.
 */
export function filterCurrencies(
  options: readonly CurrencyOption[],
  query: string,
  recent: readonly string[] = [],
): CurrencyOption[] {
  const typed = query.trim()
  if (!typed) {
    const first = recent.flatMap((code) => options.find((option) => option.code === code) ?? [])
    return [...first, ...options.filter((option) => !first.includes(option))]
  }
  if (!WORDS.test(typed)) {
    const bySymbol = options.filter((option) => option.symbol === typed)
    const byNarrow = options.filter((option) =>
      !bySymbol.includes(option) && option.aliases.includes(typed)
    )
    return [...bySymbol, ...byNarrow]
  }
  const code = typed.toUpperCase()
  const byEntry = new Map(options.map((option) => [entryOf(option), option]))
  const ranked = searchEntries(typed, [...byEntry.keys()]).map((match) => byEntry.get(match.entry)!)
  const exact = ranked.find((option) => option.code === code)
  return exact ? [exact, ...ranked.filter((option) => option !== exact)] : ranked
}

/** The English words of `CurrencyField`, each one a prop of its own. */
const CURRENCY_FIELD_LABELS = {
  label: "Currency",
  placeholder: "Code, name or symbol",
  option: (name: string, code: string) => `${name} (${code})`,
  empty: (query: string) => `No currency matches “${query}”. Try its 3-letter code, such as EUR.`,
  count: (count: number) => count === 1 ? "1 currency" : `${count} currencies`,
  clear: "Clear currency",
  required: "Select a currency",
}

export interface CurrencyFieldProps {
  /** The chosen ISO 4217 code, or an app's own code such as `"BTC"`; `null` for none. */
  value: string | null
  /** Called with the chosen code, or `null` when the clear button empties the field. */
  onChange: (code: string | null) => void
  /**
   * Every currency to offer, in listing order: ts-libs' `currencyOptions(locale)`, names in the
   * interface language and sorted by them, plus any coin the app adds.
   */
  options: readonly CurrencyOption[]
  /** Codes the person used lately, listed first, in this order, while nothing is typed. */
  recent?: readonly string[]
  /** `id` of the search input, for a `<label for>`; `Field` sets it. */
  id?: string
  /** Accessible name when no visible label names the field. Default `"Currency"`, translated. */
  ariaLabel?: string
  /** `id` of the visible label that names the field; it wins over `ariaLabel`. */
  "aria-labelledby"?: string
  /** A currency must be chosen; `Field` sets it from its own `required`. */
  required?: boolean
  /** Ids of the elements that describe the field; `Field` sets it. */
  "aria-describedby"?: string
  /** Marks the field invalid; `Field` sets it while it carries an error. */
  "aria-invalid"?: boolean | string
  /** Shown while nothing is chosen. Default `"Code, name or symbol"`, translated. */
  placeholder?: string
  /** Renders `autofocus` on the input, so a `Modal` focuses it on open. */
  autoFocus?: boolean
  /** How a chosen currency reads in the closed field. Default `"Euro (EUR)"`, translated. */
  optionLabel?: (name: string, code: string) => string
  /** Shown when the query matches nothing. Default names the query and suggests the code. */
  emptyMessage?: (query: string) => string
  /** How many currencies the query left, for a screen reader. Default `"3 currencies"`. */
  countMessage?: (count: number) => string
  /** Accessible name of the clear button. Default `"Clear currency"`, translated. */
  clearLabel?: string
  /** What the browser shows on a submit with nothing chosen. Default `"Select a currency"`. */
  requiredMessage?: string
  /** Utilities for the wrapper, appended after the combobox's own. */
  class?: string
}

/**
 * Picks a currency by its code, its name or its symbol: a {@link Combobox} of `options`.
 *
 * Typing `euro`, `eur` or `€` puts the euro first and highlighted, so Enter picks it; with nothing
 * typed, the `recent` codes come first. A row shows the code in a fixed column, the name, and the
 * symbol at the end when it differs from the code (hidden from screen readers, which hear the
 * name). The closed field reads `Euro (EUR)`. Every word is a prop with a translated default.
 */
export function CurrencyField(
  {
    value,
    onChange,
    options,
    recent,
    id,
    ariaLabel,
    "aria-labelledby": labelledBy,
    required,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    placeholder,
    autoFocus,
    optionLabel,
    emptyMessage,
    countMessage,
    clearLabel,
    requiredMessage,
    class: className,
  }: CurrencyFieldProps,
): JSX.Element {
  const text = useLabels("CurrencyField", CURRENCY_FIELD_LABELS, {
    label: ariaLabel,
    placeholder,
    option: optionLabel,
    empty: emptyMessage,
    count: countMessage,
    clear: clearLabel,
    required: requiredMessage,
  }, { option: ["name", "code"], empty: ["query"], count: ["count"] })
  const chosen = value === null ? null : options.find((option) => option.code === value) ?? null
  return (
    <Combobox<CurrencyOption>
      items={options}
      value={chosen}
      onChange={(option) => onChange(option?.code ?? null)}
      getLabel={(option) => text.option(option.name, option.code)}
      filter={(items, query) => filterCurrencies(items, query, recent)}
      renderOption={(option) => (
        <span class="flex w-full items-baseline gap-3">
          <span class="min-w-[4ch] font-medium tabular-nums">{option.code}</span>
          <span class="flex-1">{option.name}</span>
          {option.symbol !== option.code && (
            <span class="text-muted" aria-hidden="true">{option.symbol}</span>
          )}
        </span>
      )}
      id={id}
      ariaLabel={labelledBy ? undefined : text.label}
      aria-labelledby={labelledBy}
      required={required}
      requiredMessage={text.required}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      placeholder={text.placeholder}
      autoFocus={autoFocus}
      emptyMessage={text.empty}
      countMessage={text.count}
      clearLabel={text.clear}
      class={className}
    />
  )
}
