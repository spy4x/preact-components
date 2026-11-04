import { join } from "@spy4x/preact-cn/join"
import { IconSearch, IconXMark } from "@spy4x/preact-icons"
import { CATEGORY_ICONS, type IconName, ICONS } from "@spy4x/preact-icons/registry"
import { searchEntries } from "@spy4x/platform/universal/text"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useId, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { hintBubbleClasses, shiftIntoView } from "./hint-bubble.ts"
import { translate, type UiKey, useLabels, useT } from "./i18n.tsx"

/** The words of an {@link IconPicker} besides its legend and "No icon", each with an English default. */
export interface IconPickerLabels {
  /** Accessible name and placeholder of the search box, `"Search icons"`. */
  search?: string
  /** Shown in place of the grid when the search finds nothing, `"No icon matches “sofa”."`. */
  empty?: (query: string) => string
  /** The button that empties the search box, `"Clear search"`. */
  clearSearch?: string
  /** What the live region says after a search, `"6 icons"`. */
  count?: (count: number) => string
}

/** Props of {@link IconPicker}. */
export interface IconPickerProps {
  /** The chosen icon's id, or `null` for none. */
  value: IconName | null
  /** Called with the chosen id, or `null` for "No icon". */
  onChange: (value: IconName | null) => void
  /** The ids offered, in the order shown. Defaults to `CATEGORY_ICONS`. */
  icons?: readonly IconName[]
  /** Adds a first tile that clears the choice; it is hidden while a search is typed. */
  allowNone?: boolean
  /** Accessible name of the "No icon" tile, `"No icon"`. */
  noneLabel?: string
  /** The group's name, rendered as the `<legend>`, `"Icon"` by default. */
  legend?: ComponentChildren
  /** Helper text under the grid, tied to the group with `aria-describedby`. */
  hint?: ComponentChildren
  /** A message from the caller (a server refusal, say), under the grid and tied to the group. */
  error?: string | null
  /** Shared `name` of the tile radios, so a form submits the id; generated when left out. */
  name?: string
  labels?: IconPickerLabels
  /** Disables the search box and every tile. */
  disabled?: boolean
  /** Utilities on the `<fieldset>`. */
  class?: string
}

/** The English words of `IconPicker`; `none` is its `noneLabel`, `legend` its default legend. */
const ICON_PICKER_LABELS: Required<IconPickerLabels> & { none: string; legend: string } = {
  legend: "Icon",
  none: "No icon",
  search: "Search icons",
  empty: (query: string) => `No icon matches “${query}”.`,
  clearSearch: "Clear search",
  count: (count: number) => count === 1 ? "1 icon" : `${count} icons`,
}

/** The radio value of the "No icon" tile; no icon id has a capital, so it cannot meet one. */
const NONE = "None"

/**
 * One tile: 44 px tall, filling its grid cell. Checked, it takes the selection's soft fill and an
 * inset ring, so the choice is a shape and not only a hue; with the keyboard on it, the library's
 * focus outline sits outside the ring, so the two never hide each other.
 */
const tile = join(
  "flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-muted",
  "transition-colors duration-150 hover:bg-hover hover:text-foreground",
  "peer-checked:bg-selected-soft peer-checked:text-selected peer-checked:ring-2 peer-checked:ring-inset peer-checked:ring-current",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--color-ring)",
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
)

/**
 * The name bubble over a tile, shown on hover and on keyboard focus. `display: none` until then, so
 * a bubble near the edge of a phone never widens the page while nobody looks at it.
 */
const bubble = join(
  "pointer-events-none absolute bottom-full start-1/2 z-50 mb-1 hidden w-max",
  "translate-x-[calc(-50%+var(--shift,0px))] [&:dir(rtl)]:translate-x-[calc(50%+var(--shift,0px))]",
  "group-hover/icon:block peer-focus-visible:block",
)

/**
 * Moves a tile's name bubble sideways until it fits the viewport, once it is showing.
 *
 * @param event The pointer or focus event on the tile.
 */
function fitBubble(event: Event): void {
  const hint = (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-icon-hint]")
  if (!hint) return
  hint.style.setProperty("--shift", "0px")
  const box = hint.getBoundingClientRect()
  if (box.width === 0) return
  const width = hint.ownerDocument.documentElement.clientWidth
  hint.style.setProperty("--shift", `${shiftIntoView(box.left, box.right, width)}px`)
}

/**
 * An icon picker: a search box over a grid of icons, one of which a person chooses for a category,
 * a list or a folder. It stores the icon's id from `@spy4x/preact-icons/registry`.
 *
 * Built like `ColorField`: a `<fieldset>` named by its `<legend>`, with a visually hidden native
 * radio per tile, so the grid is one tab stop, the arrow keys move the choice and a form submits the
 * id under `name`. Each tile is named by the icon's name in the reader's language, which a bubble
 * also shows on hover and on keyboard focus; the legend reads `Icon · Car` once one is chosen, so a
 * phone, which has no hover, still shows the name.
 *
 * The search ranks the grid by the icon's name and aliases in the reader's language and in English,
 * with the forgiving rules of `searchEntries` (any word order, a typo, the other keyboard layout),
 * so `car`, `машина` and `vfibyf` all find the car in Russian. In the search box `Enter` chooses
 * the first icon left and never submits the form, `ArrowDown` moves to the checked tile (else the
 * first), and `Escape` empties the box; an empty box lets `Escape` reach a dialog around it.
 *
 * ```tsx
 * <IconPicker value={category.icon} onChange={(icon) => category.icon = icon} name="icon" />
 * ```
 */
