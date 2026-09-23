# `@preact-components/ui`

Preact + Tailwind primitives extracted from `gb`, `financy` and `offer-lens`.

## Rules this package follows

- **Props and ports, never a global store.** No component imports an app's state singleton. App
  state arrives as props; side effects (clipboard, geolocation, toasts) arrive as callbacks.
- **Pure Tailwind.** No dependency on `theme/` or `icons/`: component classes are inlined and the
  handful of glyphs are inline SVG.
- **Server-renderable.** `document`, `navigator` and timers are touched inside effects or event
  handlers only.
- **One Preact option hook, for four components' refs.** `./forward-ref.ts`'s hook, installed on
  Preact's shared `options` object, is what lets `Input`, `Button`, `Checkbox` and `Radio` forward
  the `ref` each is given to the native element it renders instead of Preact applying it to the
  component itself. Fourteen of this package's exports load it — checked with `deno info --json`
  against every export in `ui/deno.json`, not assumed: the four components themselves —
  `./button`'s only other export is `buttonClasses`, so a caller who imports that alone still
  installs the hook; the package root (`.`), which carries every export; `./confirm-dialog`,
  `./copy-button`, `./date-range-picker`, `./geo-button`, `./modal`, `./on-off-buttons` and
  `./pagination`, each of which renders a `Button` of its own; `./dropdown`, which uses
  `buttonClasses` without ever rendering a `Button`; and `./copyable-text`, which loads it
  transitively through `./copy-button`. `@preact-components/crud` loads it too, transitively,
  through `./dropdown`. It acts only on the four components it forwards refs for; nothing else in
  this package or a caller's own markup is affected.

## Components

