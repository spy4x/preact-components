/**
 * The `ui/` display primitives: the card anatomy, the meters, the tabbed and paged navigation, and
 * the identity widgets.
 *
 * Every card here renders its real markup. The components whose interesting half only happens in a
 * browser — `Tabs`' keyboard map, `Pagination`'s next click, a copy through the clipboard — say so
 * on the card and are demonstrated through the one thing the catalogue can honestly show: the state
 * after the decision, driven by the same port an app would pass.
 */

import {
  Avatar,
  AvatarGroup,
  type AvatarSize,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ConfidenceMeter,
  CopyableText,
  CopyableTextBody,
  DataTable,
  describedImages,
  ImageGallery,
  type ImageGalleryImage,
  Lightbox,
  type LightboxImage,
  pageRange,
  PageTitle,
  Pagination,
  Progress,
  type ProgressTone,
  type TabItem,
  Table,
  type TabOrientation,
  Tabs,
  Tooltip,
  type TooltipPlacement,
} from "@preact-components/ui"
import { serializeSort, type SortRule } from "@preact-components/signals/table-state"
import { useSignal } from "@preact/signals"
import { IconTrashBin } from "@preact-components/icons"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/**
 * A one-square image, inline so the catalogue needs no network and no asset directory.
 *
 * The `src` face of `Avatar` can only be exercised with something that loads, and a data URI is one
 * document with no request behind it. The glyph is a purple disc, which is visible at every avatar
 * size and is *not* the initials face — the point of demoing the image path is that the picture
 * shows.
 */
const inlineAvatar = `data:image/svg+xml,${
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#9333ea"/></svg>',
  )
}`

/**
 * A flat placeholder rectangle, as a data URI, so `ImageGallery` and `Lightbox`'s cards need no
 * image asset and no network — the same reason `pages/checks/system.ts`'s `ImageLightbox` card
 * uses one.
 */
