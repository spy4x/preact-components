/**
 * The `ui/` controls that are not plain form fields: the two switches, the dropdown, the searchable
 * select, the labelled switch row, and the preset-plus-custom date range.
 *
 * Each of these is a small state machine whose keyboard and pointer halves only run in a browser.
 * This repository has no DOM harness, so a card shows the closed-state markup the server render
 * produces, and the two decisions the demonstrably interactive halves turn on are exported from
 * this module as pure functions and asserted in `sections/demo-decisions.test.ts`:
 * {@link comboboxStatusLabel} and {@link dateRangeTouched}. Everything after the first keystroke,
 * hover or click remains browser-only and is described as such on the card.
 */

import {
  Combobox,
  type ComboboxOptionState,
  type DateRange,
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePreset,
  type DateRangePresetOption,
  Dropdown,
  DropdownItem,
  isValidDateRange,
  OnOffButtons,
  rangeForPreset,
  ToggleField,
  ToggleSwitch,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import {
  IconChevronDown,
  IconCog6Tooth,
  IconEllipsisVertical,
  IconTrashBin,
  IconUser,
} from "@preact-components/icons"
import type { DemoFragment } from "../registry.ts"

/** Controlled: the switch renders `value` and reports the intended value through `onToggle`. */
function ToggleSwitchDemo() {
  const archived = useSignal(false)
  const notifications = useSignal(true)

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <ToggleSwitch
          value={archived.value}
          onToggle={(next) => archived.value = next}
          label="Show archived"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          archived: {archived.value ? "on" : "off"}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch
          value={notifications.value}
          onToggle={(next) => notifications.value = next}
          label="Notifications"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          notifications: {notifications.value ? "on" : "off"}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch value={false} onToggle={() => {}} disabled label="Disabled" />
        <span class="text-sm text-gray-500 dark:text-gray-400">disabled</span>
      </div>
    </div>
  )
}

/** `value === undefined` leaves both halves unselected, which is how an unfiltered list starts. */
function OnOffButtonsDemo() {
  const value = useSignal<boolean | undefined>(undefined)

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <OnOffButtons value={value.value} onSwitch={(on) => value.value = on} />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          value: {value.value === undefined ? "undefined" : String(value.value)}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <OnOffButtons
          value={value.value}
          onSwitch={(on) => value.value = on}
          amount={{ on: 128, off: 14 }}
          onLabel="Active"
          offLabel="Archived"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">with counts and custom labels</span>
      </div>
    </div>
  )
}

/**
 * The four anchorings, every item a `DropdownItem`.
 *
 * The icon triggers pass `triggerLabel`, because they render no text a screen reader could read;
 * the text trigger passes `triggerNamedByContent` instead, so its own words stay its name. The
 * links point at `#inputs`, this section's own route: a menu item is either a real link or a real
 * button, never an anchor with a script URL in its `href`.
 */
