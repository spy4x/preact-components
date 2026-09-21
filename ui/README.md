# `@preact-components/ui`

Preact + Tailwind primitives extracted from `gb`, `financy` and `offer-lens`.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton. App
  state arrives as props; side effects (clipboard, geolocation, toasts) arrive as callbacks.
- **Pure Tailwind.** No dependency on `theme/` or `icons/`: component classes are inlined and the
  handful of glyphs are inline SVG.
- **Server-renderable.** `document`, `navigator` and timers are touched inside effects or event
  handlers only.

## Components

| Component         | Subpath             | Ports / key props                                                                                             |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Avatar`          | `avatar`            | `name`, `src`, `alt`, `size`                                                                                  |
| `AvatarGroup`     | `avatar`            | `items`, `max`, `label`, `size` (a `role="group"`, not a list)                                                |
| `Badge`           | `badge`             | `text`, `color`, `type`                                                                                       |
| `Button`          | `button`            | `variant`, `size`, native button attrs                                                                        |
| `ConfidenceMeter` | `confidence-meter`  | `value` (optional; clamped 0–100, unknown renders no reading), `label`                                        |
| `CopyButton`      | `copy-button`       | `textToCopy`, `copy?` (clipboard port)                                                                        |
| `Combobox`        | `combobox`          | `items`, `value`, `onChange`, `getLabel?`, `filter?`, `ariaLabel?`, `aria-labelledby?`, `id?`                 |
| `DateRangePicker` | `date-range-picker` | `range`, `onChange`, `timeZone`, `presets`, `labels?` (every key optional)                                    |
| `Dropdown`        | `dropdown`          | `trigger`, `triggerLabel` or `triggerNamedByContent` (one is required), `menuLabel`, `vertical`, `horizontal` |
| `DropdownItem`    | `dropdown`          | `href`, `onClick`, `disabled`, `class` — a `role="menuitem"`, out of the tab order                            |
| `ErrorState`      | `error-state`       | `message` (renders nothing when empty)                                                                        |
| `GeoButton`       | `geo-button`        | `onLocation`, `onError?`                                                                                      |
| `LoadingScreen`   | `loading-screen`    | `message`, `description`                                                                                      |
| `LoadingSkeleton` | `loading-skeleton`  | `rows`                                                                                                        |
| `LoadingSpinner`  | `loading-spinner`   | `label`, `size`                                                                                               |
| `OnOffButtons`    | `on-off-buttons`    | `value`, `amount`, `onSwitch`                                                                                 |
| `PageTitle`       | `page-title`        | `children`, `class`                                                                                           |
| `Pagination`      | `pagination`        | `page`, `pageCount`, `onChange`, `label`, `previousLabel`, `nextLabel`, `pageLabel`                           |
| `Progress`        | `progress`          | `value`, `max`, `label`, `id` (a caption needs an `id`)                                                       |
| `SkeletonCards`   | `skeletons`         | `columns`, `rows`, `lines`                                                                                    |
| `SkeletonStatus`  | `skeletons`         | `label` (the loading announcement)                                                                            |
| `SkeletonTable`   | `skeletons`         | `rows`, `columns`, `widths`, `reserveHeight`                                                                  |
| `SkeletonText`    | `skeletons`         | `lines`, `widths`                                                                                             |
| `Table`           | `table`             | `headerSlot`, `bodySlots`, `footerSlot`, `rowDataE2E`                                                         |
| `Tabs`            | `tabs`              | `tabs`, `active`, `onChange`, `orientation`, `lazy`                                                           |
| `Toastr`          | `toastr`            | `toasts`, `onDismiss`, `label`, `dismissLabel`, `dataE2E`                                                     |
| `ToggleSwitch`    | `toggle-switch`     | `value`, `onToggle`, `disabled`, `label`                                                                      |
| `Tooltip`         | `tooltip`           | `content`, `label`, `placement`, `focusable`                                                                  |

## Usage

```tsx
import { Badge, Button, Toastr, ToggleSwitch } from "@preact-components/ui"
// or one component at a time, so the barrel does not pull in the rest
import { Badge } from "@preact-components/ui/badge"
```

Wiring side effects through ports, so the package stays app-agnostic:

```tsx
<ToggleSwitch value={archived} onToggle={(next) => settings.archive.set(next)} />

