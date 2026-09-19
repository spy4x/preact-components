/**
 * The System section.
 *
 * A placeholder: the section is being written, and this is the one card that exists so far.
 * `Breadcrumb` is the cheapest honest card here — it takes its trail as props, needs no router and
 * no context, and is the one component in the package with nothing to gate behind an effect.
 *
 * The components still to be demonstrated are listed in `PENDING_DEMOS` in `../registry.ts`;
 * `SEOHead` and the dual-mode `Calendar` need a rendered-head preview and a pinned date before a
 * card would say anything true about them.
 */

import { Breadcrumb } from "@preact-components/system/breadcrumb"
import type { Crumb } from "@preact-components/system/head"
import type { DemoFragment } from "../registry.ts"

/** Three crumbs, because the component renders nothing for a trail shorter than two. */
const trail: readonly Crumb[] = [
  { name: "Docs", href: "/docs" },
  { name: "Components", href: "/docs/components" },
  { name: "Breadcrumb" },
]

export const systemDemos = {
  Breadcrumb: {
    summary:
      "Placeholder — this section is being written. Renders its trail from props: the last crumb is the current page (`aria-current`), the ones before it are links. A trail of fewer than two crumbs renders nothing.",
    snippet: `<Breadcrumb items={[{ name: "Docs", href: "/docs" }, { name: "Breadcrumb" }]} />`,
    render: () => <Breadcrumb items={trail} />,
  },
} satisfies DemoFragment<"Breadcrumb">
