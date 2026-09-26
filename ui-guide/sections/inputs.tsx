/**
 * The `ui/` controls that are not plain form fields: the two switches, the dropdown, the searchable
 * select, the labelled switch row, the file picker, and the date range picker, day-only and
 * `withTime`.
 *
 * A card shows the markup the server render produces. The three decisions a card's status line
 * turns on are exported from this module as pure functions and asserted in
 * `sections/demo-decisions.test.ts`: {@link comboboxStatusLabel}, {@link dateRangeTouched} and
 * {@link dateTimeRangeTouched}. Everything after the first keystroke, hover or click is proven in a
 * browser, by `pages/checks/ui.ts`.
 */

import {
  Button,
  Cluster,
  Combobox,
  type ComboboxOptionState,
  type DateRange,
  DateRangePicker,
  type DateRangePickerLabels,
  type DateRangePreset,
  type DateRangePresetOption,
  type DateTimeRange,
  Dropdown,
  DropdownItem,
  Field,
  FileInput,
  Grid,
  isValidDateRange,
  isValidDateTimeRange,
  OnOffButtons,
  rangeForPreset,
  Stack,
  ToggleField,
  ToggleSwitch,
} from "@spy4x/preact-ui"
import type { ComponentChildren } from "preact"
import { useSignal } from "@preact/signals"
import {
  IconChevronDown,
  IconCog6Tooth,
  IconEllipsisVertical,
  IconTrashBin,
  IconUser,
} from "@spy4x/preact-icons"
import type { DemoFragment } from "../registry.ts"

/** The small caption over one variant inside a card that shows several. */
function Variant({ title, children }: { title: ComponentChildren; children: ComponentChildren }) {
  return (
    <Stack gap="sm">
      <h4 class="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</h4>
      {children}
    </Stack>
  )
}

/** A quiet line under a control: what the caller now holds, or a short note on the variant. */
function Note(
  { children, e2e }: { children: ComponentChildren; e2e?: string },
) {
  return <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e={e2e}>{children}</p>
}

/** Controlled: the switch renders `value` and reports the intended value through `onToggle`. */
function ToggleSwitchDemo() {
  const archived = useSignal(false)
  const notifications = useSignal(true)

  return (
    <Stack gap="sm">
      <Cluster gap="sm">
        <ToggleSwitch
          value={archived.value}
          onToggle={(next) => archived.value = next}
          label="Show archived"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          archived: {archived.value ? "on" : "off"}
        </span>
      </Cluster>
      <Cluster gap="sm">
        <ToggleSwitch
          value={notifications.value}
          onToggle={(next) => notifications.value = next}
          label="Notifications"
        />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          notifications: {notifications.value ? "on" : "off"}
        </span>
      </Cluster>
      <Cluster gap="sm">
        <ToggleSwitch value={false} onToggle={() => {}} disabled label="Disabled" />
        <span class="text-sm text-gray-500 dark:text-gray-400">disabled</span>
      </Cluster>
    </Stack>
  )
}

/** `value === undefined` leaves both halves unselected, which is how an unfiltered list starts. */
function OnOffButtonsDemo() {
  const value = useSignal<boolean | undefined>(undefined)

  return (
    <Stack gap="md">
      <Cluster gap="sm">
        <OnOffButtons value={value.value} onSwitch={(on) => value.value = on} />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          value: {value.value === undefined ? "undefined" : String(value.value)}
        </span>
      </Cluster>
      <Cluster gap="sm">
        <OnOffButtons
          value={value.value}
          onSwitch={(on) => value.value = on}
          amount={{ on: 128, off: 14 }}
          onLabel="Active"
          offLabel="Archived"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">with counts and custom labels</span>
      </Cluster>
    </Stack>
  )
}

/**
 * One dropdown variant on a line: its caption on the left, its trigger on the right. The trigger
 * stays at the right because a menu lines up with its trigger's right edge by default and opens
 * leftward, so a trigger at the left of the card would push the menu over the page's navigation.
 */