<CopyButton textToCopy={invoice.id} copy={(text) => app.clipboard.copy(text)} />

<GeoButton
  onLocation={(position) => map.center.set(position)}
  onError={(message) => app.toast.error({ body: message })}
/>

<Toastr toasts={app.toast.list.value} onDismiss={(id) => app.toast.remove(id)} />

<Tabs
  active={section.value}
  onChange={(id) => section.set(id)}
  tabs={[
    { id: "metrics", label: "Metrics", content: <MetricsList /> },
    { id: "logs", label: "Logs", content: <LogList />, disabled: !canReadLogs },
  ]}
/>
```

`Tabs` is controlled — `active` in, `onChange` out, no selection state of its own — and it is not a
router, so the caller wires it to whatever state it uses. By default every panel is rendered and the
inactive ones are `hidden` (attribute plus utility), which keeps each `aria-controls` resolving and
every panel in the accessibility tree; `lazy` renders only the active panel and drops `aria-controls`
from the tabs whose panel it omitted. Ids are derived from each `TabItem.id` (`${id}-tab`,
`${id}-panel`) and never generated, so keep them unique per document. Arrow keys follow `orientation`
— Left/Right horizontal, Up/Down vertical — plus Home/End; the decision table is the exported
`nextTabIndex`.

`Toastr` auto-dismisses each toast after `toast.duration` milliseconds (default 5000, `0` keeps it
until dismissed) and reports it through `onDismiss` — the caller owns the stack.

**The stack is always in the document, an empty one included.** It renders as a named region marked
`aria-live="polite"` whether or not it holds a toast, which is what lets a screen reader announce a
toast that arrives later: an area created together with its first message is commonly not announced
at all, because the reader sees a new subtree rather than a change to one it is watching. An empty
stack has no children, no padding and no minimum height, so it paints nothing and costs no layout —
positioned `fixed` it is out of flow, and a caller that overrides that to `static` gets a
zero-height box. What it does cost is one named landmark on every page that mounts it, so mount one
stack per page rather than one per view.

Inside that polite area an error toast additionally carries `role="alert"`, which interrupts;
every other variant carries `role="status"`. Both roles imply `aria-atomic`, so a reader announces
the whole toast rather than the one text node that changed.

The timer pauses while the pointer is over the stack or focus is inside it, and resumes with the
time it had left when they leave — a toast is reachable by keyboard instead of a race. Moving focus
_within_ the stack, from a link in a toast's body to its dismiss control, does not resume it.
Raising a toast's `duration` while it is on screen is the one thing that refills the budget rather
than continuing it, which is how a caller extends a toast it has already shown.

**The pause needs the caller to own the timing.** `Toastr` can only pause the timer it runs itself,
the one driven by `ToastItem.duration`. `createToastStore` from `@preact-components/signals`, which
the wiring above reads from, does its own timing instead, and that costs a caller both halves of
what this section promises. The store schedules a removal for every toast it holds, so a toast
pushed through it is taken away on the store's schedule whatever the pointer is doing and the pause
never reaches it —
[#175](https://github.com/spy4x/preact-components/issues/175). And the store's `timeout` field
never reaches the component's `duration`, so the component runs its own 5000ms default alongside
the store's timer and a toast lives whichever of the two is **shorter**: a `timeout` longer than
five seconds is quietly cut down to five, and `timeout: 0` — which that store documents as keeping
the toast until somebody dismisses it by hand — schedules nothing of its own and so leaves the
component's default to take the toast away after five seconds. The documented way to make a toast
persist is the case this breaks worst —
[#174](https://github.com/spy4x/preact-components/issues/174). Until the store hands its timing
over, a caller who wants either of them keeps the stack itself and passes `duration`, the way the
catalogue card does. Both defects are filed against the store; neither is this component's.

Every string the stack shows is a prop with an English default: `label` names the region
(`"Notifications"`), `dismissLabel` names every dismiss control (`"Dismiss"`), and one toast can
name its own with `ToastItem.dismissLabel`, which is worth doing when several are on screen and
"Dismiss" three times over says nothing about which is which. The `data-e2e` attribute is rendered
only when `dataE2E` is passed, so a consumer's markup carries a test hook only when that consumer
asked for one.

```tsx
<Toastr
  toasts={app.toast.list.value}
  onDismiss={(id) => app.toast.remove(id)}
  label="Benachrichtigungen"
  dismissLabel="Ausblenden"