function DropdownDemo() {
  const selected = useSignal("Select action…")

  return (
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Default icon trigger</h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown
            trigger={<IconEllipsisVertical class="size-5" />}
            triggerLabel="Row actions"
            menuLabel="Row actions"
          >
            <div class="py-1" role="none">
              <DropdownItem href="#inputs">
                <IconUser class="size-4" />
                View profile
              </DropdownItem>
              <DropdownItem href="#inputs">
                <IconCog6Tooth class="size-4" />
                Settings
              </DropdownItem>
              <DropdownItem class="text-red-600 dark:text-red-400" onClick={() => {}}>
                <IconTrashBin class="size-4" />
                Delete
              </DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Custom trigger</h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown
            trigger={
              <span class="flex items-center gap-2 px-3 py-2 text-sm">
                {selected.value}
                <IconChevronDown class="size-4" />
              </span>
            }
            triggerNamedByContent
            triggerClasses="w-56 justify-between border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            panelClasses="min-w-[200px]"
            menuLabel="Bulk actions"
          >
            <div class="py-1" role="none">
              {["Create new item", "Import data", "Export data", "Archive items"].map((action) => (
                <DropdownItem key={action} onClick={() => selected.value = action}>
                  {action}
                </DropdownItem>
              ))}
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
          `vertical="up"` — last table rows
        </h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown
            trigger={<IconEllipsisVertical class="size-5" />}
            triggerLabel="Last row actions"
            menuLabel="Last row actions"
            vertical="up"
          >
            <div class="py-1" role="none">
              <DropdownItem href="#inputs">Edit item</DropdownItem>
              <DropdownItem onClick={() => {}}>Duplicate</DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
          `horizontal="left"`
        </h4>
        <div class="flex justify-center rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Dropdown
            trigger={<IconEllipsisVertical class="size-5" />}
            triggerLabel="Left-anchored actions"
            menuLabel="Left-anchored actions"
            horizontal="left"
          >
            <div class="py-1" role="none">
              <DropdownItem onClick={() => {}}>Left action</DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>
    </div>
  )
}

/** One selectable city, so the object-valued combobox has a label that is not `String(item)`. */
interface City {
  code: string
  name: string
  country: string
  retired?: boolean
}

const cities: readonly City[] = [
  { code: "PAR", name: "Paris", country: "France" },
  { code: "TYO", name: "Tokyo", country: "Japan" },
  { code: "SAO", name: "São Paulo", country: "Brazil" },
  { code: "NYC", name: "New York", country: "United States" },
  { code: "BER", name: "Berlin", country: "Germany" },
  { code: "LIS", name: "Lisbon", country: "Portugal", retired: true },
]

const coins = ["BTC", "ETH", "USD", "EUR", "SOL"] as const

/**
 * Every whole-hour UTC offset, `UTC-12:00` through `UTC+14:00`.
 *
 * Twenty-seven rows against a popup that shows about six, which is the whole point of it: this is
 * the card's one list long enough for the keyboard highlight to walk off the bottom edge.
 */
const utcOffsets: readonly string[] = Array.from({ length: 27 }, (_, index) => {
  const hours = index - 12

  return `UTC${hours < 0 ? "-" : "+"}${String(Math.abs(hours)).padStart(2, "0")}:00`
})

/** The list a page holds while its options are still on their way: none yet. */
const noItemsYet: readonly string[] = []

const cityLabel = (city: City) => `${city.name} — ${city.country}`

/**
 * A card's own one-line report of what the combobox is showing.
 *
 * `Combobox` takes the query as a prop and reports selection through a port, so "did the change
 * land?" is a question about the values the caller now holds — which is decidable without a DOM,
 * and therefore worth asserting rather than describing. The query is trimmed only for the report:
 * the component matches on the raw string and folds it itself.
 *
 * @param selection Identity of the item the caller's `value` now holds, or `null` when cleared.
 * @param query Query the caller's `onQueryChange` received.
 * @returns A sentence naming both, e.g. `selected PAR · query "sao"`.
 */
export function comboboxStatusLabel(selection: string | null, query: string): string {
  const chosen = selection === null ? "nothing selected" : `selected ${selection}`

  return query.trim() === "" ? chosen : `${chosen} · query "${query.trim()}"`
}

/**
 * A seed range, and the instant every preset in this card resolves against.
 *
 * The instant is injected rather than read from the clock, which is what makes the card's preset
 * note reproducible: the page is prerendered at build time in whatever zone the builder runs in, so
 * a build-time `new Date()` would print a different range every day. Reading the clock at click
 * time is still the component's own default, and is documented on the card.
 */
const fixedNow = new Date("2026-02-15T12:00:00Z")
const fixedZone = "Europe/Paris"
const fixedToday: DateRange = { from: "2026-02-09", to: "2026-02-15" }