| Component         | Subpath             | Ports / key props                                                                                                              |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Avatar`          | `avatar`            | `name`, `src`, `alt`, `size`                                                                                                   |
| `AvatarGroup`     | `avatar`            | `items`, `max`, `label`, `size` (a `role="group"`, not a list)                                                                 |
| `Badge`           | `badge`             | `text`, `color`, `type`                                                                                                        |
| `Button`          | `button`            | `variant`, `size`, native button attrs                                                                                         |
| `ConfidenceMeter` | `confidence-meter`  | `value` (optional; clamped 0–100, unknown renders no reading), `label`                                                         |
| `CopyButton`      | `copy-button`       | `textToCopy`, `copy?` (clipboard port)                                                                                         |
| `Combobox`        | `combobox`          | `items`, `value`, `onChange`, `getLabel?`, `filter?`, `ariaLabel?`, `aria-labelledby?`, `id?`                                  |
| `DataTable`       | `data-table`        | `columns`, `rows`, `rowKey`, `sort`, `onSortChange`, `caption`, `captionHidden?`, `empty?`, `paging?`, `rowDataE2E?`, `class?` |
| `DateRangePicker` | `date-range-picker` | `range`, `onChange`, `timeZone`, `presets`, `labels?` (every key optional)                                                     |
| `Dropdown`        | `dropdown`          | `trigger`, `triggerLabel` or `triggerNamedByContent` (one is required), `menuLabel`, `vertical`, `horizontal`                  |
| `DropdownItem`    | `dropdown`          | `href`, `onClick`, `disabled`, `class` — a `role="menuitem"`, out of the tab order                                             |
| `ErrorState`      | `error-state`       | `message` (renders nothing when empty)                                                                                         |
| `GeoButton`       | `geo-button`        | `onLocation`, `onError?`                                                                                                       |
| `LoadingScreen`   | `loading-screen`    | `message`, `description`                                                                                                       |
| `LoadingSkeleton` | `loading-skeleton`  | `rows`                                                                                                                         |
| `LoadingSpinner`  | `loading-spinner`   | `label`, `size`                                                                                                                |
| `OnOffButtons`    | `on-off-buttons`    | `value`, `amount`, `onSwitch`                                                                                                  |
| `PageTitle`       | `page-title`        | `children`, `class`                                                                                                            |
| `Pagination`      | `pagination`        | `page`, `pageCount`, `onChange`, `label`, `previousLabel`, `nextLabel`, `pageLabel`                                            |
| `Progress`        | `progress`          | `value`, `max`, `label`, `id` (a caption needs an `id`)                                                                        |
| `SkeletonCards`   | `skeletons`         | `columns`, `rows`, `lines`                                                                                                     |
| `SkeletonStatus`  | `skeletons`         | `label` (the loading announcement)                                                                                             |
| `SkeletonTable`   | `skeletons`         | `rows`, `columns`, `widths`, `reserveHeight`                                                                                   |
| `SkeletonText`    | `skeletons`         | `lines`, `widths`                                                                                                              |
| `Table`           | `table`             | `headerSlot`, `bodySlots`, `footerSlot`, `caption?`, `captionClass?`, `rowDataE2E`                                             |
| `Tabs`            | `tabs`              | `tabs`, `active`, `onChange`, `orientation`, `lazy`                                                                            |
| `Toastr`          | `toastr`            | `toasts`, `onDismiss`, `label`, `dismissLabel`, `dataE2E`                                                                      |
| `ToggleSwitch`    | `toggle-switch`     | `value`, `onToggle`, `disabled`, `label`                                                                                       |
| `Tooltip`         | `tooltip`           | `content`, `label`, `placement`, `focusable`                                                                                   |

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

<Toastr toasts={app.toast.list.value} onDismiss={(id) => app.toast.remove(String(id))} />

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

`Toastr` auto-dismisses each toast after `toast.duration` milliseconds (default
`defaultToastDuration`, which is 5000; `0` keeps it until dismissed) and reports it through
`onDismiss` — the caller owns the stack. `createToastStore` in `@preact-components/signals` writes
that same `duration` field, so the wiring above needs no adapter; `String(id)` is there because
`ToastItem.id` is `string | number` and that store's ids are strings.

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

`duration` is not validated, and `resolveDuration` documents what each odd value does. The short
version: pass `0`, a positive number of milliseconds up to 2,147,483,647, or nothing. A negative
number and `Infinity` both dismiss the toast at once, because the browser runs either as a zero
delay, and so does anything above 2,147,483,647 ms (about 24.8 days), because browsers hold a
timer's delay as a 32-bit signed integer. `NaN` starts no timer and so keeps the toast like `0`
does.

**This component owns the dismiss timer, and the store it is wired to owns none.** The pause can
only hold a timer this component runs, so `createToastStore` from `@preact-components/signals`
schedules nothing: it holds the list, and `onDismiss` calls its `remove`. The side that can see a
pointer resting on a toast is the side that should be timing it, which is why the timer lives here
rather than there.

It used to be the other way round in both halves, and both were quiet. The store scheduled a
removal per toast, so a store-fed toast was taken away on the store's own schedule whatever the
pointer was doing and the pause reached nothing
([#175](https://github.com/spy4x/preact-components/issues/175)); and the store wrote the delay
under a field called `timeout` that this component never read, so both clocks ran and a toast lived
whichever was **shorter** — a delay longer than five seconds was cut down to five, and a delay of
`0`, documented as keeping the toast until somebody dismisses it, lost it after five
([#174](https://github.com/spy4x/preact-components/issues/174)). One field name, `duration`, on
both sides now; `timeout` is still accepted by the store for one release, and `duration` wins when
both are given.

An application that renders toasts some other way gets no auto-dismiss from that store and
schedules its own removals — two lines, in `signals/README.md`. There is deliberately no opt-in
timer there, because a second clock for this one to disagree with is the defect wearing a different
coat.

Every string the stack shows is a prop with an English default: `label` names the region
(`"Notifications"`), `dismissLabel` names every dismiss control (`"Dismiss"`), and one toast can
name its own with `ToastItem.dismissLabel`, which is worth doing when several are on screen and
"Dismiss" three times over says nothing about which is which. The `data-e2e` attribute is rendered
only when `dataE2E` is passed, so a consumer's markup carries a test hook only when that consumer
asked for one.

```tsx
<Toastr
  toasts={app.toast.list.value}
  onDismiss={(id) => app.toast.remove(String(id))}
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
hint is reached by focus only, which is the right behaviour on a touch screen. The browser checks
drive both paths: one moves a real pointer onto the trigger and asserts the hint appears and then
goes away again, and another asserts the hit testing that lets the pointer travel onto the hint and
rest there.

