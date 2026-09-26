# Spacing

Spacing in this library is a small fixed scale that the library owns. Components come with their
spacing already set, and a page is put together from layout components with a named gap, never from
margins picked one element at a time. Follow this page and two pages built from the same parts look
alike.

## The scale

Padding, margin, gap, `space-x`/`space-y` and scroll margin/padding classes use only these steps,
with any variant prefix and an optional leading `-`:

| Step | Size  | Typical use                                                  |
| ---- | ----- | ------------------------------------------------------------ |
| `0`  | 0     | clearing a default                                           |
| `px` | 1 px  | a hairline offset, the padding of a tiny counter             |
| `1`  | 4 px  | an icon and its label, a label and its hint                  |
| `2`  | 8 px  | the inside of a small control, buttons in a row              |
| `3`  | 12 px | the inside of an input or a compact card                     |
| `4`  | 16 px | the inside of a card, the fields of a form, the phone gutter |
| `6`  | 24 px | cards in a list, the gutter from `sm`                        |
| `8`  | 32 px | sections of a page, the gutter from `lg`                     |
| `12` | 48 px | a large break, such as above a page footer                   |
| `16` | 64 px | the edge of a hero or an empty page                          |

Arbitrary values (`p-[13px]`, `gap-(--x)`) are not allowed for spacing. Sizes and positions (`h-12`,
`size-9`, `top-5`, `inset-2`, `max-w-6xl`) are not spacing, and the scale does not restrict them.
Something that is not a step, such as a phone's safe-area inset, gets a named utility in
`theme/preset.css` (`pb-safe`, `pb-safe-3`) instead of an arbitrary value in a component.

The scale is exported as `SPACING_STEPS` from `@spy4x/preact-theme/spacing`.

## Named gaps

Layout components take a named `gap` instead of a step. The names are exported as `SPACING_GAPS`.

| Gap    | Step | Size  | Use it between                                    |
| ------ | ---- | ----- | ------------------------------------------------- |
| `none` | `0`  | 0     | parts that should touch                           |
| `xs`   | `1`  | 4 px  | a heading and its description, an icon and text   |
| `sm`   | `2`  | 8 px  | buttons in a toolbar, tags, cards in a short list |
| `md`   | `4`  | 16 px | the blocks of a section, cards in a grid          |
| `lg`   | `6`  | 24 px | the parts of a list page or an editor             |
| `xl`   | `8`  | 32 px | the sections of a page                            |
| `2xl`  | `12` | 48 px | groups of sections                                |

Steps `3` (12 px) and `16` (64 px) are not named: they are for a component's own insides and the
page's edges, not for the space between siblings.

## No outer margins

A component's root element has no margin utility. The space between siblings is always the
parent's `gap`, so a component can be dropped into any layout without pushing its neighbours away.
`mx-auto` (centring) and a zero margin are not outer margins and stay allowed.

Margins inside a component, between its own parts, are allowed but must be on the scale; a `gap` on
the parent is still the better choice.

## Layout components

All five are in `@spy4x/preact-ui` (subpath `@spy4x/preact-ui/layout`). Each takes `as` for the
element it renders and `class` for anything that is not spacing.

- `Page` — the content column: at most `max-w-6xl`, centred, the page gutter (16 px on a phone,
  24 px from `sm`, 32 px from `lg`), and `xl` between its sections. It replaces the deprecated
  `page-layout` class.
- `Section` — an optional heading (`h2` by default) and description, then its children: `xs`
  under the heading, `md` between the header and each child.
- `Stack` — children in a column, `md` apart by default.
- `Cluster` — children in a row that wraps, `sm` apart by default, with `align` and `justify`.
- `Grid` — equal columns that fill the row, `md` apart by default, at least `sm` 12 rem, `md` 16 rem
  or `lg` 20 rem wide.

## Which gap goes where

| Between                                          | Use                           |
| ------------------------------------------------ | ----------------------------- |
| an icon and its label, inside a control          | the component already does it |
| a label, its field and its hint                  | `Field` already does it       |
| the fields of a form                             | `Stack gap="md"`              |
| the buttons of a toolbar or a form footer        | `Cluster gap="sm"`            |
| cards in a row                                   | `Grid gap="md"`               |
| the blocks inside a section                      | `Section` does it (`md`)      |
| a page title, its toolbar, a table               | `Stack gap="lg"`              |
| the sections of a page                           | `Page` does it (`xl`)         |
| the page and the window's edge (the page gutter) | `Page` does it                |

## Building a page

```tsx
import {
  Button,
  Card,
  CardBody,
  Cluster,
  Grid,
  Page,
  PageTitle,
  Section,
  Stack,
} from "@spy4x/preact-ui"

export function BillingPage() {
  return (
    <Page as="main">
      <Cluster justify="between">
        <PageTitle>Billing</PageTitle>
        <Button>New invoice</Button>
      </Cluster>

      <Section title="This month" description="Totals so far.">
        <Grid minColumnWidth="sm">
          <Card>
            <CardBody>Revenue</CardBody>
          </Card>
          <Card>
            <CardBody>Refunds</CardBody>
          </Card>
          <Card>
            <CardBody>Open invoices</CardBody>
          </Card>
        </Grid>
      </Section>

      <Section title="Payment methods">
        <Stack gap="sm">
          <Card>
            <CardBody>Company card</CardBody>
          </Card>
          <Card>
            <CardBody>Backup card</CardBody>
          </Card>
        </Stack>
      </Section>
    </Page>
  )
}
```

Nothing on this page sets a margin: every space on it is a named gap or `Page`'s gutter.

## Checking it

`findOffScaleSpacing(source)` from `@spy4x/preact-theme/spacing` returns every spacing class in a
file's text that is off the scale or arbitrary, with its line, column and reason. It uses no Deno
API. In this repository, `infra/scripts/spacing-scale.test.ts` runs it over every non-test source
file of `theme/`, `ui/`, `system/`, `crud/`, `charts/` and `map/`, with no allow-list, and
`ui-guide/root-margin.test.tsx` fails when a component the guide demonstrates puts a margin on its
root. `theme/README.md` → "Spacing" shows how an app runs the same check on its own files.

The checker reads comments too, because Tailwind's scanner does and emits CSS for a class it finds
in one. Only a word with the exact shape of a spacing class counts, so prose such as "a gap-free
layout" or "top-5 results" is never reported.