/** Every string the panel renders. The library ships no copy, so the caller writes all six. */
const dateLabels: DateRangePickerLabels = {
  menuLabel: "Date range",
  placeholder: "Any dates",
  from: "From",
  to: "To",
  apply: "Apply",
  cancel: "Cancel",
}

/** The preset list in render order, with `custom` last — which is what shows the from/to fields. */
const datePresetOptions: readonly DateRangePresetOption[] = [
  { preset: "last-7-days", label: "Last 7 days" },
  { preset: "this-month", label: "This month" },
  { preset: "this-year", label: "This year" },
  { preset: "custom", label: "Custom…" },
]

/**
 * What a card's status line says about a range the caller holds or would commit.
 *
 * The verdict is `isValidDateRange`, the very function the panel gates its Apply button on, so a
 * range this reports as incomplete is one the picker would refuse — the claim on the card is the
 * component's rule rather than a second one shaped like it. An earlier revision compared the two
 * strings directly, which is the same answer for well-formed input and a different one for anything
 * else: a raw `<=` accepts `"2026-2-15"` and `"nonsense"` alike, where `parseIsoDate` rejects both.
 *
 * Reported in the card rather than shown as a `disabled` button, because the button lives inside a
 * panel the server render emits closed.
 *
 * @param range Range to report on.
 * @returns A sentence describing it, or that it cannot be applied.
 */
export function dateRangeTouched(range: DateRange): string {
  return isValidDateRange(range)
    ? `${range.from} → ${range.to}`
    : "incomplete — Apply stays disabled"
}

/**
 * The note for one preset option, computed rather than typed out.
 *
 * The picker's trigger shows the range it was handed and its panel highlights `selectedPreset`, so a
 * hardcoded range in the card could disagree with both. Asking `rangeForPreset` for the numbers the
 * button would produce keeps the note honest, and a broken preset fails in the browser rather than
 * hiding behind copy.
 *
 * `custom` carries no maths of its own — it validates and returns the range it is given — so it is
 * asked with the card's seed range. That is also why the option is labelled as a draft: a press on
 * it opens the fields rather than committing anything.
 */
function presetNote(preset: DateRangePreset): string {
  const range = preset === "custom"
    ? rangeForPreset("custom", { now: fixedNow, timeZone: fixedZone, custom: fixedToday })
    : rangeForPreset(preset, { now: fixedNow, timeZone: fixedZone })

  return `${preset} → ${range.from} … ${range.to}`
}

/**
 * The string combobox, plus the selection reported back.
 *
 * An empty query keeps every item and a query matching nothing renders `emptyMessage` — the function
 * form here, which is how the card says which query it was. `matchesQuery` folds case and
 * diacritics, so `"sao"` finds `"São Paulo"`; that rule is unit-tested in `ui/combobox.test.tsx`,
 * and this card drives it with a real list.
 */
function CoinCombobox() {
  const coin = useSignal<string | null>("BTC")
  const query = useSignal("")

  return (
    <div class="space-y-2">
      <Combobox
        items={coins}
        value={coin.value}
        onChange={(next) => coin.value = next}
        onQueryChange={(next) => query.value = next}
        id="guide-combobox-coin"
        ariaLabel="Coin"
        placeholder="Select a coin…"
        emptyMessage={(text) => `No coin matches “${text}”`}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {comboboxStatusLabel(coin.value, query.value)}
      </p>
    </div>
  )
}

/**
 * The object combobox: `getLabel`, a disabled item, custom option markup and a code-only report.
 *
 * An object list is where the defaults stop being right — `String(item)` would render
 * `[object Object]` — so `getLabel` is the prop that makes `T` usable at all. Lisbon is
 * `isItemDisabled`, which renders `aria-disabled` and makes a press on it a no-op.
 */