## Combobox

Every string it shows is a prop with an English default: `placeholder` (`"Select…"`), `emptyMessage`
(`"No matches"`), `countMessage` (`"1 match"` / `"12 matches"`) and `clearLabel`
(`"Clear selection"`).

**One live region, rendered with the field and never taken away.** Every combobox renders a single
`role="status"` element with `aria-live="polite"` and `aria-atomic="true"` on every render, the
server render included, and it is empty until the field has been used. Answers are put into it and
taken out of it; it is never created along with one. This is the library-wide rule that `Toastr`
here and `SWUpdater` in `system/` also follow, and the reason is the same in all three: assistive
technology announces a _change_ to a region it is already watching, and commonly says nothing at all
about a region that arrives with its message already inside it.

**What goes into it, and when.** Two answers, and neither is given before it is asked:

| The field                                    | What the region holds |
| -------------------------------------------- | --------------------- |
| rendered, never opened, never typed in       | nothing               |
| opened, no query                             | nothing               |
| a query, and options left                    | `countMessage(count)` |
| a query — or an open list — and nothing left | `emptyMessage`        |

The count answers typing, which is the one thing a screen-reader user otherwise gets no feedback
about: the rows are on screen for anyone who can see them, so the count is `sr-only` and nobody else
meets it. Opening the list is answered by the list — a reader announces the expanded listbox and the
highlighted row — so a count repeated on every open would be noise over the top of it. The empty
message keeps the wider rule it already had: it is the answer to a question, and opening the field
asks one. A field nobody has touched, one whose options are still arriving over the network for
instance, says nothing at all rather than claiming there is nothing to match. When those options land
while the popup is open, the message goes and the first usable row takes the highlight, so `Enter`
picks something without an arrow key first: a list that arrives with nothing highlighted tells a
screen reader that nothing arrived.

**It is written once.** The empty message is the visible paragraph, rendered inside the region rather
than copied into a hidden twin beside it, so the words on screen and the words announced cannot drift
apart and a reader browsing the page does not meet the same sentence twice.