function placeholder(fill: string, width = 320, height = 200): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='%23${fill}'/%3E%3C/svg%3E`
}

/**
 * Four described images and one without a description in the middle of them, so the card shows
 * both halves of the contract with the harder case exercised rather than the easy one: the strip
 * and the lightbox page through the four described images in order, skipping straight from the
 * second to what would be the fourth position — the one — passed in like any other — that
 * {@link describedImages} drops before render.
 */
const galleryImages: ImageGalleryImage[] = [
  { src: placeholder("9333ea"), alt: "A purple rectangle" },
  {
    src: placeholder("2563eb"),
    alt: "A blue rectangle",
    thumbSrc: placeholder("2563eb", 96, 96),
  },
  { src: placeholder("6b7280"), alt: "  " },
  { src: placeholder("16a34a"), alt: "A green rectangle" },
  { src: placeholder("ea580c"), alt: "An orange rectangle" },
]

/**
 * The thumbnail strip, opening `Lightbox` on the one pressed.
 *
 * The third image, whose `alt` is whitespace, is passed in exactly like the other four — the card
 * shows the count `describedImages` keeps, rather than trusting a claim about what a reader cannot
 * otherwise see: a fifth thumbnail would be the tell that the rule had quietly stopped holding.
 */
function ImageGalleryDemo() {
  const shown = describedImages(galleryImages)

  return (
    <div class="space-y-2">
      <ImageGallery images={galleryImages} />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {galleryImages.length} images passed in, {shown.length} shown — the one whose{" "}
        <code>alt</code>{" "}
        is blank after trimming is dropped from the strip and from the lightbox's sequence, not
        rendered with a placeholder name.
      </p>
    </div>
  )
}

/** The three described images, for the standalone `Lightbox` card below. */
const lightboxImages: LightboxImage[] = galleryImages.slice(0, 3)

/**
 * `Lightbox` on its own, outside `ImageGallery` — the building block `system/image-lightbox.tsx`'s
 * content mode is the other caller of. Nothing here draws thumbnails: the three buttons stand in
 * for whatever trigger a caller already has, each opening the dialog on a different position, so
 * the card also shows that `index` and `open` are the caller's own state rather than the
 * component's.
 */
function LightboxDemo() {
  const openIndex = useSignal<number | null>(null)

  return (
    <div class="space-y-2">
      <div class="flex flex-wrap gap-2">
        {lightboxImages.map((image, index) => (
          <Button
            key={image.src}
            variant="outline"
            size="sm"
            onClick={() => openIndex.value = index}
          >
            Open "{image.alt}"
          </Button>
        ))}
      </div>
      <Lightbox
        images={lightboxImages}
        index={openIndex.value ?? 0}
        open={openIndex.value !== null}
        onClose={() => openIndex.value = null}
        onIndexChange={(next) => openIndex.value = next}
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Left and Right page through the three images while the dialog is open; Escape closes it and
        returns focus to whichever button opened it.
      </p>
    </div>
  )
}

/** Every size the primitive accepts — a size added to `AvatarSize` does not compile until shown. */
const avatarSizes: Record<AvatarSize, string> = {
  xs: "xs",
  sm: "sm",
  md: "md (default)",
  lg: "lg",
}

/** Every progress tone — the record is the coverage guard for `ProgressTone`. */
const progressTones: Record<ProgressTone, string> = {
  primary: "primary (default)",
  success: "success",
  warning: "warning",
  danger: "danger",
}

/** Every placement — the record is the coverage guard for `TooltipPlacement`. */
const tooltipPlacements: Record<TooltipPlacement, string> = {
  top: "top (default)",
  right: "right",
  bottom: "bottom",
  left: "left",
}

/** One example user per card, so the anatomy cards are about layout rather than about lorem. */
const cardUser = { name: "Ada Lovelace", email: "ada@example.com", role: "Administrator" }

/** Three rows, so the card below has something to be a summary of. */
const recentInvoices = [
  { id: "INV-0007", amount: "1 250.00", status: "paid" as const },
  { id: "INV-0006", amount: "89.90", status: "pending" as const },
  { id: "INV-0005", amount: "4 320.00", status: "paid" as const },
]

/**
 * The card anatomy, both header modes.
 *
 * `CardHeader` takes `title`/`action` or raw `children`, and the union is worth showing side by
 * side: the first mode is the everyday one, the second is for a header that needs markup. The third
 * card drops the body and the footer, which are optional children like any other.
 */
function CardDemo() {
  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader title="Card" action={<Badge text="default" color="gray" />} />
        <CardBody>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Header, body and footer are each optional.
          </p>
        </CardBody>
        <CardFooter>
          <div class="flex justify-end gap-2">
            <Button variant="outline" size="sm">Dismiss</Button>
            <Button size="sm">Open</Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <h4 class="text-lg font-semibold">Raw header markup</h4>
          <span class="text-xs text-gray-500 dark:text-gray-400">children win</span>
        </CardHeader>
        <CardBody>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            A header with no <code>title</code> or <code>action</code> renders its children instead.
          </p>
        </CardBody>
      </Card>

      <Card class="sm:col-span-2">
        <CardHeader
          title={cardUser.name}
          action={<Button variant="ghost" size="sm">Edit</Button>}
        />
        <CardBody>
          <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt class="kpi-label">Email</dt>
              <dd>{cardUser.email}</dd>
            </div>
            <div>
              <dt class="kpi-label">Role</dt>
              <dd>{cardUser.role}</dd>
            </div>
            <div>
              <dt class="kpi-label">Invoices</dt>
              <dd>{recentInvoices.length}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  )
}

/**
 * `Progress` at either end of its range, plus the indeterminate state.
 *
 * The card proves three claims of the contract at once: the fill is an inline width, so the
 * server-rendered markup is already correct; a reading past `max` is clamped by `clampProgress`
 * rather than overflowing the track; and no reading renders no fill at all, with `aria-valuenow`
 * left off instead of published as `0`.
 */
function ProgressDemo() {
  const rows: Array<{ label: string; value: number | null; max?: number; note: string }> = [
    { label: "Determinate", value: 42, note: "42 of 100 — 42%" },
    { label: "Clamped", value: 140, note: "140 of 100 → the track is full, not overflowing" },
    { label: "Out of range", value: -20, note: "-20 of 100 → 0%, still measurable" },
    { label: "Fractional", value: 1, max: 3, note: "1 of 3 — floored to 33%, never 34%" },
    { label: "Indeterminate", value: null, note: "no aria-valuenow, no fill" },
  ]

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries(progressTones).map(([tone, label]) => (
          <Progress key={tone} id={`guide-progress-${tone}`} label={label} value={68} tone={tone} />
        ))}
      </div>
      <div class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        {rows.map((row) => (
          <div key={row.label} class="space-y-1">
            <Progress
              id={`guide-progress-${row.label.toLowerCase().replace(/\s+/g, "-")}`}
              label={row.label}
              value={row.value}
              max={row.max}
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">{row.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Sample scores, one per tier plus the out-of-range ends.
 *
 * `ConfidenceTier` is the banding `clampConfidence` computes rather than a prop, so the record
 * documents which value lands in which band instead of guarding an API.
 */
const scores: Record<string, { value: number; label: string }> = {
  low: { value: 12, label: "12 — low" },
  medium: { value: 55, label: "55 — medium" },
  high: { value: 88, label: "88 — high" },
  "below range": { value: -20, label: "-20 → 0" },
  "above range": { value: 140, label: "140 → 100" },
}

/** One meter per band, including both clamped ends. */
function ConfidenceMeterDemo() {
  return (
    <div class="space-y-3">
      {entries(scores).map(([key, score]) => (
        <ConfidenceMeter key={key} value={score.value} label={score.label} />
      ))}
    </div>
  )
}

/** Three rows and a net row, so the shell's header, body and footer slots are all in use. */
const tableRows = [
  { date: "2026-02-01", merchant: "Coffee & Co", status: false, amount: -450 },
  { date: "2026-02-02", merchant: "Salary transfer", status: true, amount: 450000 },
  { date: "2026-02-03", merchant: "Amazon purchase", status: false, amount: -12999 },
]

/** The caller owns every cell; the primitive owns the dividers, the hover and the scroll. */
function TableDemo() {
  return (
    <Table
      rowDataE2E="ui-guide-row"
      headerSlot={
        <>
          <th scope="col" class="text-left">Date</th>
          <th scope="col" class="text-left">Merchant</th>
          <th scope="col" class="text-center">Status</th>
          <th scope="col" class="text-right">Amount</th>
        </>
      }
      bodySlots={tableRows.map((row) => (
        <>
          <td class="whitespace-nowrap tabular-nums">{row.date}</td>
          <td class="whitespace-nowrap font-medium">{row.merchant}</td>
          <td class="whitespace-nowrap text-center">
            <Badge
              text={row.status ? "cleared" : "pending"}
              color={row.status ? "green" : "gray"}
            />
          </td>
          <td class="text-right tabular-nums">{row.amount}</td>
        </>
      ))}
      footerSlot={
        <tr class="text-sm font-medium">
          <td colspan={3} class="px-6 py-3 text-right">Net</td>
          <td class="px-6 py-3 text-right tabular-nums">
            {tableRows.reduce((total, row) => total + row.amount, 0)}
          </td>
        </tr>
      }
    />
  )
}

/** One row `amount` is `null`, so the demo also shows the #120 fix: a blank cell still sorts. */
const dataTableRows: DataTableInvoice[] = [
  { id: "inv-1", date: "2026-02-01", merchant: "Coffee & Co", amount: -450 },
  { id: "inv-2", date: "2026-02-02", merchant: "Salary transfer", amount: 450000 },
  { id: "inv-3", date: "2026-02-03", merchant: "Amazon purchase", amount: -12999 },
  { id: "inv-4", date: "2026-02-04", merchant: "Uncategorised transfer", amount: null },
  { id: "inv-5", date: "2026-02-05", merchant: "Rent", amount: -120000 },
]

interface DataTableInvoice {
  id: string
  date: string
  merchant: string
  amount: number | null
}

type DataTableSortKey = "date" | "merchant" | "amount"

/**
 * A sortable, paged `DataTable`: `sort` and `page` are the card's own signals, standing in for the
 * URL parameter or the store field an application would keep them in — `DataTable` holds neither
 * itself.
 *
 * The sort state is *not* round-tripped through this card's address bar; a plain signal stands in
 * for it here. A catalogue card writing to `location` would be writing to whatever host
 * application embeds the catalogue, not to a page this library owns, which is the same reason
 * `useUrlFilters` itself is demonstrated in `pages/src/url-filters.tsx` rather than as a card. The
 * URL round trip this component actually supports is demonstrated the same way, next to that demo:
 * `pages/src/data-table-sort.tsx` binds `?sort=` through `useUrlFilters`, and `pages/checks/ui.ts`
 * drives it in a browser.
 */
function DataTableDemo() {
  const sort = useSignal<SortRule<DataTableSortKey>[]>([])
  const page = useSignal(1)

  return (
    <div class="space-y-2">
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="data-table-sort">
        sort: {serializeSort(sort.value)}
      </p>
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
            render: (row) => row.amount === null ? "—" : String(row.amount),
          },
        ]}
        rows={dataTableRows}
        rowKey={(row) => row.id}
        sort={sort.value}
        onSortChange={(next) => sort.value = next}
        paging={{
          page: page.value,
          pageSize: 3,
          onChange: (next) => page.value = next,
          label: "Invoice pages",
        }}
      />
    </div>
  )
}

/** The tab ids of the horizontal demo, so the panel content and the ids cannot drift apart. */
const overviewTabs: readonly TabItem[] = [
  { id: "guide-tab-overview", label: "Overview", content: "Totals for the current period." },
  { id: "guide-tab-detail", label: "Detail", content: "Every row behind the totals." },
  {
    id: "guide-tab-archived",
    label: "Archived",
    content: "Rows hidden from the list.",
    disabled: true,
  },
  { id: "guide-tab-activity", label: "Activity", content: "Who changed what, and when." },
]

/** Every orientation the tablist accepts — the record is the coverage guard for `TabOrientation`. */
const tabOrientations: Record<TabOrientation, string> = {
  horizontal: "horizontal (default) — ArrowLeft / ArrowRight",
  vertical: "vertical — ArrowUp / ArrowDown",
}

/**
 * Controlled tabs: `active` in, `onChange` out.
 *
 * The panel of a tab is only visible once the browser applies `hidden`, and on a wide tablist the
 * panel sits below the row, so the card carries the ids and the state in text as well: the markup
 * shows every panel and the disabled tab, while which one is *selected* is the caller's signal.
 *
 * The keyboard half is browser-only. The decision table it runs is `nextTabIndex`, exported from the
 * component and unit-tested there; nothing in this repository presses an arrow key on a tablist.
 */
function TabsDemo() {
  const topLevel = useSignal<string>(overviewTabs[0].id)
  const settings = useSignal("guide-tab-profile")

  return (
    <div class="space-y-6">
      <div>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {tabOrientations.horizontal} · active: {topLevel.value}
        </p>
        <Tabs
          tabs={overviewTabs}
          active={topLevel.value}
          onChange={(id) => topLevel.value = id}
          label="Report views"
          tabDataE2E="guide-tab"
        />
        <div class="mt-2 flex flex-wrap gap-2">
          {overviewTabs.map((tab) => (
            <Button
              key={tab.id}
              variant={tab.id === topLevel.value ? "secondary" : "outline"}
              size="sm"
              disabled={tab.disabled}
              onClick={() => topLevel.value = tab.id}
            >
              {tab.label}
            </Button>
          ))}
          <span class="self-center text-xs text-gray-500 dark:text-gray-400">
            the buttons drive the same `onChange`, which is what a click on a tab does
          </span>
        </div>
      </div>

      <div class="max-w-xs">
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">{tabOrientations.vertical}</p>
        <Tabs
          tabs={[
            { id: "guide-tab-profile", label: "Profile", content: "Name, email, avatar." },
            { id: "guide-tab-security", label: "Security", content: "Password and sessions." },
            { id: "guide-tab-billing", label: "Billing", content: "Plan and invoices." },
          ]}
          active={settings.value}
          onChange={(id) => settings.value = id}
          orientation="vertical"
          label="Account settings"
        />
      </div>
    </div>
  )
}

/**
 * The page numbers a `Pagination` renders for one page, as its own text.
 *
 * `pageRange` is the component's collapsing rule, exported from it, so this is the arithmetic the
 * card prints rather than a second implementation of it: `…` for a collapsed run, and nothing at all
 * for a `pageCount` of `0`. Pure, so the claim is asserted in `sections/demo-decisions.test.ts`
 * instead of being trusted.
 *
 * @param page Current page, `1`-based.
 * @param pageCount Total pages.
 * @returns The rendered items, joined, e.g. `1 … 10 11 12 13 14 … 24`.
 */
export function paginationNote(page: number, pageCount: number): string {
  const items = pageRange(page, pageCount)

  return items.length === 0
    ? "nothing rendered"
    : items.map((item) => "page" in item ? String(item.page) : "…").join(" ")
}

/**
 * Two page ranges: one short enough to list whole, one long enough to collapse.
 *
 * The current page is the caller's state, so the card is a real pagination control: press a page
 * number, Previous or Next and the highlight moves. What the card also shows is the control that
 * *cannot* act staying where it is and going dim — page 1 keeps its Previous button, disabled, so
 * that paging to an end with the keyboard does not destroy the button under the user's finger —
 * and a `pageCount` of `0` rendering nothing at all, which the pair at the bottom demonstrates.
 */
function PaginationDemo() {
  const short = useSignal(1)
  const asked = useSignal(0)
  const long = useSignal(12)
  const empty = useSignal(1)

  return (
    <div class="space-y-6">
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          pageCount=5 · page {short.value}{" "}
          — Previous is disabled on page 1 and Next on the last page, and neither leaves the page,
          so a keyboard user keeps the control they were pressing: {paginationNote(short.value, 5)}
        </p>
        <Pagination
          page={short.value}
          pageCount={5}
          onChange={(page) => {
            asked.value = page
            short.value = page
          }}
          label="Five pages"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="pagination-requested">
          last page asked for through onChange: {asked.value === 0 ? "none yet" : asked.value}{" "}
          — a disabled control asks for nothing at all, which is the only way to tell it from one
          whose request the component clamped back to the page it was already on.
        </p>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          pageCount=24 · page {long.value}{" "}
          — the ends are always shown, the current page keeps two neighbours on each side, and a run
          nobody needs becomes an ellipsis, which never hides a single page:{" "}
          {paginationNote(long.value, 24)}
        </p>
        <Pagination
          page={long.value}
          pageCount={24}
          onChange={(page) => long.value = page}
          label="Twenty-four pages"
        />
      </div>

      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          pageCount=0 · page {empty.value} — an empty result set renders {paginationNote(
            empty.value,
            0,
          )}
        </p>
        <Pagination page={empty.value} pageCount={0} onChange={(page) => empty.value = page} />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Nothing above this line: `pageCount={0}` returns `null`, so a list that found no rows
          needs no special case at the call site.
        </p>
      </div>
    </div>
  )
}

/**
 * The three faces an avatar can take, at every size.
 *
 * `src` is the image face, a name alone is the initials face, and a name with no usable initial —
 * here the emoji, which `initials` strips to nothing — is the generic-icon face. Which one a given
 * pair of props selects is `avatarFace`, a pure function the component calls; what the card adds is
 * the picture.
 */
function AvatarDemo() {
  return (
    <div class="space-y-6">
      <div class="flex flex-wrap items-end gap-6">
        {entries(avatarSizes).map(([size, label]) => (
          <div key={size} class="space-y-2 text-center">
            <Avatar name="Ada Lovelace" size={size} />
            <p class="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div class="flex flex-wrap items-center gap-6">
        <div class="space-y-2 text-center">
          <Avatar name="Ada Lovelace" src={inlineAvatar} size="lg" />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            image — `src` set and not failed
          </p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar name="Grace Hopper" size="lg" />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            initials — from `name`, two at most
          </p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar name="😀" size="lg" />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            icon — no usable initial in the name
          </p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar name="Wang Xiaoming" size="lg" />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            initials — one per CJK character
          </p>
        </div>
        <div class="space-y-2 text-center">
          <Avatar src={inlineAvatar} alt="" size="lg" />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            `alt=""` — decorative, hidden from assistive tech
          </p>
        </div>
      </div>
    </div>
  )
}

/** Seven members, so `max` has something to count behind the chip. */
const teamMembers = [
  { name: "Ada Lovelace" },
  { name: "Grace Hopper" },
  { name: "Alan Turing" },
  { name: "Edsger Dijkstra" },
  { name: "Barbara Liskov" },
  { name: "Tony Hoare" },
  { name: "Margaret Hamilton" },
]

/**
 * The stack, at both ends of `max`.
 *
 * No overflow is the case worth having on the card as well as the overflowing one: the whole
 * `+N` chip is absent when nothing is behind it, rather than a hoverable `+0`. With seven members
 * and `max={4}` the chip reads `+3`, and the group's accessible name carries the total.
 */
function AvatarGroupDemo() {
  return (
    <div class="space-y-4">
      <div class="space-y-1">
        <AvatarGroup items={teamMembers.slice(0, 3)} label="Reviewers" />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `label="Reviewers"` · 3 members — no chip, because nothing overflows
        </p>
      </div>
      <div class="space-y-1">
        <AvatarGroup items={teamMembers} label="Project members" max={4} />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `max={4}` · 7 members — the chip counts the rest, and the group is named “Project members
          (7)”
        </p>
      </div>
      <div class="space-y-1">
        <AvatarGroup items={teamMembers} size="sm" />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `size="sm"` · no `label` — the accessible name falls back to “Avatars (7)”
        </p>
      </div>
    </div>
  )
}

/**
 * The value, the copy control and the live region.
 *
 * `CopyableTextBody` is the half that holds no state, so the demo drives it directly: `copied` is
 * false here, which is what an untouched card looks like, and the region is empty. `CopyableText`
 * owns that flag itself for `copiedForMs` and clears it, which is the only state either of them has.
 *
 * The clipboard itself is a port. Both the port and the click that fires it are browser-only — no
 * committed test clicks a copy control — so what the card asserts is the markup: one copy control
 * per value, the full value as its text, and the live region beside it.
 */
function CopyableTextDemo() {
  const copied = useSignal<string | null>(null)

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <CopyableText
          text="0192f7c1-4d5e-7a8b-9c0d-1e2f3a4b5c6d"
          copy={(text) => {
            copied.value = text
          }}
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          the port received: {copied.value ?? "nothing yet — copying needs a click"}
        </p>
      </div>

      <div class="max-w-64 space-y-2">
        <CopyableText
          text="a-very-long-identifier-that-does-not-fit-in-the-column-it-lives-in"
          truncate
          copyLabel="Copy reference"
          copiedLabel="Reference copied"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `truncate` clips the line only: the element keeps the whole value as its text, so its
          accessible name is the full string, and the title tooltip shows what the ellipsis ate.
        </p>
      </div>

      <div class="space-y-2">
        <CopyableTextBody
          text="BTC-USD-4h-2026-02"
          copied={false}
          onCopy={() => {}}
          copyLabel="Copy series key"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `CopyableTextBody` with `copied={false}` — the stateless half, whose props are assertable
          without a click.
        </p>
      </div>
    </div>
  )
}

/**
 * Supplementary hints.
 *
 * Every placement is rendered, because the anchor classes are the whole of the positioning: the
 * surface is `absolute` inside a `relative` wrapper and moves with one utility set. On the card the
 * hints are visible (`contentClass="opacity-100 visible"`), since a reveal needs a hover the
 * catalogue cannot perform on a reader's behalf; the class names printed on each row are what a
 * consumer gets without it.
 *
 * The two accessibility rules the component enforces are both visible here: `label` is on the
 * wrapper and is the trigger's name, while the tooltip text is only ever the description — and
 * `focusable={false}` swaps the `<button>` wrapper for a `role="group"` one, so an interactive
 * trigger keeps its own single tab stop.
 *
 * The last row is the exception, and the reason it exists: one hint left to reveal itself, so a
 * reader can hover it, keep the pointer on it and press Escape over it. `pages/checks/ui.ts`
 * drives that row, which is why it is wrapped in `data-e2e="tooltip-live"` — a forced-visible hint
 * could not tell a working reveal from a broken one.
 */
function TooltipDemo() {
  return (
    <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {entries(tooltipPlacements).map(([placement, label]) => (
        <div key={placement} class="space-y-2 text-center">
          <Tooltip
            content="Supplementary, never the trigger's only name"
            label={label}
            placement={placement}
            class="bg-gray-100 px-2 py-1 dark:bg-gray-700"
            contentClass="visible opacity-100"
          >
            <span class="text-sm">{placement}</span>
          </Tooltip>
          <p class="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      ))}
      <div class="col-span-2 space-y-2 sm:col-span-4">
        <Tooltip
          content="An interactive trigger keeps its own tab stop, so the wrapper drops its own"
          label="Archive the invoice"
          focusable={false}
          contentClass="visible opacity-100"
        >
          <button
            type="button"
            class="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <IconTrashBin class="size-4" />
            Archive
          </button>
        </Tooltip>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `focusable={false}` — with a {`<button>`}{" "}
          inside, a second tab stop for one control is a keyboard trap rather than a convenience.
        </p>
      </div>
      <div class="col-span-2 space-y-2 sm:col-span-4" data-e2e="tooltip-live">
        <Tooltip
          content="Escape hides this hint, and the pointer may rest on it while it is read"
          label="Delivery estimate"
          placement="bottom"
          class="bg-gray-100 px-2 py-1 dark:bg-gray-700"
        >
          <span class="text-sm">Hover me, or tab to me</span>
        </Tooltip>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          The one hint here that reveals itself. Point at it and it stays up while the pointer is on
          it, because the gap to it is the surface's own padding rather than dead space; press
          Escape and it goes without your focus moving, and comes back on the next hover or focus.
        </p>
      </div>
    </div>
  )
}

export const displayDemos = {
  PageTitle: {
    summary:
      "Page heading carrying the library's `h1` typography. `class` replaces the default utilities entirely, so spacing is the caller's call.",
    snippet: `<PageTitle>Transactions</PageTitle>