function CityCombobox() {
  const city = useSignal<City | null>(null)
  const query = useSignal("")

  const renderOption = (item: City, state: ComboboxOptionState) => (
    <span class="flex w-full items-center justify-between gap-2">
      <span>{cityLabel(item)}</span>
      <span class="font-mono text-xs text-gray-400 dark:text-gray-500">
        {item.code}
        {state.selected ? " ✓" : ""}
      </span>
    </span>
  )

  return (
    <div class="space-y-2">
      <Combobox
        items={cities}
        value={city.value}
        onChange={(next) => city.value = next}
        onQueryChange={(next) => query.value = next}
        getLabel={cityLabel}
        isItemDisabled={(item) => item.retired === true}
        renderOption={renderOption}
        id="guide-combobox-city"
        ariaLabel="City"
        placeholder="Search a city…"
        clearLabel="Clear the city"
        listboxClass="max-h-48"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {comboboxStatusLabel(city.value?.code ?? null, query.value)}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        `renderOption` replaces the option's content, not its{" "}
        {`<li>`}: the `role="option"`, `aria-selected` and the highlight stay the component's.
      </p>
    </div>
  )
}

/**
 * The controlled-query variant, which is the shape a server-side search needs.
 *
 * With `query` in a prop, the draft belongs to the caller: `filter` becomes the caller's own
 * function and the text it filters by is the text the caller holds, so the component keeps no state
 * the caller cannot see.
 */
function ServerSearchCombobox() {
  const query = useSignal("")
  const coin = useSignal<string | null>(null)

  return (
    <div class="space-y-2">
      <Combobox
        items={coins}
        value={coin.value}
        onChange={(next) => coin.value = next}
        query={query.value}
        onQueryChange={(next) => query.value = next}
        filter={(items, text) => items.filter((item) => item.startsWith(text.toUpperCase()))}
        id="guide-combobox-server"
        ariaLabel="Coin, prefix search"
        placeholder="Type a ticker prefix…"
        emptyMessage="No ticker starts with that"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        controlled query: {query.value === "" ? "(empty)" : `"${query.value}"`} ·{" "}
        {comboboxStatusLabel(coin.value, "")}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        `filter` replaces the built-in substring match: this one is a prefix match, the kind a
        server-side search would write.
      </p>
    </div>
  )
}

/**
 * A list far longer than the popup, which is where the keyboard highlight can get lost.
 *
 * The popup is a `max-h-60` scroller — about six rows — and this list is 27 of them, so arrowing
 * down walks the highlight past the bottom edge. The component scrolls the list to follow it;
 * `pages/checks/ui.ts` drives that with real arrow presses, because no rendered string can show a
 * scroll position.
 */
function UtcOffsetCombobox() {
  const offset = useSignal<string | null>(null)

  return (
    <div class="space-y-2">
      <Combobox
        items={utcOffsets}
        value={offset.value}
        onChange={(next) => offset.value = next}
        id="guide-combobox-offset"
        ariaLabel="UTC offset"
        placeholder="Select an offset…"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        {comboboxStatusLabel(offset.value, "")}
      </p>
    </div>
  )
}

/**
 * An empty list: what a page renders while its options are still on their way.
 *
 * Untouched, this field says nothing at all — no message on screen, and nothing in a live region
 * for a screen reader to read out. "No matches" is an answer, and nobody has asked it anything
 * yet. Open it, or type in it, and the message appears as the answer it is.
 */
function LoadingCombobox() {
  const currency = useSignal<string | null>(null)

  return (
    <div class="space-y-2">
      <Combobox
        items={noItemsYet}
        value={currency.value}
        onChange={(next) => currency.value = next}
        id="guide-combobox-empty"
        ariaLabel="Currency, options still loading"
        placeholder="Select a currency…"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        An empty `items` list. Closed and untouched it renders no message and no live region; open
        it and the empty message answers the question that opening it asked.
      </p>
    </div>
  )
}