/>
```

## Tooltip

A supplementary hint on a trigger, revealed by hover and by keyboard focus, anchored with CSS only.
Two rules go together and the component holds both: **a hint can be dismissed**, and **a hint can be
pointed at**. Escape hides it and drops `aria-describedby` without moving focus, and it comes back on
the next hover or focus; the surface takes pointer events and the gap between trigger and hint is the
surface's own padding, so a pointer can travel onto the hint and rest there while it is read. A hint
that cannot be dismissed covers what somebody was reading, and one that cannot be hovered cannot be
read at all by anyone magnifying the screen.

`label` is the trigger's own accessible name and the hint is only ever its description. By default
the trigger is a `<button>`, because `aria-label` on an element with no role is not guaranteed to
reach the accessibility tree at all. `focusable={false}` is for a trigger whose children are already
interactive: the wrapper becomes a `role="group"` around that control, which keeps one tab stop for
one control and still gives the name and the description an element the tree keeps.

```tsx
<Tooltip content="Supplements the trigger" label="Total revenue" placement="right">
  <span>Revenue</span>
</Tooltip>
```

While a hint is on screen its box — the bridge to the trigger included — sits over whatever is behind
it and takes the clicks that would have gone there. It is inert again the moment the hint is hidden.
The reveal itself is Tailwind's `group-hover` and `group-focus-within`, and Tailwind compiles every
hover style inside `@media (hover: hover)`: on a device that reports no hover-capable pointer the
hint is reached by focus only, which is the right behaviour on a touch screen and is also why the
browser checks prove the hover half through hit testing rather than through the paint.

## Combobox

Every string it shows is a prop with an English default: `placeholder` (`"Select…"`), `emptyMessage`
(`"No matches"`) and `clearLabel` (`"Clear selection"`).

**The empty message waits to be asked.** It is rendered, and announced, only once the list is open or
the field carries a query. A field nobody has touched — one whose options are still arriving over the
network, for instance — says nothing at all rather than claiming there is nothing to match. When
those options land while the popup is open, the message goes and the first usable row takes the
highlight, so `Enter` picks something without an arrow key first: a list that arrives with nothing
highlighted tells a screen reader that nothing arrived.

**A known limit of that.** The element carrying the message is itself the live region, so it enters
the page already holding its text instead of sitting there empty and then changing — which is the
case screen readers announce least reliably. `Toastr` in this package does the opposite, and says
why. The browser check proves the region appears and that the input describes it; it does not prove
a reader spoke it.

**What that costs when it fails**: somebody opens a field whose options have not arrived and is told
nothing at all. From where they sit that is the defect this component just fixed — the only
difference is that the words now on the screen are true. The fix is an empty `role="status"` kept in
every combobox from the start, which is a live region on every field on the page; that trade belongs
to the three components in this library with the same shape rather than to this one alone, and is
tracked in [#186](https://github.com/spy4x/preact-components/issues/186).

The highlight belongs to the keyboard: the arrow keys move it, the popup scrolls to keep it on screen
— `block: "nearest"`, so a row already in view does not move the list at all — and no pointer handler
writes `aria-activedescendant`, so a screen reader's reading position does not follow a mouse
somebody else is holding. The row under the pointer is still painted, in CSS.

**The highlight never outlives its row.** A list can shrink under an open popup — options withdrawn
by a caller that re-fetches them, twenty-seven rows replaced by three — and a highlight left where it
was would point `aria-activedescendant` at an element the page no longer holds. It is clamped to the
list on screen, so it is dropped for as long as the list is too short to hold it: shrink the list and
the highlight goes, grow it back and it returns to the row it was on. Only the value every reader
takes is clamped; the position itself is kept, because a list that comes back is the same list.

## DateRangePicker

A preset list and a custom from/to panel, controlled: `range` in, `onChange` out. `timeZone` is
required because the server's zone is not the visitor's, and the clock is either injected through
`now` or read inside a click handler, never during render.

**Every string the panel shows has an English default, so `labels` and every key in it are
optional.** A caller who says nothing gets `"Date range"`, `"Any dates"`, `"From"`, `"To"`,
`"Apply"` and `"Cancel"`; a caller who needs one word changed passes that one word and keeps the
rest. A key passed as `undefined` falls back the same way an omitted one does. The one string with
no default is a preset's own `label`, which arrives with the preset: the caller decides both which
presets to offer and how to word each of them for its audience.

```tsx
<DateRangePicker
  range={range.value}
  onChange={(next) => range.value = next}
  timeZone="Europe/Paris"
  presets={[
    { preset: "last-7-days", label: "Sieben Tage" },
    { preset: "custom", label: "Eigener Zeitraum" },
  ]}
  labels={{ placeholder: "Alle Daten", apply: "Übernehmen" }}
