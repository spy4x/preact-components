/**
 * The `ui/` display primitives: the card anatomy, the meters, the tabbed and paged navigation, and
 * the identity widgets.
 *
 * Every card here renders its real markup. What only happens in a browser — `Tabs`' arrow keys,
 * `Pagination`'s next click, a copy through the clipboard — is driven by `pages/checks/ui.ts`; the
 * card shows the state after the decision, through the same port an app would pass.
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
  Cluster,
  ConfidenceMeter,
  CopyableText,
  CopyableTextBody,
  DataTable,
  describedImages,
  type Fact,
  FactCard,
  Grid,
  ImageGallery,
  type ImageGalleryImage,
  InstallBox,
  Lightbox,
  type LightboxImage,
  MarginNote,
  MoneyDisplay,
  pageRange,
  PageTitle,
  Pagination,
  Progress,
  type ProgressTone,
  Stack,
  type TabItem,
  Table,
  type TabOrientation,
  Tabs,
  Tooltip,
  type TooltipPlacement,
} from "@spy4x/preact-ui"
import { serializeSort, type SortRule } from "@spy4x/preact-signals/table-state"
import { useSignal } from "@preact/signals"
import { type ComponentChildren, Fragment } from "preact"
import { IconTrashBin } from "@spy4x/preact-icons"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/** A demo's small grey caption: what the example beside it shows, or a value a port received. */
function Note({ children, e2e }: { children: ComponentChildren; e2e?: string }) {
  return <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e={e2e}>{children}</p>
}

/**
 * A one-square image, inline so the catalogue needs no network and no asset directory.
 *
 * The `src` face of `Avatar` can only be exercised with something that loads, and a data URI is one
 * document with no request behind it. The glyph is a purple disc, which is visible at every avatar
 * size and is *not* the initials face.
 */
const inlineAvatar = `data:image/svg+xml,${
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#9333ea"/></svg>',
  )
}`

/**
 * A flat placeholder rectangle, as a data URI, so `ImageGallery` and `Lightbox`'s cards need no
 * image asset and no network.
 */