/** Every combobox on the card: strings, objects, a controlled query, a long list and an empty one. */
function ComboboxDemo() {
  return (
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">String items</h4>
        <CoinCombobox />
      </div>
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Object items</h4>
        <CityCombobox />
      </div>
      <div class="space-y-2 sm:col-span-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Controlled query</h4>
        <ServerSearchCombobox />
      </div>
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">
          Longer than the popup
        </h4>
        <UtcOffsetCombobox />
      </div>
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">Nothing to offer yet</h4>
        <LoadingCombobox />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">
        The popup is in the markup at all times and marked `hidden` while closed, so what is
        rendered here is the closed state: `role="combobox"` with `aria-expanded="false"`,
        `aria-controls` pointing at the `role="listbox"`, and every option already present. Opening
        it, the `aria-activedescendant` highlight and the key map are browser-only — the key map's
        decision table is exported from the component and unit-tested there.
      </p>
    </div>
  )
}

/**
 * Five labelled switch rows: plain, described and required, and the three failure-ish shapes.
 *
 * The card's report is the caller's own state after `onToggle`, which is the entire contract. The
 * binding is the part that differs from every other row in the catalogue: a switch is a `<button>`,
 * `<button>` is not a labelable element, so there is no `for` — `aria-labelledby` names the switch
 * and the label's own click handler performs the activation the browser will not.
 */
function ToggleFieldDemo() {
  const archived = useSignal(false)
  const adminOnly = useSignal(true)
  const notifications = useSignal(true)

  return (
    <div class="space-y-5">
      <ToggleField
        id="guide-toggle-archived"
        label="Show archived"
        value={archived.value}
        onToggle={(next) => archived.value = next}
      />
      <ToggleField
        id="guide-toggle-admin"
        label="Administrators only"
        value={adminOnly.value}
        onToggle={(next) => adminOnly.value = next}
        description="Hides the row from everyone without the administrator role."
        required
      />
      <ToggleField
        id="guide-toggle-notifications"
        label="Notifications"
        value={notifications.value}
        onToggle={(next) => notifications.value = next}
        description="Send an email when a run fails."
      />
      <ToggleField
        id="guide-toggle-readonly"
        label="Read-only setting"
        value={false}
        onToggle={() => {}}
        description="This caller discards the value, which is what a read-only setting looks like: the row stays live in the markup."
      />
      <ToggleField
        id="guide-toggle-locked"
        label="Locked setting"
        value={false}
        onToggle={() => {}}
        description="The control itself is disabled, and the label is dimmed with it."
        disabled
      />
      <ToggleField
        id="guide-toggle-error"
        label="Two-factor authentication"
        value={false}
        onToggle={() => {}}
        error="Your role cannot change this setting."
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        archived: {archived.value ? "on" : "off"} · admin only: {adminOnly.value ? "on" : "off"}
        {" "}
        · notifications: {notifications.value ? "on" : "off"}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The last three rows are `aria-describedby` targets: `error` renders a polite live region and
        `description` a hint, both wired from the same required id — the `-error` and `-hint`
        suffixes, the ids `Field` would have used. Empty or whitespace-only text renders but is not
        referred to.
      </p>
    </div>
  )
}

/**
 * The picker with a real range and a highlighted preset.
 *
 * The panel uses `role="group"`, so it can hold the two date inputs that `Dropdown`'s `role="menu"`
 * could not. Opening it, the preset maths, the custom draft and the outside-click close all run in
 * the browser; the trigger's text is `from → to` of whatever the caller's `range` holds.
 */
