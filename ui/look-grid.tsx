import { join } from "@spy4x/preact-cn/join"
import {
  type ComponentChild,
  type ComponentChildren,
  isValidElement,
  type JSX,
  toChildArray,
} from "preact"

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
 * The columns: one on a phone, two from `md`, three from `lg`. Every look in a row starts at the
 * same height, so the columns line up.
 */
const GRID = "grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3"

/**
 * The looks of a shop's catalog in aligned columns: one per screen width on a phone, two from
 * 768 px and three from 1024 px.
 *
 * Server-rendered CSS grid with no script. Each child becomes one item of a `<ul>`, in order,
 * read row by row. A child with `lead` set, such as a lead `StoryTile`, spans two columns from
 * `lg`; the grid reads that prop off the child itself, so pass the tile directly, not wrapped.
 *
 * @param props The looks and options, see {@link LookGridProps}.
 */
export function LookGrid({ children, label, class: className }: LookGridProps): JSX.Element | null {
  const items = toChildArray(children)
  if (items.length === 0) return null
  return (
    <ul aria-label={label} class={join(GRID, className)} data-e2e="look-grid">
      {items.map((item, index) => (
        <li
          key={isValidElement(item) && item.key != null ? item.key : index}
          class={leads(item) ? "lg:col-span-2" : undefined}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Whether a child is an element with `lead` set, which spans two columns from `lg`. */
function leads(item: ComponentChild): boolean {
  return isValidElement(item) && (item.props as { lead?: unknown }).lead === true
}