function placeholder(fill: string, width = 320, height = 200): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='%23${fill}'/%3E%3C/svg%3E`
}

/**
 * Four described images and one without a description in the middle of them, so the card shows
 * both halves of the contract: the strip and the lightbox page through the four described images,
 * and the middle one is what {@link describedImages} drops before render.
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
 * The third image, whose `alt` is whitespace, is passed in like the other four; the caption prints
 * the count `describedImages` keeps, so a fifth thumbnail would show the rule had stopped holding.
 */
function ImageGalleryDemo() {
  const shown = describedImages(galleryImages)

  return (
    <Stack gap="sm">
      <ImageGallery images={galleryImages} />
      <Note>
        {galleryImages.length} images passed in, {shown.length}{" "}
        shown: the one with a blank description is left out.
      </Note>
    </Stack>
  )
}

/** The three described images, for the standalone `Lightbox` card below. */
const lightboxImages: LightboxImage[] = galleryImages.slice(0, 3)

/** The one image {@link LightboxDemo}'s fourth button tries to open — undescribed, on purpose. */
const undescribedLightboxImage: LightboxImage = { src: placeholder("6b7280"), alt: "  " }

/**
 * `Lightbox` on its own, outside `ImageGallery`. The three buttons stand in for whatever trigger a
 * caller already has, each opening the dialog on a different position, so `index` and `open` are
 * visibly the caller's own state. The fourth button tries to open a second, separate `Lightbox` fed
 * one undescribed image, which refuses to open.
 */
function LightboxDemo() {
  const openIndex = useSignal<number | null>(null)
  const emptyOpen = useSignal(false)

  return (
    <Stack gap="sm">
      <Cluster>
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
        <Button
          variant="outline"
          size="sm"
          data-e2e="lightbox-empty-open"
          onClick={() => emptyOpen.value = true}
        >
          Open with no description
        </Button>
      </Cluster>
      <Lightbox
        images={lightboxImages}
        index={openIndex.value ?? 0}
        open={openIndex.value !== null}
        onClose={() => openIndex.value = null}
        onIndexChange={(next) => openIndex.value = next}
      />
      {
        /*
          `data-requested` records whether the fourth button was pressed, so the browser check can
          tell "the lightbox refused to open" from "the button did nothing"; both leave the dialog
          closed. `pages/checks/ui.ts` finds this dialog by the wrapper's `data-e2e`.
        */
      }
      <div data-e2e="lightbox-empty" data-requested={emptyOpen.value}>
        <Lightbox
          images={[undescribedLightboxImage]}
          index={0}
          open={emptyOpen.value}
          onClose={() => emptyOpen.value = false}
          onIndexChange={() => {}}
        />
      </div>
      <Note>
        The last button opens nothing: its one image has no description, so there is nothing to
        show.
      </Note>
    </Stack>
  )
}

/** Every size the primitive accepts — a size added to `AvatarSize` does not compile until shown. */
const avatarSizes: Record<AvatarSize, string> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
}

/** Every progress tone — the record is the coverage guard for `ProgressTone`. */
const progressTones: Record<ProgressTone, string> = {
  primary: "Primary",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
}

/** Every placement — the record is the coverage guard for `TooltipPlacement`. */
const tooltipPlacements: Record<TooltipPlacement, string> = {
  top: "top (default)",
  right: "right",
  bottom: "bottom",
  left: "left",
}

/** One card per mode of `CardHeader`: a title with an action, and the header's own markup. */
function CardHeaderDemo() {
  return (
    <Stack>
      <Card>
        <CardHeader title="Invoices" action={<Badge text="3 open" color="gray" />} />
      </Card>
      <Card>
        <CardHeader>
          <h4 class="text-lg font-semibold">Your own header</h4>
          <span class="text-xs text-gray-500 dark:text-gray-400">children</span>
        </CardHeader>
      </Card>
    </Stack>
  )
}

/** A card with all three parts, the way most cards are written. */
function CardDemo() {
  return (
    <Card>
      <CardHeader title="Ada Lovelace" action={<Button variant="ghost" size="sm">Edit</Button>} />
      <CardBody>
        <p class="text-sm text-gray-600 dark:text-gray-300">Administrator, since March 2026.</p>
      </CardBody>
      <CardFooter class="justify-end">
        <Button variant="outline" size="sm">Dismiss</Button>
        <Button size="sm">Open</Button>
      </CardFooter>
    </Card>
  )
}

/** `FactCard` with three facts. */
function FactCardDemo() {
  const facts: Fact[] = [
    { key: "Stack", value: "Deno + Hono + Fresh" },
    { key: "Hosting", value: "One Compose stack" },
    { key: "Status", value: "In production" },
  ]
  return <FactCard title="example.com" facts={facts} class="max-w-md" />
}

/**
 * `MarginNote` before a paragraph in a column marked `@container`, so the note's container query
 * has a column to measure. At most window widths this card's column is narrower than 30rem, so the
 * note sits inline; `pages/checks/ui.ts` sets the column's width itself to see it float, and reads
 * the column as the note's parent, with the paragraph a direct child of it.
 */
function MarginNoteDemo() {
  return (
    <div class="@container flow-root max-w-prose text-sm text-gray-600 dark:text-gray-300">
      <MarginNote
        sourceHref="https://example.com/benchmark"
        sourceLabel="Benchmark"
        checkedOn="2026-09-01"
      >
        Cold start under 50ms on a shared vCPU.
      </MarginNote>
      <p>
        The server answers from a single small process, so a cold start is cheap and a request that
        arrives after a quiet hour is served as quickly as the one before it. The note beside this
        paragraph says where that number comes from and when it was last checked.
      </p>
    </div>
  )
}

/**
 * `Progress` in every tone, then the two readings worth knowing: one past `max`, which fills the
 * track rather than overflowing it, and none at all, which draws a bare track.
 */
function ProgressDemo() {
  return (
    <Stack>
      {entries(progressTones).map(([tone, label]) => (
        <Progress key={tone} id={`guide-progress-${tone}`} label={label} value={68} tone={tone} />
      ))}
      <Progress id="guide-progress-clamped" label="Past the maximum (140 of 100)" value={140} />
      <Progress id="guide-progress-indeterminate" label="No reading yet" value={null} />
    </Stack>
  )
}

/** Scores in each band, and one past each end of the range. */
const scores: Record<string, { value: number; label: string }> = {
  low: { value: 12, label: "12, low" },
  medium: { value: 55, label: "55, medium" },
  high: { value: 88, label: "88, high" },
  "above range": { value: 140, label: "140, shown as 100" },
}

/** One meter per band, and one clamped. */
function ConfidenceMeterDemo() {
  return (
    <Stack gap="sm">
      {entries(scores).map(([key, score]) => (
        <ConfidenceMeter key={key} value={score.value} label={score.label} />
      ))}
    </Stack>
  )
}

/** Three currencies with a different decimal count each, plus one negative amount coloured. */
const moneyRows: { amount: number; currency: string; note: string; negative?: boolean }[] = [
  { amount: 12345, currency: "EUR", note: "two decimals" },
  { amount: 12345, currency: "JPY", note: "no decimals" },
  { amount: 12345, currency: "KWD", note: "three decimals" },
  { amount: -4599, currency: "EUR", note: "colorNegative", negative: true },
]

/** Each amount beside what it shows, in two aligned columns. */
function MoneyDisplayDemo() {
  return (
    <div class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
      {moneyRows.map((row) => (
        <Fragment key={`${row.currency}${row.amount}`}>
          <span class="text-right tabular-nums">
            <MoneyDisplay
              amount={row.amount}
              currency={row.currency}
              colorNegative={row.negative}
            />
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{row.note}</span>
        </Fragment>
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

/** One row's `amount` is `null`, so the demo also shows that a blank cell still sorts. */
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
 * URL parameter or the store field an application would keep them in.
 *
 * The sort is not written to the address bar here: a catalogue card writing to `location` would
 * write to whatever host embeds the catalogue. `pages/src/data-table-sort.tsx` binds `?sort=`
 * through `useUrlFilters`, and `pages/checks/ui.ts` drives both. That check reads the readout's
 * text as `sort: <rules>`.
 */
function DataTableDemo() {
  const sort = useSignal<SortRule<DataTableSortKey>[]>([])
  const page = useSignal(1)

  return (
    <Stack gap="sm">
      <Note e2e="data-table-sort">sort: {serializeSort(sort.value)}</Note>
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
    </Stack>
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
  horizontal: "Horizontal: the left and right arrows move between tabs.",
  vertical: "Vertical: the up and down arrows move between tabs.",
}

/** Controlled tabs, `active` in and `onChange` out, in both orientations side by side. */
function TabsDemo() {
  const topLevel = useSignal<string>(overviewTabs[0].id)
  const settings = useSignal("guide-tab-profile")

  return (
    <Grid gap="xl">
      <Stack gap="sm">
        <Note>{tabOrientations.horizontal}</Note>
        <Tabs
          tabs={overviewTabs}
          active={topLevel.value}
          onChange={(id) => topLevel.value = id}
          label="Report views"
          tabDataE2E="guide-tab"
        />
      </Stack>
      <Stack gap="sm">
        <Note>{tabOrientations.vertical}</Note>
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
      </Stack>
    </Grid>
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
 * Three page counts: one short enough to list whole, one long enough to collapse, and none.
 *
 * The first pager's readout is what `pages/checks/ui.ts` reads: it matches `onChange: <n>` there, so
 * a disabled control, which asks for nothing, is told apart from one that asked for its own page.
 */
function PaginationDemo() {
  const short = useSignal(1)
  const asked = useSignal(0)
  const long = useSignal(12)
  const empty = useSignal(1)

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Note>5 pages, on page {short.value}</Note>
        <Pagination
          page={short.value}
          pageCount={5}
          onChange={(page) => {
            asked.value = page
            short.value = page
          }}
          label="Five pages"
        />
        <Note e2e="pagination-requested">
          Last page asked for through onChange: {asked.value === 0 ? "none yet" : asked.value}
        </Note>
      </Stack>

      <Stack gap="sm">
        <Note>24 pages, on page {long.value}: {paginationNote(long.value, 24)}</Note>
        <Pagination
          page={long.value}
          pageCount={24}
          onChange={(page) => long.value = page}
          label="Twenty-four pages"
        />
      </Stack>

      <Stack gap="sm">
        <Note>0 pages: {paginationNote(empty.value, 0)}</Note>
        <Pagination page={empty.value} pageCount={0} onChange={(page) => empty.value = page} />
      </Stack>
    </Stack>
  )
}

/** One avatar and the caption under it, centred on each other. */
function Labelled({ caption, children }: { caption: string; children: ComponentChildren }) {
  return (
    <Stack gap="sm" class="items-center text-center">
      {children}
      <Note>{caption}</Note>
    </Stack>
  )
}

/**
 * Every size, then the faces an avatar can take: the image, the initials, and the icon when the
 * name gives no usable initial. Which face a pair of props selects is `avatarFace`, a pure function
 * the component calls; what the card adds is the picture.
 */
function AvatarDemo() {
  return (
    <Stack gap="lg">
      <Cluster align="end" gap="lg">
        {entries(avatarSizes).map(([size, label]) => (
          <Labelled key={size} caption={label}>
            <Avatar name="Ada Lovelace" size={size} />
          </Labelled>
        ))}
      </Cluster>
      <Cluster align="start" gap="lg">
        <Labelled caption="image">
          <Avatar name="Ada Lovelace" src={inlineAvatar} size="lg" />
        </Labelled>
        <Labelled caption="initials">
          <Avatar name="Grace Hopper" size="lg" />
        </Labelled>
        <Labelled caption="CJK initials">
          <Avatar name="王小明" size="lg" />
        </Labelled>
        <Labelled caption="no initial: icon">
          <Avatar name="😀" size="lg" />
        </Labelled>
        <Labelled caption={`alt="": decorative`}>
          <Avatar src={inlineAvatar} alt="" size="lg" />
        </Labelled>
      </Cluster>
    </Stack>
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
 * The stack with nothing to overflow, and with the rest counted: with seven members and `max={4}`
 * the chip reads `+3`, and the group's accessible name carries the total.
 */
function AvatarGroupDemo() {
  return (
    <Stack>
      <Stack gap="xs">
        <AvatarGroup items={teamMembers.slice(0, 3)} label="Reviewers" />
        <Note>3 members: nothing overflows, so no count</Note>
      </Stack>
      <Stack gap="xs">
        <AvatarGroup items={teamMembers} label="Project members" max={4} />
        <Note>7 members, max 4: the chip counts the other 3</Note>
      </Stack>
      <Stack gap="xs">
        <AvatarGroup items={teamMembers} size="sm" />
        <Note>size "sm"</Note>
      </Stack>
    </Stack>
  )
}

/** A plain value copied through a port the card watches, and a long one truncated. */
function CopyableTextDemo() {
  const copied = useSignal<string | null>(null)

  return (
    <Stack>
      <CopyableText
        text="0192f7c1-4d5e-7a8b-9c0d-1e2f3a4b5c6d"
        copy={(text) => {
          copied.value = text
        }}
      />
      <div class="max-w-64">
        <CopyableText
          text="a-very-long-identifier-that-does-not-fit-in-the-column-it-lives-in"
          truncate
          copyLabel="Copy reference"
          copiedLabel="Reference copied"
        />
      </div>
      <Note>copy port received: {copied.value ?? "nothing yet"}</Note>
    </Stack>
  )
}

/** `CopyableTextBody` with its copied flag held by the card instead of by the component. */
function CopyableTextBodyDemo() {
  const copied = useSignal(false)

  return (
    <Stack>
      <CopyableTextBody
        text="BTC-USD-4h-2026-02"
        copied={copied.value}
        onCopy={() => copied.value = true}
        copyLabel="Copy series key"
      />
      <Cluster>
        <Note>copied: {copied.value ? "yes" : "no"}</Note>
        <Button variant="outline" size="sm" onClick={() => copied.value = false}>
          Reset
        </Button>
      </Cluster>
    </Stack>
  )
}

/**
 * Every placement with its hint pinned open, then an interactive trigger, then one hint left to
 * reveal itself.
 *
 * The pinned hints use `contentClass="opacity-100 visible"`, since a reveal needs a hover the
 * catalogue cannot perform for a reader. Each placement cell keeps room above and below its trigger
 * for a top or bottom hint, and `pages/checks/ui-guide.ts` asserts that no hint covers a trigger.
 *
 * The last row, `data-e2e="tooltip-live"`, is the one `pages/checks/ui.ts` hovers, keeps the pointer
 * on and presses Escape over: a hint pinned open could not tell a working reveal from a broken one.
 */
function TooltipDemo() {
  return (
    <Stack gap="xl">
      <div class="grid grid-cols-1 gap-x-6 sm:grid-cols-4">
        {entries(tooltipPlacements).map(([placement, label]) => (
          <div
            key={placement}
            class="flex flex-col items-center gap-12 pt-12 pb-4 text-center"
            data-e2e="tooltip-placement"
          >
            <Tooltip
              content="Hint"
              label={label}
              placement={placement}
              class="bg-gray-100 px-2 py-1 dark:bg-gray-700"
              contentClass="visible opacity-100"
            >
              <span class="text-sm">{placement}</span>
            </Tooltip>
            <Note>{label}</Note>
          </div>
        ))}
      </div>
      <Grid>
        <Stack gap="sm" class="items-center pt-16 text-center">
          <Tooltip
            content="The button keeps its own tab stop"
            label="Archive the invoice"
            focusable={false}
            contentClass="visible max-w-48 opacity-100"
          >
            <Button variant="outline" size="sm">
              <IconTrashBin class="size-4" />
              Archive
            </Button>
          </Tooltip>
          <Note>focusable=false, around a button</Note>
        </Stack>
        <Stack gap="sm" class="items-center text-center" data-e2e="tooltip-live">
          <Tooltip
            content="Escape hides this hint, and the pointer may rest on it while it is read"
            label="Delivery estimate"
            placement="bottom"
            class="bg-gray-100 px-2 py-1 dark:bg-gray-700"
            contentClass="max-w-48"
          >
            <span class="text-sm">Hover me, or tab to me</span>
          </Tooltip>
        </Stack>
      </Grid>
    </Stack>
  )
}

export const displayDemos = {
  PageTitle: {
    summary: "The page's main heading, in the library's `h1` style and with no margin of its own.",
    wide: false,
    snippet: `<Stack>
  <PageTitle>Transactions</PageTitle>
  <PageTitle class="text-xl sm:text-xl">Nested detail</PageTitle>
