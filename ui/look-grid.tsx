import { join } from "@spy4x/preact-cn/join"
import { type ComponentChildren, isValidElement, type JSX, toChildArray } from "preact"

/** Props of {@link LookGrid}. */
export interface LookGridProps {
  /** The looks, usually `LookTile`s, newest first. None renders nothing. */
  children: ComponentChildren
  /** The list's accessible name, such as `"New in"`. Left out, the list has none. */
  label?: string
  /** Utilities on the list. */
  class?: string
}

/**
 * The columns, and room under them for the lowered column: one column on a phone, two from `md`,
 * three from `lg`.
 */
const GRID = "grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 md:pb-16 lg:grid-cols-3"

/**
 * Every second tile is lowered in two columns, and the middle one in three, so the columns are
 * staggered like a contact sheet. A translate moves the drawing only: the row order, the reading
 * order and the tab order stay the order of the list.
 */
const STAGGER = "md:max-lg:even:translate-y-16 lg:nth-[3n+2]:translate-y-16"

/**
 * The looks of a shop's catalog in staggered columns: one per screen width on a phone, two from
 * 768 px and three from 1024 px, with the middle column lowered.
 *
 * Server-rendered CSS grid with no script. Each child becomes one item of a `<ul>`, in order,
 * read row by row.
 *
 * @param props The looks and options, see {@link LookGridProps}.
 */
export function LookGrid({ children, label, class: className }: LookGridProps): JSX.Element | null {
  const items = toChildArray(children)
  if (items.length === 0) return null
  return (
    <ul aria-label={label} class={join(GRID, className)} data-e2e="look-grid">
      {items.map((item, index) => (
        <li key={isValidElement(item) && item.key != null ? item.key : index} class={STAGGER}>
          {item}
        </li>
      ))}
    </ul>
  )
}