**What it costs a host: nothing.** The region carries no class, no padding, no border and no minimum
height, so it is zero pixels tall while it is empty — and it is a child of the component's own root,
which is a plain block container, rather than a sibling of the field in the host's layout. A parent
that holds a whole combobox is therefore charged for one combobox-shaped box either way. Measured in
Chromium against a clone of the shipped field, in a column of two 24px paragraphs, taking the region
out and putting it back: **0px in every one of block flow, block flow with `space-y-4`, a `flex`
column with `gap-4`, a `flex` column with `space-y-4`, a `grid` with `gap-4`, and a `grid` with
`space-y-4`**. That is the one thing that differs from `SWUpdater`, whose region _is_ its whole
output and therefore lands directly in the host's container, where a `flex` or `grid` gap does charge
16px for it. What an always-present region costs everywhere is one more node in the accessibility
tree, and here that is one per field rather than one per page — the trade [#186] weighed and took.

**The input is described by the region while the empty message is in it, and never while the count
is.** The two sentences the region can hold are different kinds of thing. "No matches" is a standing
fact about the field, true for as long as it is on screen, and a live region announces a _change_ and
says nothing at all when focus arrives — so without a description, somebody tabbing into a
server-filtered field that was rendered with a query matching nothing would be told about the field
and nothing about the message on its face. `aria-describedby` therefore points at the region exactly
while `answersEmpty` holds. A count is not a fact about the field but about the last keystroke, and a
description is re-read every time the input is announced, so "12 matches" would be spoken as part of
the field's identity long after the number was true, and in the one moment it is new it would be both
described and announced. A query that matches nothing never carries a count, so while the input is
described the region's text is the empty message and nothing else.

Measured in Chromium through the DevTools protocol, which is the tree a reader reads rather than the
markup: the input's accessible description is `""` on an untouched field, `""` while the region holds
a count, the empty message once the query matches nothing, still the empty message on the closed
field that query was abandoned on, and `""` again once the field is cleared.

**A known limit of that.** A combobox closed by a click outside it, or by focus moving away, keeps
its draft query — only `Escape` and choosing an option drop it — so a field that has a selection can
close showing that selection while its region still holds the answer to the query that was abandoned.
Nothing is spoken, because nothing changed, but a reader browsing the page meets a count, or a "no
matches", that does not describe what the field is showing. This is not new: the same shape applied to
the empty message before the region was made permanent.

**No screen reader has been run against this repository.** What is demonstrated is markup and the
order in which the DOM changes — the region is in the page first, and the message arrives as a
mutation of that same element. `pages/checks/ui.ts` parks a reference to the region and a
`MutationObserver` on it while it is empty, so a check cannot pass by finding a region that turned up
carrying its text. That is not a demonstration that any particular screen reader speaks.

[#186]: https://github.com/spy4x/preact-components/issues/186

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

All seven of those close paths are driven in a real browser in `pages/checks/ui.ts` — the five that
return focus and the two that must not — and so is the move that opens the panel.

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
each end, either that end's page and a `…` or the two pages the window swallowed in place of that
`…`. The unit suite walks every page of every total up to sixty across a dozen values of `size`, so
nine is a measured ceiling rather than an estimate — and it checks that nine is reached, because a
bound nobody reaches is a bound nobody has tested.

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

## DataTable

`Table`'s markup joined to `@preact-components/signals/table-state`'s sort rules: a sortable,
optionally paged table with no sort state of its own.

```tsx
import { DataTable } from "@preact-components/ui/data-table"
import type { SortRule } from "@preact-components/signals/table-state"

const sort = useSignal<SortRule<"date" | "merchant" | "amount">[]>([])

<DataTable
  caption="Invoices"
  columns={[
    { key: "date", header: "Date", sortable: true },
    { key: "merchant", header: "Merchant", sortable: true },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      render: (row) => formatMoney(row.amount),
    },
  ]}
  rows={invoices}
  rowKey={(row) => row.id}
  sort={sort.value}
  onSortChange={(next) => sort.value = next}
/>
```

**The caller owns `sort` — and `paging.page` when paging is on — the same way an app owns any
other filter, so either can live in a signal, `useState`, or a URL parameter through
`parseSort`/`serializeSort`.** `DataTable` reads that state, applies it with `sortRows` and a
plain slice, and writes the next value back through `onSortChange`/`paging.onChange`; it holds
none of its own. This is a deliberate split from `Pagination`, which only renders controls and
leaves slicing to the caller: `DataTable` already holds the full row set and the rules to apply to
it, so it is the one place that can do both without asking every caller to duplicate the pairing —
which is what one source application this component was extracted from was already doing by hand,
in two places.

`pages/src/data-table-sort.tsx` demonstrates the URL half in a real browser, bound through
`useUrlFilters` next to that hook's own demo, `pages/src/url-filters.tsx`: pressing a header adds
`?sort=` to the address, and a press of Back removes it again along with the sort. It lives in
`pages/src` rather than as a catalogue card because a card writing to `location` would be writing
to whatever host application embeds the catalogue, the same reason `useUrlFilters` itself is
demonstrated there.

**`DataTable` sorts and pages client-side only.** `rows` has to be the complete, unsorted set:
`sortRows` runs its own collation over every row it is given, including rows a server already
sorted, and there is no way to hand this component a `pageCount` for a page it cannot see the rest
of — passing one page's worth of rows with `paging.page: 2` renders that page's rows on what looks
like page 1, because `DataTable` has no way to know there were more before them. A mode that skips
`sortRows` and takes a caller-supplied `pageCount` instead is tracked in
[#235](https://github.com/spy4x/preact-components/issues/235) rather than built here.

**Every sortable header is a real `<button>`**, so Tab and Space reach it — a real Enter press
does not activate a focused button in this repository's browser checks, so `pages/checks/ui.ts`
proves the Space path. Pressing it calls `toggleSort`, which cycles that column through
ascending → descending → off and, if the column was not already part of `sort`, appends it as the
_least significant_ rule rather than replacing what was there. That is the whole of how a
multi-column sort is built: there is no modifier key, a keyboard user just Tabs to a second
sortable header and presses Space, and removes it again by cycling that same header back off.

**`aria-sort` carries the state; the chevron beside a header's text is decorative.** A column's
`<th>` carries `aria-sort="ascending"` or `"descending"` only while that column is part of `sort`
— a column not in `sort` carries no `aria-sort` attribute at all, never `"none"`. The chevron is
`aria-hidden`, so a screen reader is never told anything the attribute did not already say; it
only points a sighted reader the way `aria-sort` already points a screen reader.

**The table's name is a required `caption`.** It is the one string only the caller knows, so there
is no English default; `captionHidden` keeps it for assistive tech while hiding it visually
(`sr-only`) rather than leaving the table unnamed. `Table` gained an optional `caption`/
`captionClass` pair for this — omitted, it renders nothing, so every existing `Table` caller is
unaffected.

**`empty` replaces the whole body, not just one cell's worth**, when `rows` is empty: a single row
spanning every column, defaulting to `<EmptyState title="No rows" />`. The header stays, so a
sortable column stays clickable even when a filter elsewhere on the page is what emptied the list.

**`rowKey` stamps `data-row-key` on each row's first cell**, exported as `rowKeyAttribute`.
`Table` keys its own `<tr>`s by array position, not by a caller-supplied identity — extending that
is `Table`'s own change to make, tracked as a follow-up
([#234](https://github.com/spy4x/preact-components/issues/234)) rather than built here — so a sort
or a page turn that reorders rows gives Preact nothing to reconcile a row's identity against by
itself. Stamping the key on the DOM is what lets a page, or a browser check, point at a specific
row without depending on its rendered text.

**Paging is optional and minimal**: `page`, `pageSize` and `onChange`, mirroring `Pagination`'s own
prop names because most of them pass straight through to it. `DataTable` computes `pageCount` from
the full, sorted row count and slices the visible page itself; omit `paging` entirely for every row
on one page. `page` is clamped into `1…pageCount` the same way `Pagination` clamps its own, before
it is used for both the slice and the pager — a page a filter has shrunk past, or `0` or a negative
number, renders the nearest real page instead of an empty body beside a pager that disagrees with
it.

**A column is one of two shapes.** A data column reads a row field: `key` (one of the row type's
own string keys), `header`, and optionally `sortable`, `align` and `render`. `key` is also this
column's identity, so it is what `sort` and `toggleSort` key by, and only a data column can carry
`sortable` or `aria-sort` at all. A display column has no field of its own — an actions column,
say — and takes `id`, `header`, `render` (required, since there is no field to fall back to) and
optionally `align`; it is never sortable and never carries `aria-sort`, because there is no row
field for a header press to toggle. Keeping the two shapes separate is what stops a display column
from being told it is sorted: an earlier version let a display column reuse a data column's `key`
for its own identity, and a header sorted by that field then read as sorted on both columns —
`aria-sort` came from the key alone, not from whether the column could actually be sorted. `id` and
every data column's `key` still have to be unique across the whole `columns` array, the ordinary
"give a list of keyed things distinct keys" rule and nothing more.

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