</Stack>`,
    render: () => (
      <Stack>
        <PageTitle>Transactions</PageTitle>
        <PageTitle class="text-xl sm:text-xl">Nested detail, at a smaller size</PageTitle>
      </Stack>
    ),
  },
  MoneyDisplay: {
    summary:
      "Shows an amount kept in a currency's smallest unit, with that currency's own decimals.",
    wide: false,
    snippet: `<MoneyDisplay amount={12345} currency="EUR" />
<MoneyDisplay amount={-4599} currency="EUR" colorNegative />`,
    render: () => <MoneyDisplayDemo />,
  },
  ConfidenceMeter: {
    summary: "A bar for a score from 0 to 100 that also says whether it is low, medium or high.",
    wide: false,
    snippet: `<ConfidenceMeter value={88} label="match" />`,
    render: () => <ConfidenceMeterDemo />,
  },
  Progress: {
    summary:
      "A progress bar with an optional caption, which draws a bare track while there is no reading.",
    wide: false,
    props: [
      {
        name: "value",
        type: "number | null",
        description: "The reading; kept between 0 and `max`, and none draws a bare track.",
      },
      { name: "max", type: "number", default: "100", description: "The value of a full bar." },
      {
        name: "tone",
        type: `"primary" | "success" | "warning" | "danger"`,
        default: `"primary"`,
        description: "The bar's colour.",
      },
      {
        name: "label",
        type: "string",
        description: "A caption above the bar; it needs an `id` beside it.",
      },
    ],
    snippet: `<Progress id="upload" label="Upload" value={42} tone="success" />
