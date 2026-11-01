import { cn } from "@spy4x/preact-cn"
import { IconChevronDown } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/** One change of a {@link ChangeList}: a sentence and, optionally, the pull request it came in. */
export interface ChangeEntry {
  /** The change in one plain sentence. */
  text: string
  /** The pull request's number, shown as `#612` after the sentence. Drawn only with `href`. */
  number?: number
  /** Where the number links to, such as the pull request on GitHub. Drawn only with `number`. */
  href?: string
}

/** One month of a {@link ChangeList}. */
export interface ChangeMonth {
  /** The heading's `id`, such as `"2026-10"`, so `#2026-10` links to the month. */
  id: string
  /** The heading, such as `"October 2026"`. */
  title: string
  /** What is new this month, listed open under "New". Empty, the group is not drawn. */
  added: readonly ChangeEntry[]
  /** What was fixed, folded under "Fixed" in a `<details>` that counts them. Empty, not drawn. */
  fixed: readonly ChangeEntry[]
  /** Shown after the month's count in its muted line, such as a link to that month's post. */
  note?: ComponentChildren
}

/** The words a {@link ChangeList} shows. */
export interface ChangeListLabels {
  /** The heading of new things. Default: `"New"`. */
  added: string
  /** The heading of fixes. Default: `"Fixed"`. */
  fixed: string
  /** A month's count of changes. Default: `"1 change"`, `"42 changes"`. */
  changes: (count: number) => string
  /** The summary of the folded fixes. Default: `"1 fix"`, `"108 fixes"`. */
  fixes: (count: number) => string
  /** The name of a change's number link. Default: `"Pull request 612"`. */
  pullRequest: (number: number) => string
  /** The name of every heading's anchor link. Default: `"Link to this section"`. */
  anchor: string
}

/** The English words {@link ChangeList} shows when the caller passes none. */
export const CHANGE_LIST_LABELS: ChangeListLabels = {
  added: "New",
  fixed: "Fixed",
  changes: (count) => count === 1 ? "1 change" : `${count} changes`,
  fixes: (count) => count === 1 ? "1 fix" : `${count} fixes`,
  pullRequest: (number) => `Pull request ${number}`,
  anchor: "Link to this section",
}

/** Props of {@link ChangeList}. */
export interface ChangeListProps {
  /** The months, newest first. An empty list renders nothing, so the caller draws its empty state. */
  months: readonly ChangeMonth[]
  /** Level of each month's heading, `<h2>` or `<h3>`; New and Fixed sit one below. Defaults to `2`. */
  headingLevel?: 2 | 3
  /** The words shown; see {@link CHANGE_LIST_LABELS}. */
  labels?: Partial<ChangeListLabels>
  /** Utilities on the list. */
  class?: string
}

const FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

const ANCHOR =
  `rounded-sm px-1 text-muted opacity-0 group-hover/heading:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${FOCUS}`

const HEADING = "scroll-mt-16 font-semibold text-balance break-words hyphens-auto text-foreground"

/** A heading with its "Link to this section" link beside it, outside it. */
function AnchoredHeading(
  { level, id, title, anchor, class: className }: {
    level: 2 | 3 | 4
    id: string
    title: ComponentChildren
    anchor: string
    class: string
  },
): JSX.Element {
  const Heading = `h${level}` as "h2"
  return (
    <div class="group/heading flex items-baseline gap-2">
      <Heading id={id} class={cn(HEADING, className)}>{title}</Heading>
      <a href={`#${id}`} aria-label={anchor} class={ANCHOR}>
        <span aria-hidden="true">#</span>
      </a>
    </div>
  )
}

/** The changes of one group, one sentence each with its muted number link. */
function Entries(
  { entries, words }: { entries: readonly ChangeEntry[]; words: ChangeListLabels },
): JSX.Element {
  return (
    <ul class="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <li key={entry.number ?? index} class="text-pretty">
          {entry.text}
          {entry.number !== undefined && entry.href && (
            <>
              {" "}
              <a
                href={entry.href}
                aria-label={words.pullRequest(entry.number)}
                class={`rounded-sm text-sm text-muted tabular-nums hover:underline ${FOCUS}`}
              >
                <bdi>#{entry.number}</bdi>
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * What changed, month by month: per month its heading with an anchor, a muted count, what is
 * new as an open list, and the fixes folded in a `<details>` that counts them, so fixes are there
 * without burying the new things. Each change is one sentence and its pull request's number.
 *
 * Plain markup and native `<details>`, so it works on a server-rendered page with no JavaScript.
 * Every heading gets a "Link to this section" link, shown on hover and on focus; New and Fixed
 * take the ids `<month>-new` and `<month>-fixed`. Numbers sit in `<bdi>`, so `#612` keeps its
 * order on a right-to-left page.
 *
 * @param props The months and options, see {@link ChangeListProps}.
 */
export function ChangeList(
  { months, headingLevel = 2, labels, class: className }: ChangeListProps,
): JSX.Element | null {
  const words = useLabels("ChangeList", CHANGE_LIST_LABELS, labels, {
    changes: ["count"],
    fixes: ["count"],
    pullRequest: ["number"],
  })
  if (months.length === 0) return null
  const sub = (headingLevel + 1) as 3 | 4
  return (
    <div class={cn("flex flex-col gap-12", className)} data-e2e="change-list">
      {months.map((month) => (
        <section key={month.id} aria-labelledby={month.id} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <AnchoredHeading
              level={headingLevel}
              id={month.id}
              title={month.title}
              anchor={words.anchor}
              class="text-2xl/8 tracking-tight"
            />
            <p class="text-sm text-muted">
              {words.changes(month.added.length + month.fixed.length)}
              {month.note && <>{" · "}{month.note}</>}
            </p>
          </div>
          {month.added.length > 0 && (
            <div class="flex flex-col gap-2">
              <AnchoredHeading
                level={sub}
                id={`${month.id}-new`}
                title={words.added}
                anchor={words.anchor}
                class="text-lg"
              />
              <Entries entries={month.added} words={words} />
            </div>
          )}
          {month.fixed.length > 0 && (
            <div class="flex flex-col gap-2">
              <AnchoredHeading
                level={sub}
                id={`${month.id}-fixed`}
                title={words.fixed}
                anchor={words.anchor}
                class="text-lg"
              />
              <details class="group/fixes">
                <summary
                  class={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-muted hover:text-foreground [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  <IconChevronDown class="size-4 motion-safe:transition-transform motion-safe:duration-200 group-open/fixes:rotate-180" />
                  {words.fixes(month.fixed.length)}
                </summary>
                <div class="pt-2">
                  <Entries entries={month.fixed} words={words} />
                </div>
              </details>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
