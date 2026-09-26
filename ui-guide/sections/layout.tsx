/**
 * The `ui/` layout components: how a page puts space between its parts.
 *
 * No component in the library carries an outer margin, so every gap on a page comes from one of
 * these five and its named `gap`. The tiles inside each card are plain placeholders, tinted and
 * unbordered, so the space between them is what the eye reads and no card shows a box in a box.
 */

import { Button, Card, CardBody, Cluster, Grid, Page, Section, Stack } from "@spy4x/preact-ui"
import type { SpacingGap } from "@spy4x/preact-theme/spacing"
import type { DemoFragment } from "../registry.ts"

/** A tinted placeholder, so the space around it is what the demo shows. */
function Tile({ children }: { children: string }) {
  return (
    <div class="rounded-md bg-purple-100 px-3 py-2 text-sm text-purple-900 dark:bg-purple-900/40 dark:text-purple-100">
      {children}
    </div>
  )
}

/** The three gaps the `Stack` card sets side by side, each with what it is for. */
const stackGaps: readonly { gap: SpacingGap; size: string; use: string }[] = [
  { gap: "sm", size: "8 px", use: "buttons stacked on a phone" },
  { gap: "md", size: "16 px", use: "the fields of a form" },
  { gap: "xl", size: "32 px", use: "the sections of a page" },
]

/** The named gaps, as the props tables of the three layout components state them. */
const GAP_TYPE = `"none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl"`

export const layoutDemos = {
  Stack: {
    summary: "Puts its children in a column, a named gap apart.",
    wide: true,
    props: [
      {
        name: "gap",
        type: GAP_TYPE,
        default: `"md"`,
        description: "The space between the children, from 0 to 48 px.",
      },
      {
        name: "as",
        type: `"div" | "section" | "ul" | …`,
        default: `"div"`,
        description: "The element it renders.",
      },
    ],
    snippet: `<Stack>
  <Field id="name" label="Name"><Input id="name" /></Field>
  <Field id="email" label="Email"><Input id="email" type="email" /></Field>
</Stack>`,
    render: () => (
      <Grid minColumnWidth="sm" gap="xl">
        {stackGaps.map(({ gap, size, use }) => (
          <Stack key={gap} gap={gap}>
            <Tile>{`gap="${gap}"`}</Tile>
            <Tile>{`${size} apart`}</Tile>
            <Tile>{use}</Tile>
          </Stack>
        ))}
      </Grid>
    ),
  },
  Cluster: {
    summary: "Puts its children in a row that wraps: a toolbar, a row of buttons, a list of tags.",
    wide: false,
    props: [
      {
        name: "gap",
        type: GAP_TYPE,
        default: `"sm"`,
        description: "The space between the children, across and down.",
      },
      {
        name: "align",
        type: `"start" | "center" | "end" | "baseline" | "stretch"`,
        default: `"center"`,
        description: "How the children line up across the row.",
      },
      {
        name: "justify",
        type: `"start" | "center" | "end" | "between"`,
        default: `"start"`,
        description: "Where the children sit along the row.",
      },
    ],
    snippet: `<Cluster justify="between">
  <h4 class="h3">Invoices</h4>
  <Cluster>
    <Button variant="secondary">Export</Button>
    <Button>New invoice</Button>
  </Cluster>
</Cluster>`,
    render: () => (
      <Cluster justify="between">
        <h4 class="h3">Invoices</h4>
        <Cluster>
          <Button variant="secondary">Export</Button>
          <Button>New invoice</Button>
        </Cluster>
      </Cluster>
    ),
  },
  Section: {
    summary: "A titled block of a page: a heading, an optional description, then its content.",
    wide: false,
    props: [
      { name: "title", type: "string", description: "The heading, which also names the section." },
      { name: "description", type: "ComponentChildren", description: "A line under the heading." },
      {
        name: "headingLevel",
        type: "2 | 3 | 4",
        default: "2",
        description: "The heading's level, and its size.",
      },
      {
        name: "as",
        type: `"section" | "article" | "aside" | "div"`,
        default: `"section"`,
        description: "The element it renders; a `div` is not a landmark.",
      },
    ],
    snippet: `<Section title="Payment methods" description="Cards we can charge." headingLevel={4}>
  <Grid>…</Grid>
</Section>`,
    render: () => (
      <Section
        title="Payment methods"
        description="Cards we can charge for this workspace."
        headingLevel={4}
      >
        <Grid minColumnWidth="sm">
          <Tile>Company card</Tile>
          <Tile>Backup card</Tile>
        </Grid>
      </Section>
    ),
  },
  Grid: {
    summary: "Lays its children out in equal columns, as many as fit the width.",
    wide: true,
    props: [
      {
        name: "minColumnWidth",
        type: `"sm" | "md" | "lg"`,
        default: `"md"`,
        description: "The narrowest a column gets: 12, 16 or 20 rem.",
      },
      {
        name: "gap",
        type: GAP_TYPE,
        default: `"md"`,
        description: "The space between the cells, across and down.",
      },
    ],
    snippet: `<Grid minColumnWidth="sm">
  <Card>…</Card>
  <Card>…</Card>
  <Card>…</Card>
</Grid>`,
    render: () => (
      <Grid minColumnWidth="sm">
        {["Revenue", "Customers", "Refunds", "Churn", "Trials"].map((name) => (
          <Card key={name}>
            <CardBody>{name}</CardBody>
          </Card>
        ))}
      </Grid>
    ),
  },
  Page: {
    summary:
      "The content column of a page: centred, with the page's side gutter and room between its sections.",
    wide: true,
    snippet: `<Page>
  <PageTitle>Billing</PageTitle>
  <Section title="Invoices">…</Section>
  <Section title="Payment methods">…</Section>
</Page>`,
    render: () => (
      <Page>
        <Tile>page title</Tile>
        <Tile>first section</Tile>
        <Tile>second section</Tile>
      </Page>
    ),
  },
} satisfies DemoFragment