<PageTitle class="mb-2 text-xl">Nested detail</PageTitle>`,
    render: () => (
      <div class="space-y-4">
        <PageTitle>Transactions</PageTitle>
        <PageTitle class="mb-0 text-xl">Nested detail with an overridden scale</PageTitle>
      </div>
    ),
  },
  ConfidenceMeter: {
    summary:
      "Horizontal meter for a `0…100` score, banded into low / medium / high. Width is inline, so it is correct before hydration.",
    snippet: `<ConfidenceMeter value={88} label="match" />`,
    render: () => <ConfidenceMeterDemo />,
  },
  Table: {
    summary:
      "Table shell with header, body and optional footer slots. The primitive owns dividers, hover and horizontal scroll; the caller owns every cell.",
    snippet: `<Table
  headerSlot={<th scope="col">Merchant</th>}
  bodySlots={rows.map((row) => <td>{row.merchant}</td>)}
  footerSlot={<tr>…</tr>}
/>`,
    render: () => <TableDemo />,
  },
  DataTable: {
    summary:
      "`Table`'s markup joined to `table-state`'s sort rules: a sortable, optionally paged table with no sort or page state of its own — the caller owns `sort` and `paging.page`, so either can live in a signal or a URL parameter. Every sortable header is a real button; `aria-sort` carries the state, the chevron beside it is decorative. `caption` is required — it is the table's name, and only the caller knows it.",
    snippet: `<DataTable
  caption="Invoices"
  columns={[
    { key: "date", header: "Date", sortable: true },
    { key: "merchant", header: "Merchant", sortable: true },
    { key: "amount", header: "Amount", sortable: true, align: "right" },
  ]}
  rows={invoices}
  rowKey={(row) => row.id}
  sort={sort.value}
  onSortChange={(next) => sort.value = next}
  paging={{ page: page.value, pageSize: 3, onChange: (next) => page.value = next }}
