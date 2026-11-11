/**
 * The `SiteSearch` card of the `ui/` display section: a pretend site's search over the index
 * `pages/build.ts` builds from `site-search-entries.ts`. Loading, the retry, the link guard and
 * `onSearched` are proven in a browser by `pages/e2e/ui/site-search.spec.ts`.
 */

import { useSignal } from "@preact/signals"
import { Stack } from "@spy4x/preact-ui/layout"
import { SiteSearch, type SiteSearchEvent } from "@spy4x/preact-ui/site-search"
import type { DemoFragment } from "../registry.ts"
import { DemoNote } from "./demo-note.tsx"
import { SITE_SEARCH_DEMO_SRC } from "./site-search-entries.ts"

/**
 * Two `SiteSearch` triggers over the same pretend site: the field and the icon. The field opens on
 * Ctrl+Shift+F (⌘⇧F on a Mac), since the page's header search owns `/` and Ctrl+K; the icon has no
 * hotkey. The note shows how many sessions
 * `onSearched` heard of and the last one.
 */
function SiteSearchDemo() {
  const sessions = useSignal(0)
  const last = useSignal<SiteSearchEvent | null>(null)
  const ran = useSignal("nothing yet")
  const onSearched = (event: SiteSearchEvent) => {
    sessions.value++
    last.value = event
  }
  const commands = [{
    id: "hello",
    label: "Say hello",
    group: "Commands",
    run: () => ran.value = "Say hello",
  }]
  return (
    <Stack>
      <SiteSearch
        src={SITE_SEARCH_DEMO_SRC}
        fetch={(src) => fetch(src)}
        commands={commands}
        groupOrder={["Components", "Commands"]}
        labels={{ placeholder: "Search the guide…" }}
        hotkeys={["mod+shift+f"]}
        dataE2E="site-search"
        onSearched={onSearched}
      />
      <SiteSearch
        src={SITE_SEARCH_DEMO_SRC}
        fetch={(src) => fetch(src)}
        trigger="icon"
        hotkeys={[]}
        dataE2E="site-search-icon"
        onSearched={onSearched}
      />
      <DemoNote e2e="site-search-note">
        Sessions <span data-e2e="site-search-sessions">{sessions.value}</span>; last{" "}
        <span data-e2e="site-search-last">
          {last.value === null ? "none" : JSON.stringify(last.value)}
        </span>; ran{" "}
        <span data-e2e="site-search-ran">{ran.value}</span>. Try “palette”, “kbd”, “contact” or
        “tricky”: the last finds a <code>javascript:</code> link, which never shows.
      </DemoNote>
    </Stack>
  )
}

/** The `SiteSearch` card, merged into the display section. */
export const siteSearchDemos = {
  SiteSearch: {
    summary:
      "A website's search: a field-shaped button people notice and the palette it opens over the site's prebuilt index and its commands.",
    wide: false,
    props: [
      {
        name: "src",
        type: "string",
        default: `"/search.json"`,
        description:
          "`JSON.stringify` of an `@spy4x/search` index the server built; fetched on hover, focus or opening, kept, and fetched again after a failure. Links off the site or to `javascript:` never show.",
      },
      {
        name: "fetch",
        type: "(src) => Promise<Response>",
        description:
          "The page's `fetch`, a port: no component of this library talks to the network by itself.",
      },
      {
        name: "commands",
        type: "{ id, label, run, group?, icon?, keepOpen?, … }[]",
        description: "Client-side commands listed with the results, filtered by the query.",
      },
      {
        name: "groupOrder",
        type: "string[]",
        description: "Groups listed first, in this order.",
      },
      {
        name: "onSearched",
        type: "({ query, results, chosenPosition?, chosenKind?, correction? }) => void",
        description:
          "Once per session, on a choice or the close; the query trimmed to 64 characters. Say so on the privacy page and send no user id.",
      },
      {
        name: "trigger",
        type: `"field" | "icon"`,
        default: `"field"`,
        description:
          "The field-shaped button with the placeholder and hotkey hint, or a magnifier whose tooltip shows both. A link to `/search?q=` until hydration.",
      },
      {
        name: "hotkeys",
        type: "string[]",
        default: `["mod+k", "/"]`,
        description:
          "What opens the palette; the trigger shows the first, Ctrl/⌘+K by default. `[]` turns them off.",
      },
      {
        name: "labels",
        type: "Partial<SiteSearchLabels>",
        description:
          "`placeholder`, `empty(query)`, `error`, `loading`, `search`, `close`; see `defaultSiteSearchLabels` and `defaultCommandPaletteLabels`.",
      },
    ],
    snippet: `<SiteSearch
  fetch={fetch}
  labels={{ placeholder: "Search posts, projects, services…" }}
  groupOrder={["Pages", "Posts"]}
  commands={[{ id: "theme", label: "Toggle theme", group: "Commands", run: toggleTheme }]}
  onSearched={(event) => analytics.track("search", event)}
/>

<SiteSearch fetch={fetch} trigger="icon" />`,
    render: () => <SiteSearchDemo />,
  },
} satisfies DemoFragment
