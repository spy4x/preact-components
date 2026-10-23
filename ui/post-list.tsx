import { join } from "@spy4x/preact-cn/join"
import type { JSX } from "preact"
import { useFormat } from "./format.tsx"
import { useLabels } from "./i18n.tsx"

/** One post of a {@link PostList}. */
export interface PostListItem {
  /** Where the title links to. */
  href: string
  /** The post's title, the row's link text. */
  title: string
  /** One or two sentences, cut to two lines. Left out, the row has no description. */
  description?: string
  /** The day the post went live, as an ISO 8601 instant or date. Shown in UTC, so every reader sees one day. */
  publishedAt: string
  /** The reading time in whole minutes. Left out, the row shows the date alone. */
  readMinutes?: number
}

/** The words a {@link PostList} shows. */
export interface PostListLabels {
  /** The reading time. Default: `"6 min read"`. */
  readTime: (minutes: number) => string
}

/** The English words {@link PostList} shows when the caller passes none. */
export const POST_LIST_LABELS: PostListLabels = {
  readTime: (minutes) => `${minutes} min read`,
}

/** Props of {@link PostList}. */
export interface PostListProps {
  /** The posts, newest first. An empty list renders nothing, so the caller draws its own empty state. */
  posts: readonly PostListItem[]
  /** Level of each title's heading, `<h2>` to `<h4>`. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4
  /** The list's accessible name, such as `"Read next"`. Left out, the list has none. */
  label?: string
  /** The words shown; see {@link POST_LIST_LABELS}. */
  labels?: Partial<PostListLabels>
  /** Utilities on the list. */
  class?: string
}

/** The title link: the whole row is its target, through a stretched `::after`. */
const LINK =
  "rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-hidden " +
  "after:absolute after:inset-0 after:rounded-primary focus-visible:after:ring-2 " +
  "focus-visible:after:ring-focus"

/**
 * A list of articles, as a blog's index or its "Read next": per row the day it went live and its
 * reading time, the title as a link, and a description cut to two lines. No covers.
 *
 * Plain markup and CSS, so it works on a server-rendered page with no JavaScript. The whole row
 * takes the click, while a screen reader hears one link per post, named by its title. The date is
 * a `<time datetime>` in the formatter of the nearest `FormatContext`, read in UTC.
 *
 * @param props The posts and options, see {@link PostListProps}.
 */
export function PostList(
  { posts, headingLevel = 2, label, labels, class: className }: PostListProps,
): JSX.Element | null {
  const format = useFormat().utc()
  if (posts.length === 0) return null
  const words = useLabels("PostList", POST_LIST_LABELS, labels, { readTime: ["minutes"] })
  const Heading = `h${headingLevel}` as const
  return (
    <ul aria-label={label} class={join("border-t border-subtle", className)} data-e2e="post-list">
      {posts.map((post) => (
        <li key={post.href} class="relative border-b border-subtle py-6">
          <p class="text-sm text-muted tabular-nums">
            <time dateTime={post.publishedAt}>{format.date(post.publishedAt)}</time>
            {post.readMinutes !== undefined && ` · ${words.readTime(post.readMinutes)}`}
          </p>
          <Heading class="mt-1 text-lg font-semibold text-balance sm:text-xl">
            <a href={post.href} class={LINK}>{post.title}</a>
          </Heading>
          {post.description && (
            <p class="mt-1 line-clamp-2 text-base text-muted text-pretty">{post.description}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
