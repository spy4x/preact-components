import { Badge, ConfidenceMeter, PageTitle, Table } from "@preact-components/ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

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

function ConfidenceMeterDemo() {
  return (
    <div class="space-y-3">
      {entries(scores).map(([key, score]) => (
        <ConfidenceMeter key={key} value={score.value} label={score.label} />
      ))}
    </div>
  )
}

const rows = [
  { date: "2026-02-01", merchant: "Coffee & Co", status: false, amount: -450 },
  { date: "2026-02-02", merchant: "Salary transfer", status: true, amount: 450000 },
  { date: "2026-02-03", merchant: "Amazon purchase", status: false, amount: -12999 },
]

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
      bodySlots={rows.map((row) => (
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
            {rows.reduce((total, row) => total + row.amount, 0)}
          </td>
        </tr>
      }
    />
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
} satisfies DemoFragment<"ConfidenceMeter" | "PageTitle" | "Table">
