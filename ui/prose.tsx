import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/** The words {@link Prose} adds to an article. */
export interface ProseLabels {
  /** The name of every heading's anchor link. Default: `"Link to this section"`. */
  anchor: string
  /** The name of a table's scroll region when no heading comes before the table. Default: `"Table"`. */
  table: string
}

/** The English words {@link Prose} adds when the caller passes none. */
export const PROSE_LABELS: ProseLabels = {
  anchor: "Link to this section",
  table: "Table",
}

/** Props of {@link Prose}. */
export interface ProseProps {
  /**
   * Rendered article HTML, such as the output of a Markdown renderer. It is set as the element's
   * `innerHTML`, so it must already be safe: rendered from trusted text, with raw HTML stripped and
   * links limited to safe schemes. `Prose` adds styles only and never cleans markup.
   */
  html?: string
  /** The article as elements instead of `html`. Ignored when `html` is given. */
  children?: ComponentChildren
  /** The wrapping element. Defaults to `"div"`; use `"article"` when the body is the whole post. */
  as?: "div" | "article"
  /**
   * Give every `h2` and `h3` of `html` that has an `id` a link to itself, shown on hover and on
   * focus, so a reader can copy the address of a section. Defaults to `false`. Applies to `html`
   * only, not to `children`.
   */
  anchors?: boolean
  /** The words added to the article; see {@link PROSE_LABELS}. */
  labels?: Partial<ProseLabels>
  /** Utilities after the prose classes, such as `mx-auto`. Not merged. */
  class?: string
}

/** A heading `h2` to `h4` with its content, or a whole table, in document order. */
const BLOCKS = /<h([2-4])\b([^>]*)>[\s\S]*?<\/h\1>|<table\b[\s\S]*?<\/table>/g
/** The `id` attribute of an opening tag's attributes. */
const ID = /\bid="([^"]+)"/

/** `value` escaped for a double-quoted attribute. */
function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

/**
 * `html` with each table in a focusable scroll region named after the heading before it, and, when
 * `anchors` is set, each `h2` and `h3` with an `id` followed by a link to itself.
 */
function enhance(html: string, anchors: boolean, words: ProseLabels): string {
  let heading: string | undefined
  return html.replace(BLOCKS, (block: string, level?: string, attributes?: string) => {
    if (level === undefined) {
      const name = heading === undefined
        ? `aria-label="${attribute(words.table)}"`
        : `aria-labelledby="${heading}"`
      return `<div data-prose-table="" role="region" tabindex="0" ${name}>${block}</div>`
    }
    const id = ID.exec(attributes ?? "")?.[1]
    if (id === undefined) return block
    heading = id
    if (!anchors || level === "4") return block
    const link = `<a data-prose-anchor="" href="#${id}" aria-label="${
      attribute(words.anchor)
    }"><span aria-hidden="true">#</span></a>`
    return `<div data-prose-heading="">${block}${link}</div>`
  })
}

/**
 * The typography of an article: rendered Markdown (headings `h2` to `h4`, paragraphs, lists, code,
 * quotes, tables, images, links and rules) set from the design tokens at a reading measure of
 * about 65 characters, in light and dark.
 *
 * The styles are `.pc-prose` from the theme's preset, on one wrapper, so a server-rendered page
 * shows them with no JavaScript, and the type follows the tokens into dark mode. The page's `h1`
 * stays outside; the body starts at `h2`. Headings scroll to clear a sticky header when a
 * table-of-contents link targets their `id`.
 *
 * In `html`, each table goes in its own scroll region, focusable and named after the heading
 * before it, so a wide table scrolls by itself, from the keyboard too, and the page never does.
 * With `anchors`, each `h2` and `h3` gets a "Link to this section" link beside it, outside the
 * heading so the heading's name stays its text.
 *
 * @param props The article and options, see {@link ProseProps}.
 */
export function Prose(
  { html, children, as = "div", anchors = false, labels, class: className }: ProseProps,
): JSX.Element {
  const Tag = as
  const classes = join("pc-prose", className)
  const words = useLabels("Prose", PROSE_LABELS, labels)
  if (html !== undefined) {
    return (
      <Tag
        class={classes}
        data-prose=""
        dangerouslySetInnerHTML={{ __html: enhance(html, anchors, words) }}
      />
    )
  }
  return <Tag class={classes} data-prose="">{children}</Tag>
}