export function IconPicker(
  {
    value,
    onChange,
    icons = CATEGORY_ICONS,
    allowNone = false,
    noneLabel,
    legend,
    hint,
    error,
    name,
    labels = {},
    disabled = false,
    class: className,
  }: IconPickerProps,
): JSX.Element {
  const translator = useT()
  const text = useLabels("IconPicker", ICON_PICKER_LABELS, { ...labels, none: noneLabel }, {
    empty: ["query"],
    count: ["count"],
  })
  const id = useId()
  const query = useSignal("")
  /** Whether the search has changed since the first render, so the live region speaks. */
  const searched = useSignal(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const nameOf = (icon: IconName) =>
    translate(translator, `IconPicker.icon.${icon}` as UiKey, ICONS[icon].name)
  const entries = icons.map((icon) => {
    const english = ICONS[icon]
    const local = translate(
      translator,
      `IconPicker.aliases.${icon}` as UiKey,
      english.aliases.join(", "),
    )
    return {
      icon,
      label: nameOf(icon),
      aliases: [english.name, ...english.aliases, ...local.split(",").map((word) => word.trim())]
        .filter((word) => word !== ""),
    }
  })
  const shown = searchEntries(query.value, entries).map((match) => match.entry)
  const searching = query.value.trim() !== ""
  const chosen = value !== null && Object.hasOwn(ICONS, value) ? value : null

  const groupName = name ?? `${id}-icon`
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint !== undefined && hint !== null && hint !== false && hint !== ""
    ? `${id}-hint`
    : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined

  const search = (next: string) => {
    query.value = next
    searched.value = true
  }

  const clear = () => {
    search("")
    searchRef.current?.focus()
  }

  const onSearchKey = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      // A search box in a form submits it on Enter; here Enter means "this one".
      event.preventDefault()
      if (shown[0]) onChange(shown[0].icon)
    } else if (event.key === "ArrowDown") {
      const radios = [...gridRef.current?.querySelectorAll<HTMLInputElement>("input") ?? []]
      const target = radios.find((radio) => radio.checked) ?? radios[0]
      if (!target) return
      event.preventDefault()
      target.focus()
    } else if (event.key === "Escape" && query.value !== "") {
      // The box's own Escape: a dialog around it closes on the next one.
      event.preventDefault()
      event.stopPropagation()
      search("")
    }
  }

  /** One tile: a hidden radio, the glyph, the name for a screen reader and the bubble. */
  const option = (optionValue: string, label: string, glyph: JSX.Element) => (
    <label
      key={optionValue}
      class="group/icon relative"
      onPointerEnter={fitBubble}
      onFocusCapture={fitBubble}
    >
      <input
        type="radio"
        class="peer sr-only"
        name={groupName}
        value={optionValue}
        checked={(chosen ?? NONE) === optionValue}
        onChange={() => onChange(optionValue === NONE ? null : optionValue as IconName)}
        data-e2e="icon-picker-tile"
      />
      <span class={tile} aria-hidden="true">{glyph}</span>
      <span class="sr-only">{label}</span>
      <span class={bubble} aria-hidden="true" data-icon-hint>
        <span class={hintBubbleClasses}>{label}</span>
      </span>
    </label>
  )

  return (
    <fieldset
      class={className}
      aria-describedby={describedBy}
      disabled={disabled}
      data-e2e="icon-picker"
    >
      <legend class="pc-label mb-2">
        {legend ?? text.legend}
        {chosen !== null && (
          // The legend is a flex box, which drops a leading space, so a margin keeps the gap.
          <span class="ms-1 font-normal text-muted" aria-hidden="true">{`· ${nameOf(chosen)}`}</span>
        )}
      </legend>
      <div class="relative mb-2 w-full sm:max-w-xs">
        <IconSearch class="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={searchRef}
          type="search"
          value={query.value}
          placeholder={text.search}
          aria-label={text.search}
          autocomplete="off"
          onInput={(event) => search(event.currentTarget.value)}
          onKeyDown={onSearchKey}
          class="pc-input h-11 pe-12 ps-8 text-sm [&::-webkit-search-cancel-button]:appearance-none"
          data-e2e="icon-picker-search"
        />
        {query.value !== "" && (
          <button
            type="button"
            aria-label={text.clearSearch}
            class="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-primary text-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
            onClick={clear}
          >
            <IconXMark class="size-4" />
          </button>
        )}
      </div>
      {shown.length > 0
        ? (
          <div
            ref={gridRef}
            class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1"
          >
            {allowNone && !searching && option(
              NONE,
              text.none,
              <span class="block h-0.5 w-5 -rotate-45 rounded-full bg-current" />,
            )}
            {shown.map(({ icon, label }) => {
              const { Icon } = ICONS[icon]
              return option(icon, label, <Icon class="size-5" />)
            })}
          </div>
        )
        : (
          <div class="flex flex-col items-start gap-2 py-3">
            <p class="text-sm text-muted">{text.empty(query.value.trim())}</p>
            <Button variant="ghost" size="sm" onClick={clear}>{text.clearSearch}</Button>
          </div>
        )}
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {searched.value
          ? shown.length > 0 ? text.count(shown.length) : text.empty(query.value.trim())
          : ""}
      </p>
      {errorId !== undefined && (
        <p id={errorId} class="mt-2 text-sm text-danger" aria-live="polite">{error}</p>
      )}
      {hintId !== undefined && <p id={hintId} class="mt-2 text-sm text-muted">{hint}</p>}
    </fieldset>
  )
}