<Progress value={null} />`,
    render: () => <ProgressDemo />,
  },
  Table: {
    summary:
      "The frame of a data table: you write the cells, it draws the dividers, the hover and the scroll.",
    wide: true,
    props: [
      {
        name: "headerSlot",
        type: "ComponentChildren",
        description: "The header row's cells.",
      },
      {
        name: "bodySlots",
        type: "ComponentChildren[]",
        description: "One entry per row, each that row's cells.",
      },
      {
        name: "footerSlot",
        type: "ComponentChildren",
        description: "Whole footer rows, such as a total.",
      },
      {
        name: "caption",
        type: "ComponentChildren",
        description: "The table's name.",
      },
    ],
    snippet: `<Table
  headerSlot={<th scope="col">Merchant</th>}
  bodySlots={rows.map((row) => <td>{row.merchant}</td>)}
  footerSlot={<tr>…</tr>}
/>`,
    render: () => <TableDemo />,
  },
  DataTable: {
    summary:
      "A table whose columns sort and whose rows page, while you keep the sort and the page.",
    wide: true,
    props: [
      {
        name: "caption",
        type: "string",
        description: "The table's name, which only you know, so it is required.",
      },
      {
        name: "columns",
        type: "DataTableColumn[]",
        description: "Each column's key, header, alignment and whether it sorts.",
      },
      {
        name: "sort",
        type: "SortRule[]",
        description: "The current sort, with `onSortChange` to change it.",
      },
      {
        name: "paging",
        type: "{ page, pageSize, onChange }",
        description: "Pages the rows when given; left out, every row shows.",
      },
      {
        name: "rowKey",
        type: "(row) => string | number",
        description: "A stable key for each row.",
      },
    ],
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
    summary: "A surface that groups related content, with an optional header, body and footer.",
    wide: false,
    snippet: `<Card>
  <CardHeader title="Invoices" action={<Button size="sm">New</Button>} />
  <CardBody>…</CardBody>
  <CardFooter><Button variant="outline" size="sm">Dismiss</Button></CardFooter>
