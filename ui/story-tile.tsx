import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useFormat } from "./format.tsx"
import { useLabels } from "./i18n.tsx"
import { Link } from "./link.tsx"
import { type LookPhoto, LookPicture, TILE_LINK } from "./look-picture.tsx"
import { POST_LIST_LABELS, type PostListLabels } from "./post-list.tsx"

/** Props of {@link StoryTile}. */
export interface StoryTileProps {
  /** Where the tile links to: the post's page. */
  href: string
  /** The post's title: the link's text and accessible name. */
  title: string
  /** The topic, shown small above the title, such as `"Fabrics"`. Left out, the tile has none. */
  topic?: ComponentChildren
  /** The day the post went live, as an ISO 8601 instant or date. Shown in UTC, so every reader sees one day. */
  publishedAt: string
  /** The reading time in whole minutes. Left out, the tile shows the date alone. */
  readMinutes?: number
  /**
   * The cover, cropped to 3:4, as `LookTile` takes its photo. Left out, the tile draws a
   * typographic cover: the title, large, on a plain panel.
   */
  cover?: LookPhoto
  /**
   * The post the list opens with: a larger title and, in a `LookGrid` from `lg`, two columns
   * with a 4:3 cover. A phone shows it at full width like the rest.
   */
  lead?: boolean
  /** Load the cover at once and first, for the tiles above the fold. Lazy otherwise. */
  priority?: boolean
  /**
   * A `view-transition-name` for the cover, unique on the page. Give the post's own cover the same
   * name, and it grows from the tile into the post, as `LookTile`'s photo does.
   */
  viewTransitionName?: string
  /** Level of the title's heading, `<h2>` to `<h4>`. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4
  /** Takes a plain click on the tile instead of the browser, as `Link`'s port does. */
  navigate?: (href: string) => void
  /** The words, the same as `PostList`'s; see `POST_LIST_LABELS`. */
  labels?: Partial<PostListLabels>
  /** Utilities on the tile. */
  class?: string
}

/** The width of a lead tile in a `LookGrid`: two columns of three from `lg`. */
const LEAD_SIZES = "(min-width: 64rem) 67vw, (min-width: 48rem) 50vw, 100vw"

/**
 * One post of a photo-led blog, made to sit beside `LookTile`s: a tall 3:4 cover with no border,
 * then the topic, the title and a muted line with the date and the reading time.
 *
 * Plain markup and CSS, so it works on a server-rendered page with no JavaScript. The whole tile
 * takes the click, while a screen reader hears one link named by the title. A post with no cover
 * gets a typographic one, the title large and heavy at the bottom of a plain panel, hidden from
 * screen readers since the link says it already. The date is a `<time datetime>` in the formatter
 * of the nearest `FormatContext`, read in UTC.
 *
 * @param props The post and options, see {@link StoryTileProps}.
 * @throws {Error} When the cover has no variant, or a variant `responsiveImage` refuses.
 */
export function StoryTile(
  {
    href,
    title,
    topic,
    publishedAt,
    readMinutes,
    cover,
    lead = false,
    priority = false,
    viewTransitionName,
    headingLevel = 2,
    navigate,
    labels,
    class: className,
  }: StoryTileProps,
): JSX.Element {
  const format = useFormat().utc()
  const words = useLabels("PostList", POST_LIST_LABELS, labels, { readTime: ["minutes"] })
  const Heading = `h${headingLevel}` as const
  const aspect = lead ? "lg:aspect-4/3" : undefined
  return (
    <div
      class={join("relative flex flex-col gap-3", className)}
      data-e2e="story-tile"
      data-lead={lead ? "" : undefined}
    >
      {cover
        ? (
          <LookPicture
            photo={cover}
            sizes={lead ? LEAD_SIZES : undefined}
            priority={priority}
            viewTransitionName={viewTransitionName}
            imageClass={aspect}
          />
        )
        : (
          <div
            aria-hidden="true"
            class={join(
              "flex aspect-3/4 items-end overflow-hidden rounded-primary bg-surface p-6",
              aspect,
            )}
            style={viewTransitionName ? { viewTransitionName } : undefined}
          >
            <p
              class={join(
                "line-clamp-6 font-extrabold tracking-tighter text-balance",
                lead ? "text-4xl/tight lg:text-6xl/tight" : "text-3xl/tight",
              )}
            >
              {title}
            </p>
          </div>
        )}
      <div class="flex flex-col gap-1">
        {topic && <p class="font-mono text-sm font-medium text-primary">{topic}</p>}
        <Heading
          class={join(
            "font-semibold text-balance",
            lead ? "text-xl sm:text-2xl lg:text-3xl" : "text-lg sm:text-xl",
          )}
        >
          <Link href={href} navigate={navigate} class={TILE_LINK}>{title}</Link>
        </Heading>
        <p class="text-sm text-muted tabular-nums">
          <time dateTime={publishedAt}>{format.date(publishedAt)}</time>
          {readMinutes !== undefined && ` · ${words.readTime(readMinutes)}`}
        </p>
      </div>
    </div>
  )
}