function DropdownRow(
  { title, children }: { title: ComponentChildren; children: ComponentChildren },
) {
  return (
    <Cluster justify="between">
      <span class="text-sm text-gray-700 dark:text-gray-300">{title}</span>
      {children}
    </Cluster>
  )
}

/**
 * The four anchorings, every item a `DropdownItem`.
 *
 * The icon triggers pass `triggerLabel`, because they render no text a screen reader could read;
 * the text trigger passes `triggerNamedByContent` instead, so its own words stay its name. The
 * links point at `#inputs`, this section's own route: a menu item is either a real link or a real
 * button, never an anchor with a script URL in its `href`. `pages/checks/ui.ts` drives the first
 * dropdown on the card, so the icon trigger stays first.
 */
function DropdownDemo() {
  const selected = useSignal("Select action…")

  return (
    <Grid minColumnWidth="lg" gap="lg">
      <DropdownRow title="Icon trigger">
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
      </DropdownRow>

      <DropdownRow title="Text trigger">
        <Dropdown
          trigger={
            <span class="flex items-center gap-2 px-3 py-2 text-sm">
              {selected.value}
              <IconChevronDown class="size-4" />
            </span>
          }
          triggerNamedByContent
          triggerClasses="w-48 justify-between border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
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
      </DropdownRow>

      <DropdownRow title="Opens up">
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
      </DropdownRow>

      <DropdownRow title="Lines up on the left">
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
      </DropdownRow>
    </Grid>
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

/** The options that turn up a moment later, standing in for a list a slow network delivers. */
const lateCurrencies: readonly string[] = ["EUR", "GBP", "USD"]

/** How long those options take to arrive. Written on the card's button, and read back by checks. */
const arrivalDelay = 1200

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

/**
 * The panel's copy, spelled out in full for the first card only.
 *
 * Every key here is what the component would have defaulted to anyway, and writing them out is the
 * point of the first card: it documents what the object holds. The second card passes this object
 * nowhere — it hands over `placeholder` alone — so the two cards between them render both paths,
 * the caller supplying all six and the component supplying five of them.
 */
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
 * {@link dateRangeTouched}'s counterpart for a `withTime` range: delegates to `isValidDateTimeRange`,
 * the function the picker's own Apply button gates on in that mode, for the reason given on
 * {@link dateRangeTouched} itself.
 *
 * @param range Timed range to report on.
 * @returns A sentence describing it, or that it cannot be applied.
 */
export function dateTimeRangeTouched(range: DateTimeRange): string {
  return isValidDateTimeRange(range)
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

  return `${range.from} … ${range.to}`
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
    <Stack gap="sm">
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
      <Note e2e="controlled-value">{comboboxStatusLabel(coin.value, query.value)}</Note>
    </Stack>
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
    <Stack gap="sm">
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
      <Note e2e="controlled-value">
        {comboboxStatusLabel(city.value?.code ?? null, query.value)}
      </Note>
    </Stack>
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
    <Stack gap="sm">
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
      <Note e2e="controlled-value">
        controlled query: {query.value === "" ? "(empty)" : `"${query.value}"`} ·{" "}
        {comboboxStatusLabel(coin.value, "")}
      </Note>
    </Stack>
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
    <Stack gap="sm">
      <Combobox
        items={utcOffsets}
        value={offset.value}
        onChange={(next) => offset.value = next}
        id="guide-combobox-offset"
        ariaLabel="UTC offset"
        placeholder="Select an offset…"
      />
      <Note>{comboboxStatusLabel(offset.value, "")}</Note>
    </Stack>
  )
}

/**
 * An empty list, and the moment its options turn up.
 *
 * Untouched, this field says nothing at all — no message on screen, and an empty live region for a
 * screen reader to find nothing in. Open it, or type in it, and "no matches" arrives inside that
 * region as an answer.
 *
 * The button waits rather than loading on the spot: pressing anything outside a combobox closes
 * it, so a delay is what lets the options land while the popup is open and empty, which is what a
 * slow network does and what `pages/checks/ui.ts` drives. `data-delay` carries the wait so the
 * check waits the same amount rather than keeping its own copy of the number.
 */
function LoadingCombobox() {
  const currency = useSignal<string | null>(null)
  const options = useSignal<readonly string[]>(noItemsYet)

  const load = () => {
    options.value = noItemsYet
    setTimeout(() => options.value = lateCurrencies, arrivalDelay)
  }

  return (
    <Stack gap="sm">
      <Combobox
        items={options.value}
        value={currency.value}
        onChange={(next) => currency.value = next}
        id="guide-combobox-empty"
        ariaLabel="Currency, options still loading"
        placeholder="Select a currency…"
      />
      <Cluster gap="sm">
        <Button
          variant="outline"
          size="sm"
          data-e2e="combobox-load"
          data-delay={arrivalDelay}
          onClick={load}
        >
          Load options in {arrivalDelay / 1000} s
        </Button>
        <Note>
          {options.value.length === 0
            ? "no options yet"
            : `${options.value.length} options · ${comboboxStatusLabel(currency.value, "")}`}
        </Note>
      </Cluster>
    </Stack>
  )
}

/**
 * The live region, and what typing puts into it.
 *
 * Every other field on this card is driven by a check that opens it, so none of them is still
 * untouched by the time the region is worth looking at. This one exists to be read first and then
 * typed in, and `pages/checks/ui.ts` drives nothing else on it.
 *
 * Both strings are the caller's rather than the component's defaults, so a check that found the
 * English wording would be reading a hard-coded string somewhere instead of the prop it is about.
 * The count is visually hidden, so the only visible sign of it is the report below the field.
 */
function AnnouncingCombobox() {
  const coin = useSignal<string | null>(null)
  const query = useSignal("")

  return (
    <Stack gap="sm">
      <Combobox
        items={coins}
        value={coin.value}
        onChange={(next) => coin.value = next}
        onQueryChange={(next) => query.value = next}
        id="guide-combobox-announce"
        ariaLabel="Coin, with the count announced"
        placeholder="Type to narrow the list…"
        emptyMessage="No coin left"
        countMessage={(count) => count === 1 ? "1 coin left" : `${count} coins left`}
      />
      <Note e2e="controlled-value">{comboboxStatusLabel(coin.value, query.value)}</Note>
    </Stack>
  )
}

/**
 * Every combobox on the card: strings, objects, a controlled query, a long list, an empty one, and
 * one whose screen-reader count uses the caller's own words.
 */
function ComboboxDemo() {
  return (
    <Grid minColumnWidth="md" gap="lg">
      <Variant title="Strings">
        <CoinCombobox />
      </Variant>
      <Variant title="Objects, one disabled">
        <CityCombobox />
      </Variant>
      <Variant title="Your own search">
        <ServerSearchCombobox />
      </Variant>
      <Variant title="A long list">
        <UtcOffsetCombobox />
      </Variant>
      <Variant title="Options still loading">
        <LoadingCombobox />
      </Variant>
      <Variant title="A spoken count in your words">
        <AnnouncingCombobox />
      </Variant>
    </Grid>
  )
}

/**
 * Six labelled switch rows: plain, described and required, and the read-only, disabled and failing
 * shapes. The card's report is the caller's own state after `onToggle`, which is the whole
 * contract.
 */
function ToggleFieldDemo() {
  const archived = useSignal(false)
  const adminOnly = useSignal(true)
  const notifications = useSignal(true)

  return (
    <Stack gap="lg">
      <Grid minColumnWidth="md" gap="lg">
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
          description="The caller ignores the change, so the switch stays off."
        />
        <ToggleField
          id="guide-toggle-locked"
          label="Locked setting"
          value={false}
          onToggle={() => {}}
          description="Disabled: the label dims with the switch."
          disabled
        />
        <ToggleField
          id="guide-toggle-error"
          label="Two-factor authentication"
          value={false}
          onToggle={() => {}}
          error="Your role cannot change this setting."
        />
      </Grid>
      <Note e2e="controlled-value">
        archived: {archived.value ? "on" : "off"} · admin only: {adminOnly.value ? "on" : "off"}
        {" "}
        · notifications: {notifications.value ? "on" : "off"}
      </Note>
    </Stack>
  )
}

/**
 * `FileInput` in five shapes: image-only and size-limited, disabled, nested inside a `Field`, capped
 * at one file, and posting through a plain `<form>`.
 *
 * What a caller reads — `onFiles` and `onReject` — is echoed under the first and fourth pickers.
 * Inside a `Field`, the label and hint go to `Field`, and `FileInput` renders none of its own.
 *
 * The single-file picker has no `multiple`, so a second file is refused with reason `"too-many"`;
 * it also accepts PNG only, which `pages/checks/ui.ts` uses to prove a wrong-type refusal leaves a
 * file already chosen in place. The last picker's `<form>` has no `onSubmit`: it is the plain
 * multipart post, which the checks prove against the `form-demo/` static page.
 *
 * The unmount button (`data-e2e="file-input-toggle-mount"`) is scaffolding, not a `FileInput` prop:
 * the catalogue never unmounts a card on its own, so proving preview URLs are revoked on unmount
 * needs a real Preact unmount, and this button gives the check one without leaving the page.
 */
function FileInputDemo() {
  const chosen = useSignal<string[]>([])
  const refused = useSignal<string[]>([])
  const mounted = useSignal(true)
  const singleRefused = useSignal<string[]>([])

  return (
    <Stack gap="lg">
      <Grid minColumnWidth="md" gap="lg">
        <Variant title="Images only, up to 2 MB">
          {mounted.value && (
            <FileInput
              id="guide-file-input"
              label="Attachments"
              hint="PNG or JPEG, up to 2 MB each"
              accept="image/png,image/jpeg"
              maxSize={2 * 1024 * 1024}
              multiple
              onFiles={(files) => chosen.value = files.map((f) => f.name)}
              onReject={(reasons) =>
                refused.value = reasons.map((r) => `${r.file.name} (${r.reason})`)}
            />
          )}
          <Note e2e="file-input-chosen">
            chosen: {chosen.value.length === 0 ? "none" : chosen.value.join(", ")}
          </Note>
          <Note e2e="file-input-refused">
            refused: {refused.value.length === 0 ? "none" : refused.value.join(", ")}
          </Note>
          <Cluster>
            <Button
              variant="outline"
              size="sm"
              data-e2e="file-input-toggle-mount"
              onClick={() => mounted.value = !mounted.value}
            >
              {mounted.value ? "Unmount" : "Remount"} this picker
            </Button>
          </Cluster>
        </Variant>
        <Variant title="One file, PNG only">
          <FileInput
            id="guide-file-input-single"
            label="Attachment"
            accept="image/png"
            labels={{ tooMany: (name) => `${name}: un seul fichier est autorisé` }}
            onReject={(reasons) =>
              singleRefused.value = reasons.map((r) => `${r.file.name} (${r.reason})`)}
          />
          <Note e2e="file-input-single-refused">
            refused: {singleRefused.value.length === 0 ? "none" : singleRefused.value.join(", ")}
          </Note>
        </Variant>
        <Variant
          title={
            <>
              Inside a <code>Field</code>
            </>
          }
        >
          <Field
            id="guide-file-input-field"
            label="Attachments"
            hint="Up to 2 MB each"
          >
            <FileInput id="guide-file-input-field" />
          </Field>
        </Variant>
        <Variant title="Disabled">
          <FileInput id="guide-file-input-disabled" label="Attachments" disabled />
        </Variant>
      </Grid>
      <Variant title="A plain form post">
        <form action="form-demo/" method="post" encType="multipart/form-data">
          <Stack gap="sm">
            <FileInput id="guide-file-input-form" name="attachment" label="Attachment" />
            <Cluster>
              <Button type="submit" variant="outline">Send</Button>
            </Cluster>
          </Stack>
        </form>
      </Variant>
    </Stack>
  )
}

/**
 * The picker with a real range and a highlighted preset, every label spelled out.
 *
 * The three pickers' wrappers use `space-y-3` rather than `Stack`. Only the `withTime` picker's
 * check in `pages/checks/ui.ts` needs the class: it finds that picker's status line through
 * `closest("div.space-y-3")`. The other two keep it so the three columns are spaced alike.
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
      <Note e2e="controlled-value">
        range:{" "}
        <span class="whitespace-nowrap">
          {range.value === null ? "none" : dateRangeTouched(range.value)}
        </span>
      </Note>
    </div>
  )
}

/**
 * The picker with nothing chosen and only `placeholder` passed, so every other label in its panel
 * is the component's English default; the card above passes all six, so the two render both paths.
 */
function DateRangePickerEmptyDemo() {
  const range = useSignal<DateRange | null>(null)

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
        labels={{ placeholder: "All time" }}
        dataE2E="guide-date-range-empty"
      />
      <Note e2e="controlled-value">
        range:{" "}
        <span class="whitespace-nowrap">
          {range.value === null ? "none" : dateRangeTouched(range.value)}
        </span>
      </Note>
    </div>
  )
}