</Card>`,
    render: () => <CardDemo />,
  },
  CardHeader: {
    summary: "A card's top row: a title with an optional action, or your own markup instead.",
    wide: false,
    snippet: `<CardHeader title="Invoices" action={<Badge text="3 open" />} />

<CardHeader>
  <h4>Your own header</h4>
</CardHeader>`,
    render: () => <CardHeaderDemo />,
  },
  CardBody: {
    summary: "The padded content area of a card.",
    wide: false,
    snippet: `<Card>
  <CardBody>
    <p>Header, body and footer are each optional.</p>
  </CardBody>
</Card>`,
    render: () => (
      <Card>
        <CardBody>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Header, body and footer are each optional.
          </p>
        </CardBody>
      </Card>
    ),
  },
  CardFooter: {
    summary: "A row under a card's content, divided from it by a line, usually for its buttons.",
    wide: false,
    snippet: `<CardFooter class="justify-end">
  <Button variant="outline" size="sm">Dismiss</Button>
  <Button size="sm">Open</Button>
</CardFooter>`,
    render: () => (
      <Card>
        <CardBody>
          <p class="text-sm text-gray-600 dark:text-gray-300">Save the draft before you leave?</p>
        </CardBody>
        <CardFooter class="justify-end">
          <Button variant="outline" size="sm">Dismiss</Button>
          <Button size="sm">Save</Button>
        </CardFooter>
      </Card>
    ),
  },
  FactCard: {
    summary: "A card that lists facts as pairs of a label and a value.",
    wide: false,
    snippet: `<FactCard
  title="example.com"
  facts={[
    { key: "Stack", value: "Deno + Hono + Fresh" },
    { key: "Status", value: <StatusMark status="ready" /> },
  ]}
