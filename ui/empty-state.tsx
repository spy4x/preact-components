import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"

export interface EmptyStateProps {
  /** Decorative glyph. Rendered in a muted box and hidden from assistive tech. */
  icon?: ComponentChildren
  /** Headline describing what is missing. */
  title?: string
  /** Second line, usually what the caller can do about it. */
  description?: string
  /** Caller-owned control (`Button`, link, …). Rendered under the copy. */
  action?: ComponentChildren
  class?: string
}

/*
 * Container geometry is deliberately identical to `ErrorState` — same max width, margin, radius
 * and padding — so a page can swap one state for the other without a layout jump. The dashed
 * border and the muted palette are the only difference, and `LoadingSkeleton`'s card utilities
 * supply most of them.
 */
const box =
  "mx-auto my-4 max-w-[650px] rounded-lg border border-dashed border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800"

/* The same icon box `LoadingSkeleton` uses for its placeholder glyph. */
const iconBox =
  "mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"

/**
 * "Nothing here" placeholder for a list, table or search that produced no rows.
 *
 * Every string is a prop: the component owns layout, never copy. Absent slots render nothing at
 * all, and an instance with no slot renders `null`, so the source component's baked-in product
 * sentence cannot come back through a default.
 *
 * `role="status"` on the root: an empty collection is a polite outcome a page can host twice, so an
 * `alert` role would impersonate `ErrorState`. No `aria-labelledby` either — that needs an `id`, and
 * two instances on one page would collide.
 *
 * @param props Slots and caller utilities, see {@link EmptyStateProps}.
 * @returns The placeholder, or `null` when every slot is absent.
 */
export function EmptyState(
  { icon, title, description, action, class: className }: EmptyStateProps,
): JSX.Element | null {
  const hasContent = Boolean(icon) || Boolean(title) || Boolean(description) || Boolean(action)
  if (!hasContent) return null

  return (
    <div role="status" class={cn(box, className)}>
      {icon && (
        <span aria-hidden="true" class={iconBox}>
          {icon}
        </span>
      )}
      {title && (
        <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      )}
      {description && <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div class="mt-4">{action}</div>}
    </div>
  )
}