/**
 * The picker with `withTime` on: From and To are `datetime-local` fields, and the panel also offers
 * the two presets that only make sense with a time of day, `"last-hour"` and `"last-24-hours"`.
 * `now` is injected, so the two sub-day presets resolve to the same numbers at every build.
 */
function DateRangePickerWithTimeDemo() {
  const range = useSignal<DateTimeRange | null>(null)

  return (
    <div class="space-y-3">
      <DateRangePicker
        withTime
        range={range.value}
        onChange={(next) => range.value = next}
        timeZone={fixedZone}
        now={fixedNow}
        dataE2E="guide-date-range-time"
      />
      <Note e2e="controlled-value">
        range:{" "}
        <span class="whitespace-nowrap">
          {range.value === null ? "none" : dateTimeRangeTouched(range.value)}
        </span>
      </Note>
    </div>
  )
}

/** The three pickers side by side: a chosen range, nothing chosen, and `withTime`. */
function DateRangePickersDemo() {
  return (
    <Stack gap="lg">
      <Grid minColumnWidth="sm" gap="lg">
        <Variant title="Presets">
          <DateRangePickerDemo />
        </Variant>
        <Variant title="Nothing chosen">
          <DateRangePickerEmptyDemo />
        </Variant>
        <Variant
          title={
            <>
              <code>withTime</code>
            </>
          }
        >
          <DateRangePickerWithTimeDemo />
        </Variant>
      </Grid>
      <Stack gap="xs">
        <Note>
          The first picker's presets, resolved against a fixed{" "}
          <code class="whitespace-nowrap">now</code> so every build prints the same dates:
        </Note>
        <ul class="text-xs text-gray-500 dark:text-gray-400">
          {datePresetOptions.map((option) => (
            <li key={option.preset}>
              {option.label}: <span class="whitespace-nowrap">{presetNote(option.preset)}</span>
            </li>
          ))}
        </ul>
      </Stack>
    </Stack>
  )
}