/>`,
    render: () => <FactCardDemo />,
  },
  MarginNote: {
    summary:
      "A short aside next to a paragraph, with an optional source link and the date it was checked.",
    wide: false,
    props: [
      { name: "sourceHref", type: "string", description: "Where the claim comes from." },
      { name: "sourceLabel", type: "string", description: "The source link's text." },
      {
        name: "checkedOn",
        type: "string",
        description: "The date the claim was checked, as `YYYY-MM-DD`.",
      },
    ],
    snippet: `<div class="@container flow-root">
  <MarginNote sourceHref={benchmarkUrl} sourceLabel="Benchmark" checkedOn="2026-09-01">
    Cold start under 50ms on a shared vCPU.
  </MarginNote>
  <p>The paragraph the note sits beside.</p>
</div>`,
    render: () => <MarginNoteDemo />,
  },
  CopyableText: {
    summary:
      "A value in monospace with a copy button, which also tells a screen reader it was copied.",
    wide: false,
    props: [
      { name: "text", type: "string", description: "The value shown and copied." },
      {
        name: "truncate",
        type: "boolean",
        default: "false",
        description: "Cuts a long value to one line; the whole value is still copied.",
      },
      {
        name: "copy",
        type: "(text) => void",
        default: "the clipboard",
        description: "Replaces the clipboard.",
      },
      {
        name: "copyLabel",
        type: "string",
        default: `"Copy"`,
        description: "The copy button's name.",
      },
    ],
    snippet: `<CopyableText text={invoice.id} />
