# Spacing

Spacing in this library is a small fixed scale that the library owns. Components come with their
spacing already set, and a page is put together from layout components with a named gap, never from
margins picked one element at a time. Follow this page and two pages built from the same parts look
alike.

## The scale

Padding, margin, gap, `space-x`/`space-y` and scroll margin/padding classes use only these steps,
with any variant prefix and an optional leading `-`:

| Step | Size  | Named gap | Where it goes                                      |
| ---- | ----- | --------- | -------------------------------------------------- |
| `0`  | 0     | `none`    | see "Which gap goes where"                         |
| `px` | 1 px  | —         | a hairline offset inside a component               |
| `1`  | 4 px  | `xs`      | see "Which gap goes where"                         |
| `2`  | 8 px  | `sm`      | see "Which gap goes where"                         |
| `3`  | 12 px | —         | a component's own insides, such as an input's side |
| `4`  | 16 px | `md`      | see "Which gap goes where"; the phone gutter       |
| `6`  | 24 px | `lg`      | see "Which gap goes where"; the gutter from `sm`   |
| `8`  | 32 px | `xl`      | see "Which gap goes where"; the gutter from `lg`   |
| `12` | 48 px | `2xl`     | see "Which gap goes where"                         |
| `16` | 64 px | —         | the edge of a hero or an empty page                |

Arbitrary values (`p-[13px]`, `gap-(--x)`) and arbitrary properties that set spacing
(`[padding:13px]`) are not allowed. In a stylesheet, Tailwind's `--spacing()` function takes a
step too. Sizes and positions (`h-12`, `size-9`, `top-5`, `inset-2`, `max-w-6xl`) are not spacing,
and the scale does not restrict them. Something that is not a step, such as a phone's safe-area
inset, gets a named utility in `theme/preset.css` (`pb-safe`, `pb-safe-3`) instead of an arbitrary
value in a component.

The scale is exported as `SPACING_STEPS` from `@spy4x/preact-theme/spacing`.

## Named gaps

Layout components take a named `gap` instead of a step. The names are exported as `SPACING_GAPS`.
The table below is the one place that says which gap goes where; the guide's cards and the page
example follow it.

## Which gap goes where

| Between                                              | Gap    | Size   | Use                           |
| ---------------------------------------------------- | ------ | ------ | ----------------------------- |
| parts that should touch                              | `none` | 0      | any layout component          |
| an icon and its label, a heading and its description | —      | 4–8 px | the component already does it |
| a label, its field and its hint                      | `sm`   | 8 px   | `Field` already does it       |
| the buttons of a toolbar or a form footer, tags      | `sm`   | 8 px   | `Cluster` (its default)       |
| the fields of a form                                 | `md`   | 16 px  | `Stack` (its default)         |
| cards in a list                                      | `md`   | 16 px  | `Stack` (its default)         |
| cards in a grid                                      | `md`   | 16 px  | `Grid` (its default)          |
| the blocks inside a section                          | `md`   | 16 px  | `Section` does it             |
| a list page's title, toolbar and table               | `lg`   | 24 px  | `Stack gap="lg"`              |
| the sections of a page                               | `xl`   | 32 px  | `Page` does it                |
| groups of sections                                   | `2xl`  | 48 px  | `Stack gap="2xl"`             |
| the page and the window's edge (the page gutter)     | —      | —      | `Page` does it                |

Steps `3` (12 px) and `16` (64 px) have no name: they are for a component's own insides and the
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
  under the heading, `md` between the header and each child. It renders a `section`, `article`,
  `aside` or `div`; the first three are named by their heading, a `div` is not.
- `Stack` — children in a column, `md` apart by default.
- `Cluster` — children in a row that wraps, `sm` apart by default, with `align` and `justify`.
- `Grid` — equal columns that fill the row, `md` apart by default, at least `sm` 12 rem, `md` 16 rem
  or `lg` 20 rem wide.

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
    <Page>
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
        <Stack>
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

`Page` renders a `div`, because `Shell` and `RailShell` already render the page's `<main>` around
it. Pass `as="main"` only on a page that has no shell, so the document still has exactly one
`<main>`.

## Checking it

`findOffScaleSpacing(source)` from `@spy4x/preact-theme/spacing` reads a file's text and returns,
with its line, column and reason:

- every spacing class off the scale or with an arbitrary value (`p-5`, `sm:-mt-7`, `p-[13px]`);
- every arbitrary property that sets padding, margin, a gap or their scroll forms
  (`[padding:13px]`, `md:[margin-top:1rem]`);
- every `--spacing()` call whose argument is not a numeric step (`--spacing(5)`).

It does not see a raw CSS declaration (`padding: 10px` in a stylesheet), an inline `style`, a class
name built at run time (`` `p-${n}` ``), Tailwind's legacy `theme()` function, or an arbitrary
property that rescales the whole scale inside an element (`[--spacing:0.3rem]`). Those are held by
review, so read the check as a floor, not as proof.

It uses no Deno API. In this repository, `infra/scripts/spacing-scale.test.ts` runs it over every
non-test source file of `theme/`, `ui/`, `system/`, `crud/`, `charts/` and `map/`, with no
allow-list, and `ui-guide/root-margin.test.tsx` fails when a component the guide demonstrates puts a
margin on its root. `theme/README.md` → "Spacing" shows how an app runs the same check on its own
files.

The checker reads comments too, because Tailwind's scanner does and emits CSS for a class it finds
in one. Only a word with the exact shape of a spacing class counts, so prose such as "a gap-free
layout" or "top-5 results" is never reported.
