import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"

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
  /** Utilities after the prose classes, such as `mx-auto`. Not merged. */
  class?: string
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
 * @param props The article and options, see {@link ProseProps}.
 */
export function Prose({ html, children, as = "div", class: className }: ProseProps): JSX.Element {
  const Tag = as
  const classes = join("pc-prose", className)
  if (html !== undefined) {
    return <Tag class={classes} data-prose="" dangerouslySetInnerHTML={{ __html: html }} />
  }
  return <Tag class={classes} data-prose="">{children}</Tag>
}