function DateRangePickerDemo() {
  const range = useSignal<DateRange | null>(fixedToday)

  return (
    <div class="space-y-3">
      <DateRangePicker
        range={range.value}
        onChange={(next) => range.value = next}
        timeZone={fixedZone}
        now={fixedNow}
        presets={datePresetOptions}
        labels={dateLabels}
        selectedPreset="last-7-days"
        dataE2E="guide-date-range"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        range: {range.value === null ? "none" : dateRangeTouched(range.value)}
      </p>
      <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>
          Every preset resolves against an injected instant,{" "}
          <code>now={fixedNow.toISOString()}</code> in{" "}
          <code>{fixedZone}</code>, so the numbers below are the same on every build:
        </p>
        <ul class="list-disc pl-4">
          {datePresetOptions.map((option) => (
            <li key={option.preset}>
              {option.label}: {presetNote(option.preset)}
            </li>
          ))}
        </ul>
        <p>
          Without `now` the component reads the clock inside the click handler, never during render,
          so an app that wants "today" gets it and the first render stays deterministic.
        </p>
      </div>
    </div>
  )
}

/**
 * The picker with nothing chosen and a draft the caller would refuse.
 *
 * Nothing chosen is what a filter bar starts as: the trigger reads `placeholder` and the caller's
 * `range` is `null`. The reversed pair on the right is the validation case — the panel accepts it as
 * text and cannot commit it.
 */
function DateRangePickerEmptyDemo() {
  const range = useSignal<DateRange | null>(null)
  const rejected: DateRange = { from: "2026-03-31", to: "2026-03-01" }

  return (
    <div class="space-y-3">
      <DateRangePicker
        range={range.value}
        onChange={(next) => range.value = next}
        timeZone={fixedZone}
        now={fixedNow}
        presets={[
          { preset: "today", label: "Today" },
          { preset: "yesterday", label: "Yesterday" },
          { preset: "custom", label: "Custom…" },
        ]}
        labels={{ ...dateLabels, placeholder: "All time" }}
        dataE2E="guide-date-range-empty"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        range:{" "}
        {range.value === null
          ? "none — the trigger reads “All time”"
          : dateRangeTouched(range.value)}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        A draft the caller would refuse reads {dateRangeTouched(rejected)}{" "}
        — the same rule the Apply button follows, which is why the reversed pair cannot be
        committed.
      </p>
    </div>
  )
}