/>
```

**Focus follows the panel**, which is the difference between a keyboard user keeping their place and
losing it. Opening moves focus to the pressed preset — so a reader announces the choice the panel
opens on — or to the first preset when nothing is pressed, or to the panel itself when there are no
presets at all. The move happens in an effect rather than in the click handler, because the panel is
rendered with the `hidden` attribute and Chromium refuses to focus anything inside a `display: none`
subtree: a `focus()` call in the same tick as the state change fires no focus event at all.

A close the person drove **from inside** the panel hands focus back to the trigger: choosing a
preset, Apply, Cancel, pressing the trigger a second time, and Escape. In each of those the next
render hides the element their focus is on, so something has to move it, and the trigger is where
they came from.

A close driven from **outside** it does not, and there are two. A click outside leaves focus on
whatever was clicked, because the person has just put it there deliberately. And Escape is a return
only when focus was still inside the component as the key was pressed: a Tab out leaves the panel
open behind you, so Escape can arrive from somewhere the person has since walked to, and pulling
them back there would be one more way to lose their place rather than a way to keep it.

Focus merely _leaving_ the panel is not a close at all here. A Tab out leaves it open, which is the
one dismissal path this component does not have — and is also what makes the Escape-from-outside
case above reachable.

All seven of those paths are driven in a real browser in `pages/checks/ui.ts`: opening, the five
that return focus, and the two that must not.

`Custom…` is marked pressed while the custom fields are the live choice — the button was activated,
either field was typed into, or the caller's `selectedPreset` is `"custom"` — and stops being
pressed when another preset takes over or the draft is cancelled. It reads that state from the same
signal the fields write, so what a screen reader announces and what the panel shows cannot disagree.

## Pagination

Page numbers with the long runs collapsed, plus previous and next. Controlled: `page` is rendered as
given (clamped into `1…pageCount`) and every request leaves through `onChange`. `pageCount={0}`
renders nothing at all, so a list that found no rows needs no special case at the call site, and
`pageCount={1}` renders the one page and no controls: a list with a single page has nowhere to go,
and two dead tab stops on it would cost every reader who tabs past them something and gain nobody
anything.

**From two pages up, Previous and Next are always rendered, and carry `aria-disabled="true"` where
they cannot act.** Both obvious alternatives lose the keyboard user's place at the exact moment they
reach the end,
which is while they are pressing the control: unmounting it destroys the element under their focus,
and setting the native `disabled` attribute on a focused button takes focus off it — measured in the
headless Chromium this repository drives, where `document.activeElement` went from the button to
`<body>` on the line that set the attribute. Chromium's accessibility tree reports the control as
disabled for either spelling, so nothing is given up. What `aria-disabled` does not do is stop the
press — a real Space press still fires a click on such a button — so each handler checks the end it
guards before calling `onChange`. The controls do mount and unmount as `pageCount` crosses between
one and two, which is the caller's data changing rather than a step the reader took inside the
control, so nobody's focus is on one at that moment.

**The window keeps two pages on each side of the current one.** The first and last page are always
shown, the window slides back inside the range rather than shrinking when it reaches an end, and a
`…` always stands for at least two pages: where a mark would have hidden a single page, that page is
written out instead, because the mark takes the same room and says less. `pageRange(page, pageCount,
size)` is that rule on its own, exported and unit-tested; `size` says how long a range may be before
it collapses at all, and the collapsed window's width does not depend on it. What bounds the
collapsed form is the two-page rule instead: at most nine items, being the five-page window plus, at
each end, either that end's page and a `…` or the up to two pages the window swallowed in place of
that `…`. The unit suite walks every page of every total up to sixty across a dozen values of
`size`, so nine is a measured ceiling rather than an estimate — and it checks that nine is reached,
because a bound nobody reaches is a bound nobody has tested.

```
pageRange(5, 10)   1 2 3 4 5 6 7 … 10
pageRange(15, 30)  1 … 13 14 15 16 17 … 30
pageRange(30, 30)  1 … 26 27 28 29 30
```

Every string is a prop with an English default: `label` names the `nav` landmark (`"Pagination"`),
`previousLabel` and `nextLabel` name the two controls, and `pageLabel` names one page number. That
last one is a function of the number rather than a string, because a translation needs the number
and where it falls in the sentence is the translator's business.

```tsx
<Pagination
  page={page.value}
  pageCount={24}
  onChange={(next) => page.value = next}
  label="Rechnungsseiten"
  previousLabel="Zurück"
  nextLabel="Weiter"
  pageLabel={(number) => `Seite ${number}`}