<CopyableText text={reference} truncate copyLabel="Copy reference" />`,
    render: () => <CopyableTextDemo />,
  },
  AvatarGroup: {
    summary: "Overlapping avatars of a group, with a count for the ones that do not fit.",
    wide: false,
    props: [
      { name: "items", type: "{ name, src? }[]", description: "The members." },
      {
        name: "max",
        type: "number",
        default: "4",
        description: "How many avatars show before the count.",
      },
      {
        name: "label",
        type: "string",
        default: `"Avatars"`,
        description: "The group's name; the member count is added to it.",
      },
    ],
    snippet: `<AvatarGroup items={members} label="Project members" max={4} size="sm" />`,
    render: () => <AvatarGroupDemo />,
  },
  CopyableTextBody: {
    summary: "`CopyableText` without its own state, for when you keep the copied flag yourself.",
    wide: false,
    snippet: `<CopyableTextBody
  text={seriesKey}
  copied={copied.value}
  onCopy={() => copied.value = true}
  copyLabel="Copy series key"
/>`,
    render: () => <CopyableTextBodyDemo />,
  },
  InstallBox: {
    summary: "A one-line command with a copy button, for install instructions.",
    wide: false,
    snippet: `<InstallBox command="deno add jsr:@spy4x/preact-ui" />`,
    render: () => <InstallBox command="deno add jsr:@spy4x/preact-ui" class="max-w-sm" />,
  },
  Avatar: {
    summary: "A round picture of a person that falls back to their initials, then to an icon.",
    wide: true,
    props: [
      {
        name: "name",
        type: "string",
        description: "Whose avatar it is; the initials come from it.",
      },
      {
        name: "src",
        type: "string",
        description: "The picture; a failed load shows the initials.",
      },
      {
        name: "size",
        type: `"xs" | "sm" | "md" | "lg"`,
        default: `"md"`,
        description: "The avatar's diameter.",
      },
      {
        name: "alt",
        type: "string",
        default: "name",
        description: "Its accessible name; an empty string hides it from screen readers.",
      },
    ],
    snippet: `<Avatar name="Ada Lovelace" size="lg" />