/>`,
    render: () => <DataTableDemo />,
  },
  Card: {
    summary:
      "Card surface carrying the preset's `card` utility and nothing else — no padding or width opinion of its own. Header, body and footer are optional children, and a caller's `class` is merged after the preset's, so a later utility wins.",
    snippet: `<Card>
  <CardHeader title="Invoices" action={<Button size="sm">New</Button>} />
  <CardBody>…</CardBody>
  <CardFooter><Button variant="outline" size="sm">Dismiss</Button></CardFooter>
</Card>`,
    render: () => <CardDemo />,
  },
  CardHeader: {
    summary:
      "Card header in one of two mutually exclusive modes: `title` plus an optional right-aligned `action` slot, or raw `children`, which replace both. Mixing them is a type error rather than markup that silently drops half the header.",
    snippet: `<CardHeader title="Invoices" action={<Button size="sm">New</Button>} />

<CardHeader>
  <h4>Raw header markup</h4>
  <span>children win over title/action</span>
</CardHeader>`,
    render: () => <CardDemo />,
  },
  CardBody: {
    summary:
      "The content region of a card: the `card-body` utility and a slot, nothing more. There is no padding prop — a caller that wants different geometry passes utilities through `class`.",
    snippet: `<CardBody>
  <p>Header, body and footer are each optional.</p>