export const inputDemos = {
  ToggleSwitch: {
    summary:
      "Two-state switch, controlled. Renders `value`, reports the intended value through `onToggle`; persistence belongs to the caller.",
    snippet: `<ToggleSwitch
  value={archived.value}
  onToggle={(next) => archived.value = next}
  label="Show archived"
/>`,
    render: () => <ToggleSwitchDemo />,
  },
  OnOffButtons: {
    summary:
      "Segmented ON/OFF pair. `value` of `undefined` leaves both halves unselected; `amount` annotates them with counts.",
    snippet: `<OnOffButtons
  value={showActive.value}
  amount={{ on: 128, off: 14 }}
  onSwitch={(on) => showActive.value = on}
/>`,
    render: () => <OnOffButtonsDemo />,
  },
  Dropdown: {
    summary:
      "Trigger plus a real menu. Opening it moves focus to the first item; Arrow Down and Arrow Up walk the items with Home and End at the ends; Escape closes it and gives the trigger its focus back; and it closes as soon as focus leaves, which one Tab press does because the items are out of the tab order. Outside-click still dismisses it. The trigger's accessible name is required and comes in two shapes, because one `aria-label` cannot serve both: `triggerLabel` names an icon trigger, and `triggerNamedByContent` declares that a trigger's own visible text is its name so nothing is written over it. Open/closed is local state, so the panel is `hidden` in the server render, and every `document` access sits in an effect or a handler.",
    snippet: `<Dropdown
  trigger={<IconEllipsisVertical />}
  triggerLabel="Row actions"
  menuLabel="Row actions"
  vertical="up"
>
  <DropdownItem href={editHref}>Edit</DropdownItem>
  <DropdownItem onClick={archive}>Archive</DropdownItem>
</Dropdown>`,
    render: () => <DropdownDemo />,
  },
  DropdownItem: {
    summary:
      'One item of a `Dropdown`\'s menu: a link with `href` and a `<button>` without one. It exists because `role="menuitem"` cannot be applied from outside — `Dropdown` receives its children already rendered, and a menu whose children carry no role is, to a screen reader, a menu with nothing in it. The item is out of the tab order, because inside a menu the arrow keys move between items and Tab leaves altogether. A disabled item is skipped by those keys rather than landed on.',
    snippet: `<DropdownItem href="/regions/1/edit">Edit</DropdownItem>
<DropdownItem class="text-red-600" onClick={archive}>Archive</DropdownItem>
<DropdownItem disabled onClick={archive}>Archive</DropdownItem>`,
    render: () => (
      <div
        class="w-56 rounded-md border border-gray-200 py-1 dark:border-gray-700"
        role="menu"
        aria-orientation="vertical"
        aria-label="Item shapes"
      >
        <DropdownItem href="#inputs">A link, because it has one</DropdownItem>
        <DropdownItem onClick={() => {}}>A button, because it does not</DropdownItem>
        <DropdownItem class="text-red-600 dark:text-red-400" onClick={() => {}}>
          Destructive, through `class`
        </DropdownItem>
        <DropdownItem disabled onClick={() => {}}>Disabled</DropdownItem>
      </div>
    ),
  },
  ToggleField: {
    summary:
      "Labelled row for a `ToggleSwitch`: label and switch on one line, `description` and `error` under them. It deliberately does not render through `Field` — a switch is a `<button>`, which is not a labelable element, so there is no `for` to write: `aria-labelledby` names the switch and the label carries the click the browser will not perform. The two message ids are the ones `Field` uses, `${id}-error` and `${id}-hint`.",
    snippet: `<ToggleField
  id="show-archived"
  label="Show archived"
  value={archived.value}
  onToggle={(next) => archived.value = next}
  description="Hides the row from the list"
  required
/>`,
    render: () => <ToggleFieldDemo />,
  },
  Combobox: {
    summary:
      'Searchable single-select: the ARIA combobox pattern by hand, with `role="listbox"` options and focus never leaving the input — the highlight is announced through `aria-activedescendant`, moved by the keyboard alone and followed by the list, which scrolls to keep it on screen. Items may be any `T` once `getLabel` says what to render and match; `filter` replaces the built-in substring match, and a controlled `query` with `onQueryChange` is the server-side shape. Every string it shows defaults to English and takes an override: `placeholder`, `emptyMessage` and `clearLabel`. The empty message waits until the field is open or has a query in it, so a field nobody has touched — one whose options are still loading, say — never claims there are no matches.',
    snippet: `<Combobox
  items={cities}
  value={city.value}
  onChange={(next) => city.value = next}
  getLabel={(city) => \`\${city.name} — \${city.country}\`}
  isItemDisabled={(city) => city.retired === true}
  placeholder="Search a city…"
  emptyMessage={(query) => \`No city matches “\${query}”\`}
/>`,
    render: () => <ComboboxDemo />,
  },
  DateRangePicker: {
    summary:
      "Preset menu plus a custom from/to panel over `rangeForPreset`. The value is controlled, every string is a prop, and `timeZone` is required because the server's zone is not the visitor's. The clock is either injected through `now` or read inside a click handler, never during render, so the first render is deterministic. The panel is a `role=\"group\"` rather than a menu, because it contains form controls.",
    snippet: `<DateRangePicker
  range={range.value}
  onChange={(next) => range.value = next}
  timeZone="Europe/Paris"
  presets={[
    { preset: "last-7-days", label: "Last 7 days" },
    { preset: "custom", label: "Custom…" },
  ]}
  labels={{
    menuLabel: "Date range",
    placeholder: "Any dates",
    from: "From",
    to: "To",
    apply: "Apply",
    cancel: "Cancel",
  }}
  selectedPreset="last-7-days"
/>`,
    render: () => (
      <div class="space-y-6">
        <DateRangePickerDemo />
        <DateRangePickerEmptyDemo />
      </div>
    ),
  },
} satisfies DemoFragment
