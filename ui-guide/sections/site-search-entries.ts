/**
 * The entries of the `SiteSearch` card's pretend site. `pages/build.ts` builds them into
 * `site-search-demo/search.json` with `createIndex`, as a site's server would, and the card loads
 * that file. Each link is a card on the guide's UI page, except the e-mail address, and one
 * `javascript:` link that the search must never list.
 */

import type { SearchEntry } from "@spy4x/search"

/** Where the card's index is, relative to the guide's page. */
export const SITE_SEARCH_DEMO_SRC = "site-search-demo/search.json"

/** The pretend site's pages, as its server would index them. */
export const siteSearchDemoEntries: readonly SearchEntry[] = [
  {
    label: "Command palette",
    aliases: ["search dialog", "ctrl k"],
    detail: "A search button and the dialog it opens",
    text: "Results grouped under headings that the arrow keys move through.",
    group: "Components",
    href: "#demo-CommandPalette",
  },
  {
    label: "Site search",
    detail: "A website's search over its prebuilt index",
    group: "Components",
    href: "#demo-SiteSearch",
  },
  {
    label: "Keyboard keys",
    aliases: ["kbd", "shortcut"],
    detail: "Keys drawn as keycaps",
    group: "Components",
    href: "#demo-Kbd",
  },
  {
    label: "Tabs",
    detail: "Panels behind a row of tabs",
    group: "Components",
    href: "#demo-Tabs",
  },
  {
    label: "Tooltip",
    detail: "A short label on hover and focus",
    group: "Components",
    href: "#demo-Tooltip",
  },
  {
    label: "Timeline",
    detail: "Events in order, newest first",
    group: "Components",
    href: "#demo-Timeline",
  },
  {
    label: "Email the maintainer",
    aliases: ["contact"],
    group: "Contact",
    href: "mailto:hello@example.com",
  },
  {
    label: "Tricky link",
    detail: "A javascript: link, which the search never lists",
    group: "Components",
    href: "javascript:alert(1)",
  },
]