<Avatar name="Ada Lovelace" src={user.avatarUrl} />
<Avatar src={user.avatarUrl} alt="" />`,
    render: () => <AvatarDemo />,
  },
  Tabs: {
    summary: "Tabs that switch between panels, in a row or a column, with the arrow keys.",
    wide: true,
    props: [
      {
        name: "tabs",
        type: "TabItem[]",
        description: "Each tab's id, label, panel content and whether it is disabled.",
      },
      {
        name: "active",
        type: "string",
        description: "The selected tab's id, with `onChange` to change it.",
      },
      {
        name: "orientation",
        type: `"horizontal" | "vertical"`,
        default: `"horizontal"`,
        description: "A row of tabs, or a column.",
      },
      { name: "label", type: "string", description: "The tab list's accessible name." },
    ],
    snippet: `<Tabs
  tabs={[
    { id: "overview", label: "Overview", content: <Overview /> },
    { id: "detail", label: "Detail", content: <Detail />, disabled: true },
  ]}
  active={view.value}
  onChange={(id) => view.value = id}
  label="Report views"
/>`,
    render: () => <TabsDemo />,
  },
  Pagination: {
    summary:
      "Page numbers with previous and next buttons, a long run of pages shortened to an ellipsis.",
    wide: true,
    props: [
      { name: "page", type: "number", description: "The current page, counted from 1." },
      { name: "pageCount", type: "number", description: "How many pages; 0 renders nothing." },
      {
        name: "onChange",
        type: "(page: number) => void",
        description: "Called with the page a reader asks for.",
      },
      {
        name: "label",
        type: "string",
        default: `"Pagination"`,
        description: "The navigation's accessible name.",
      },
    ],
    snippet:
      `<Pagination page={page.value} pageCount={24} onChange={(next) => page.value = next} />`,
    render: () => <PaginationDemo />,
  },
  Tooltip: {
    summary: "A short hint that appears when its trigger is hovered or focused.",
    wide: true,
    props: [
      { name: "content", type: "ComponentChildren", description: "The hint." },
      { name: "label", type: "string", description: "The trigger's accessible name." },
      {
        name: "placement",
        type: `"top" | "right" | "bottom" | "left"`,
        default: `"top"`,
        description: "Which side of the trigger the hint appears on.",
      },
      {
        name: "focusable",
        type: "boolean",
        default: "true",
        description: "Pass `false` when the trigger is already a button or a link.",
      },
    ],
    snippet: `<Tooltip content="Supplements the trigger" label="Total revenue" placement="right">
  <span>Revenue</span>
</Tooltip>

<Tooltip content="Archive the invoice" label="Archive" focusable={false}>
  <button type="button">Archive</button>
</Tooltip>`,
    render: () => <TooltipDemo />,
  },
  ImageGallery: {
    summary: "A row of thumbnails that opens each image full size in a lightbox.",
    wide: true,
    snippet: `<ImageGallery
  images={[
    { src: hero, alt: "A hero shot" },
    { src: team, alt: "The team", thumbSrc: teamThumb },
  ]}
/>`,
    render: () => <ImageGalleryDemo />,
  },
  Lightbox: {
    summary: "A dialog that shows one image of a set at a time, with previous and next.",
    wide: true,
    props: [
      { name: "images", type: "LightboxImage[]", description: "The set, each with its `alt`." },
      { name: "index", type: "number", description: "The image showing." },
      {
        name: "open",
        type: "boolean",
        description: "Whether the dialog is open, with `onClose` to close it.",
      },
      {
        name: "onIndexChange",
        type: "(index: number) => void",
        description: "Called when the reader moves to another image.",
      },
    ],
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