</CardBody>`,
    render: () => <CardDemo />,
  },
  CardFooter: {
    summary:
      "Divider-separated action row at the bottom of a card, normally holding a row of buttons. Like the header it is a slot, so a table footer or a caption goes in it just as well.",
    snippet: `<CardFooter>
  <div class="flex justify-end gap-2">
    <Button variant="outline" size="sm">Dismiss</Button>
    <Button size="sm">Open</Button>
  </div>
</CardFooter>`,
    render: () => <CardDemo />,
  },
  Progress: {
    summary:
      "Determinate progress bar, captioned or not; with no reading it renders a bare track and omits `aria-valuenow` rather than claiming `0`. Width is inline so the server render is already correct, and a reading outside `0…max` is clamped by `clampProgress`.",
    snippet: `<Progress id="upload" label="Upload" value={42} tone="success" />

// No reading yet: the honest indeterminate DOM, not a bar at zero.
<Progress value={undefined} />`,
    render: () => <ProgressDemo />,
  },
  Tabs: {
    summary:
      "Controlled tablist and panels: `active` in, `onChange` out, no state of its own. Every panel is rendered with the inactive ones `hidden` by default, so each `aria-controls` resolves; ids are derived from `TabItem.id` rather than generated. Arrow-key navigation is browser-only — its decision table is `nextTabIndex`, unit-tested in the component.",
    snippet: `<Tabs
  tabs={[
    { id: "overview", label: "Overview", content: <Overview /> },
    { id: "detail", label: "Detail", content: <Detail />, disabled: true },
  ]}
  active={view.value}
  onChange={(id) => view.value = id}
  orientation="vertical"
  label="Report views"
