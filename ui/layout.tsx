import { cn } from "@spy4x/preact-cn"
import type { SpacingGap } from "@spy4x/preact-theme/spacing"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"

/**
 * Layout components: the only way this library puts space between siblings.
 *
 * No component in the library carries an outer margin. A page is assembled from these five, each
 * with a named gap from `@spy4x/preact-theme/spacing` (`none` 0, `xs` 4 px, `sm` 8 px, `md` 16 px,
 * `lg` 24 px, `xl` 32 px, `2xl` 48 px), so two pages built from the same parts look alike.
 * `docs/spacing.md` says which gap goes where.
 */

/** The block elements a layout component may render as. */
export type LayoutElement =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "main"
  | "header"
  | "footer"
  | "nav"
  | "form"
  | "fieldset"
  | "ul"
  | "ol"
  | "li"

/**
 * Attributes every layout component passes to its element.
 *
 * `class` is re-declared as a plain string, as in `Card`, and is meant for non-spacing extras
 * (a background, a border): the gap is the `gap` prop's job.
 */
interface LayoutProps extends Omit<JSX.HTMLAttributes<HTMLElement>, "class" | "title" | "ref"> {
  /** The element to render. Defaults to `div`, or `section` for {@link Section}. */
  as?: LayoutElement
  /** Utilities added after the component's own, for anything that is not spacing. */
  class?: string
  children?: ComponentChildren
}

/**
 * One class per named gap. Written out rather than built from `SPACING_GAPS`, so Tailwind's
 * scanner sees each class whole; `layout.test.tsx` holds the two together.
 */
const LAYOUT_GAP_CLASSES: Readonly<Record<SpacingGap, string>> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
  "2xl": "gap-12",
}

export interface StackProps extends LayoutProps {
  /** Space between the children. Defaults to `md` (16 px). */
  gap?: SpacingGap
}

/** Renders `as` with `className` and the remaining attributes. */
function Box(
  { as = "div", className, children, ...rest }:
    & Omit<LayoutProps, "class">
    & { className: string },
): JSX.Element {
  const Tag = as as "div"
  return <Tag {...rest} class={className}>{children}</Tag>
}

/**
 * Children in a column, a named `gap` apart.
 *
 * The everyday layout: the fields of a form, the cards of a sidebar, the blocks of a section.
 *
 * @param props See {@link StackProps}.
 */
export function Stack({ gap = "md", class: className, ...rest }: StackProps): JSX.Element {
  return <Box {...rest} className={cn("flex flex-col", LAYOUT_GAP_CLASSES[gap], className)} />
}

/** How a {@link Cluster}'s children line up across the row. */
export type ClusterAlign = "start" | "center" | "end" | "baseline" | "stretch"

/** Where a {@link Cluster}'s children sit along the row. */
export type ClusterJustify = "start" | "center" | "end" | "between"

const ALIGN_CLASSES: Record<ClusterAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
  stretch: "items-stretch",
}

const JUSTIFY_CLASSES: Record<ClusterJustify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
}

export interface ClusterProps extends LayoutProps {
  /** Space between the children, across and down when the row wraps. Defaults to `sm` (8 px). */
  gap?: SpacingGap
  /** Cross-axis alignment. Defaults to `center`. */
  align?: ClusterAlign
  /** Main-axis placement. Defaults to `start`. */
  justify?: ClusterJustify
}

/**
 * Children in a row that wraps, a named `gap` apart: a toolbar, a row of buttons, a list of tags.
 *
 * @param props See {@link ClusterProps}.
 */
export function Cluster(
  { gap = "sm", align = "center", justify = "start", class: className, ...rest }: ClusterProps,
): JSX.Element {
  const classes = cn(
    "flex flex-wrap",
    ALIGN_CLASSES[align],
    JUSTIFY_CLASSES[justify],
    LAYOUT_GAP_CLASSES[gap],
    className,
  )
  return <Box {...rest} className={classes} />
}

/** The narrowest a {@link Grid} column may get before the grid drops a column. */
export type GridColumnWidth = "sm" | "md" | "lg"

/**
 * `auto-fit` collapses empty tracks, so the columns always fill the row and a short last row has
 * no holes; `min(100%, …)` keeps one column from overflowing a phone.
 */
const COLUMN_CLASSES: Record<GridColumnWidth, string> = {
  sm: "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]",
  md: "grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]",
  lg: "grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]",
}

export interface GridProps extends LayoutProps {
  /** Space between the cells, across and down. Defaults to `md` (16 px). */
  gap?: SpacingGap
  /** Minimum column width: `sm` 12 rem, `md` 16 rem, `lg` 20 rem. Defaults to `md`. */
  minColumnWidth?: GridColumnWidth
}

/**
 * Equal columns that fill the width: as many as fit at `minColumnWidth`, a named `gap` apart.
 *
 * @param props See {@link GridProps}.
 */
export function Grid(
  { gap = "md", minColumnWidth = "md", class: className, ...rest }: GridProps,
): JSX.Element {
  const classes = cn("grid", COLUMN_CLASSES[minColumnWidth], LAYOUT_GAP_CLASSES[gap], className)
  return <Box {...rest} className={classes} />
}

export type PageProps = LayoutProps

/**
 * The content column of a page: a readable maximum width, centred, with the page gutter (16 px on
 * a phone, 24 px from `sm`, 32 px from `lg`) and the `xl` gap (32 px) between its sections.
 *
 * It replaces the theme's `page-layout` utility, which stays for one release as a deprecated
 * alias. It renders a `div` unless `as` says otherwise, since the host shell usually owns `<main>`.
 *
 * @param props See {@link PageProps}.
 */
export function Page({ class: className, ...rest }: PageProps): JSX.Element {
  const classes = cn(
    "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8",
    className,
  )
  return <Box {...rest} className={classes} />
}

/** Heading level of a {@link Section}'s title. */
export type SectionHeadingLevel = 2 | 3 | 4

/** The theme's heading class for each level, written out so Tailwind's scanner sees it. */
const HEADING_CLASSES: Record<SectionHeadingLevel, string> = { 2: "h2", 3: "h3", 4: "h4" }

export interface SectionProps extends LayoutProps {
  /** Heading text. Without it the section renders no header and has no accessible name. */
  title?: string
  /** One or two sentences under the heading. */
  description?: ComponentChildren
  /** The heading's level, `h2` by default. Its look follows the level, from the theme's classes. */
  headingLevel?: SectionHeadingLevel
}

/**
 * A titled block of a page: an optional heading and description, then the children.
 *
 * The gaps are fixed so every section on every page reads the same: `xs` (4 px) between the heading
 * and the description, `md` (16 px) between the header and each child. A titled section is named
 * by its heading, so it is a landmark a screen reader can jump to.
 *
 * @param props See {@link SectionProps}.
 */
export function Section(
  {
    as = "section",
    title,
    description,
    headingLevel = 2,
    class: className,
    children,
    ...rest
  }: SectionProps,
): JSX.Element {
  const headingId = useId()
  const Heading = `h${headingLevel}` as "h2"
  const hasHeader = Boolean(title) || Boolean(description)
  return (
    <Box
      {...rest}
      as={as}
      aria-labelledby={title ? headingId : rest["aria-labelledby"]}
      className={cn("flex flex-col gap-4", className)}
    >
      {hasHeader && (
        <header class="flex flex-col gap-1">
          {title && <Heading id={headingId} class={HEADING_CLASSES[headingLevel]}>{title}</Heading>}
          {description && <p class="text-muted text-sm">{description}</p>}
        </header>
      )}
      {children}
    </Box>
  )
}
