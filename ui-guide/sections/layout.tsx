/**
 * The `ui/` layout components: how a page puts space between its parts.
 *
 * No component in the library carries an outer margin, so every gap on a page comes from one of
 * these five and its named `gap`. The boxes inside each card are plain placeholders, dashed so the
 * gap between them is what the eye reads.
 */

import { Button, Card, CardBody, Cluster, Grid, Page, Section, Stack } from "@spy4x/preact-ui"
import type { DemoFragment } from "../registry.ts"

/** A dashed placeholder, so the space around it is what the demo shows. */
function Box({ children }: { children: string }) {
  return (
    <div class="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
      {children}
    </div>
  )
}

export const layoutDemos = {
  Stack: {
    summary:
      "Children in a column, a named `gap` apart: `none`, `xs` (4 px), `sm` (8 px), `md` (16 px, the default), `lg` (24 px), `xl` (32 px) or `2xl` (48 px). `as` picks the element and `class` adds anything that is not spacing.",
    snippet: `<Stack gap="sm">
  <Field id="name" label="Name"><Input id="name" /></Field>
  <Field id="email" label="Email"><Input id="email" type="email" /></Field>
</Stack>`,
    render: () => (
      <Cluster align="start" gap="xl">
        <Stack gap="sm">
          <Box>gap="sm"</Box>
          <Box>8 px apart</Box>
          <Box>fields of a form</Box>
        </Stack>
        <Stack>
          <Box>gap="md"</Box>
          <Box>16 px apart</Box>
          <Box>the default</Box>
        </Stack>
        <Stack gap="xl">
          <Box>gap="xl"</Box>
          <Box>32 px apart</Box>
          <Box>sections of a page</Box>
        </Stack>
      </Cluster>
    ),
  },
  Cluster: {
    summary:
      "Children in a row that wraps, a named `gap` apart (`sm` by default), for toolbars, button rows and tags. `align` lines them up across the row (`center` by default) and `justify` places them along it (`start`, `center`, `end` or `between`).",
    snippet: `<Cluster justify="between">
  <h2 class="h3">Invoices</h2>
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
  Grid: {
    summary:
      "Equal columns that fill the width: as many as fit at `minColumnWidth` (`sm` 12 rem, `md` 16 rem by default, `lg` 20 rem), a named `gap` apart. A short last row stretches instead of leaving holes, and one column never overflows a phone.",
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
      "The content column of a page: centred, at most `max-w-6xl`, with the page gutter (16 px on a phone, 24 px from `sm`, 32 px from `lg`) and 32 px between its sections. It renders a `div` unless `as` says otherwise, since the host shell usually owns `<main>`. It replaces the deprecated `page-layout` class.",
    snippet: `<Page>
  <PageTitle>Billing</PageTitle>
  <Section title="Invoices">…</Section>
  <Section title="Payment methods">…</Section>
</Page>`,
    render: () => (
      <div class="rounded-md bg-gray-50 dark:bg-gray-900">
        <Page>
          <Box>page title</Box>
          <Box>first section</Box>
          <Box>second section</Box>
        </Page>
      </div>
    ),
  },
  Section: {
    summary:
      "A titled block of a page: an optional heading (`h2` by default, `headingLevel` for `h3` or `h4`) and description, then its children, with fixed gaps — 4 px under the heading, 16 px between the header and each child. A titled section is named by its heading, so a screen reader can jump to it.",
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
          <Box>Company card</Box>
          <Box>Backup card</Box>
        </Grid>
      </Section>
    ),
  },
} satisfies DemoFragment