/>`,
    render: () => <TabsDemo />,
  },
  Pagination: {
    summary:
      "Page numbers with the long runs collapsed, plus previous/next. Controlled: `page` is rendered (clamped) and every request leaves through `onChange`. From two pages up, a control that cannot act stays where it is and carries `aria-disabled` — unmounting it, or disabling it natively, would take focus off the button a keyboard user is pressing. `pageCount={0}` renders nothing and `pageCount={1}` renders the one page with no controls, since neither can lose anybody their place. Every page number's name comes from `pageLabel`, which defaults to `Page N`.",
    snippet: `<Pagination page={page.value} pageCount={24} onChange={(page) => page.value = page} />

// An empty result set needs no special case at the call site.
<Pagination page={1} pageCount={0} onChange={() => {}} />`,
    render: () => <PaginationDemo />,
  },
  Avatar: {
    summary:
      'Round image with two fallbacks: the initials of `name`, then `IconUser` when the name yields no initial. `src` is used while it is set and has not errored, and a failure is remembered per URL — changing `src` clears it, so a dead URL can be replaced with a live one. `alt=""` makes the box decorative.',
    snippet: `<Avatar name="Ada Lovelace" size="lg" />
<Avatar name="Ada Lovelace" src={user.avatarUrl} />
<Avatar name="😀" />                        {/* no usable initial → the icon face */}
<Avatar src={user.avatarUrl} alt="" />       {/* named elsewhere in the row */}`,
    render: () => <AvatarDemo />,
  },
  AvatarGroup: {
    summary:
      'Overlapping stack of avatars with a `+N` chip for the rest. `max` decides how many fit and the chip counts the remainder, and it is absent when nothing overflows. The group is one labelled object — `role="group"`, members decorative — whose name from `label` carries the total.',
    snippet: `<AvatarGroup items={members} label="Project members" max={4} size="sm" />`,
    render: () => <AvatarGroupDemo />,
  },
  CopyableText: {
    summary:
      "Monospace value with an integrated copy control, plus a polite live region that announces the copy — `CopyButton` confirms by swapping its glyph, which reaches neither a screen reader nor an `aria-label`. `copiedForMs` (1500 default) is the only state it holds; the clipboard write is the `copy` port.",
    snippet: `<CopyableText text={invoice.id} />
