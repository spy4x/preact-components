/**
 * The cards of the parts that tell a reader where they are on a long public page: `Breadcrumbs`
 * above its `h1` and `OnThisPage` beside its body. Neither needs JavaScript. They are spread into
 * the Display section.
 */

import { Breadcrumbs, OnThisPage } from "@spy4x/preact-ui"
import type { DemoFragment } from "../registry.ts"

export const pageNavigationDemos = {
  Breadcrumbs: {
    summary:
      "Where a page sits on a site, as a trail of links above its `h1`; the last step is the page itself.",
    wide: false,
    props: [
      {
        name: "items",
        type: "{ label, href? }[]",
        description:
          'The trail from the root. The last step without `href` is the current page, marked `aria-current="page"`. An empty trail renders nothing.',
      },
      {
        name: "label",
        type: "string",
        default: `"Breadcrumb"`,
        description: "The landmark's name.",
      },
    ],
    snippet: `<Breadcrumbs
  items={[
    { label: "Seed", href: "/" },
    { label: "Features", href: "/features" },
    { label: "Sign-in" },
  ]}
/>`,
    render: () => (
      <Breadcrumbs
        items={[
          { label: "Seed", href: "#demo-Breadcrumbs" },
          { label: "Features", href: "#demo-Breadcrumbs" },
          { label: "Sign-in" },
        ]}
      />
    ),
  },
  OnThisPage: {
    summary:
      "The sections of a long page: a sticky list in a side column on a wide screen, a disclosure on a narrow one.",
    wide: false,
    props: [
      {
        name: "links",
        type: "{ label, href, ...anchor attributes }[]",
        description:
          "The sections, in order, each with its fragment. Any other anchor attribute, such as `data-*`, passes through. An empty list renders nothing.",
      },
      {
        name: "label",
        type: "string",
        default: `"On this page"`,
        description: "The list's heading and the landmark's name.",
      },
      {
        name: "openFrom",
        type: `"lg" | "xl"`,
        default: `"lg"`,
        description: "The width from which the list stands open; below it, it folds.",
      },
    ],
    snippet: `<OnThisPage
  openFrom="xl"
  links={[
    { label: "What you get", href: "#what-you-get" },
    { label: "Limits", href: "#limits" },
  ]}
/>`,
    // Named apart from the guide's own "On this page" column, so the page's landmarks stay unique.
    render: () => (
      <OnThisPage
        label="Sections of this example"
        links={[
          { label: "What you get", href: "#demo-OnThisPage" },
          { label: "How it works", href: "#demo-OnThisPage" },
          { label: "Limits", href: "#demo-OnThisPage" },
        ]}
      />
    ),
  },
} satisfies DemoFragment