/>
```

## Skeletons

`LoadingSkeleton` is the generic placeholder. The `skeletons` subpath adds variants whose boxes come
from the counts the real component takes: `SkeletonText`, `SkeletonTable`, `SkeletonCards`.

Every subtree is `aria-hidden="true"` and none of them announces anything. The announcement is a
sibling live region, `SkeletonStatus` (`role="status"`, `aria-live="polite"`, `sr-only` text), so one
region can cover a table, a grid and a paragraph that load together, and the caller owns the copy:

```tsx
{
  loading.value
    ? (
      <>
        <SkeletonStatus label="Loading invoices" />
        <SkeletonTable rows={5} columns={4} widths={[3, 3, 2, 1]} />
      </>
    )
    : <Table headerSlot={…} bodySlots={…} />
}
```

`SkeletonTable` mirrors the real `Table`'s wrapper, header row and one-line body row. The heights are
measurements, not arithmetic: Chromium renders a body row at **53px** and the header at **44.5px** on
both sides, so a row sits at the same offset whether the caller renders the skeleton or the table. The
wrapper costs **0.5px** at a full 12-row table — `681px` against `681.5px`. The residual is the last
skeleton body row, which a one-row `tbody` measures at `52.5px` like the real table's; pinning that row
to `3.28125rem` closes the wrapper to `681px` with `0.00px` drift on every row. `tableRowHeightRem()` returns
the body value and `tableHeaderHeightRem()` the header value, both pinned by tests that assert the
literal rather than restating the implementation.

**A cell must fit one line.** The skeleton reserves one line per body row, so a cell that wraps is
taller than its placeholder: measured, a cell wrapping to four lines at a 560px viewport pushed its row
to `73px`, `20px` past what was reserved, and the drift accumulates down the table. Keep cell content to
one line, or reach for `SkeletonCards` and `SkeletonText` where the content is prose.

**Column widths are an approximation, not a mirror.** `widths` splits the grid by weight, while the
real `Table` is `table-auto` and sizes columns from cell content: for one four-column table the real
split measured `24.8 / 23.0 / 27.2 / 25.0 %` against the grid's `31.6 / 31.6 / 21.0 / 10.5 %`. Close
enough that the skeleton does not jump between column boundaries, not close enough to call equal —
and making them equal needs a `Table` API change plus `table-layout: fixed`, which `Table` does not
offer today. `columnWidthPercents(widths)` is what reports the split, and `tableGeometry({ rows,
columns, widths })` the rest of the geometry; both are assertable without a DOM. The checklist a
caller can satisfy, and the one case no props-only component can cover, are on `SkeletonTable`'s
JSDoc.

## Tests

`deno task test` from the repo root. Tests render each component with
`preact-render-to-string` and assert on the real markup: palette selection, variant swap, utility
merge order, `aria` wiring, null returns and prop passthrough. `preact-render-to-string` is pinned
in this package's `deno.json` because the root import map has no renderer.

## Not in this package

`DateTimeFilter`, `MetricsList`, `Map`, `Export` and the higher-level selectors
(`CurrencySelector`, `DateRangeSelector`, `AccountSelector`) stay app-side for now — the first two
are theme-coupled and belong with the charts work, `Map` loads Leaflet from an unpkg script and
`Export` drags in `xlsx`. `DeletionValidation` belongs with the CRUD package.