<CopyableText
  text={reference}
  truncate
  copyLabel="Copy reference"
  copiedLabel="Reference copied"
  copy={app.clipboard.copy}
/>`,
    render: () => <CopyableTextDemo />,
  },
  CopyableTextBody: {
    summary:
      "The stateless body of `CopyableText`: the same value, copy control and live region with `copied` in and `onCopy` out, which is what makes the props it hands down — the copy port above all — assertable without a render that holds state.",
    snippet: `<CopyableTextBody
  text={seriesKey}
  copied={copied.value}
  onCopy={() => copied.value = true}
  copyLabel="Copy series key"
/>`,
    render: () => <CopyableTextDemo />,
  },
  Tooltip: {
    summary:
      "Supplementary hint revealed by hover and by keyboard focus, anchored with CSS only — no measurement, no scroll or resize listener. Escape dismisses a hint without moving focus, and the pointer can travel onto the hint and rest there, so it can be read under magnification. `label` is the trigger's own accessible name, carried by a `<button>` wrapper that may actually hold one, and the tooltip text is only ever its description; `focusable={false}` makes the wrapper a `role=\"group\"` instead, leaving the single tab stop to the caller's own control.",
    snippet: `<Tooltip content="Supplements the trigger" label="Total revenue" placement="right">
  <span>Revenue</span>
</Tooltip>

// Interactive children own the tab stop already:
<Tooltip content="Archive the invoice" label="Archive" focusable={false}>
  <button type="button">Archive</button>
</Tooltip>`,
    render: () => <TooltipDemo />,
  },
  ImageGallery: {
    summary:
      "A strip of thumbnails — real `<button>` elements, named by each image's `alt` — that opens `Lightbox` on the one pressed. `images` is `{ src, alt, thumbSrc? }`; `thumbSrc` is the thumbnail's own source and defaults to `src` when left out. An image whose `alt` is empty after trimming is dropped before render, not in the strip and not in the lightbox's sequence, and this is silent — `alt` is already required by the type, so an empty one only reaches this component through a caller that bypassed it.",
    snippet: `<ImageGallery
  images={[
    { src: hero, alt: "A hero shot" },
    { src: team, alt: "The team", thumbSrc: teamThumb },
  ]}
/>`,
    render: () => <ImageGalleryDemo />,
  },
  Lightbox: {
    summary:
      "The dialog `ImageGallery` and `system/image-lightbox.tsx`'s content mode both open: the current image, its `alt` as a caption, labelled previous/next, a \"3 of 8\" counter announced through a live region that is present whether the dialog is open or not. `images`, `index`, `open`, `onClose` and `onIndexChange` are all the caller's own state — built on a native `<dialog>` rather than `ui/Modal`, so a listener can be attached to the dialog itself for Left and Right; see the component's own doc for what about `Modal` did not fit. Escape and a backdrop click close it natively, and focus returns to whatever had it before the dialog opened.",
    snippet: `<Lightbox
  images={images}
  index={index}
  open={open}
  onClose={() => setOpen(false)}
  onIndexChange={setIndex}
/>`,
    render: () => <LightboxDemo />,
  },
} satisfies DemoFragment