export const inputDemos = {
  ToggleSwitch: {
    summary:
      "An on/off switch for one setting that applies at once, such as showing archived rows.",
    wide: false,
    props: [
      { name: "value", type: "boolean", description: "Whether the switch is on." },
      {
        name: "onToggle",
        type: "(value: boolean) => void",
        description: "Called with the value a press asks for; the caller stores it.",
      },
      { name: "label", type: "string", description: "The switch's accessible name." },
      { name: "disabled", type: "boolean", default: "false", description: "Greys it out." },
    ],
    snippet: `<ToggleSwitch
  value={archived.value}
  onToggle={(next) => archived.value = next}
  label="Show archived"
/>`,
    render: () => <ToggleSwitchDemo />,
  },
  OnOffButtons: {
    summary:
      "A two-button ON/OFF filter that can also start with neither half chosen, with optional counts.",
    wide: false,
    props: [
      {
        name: "value",
        type: "boolean | undefined",
        description: "The chosen half; `undefined` chooses neither.",
      },
      {
        name: "onSwitch",
        type: "(on: boolean) => void",
        description: "Called with the half that was pressed.",
      },
      {
        name: "amount",
        type: "{ on: number; off: number }",
        description: "A count shown under each half.",
      },
      {
        name: "onLabel / offLabel",
        type: "string",
        default: `"ON" / "OFF"`,
        description: "The halves' text.",
      },
    ],
    snippet: `<OnOffButtons
  value={showActive.value}
  amount={{ on: 128, off: 14 }}
  onSwitch={(on) => showActive.value = on}
/>`,
    render: () => <OnOffButtonsDemo />,
  },
  ToggleField: {
    summary:
      "A settings row: a label and a `ToggleSwitch` on one line, with a description or an error under them.",
    wide: true,
    props: [
      {
        name: "id",
        type: "string",
        description: "The switch's id; the messages' ids derive from it.",
      },
      { name: "label", type: "ComponentChildren", description: "The row's visible name." },
      { name: "value", type: "boolean", description: "Whether the switch is on." },
      {
        name: "onToggle",
        type: "(value: boolean) => void",
        description: "Called with the value a press asks for.",
      },
      { name: "description", type: "ComponentChildren", description: "A hint under the row." },
      { name: "error", type: "string | null", description: "An error under the row, announced." },
    ],
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
  Dropdown: {
    summary:
      "A button that opens a menu of actions, which the arrow keys, Home, End and Escape work through.",
    wide: true,
    props: [
      { name: "trigger", type: "ComponentChildren", description: "What the button shows." },
      {
        name: "triggerLabel",
        type: "string",
        description: "Names a trigger that shows only an icon.",
      },
      { name: "menuLabel", type: "string", description: "The menu's accessible name." },
      {
        name: "vertical / horizontal",
        type: `"up" | "down" / "left" | "right"`,
        default: `"down" / "right"`,
        description: "Which way the menu opens and which edge it lines up with.",
      },
    ],
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
      "One entry of a `Dropdown` menu: a link when it has an `href`, a button when it does not.",
    wide: true,
    props: [
      { name: "href", type: "string", description: "Makes the item a link to this address." },
      { name: "onClick", type: "() => void", description: "What a button item does." },
      {
        name: "disabled",
        type: "boolean",
        default: "false",
        description: "Greys it out; the arrow keys skip it.",
      },
      { name: "class", type: "string", description: "Extra classes, such as a red text colour." },
    ],
    snippet: `<DropdownItem href="/regions/1/edit">Edit</DropdownItem>
<DropdownItem class="text-red-600" onClick={archive}>Archive</DropdownItem>
<DropdownItem disabled onClick={archive}>Archive</DropdownItem>`,
    render: () => (
      <div class="w-56" role="menu" aria-orientation="vertical" aria-label="Item shapes">
        <DropdownItem href="#inputs">A link, because it has an href</DropdownItem>
        <DropdownItem onClick={() => {}}>A button, because it has none</DropdownItem>
        <DropdownItem class="text-red-600 dark:text-red-400" onClick={() => {}}>
          Destructive, through its class
        </DropdownItem>
        <DropdownItem disabled onClick={() => {}}>Disabled</DropdownItem>
      </div>
    ),
  },
  Combobox: {
    summary:
      "A text field that filters a list as you type and picks one item from it, by keyboard or pointer.",
    wide: true,
    props: [
      { name: "items", type: "readonly T[]", description: "Everything that can be picked." },
      { name: "value", type: "T | null", description: "The picked item." },
      {
        name: "onChange",
        type: "(value: T | null) => void",
        description: "Called with the new pick, or `null` when cleared.",
      },
      {
        name: "getLabel",
        type: "(item: T) => string",
        default: "String",
        description: "The text shown and searched for an item; pass it for objects.",
      },
      {
        name: "filter",
        type: "(items, query) => T[]",
        default: "folded substring match",
        description: "Replaces the built-in search.",
      },
      {
        name: "query / onQueryChange",
        type: "string / (query: string) => void",
        description: "Hands the typed text to the caller, as a server-side search needs.",
      },
      {
        name: "emptyMessage",
        type: "string | ((query: string) => ComponentChildren)",
        default: `"No matches"`,
        description: "What the list says when nothing matches.",
      },
    ],
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
      "A filter-bar control that picks a date range from presets such as Last 7 days, or from two date fields.",
    wide: true,
    props: [
      {
        name: "range / onChange",
        type: "DateRange | null / (range) => void",
        description: "The chosen range, held by the caller.",
      },
      {
        name: "timeZone",
        type: "string",
        description: "The zone presets resolve in, because the server's is not the visitor's.",
      },
      {
        name: "presets",
        type: "DateRangePresetOption[]",
        description: "The preset buttons, in order; a `custom` entry opens the date fields.",
      },
      {
        name: "now",
        type: "Date",
        default: "the clock, read on a press",
        description: "The instant presets resolve against.",
      },
      {
        name: "withTime",
        type: "boolean",
        default: "false",
        description: "Date and time fields, a timed range, and last-hour presets.",
      },
      {
        name: "labels",
        type: "DateRangePickerLabels",
        default: "English",
        description: "Every word in the panel, one key at a time.",
      },
    ],
    snippet: `<DateRangePicker
  range={range.value}
  onChange={(next) => range.value = next}
  timeZone="Europe/Paris"
  presets={[
    { preset: "last-7-days", label: "Last 7 days" },
    { preset: "custom", label: "Custom…" },
  ]}
  selectedPreset="last-7-days"
/>

// Every label is English by default; override only the ones you need to.
<DateRangePicker {...props} labels={{ placeholder: "All time" }} />

// withTime: datetime-local fields, a DateTimeRange, and two sub-day presets — no presets prop.
<DateRangePicker
  withTime
  range={timedRange.value}
  onChange={(next) => timedRange.value = next}
  timeZone="Europe/Paris"
/>`,
    render: () => <DateRangePickersDemo />,
  },
  FileInput: {
    summary:
      "A file picker with a drop zone that previews images and refuses the wrong type or size, without uploading anything.",
    wide: true,
    props: [
      { name: "id", type: "string", description: "The native input's id." },
      {
        name: "accept / maxSize",
        type: "string / number",
        description: "What it keeps: file types, and the largest size in bytes.",
      },
      { name: "multiple", type: "boolean", default: "false", description: "Allows several files." },
      { name: "onFiles", type: "(files: File[]) => void", description: "The files it kept." },
      {
        name: "onReject",
        type: "(reasons: FileRejection[]) => void",
        description: "The files it refused, each with its reason.",
      },
      {
        name: "previews",
        type: "boolean",
        default: "true",
        description: "Shows a thumbnail beside each image.",
      },
    ],
    snippet: `<FileInput
  id="attachments"
  label="Attachments"
  hint="PNG or JPEG, up to 2 MB each"
  accept="image/png,image/jpeg"
  maxSize={2 * 1024 * 1024}
  multiple
  onFiles={(files) => chosen.value = files}
  onReject={(reasons) => refused.value = reasons}
/>`,
    render: () => <FileInputDemo />,
  },
} satisfies DemoFragment
