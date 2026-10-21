/**
 * Letting a person reorder and hide the parts of a page, such as a dashboard's widgets or a
 * table's columns: the dialog ({@link LayoutCustomiser}) and the merge that keeps a saved layout
 * valid as the parts change ({@link mergeLayout}).
 */

import type { JSX } from "preact"
import { Badge } from "./badge.tsx"
import { Button } from "./button.tsx"
import { Modal } from "./modal.tsx"
import { SortableList } from "./sortable-list.tsx"
import { ToggleSwitch } from "./toggle-switch.tsx"

/** One part's place in a saved layout: its id and whether the person hid it. */
export interface LayoutEntry {
  id: string
  hidden: boolean
}

/**
 * A saved layout made valid for the parts that exist now, in the saved order.
 *
 * An id that is no longer available is dropped, and so is a repeat of an id or an entry that is not
 * `{ id, hidden }` at all, since a saved layout comes from storage and may be old or damaged. An
 * available id the layout does not mention is added at the end, shown, so a new part appears
 * without anyone migrating the stored layouts. With nothing saved, the answer is `available` in its
 * own order, all shown.
 *
 * @param saved The stored layout, or anything read where one should be.
 * @param available The ids of the parts the person may see, in their default order.
 */
export function mergeLayout(saved: unknown, available: readonly string[]): LayoutEntry[] {
  const known = new Set(available)
  const merged: LayoutEntry[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(saved) ? saved : []) {
    if (typeof entry !== "object" || entry === null) continue
    const { id, hidden } = entry as Record<string, unknown>
    if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue
    seen.add(id)
    merged.push({ id, hidden: hidden === true })
  }
  for (const id of available) if (!seen.has(id)) merged.push({ id, hidden: false })
  return merged
}

/**
 * `layout` with the entry `id` hidden or shown; unchanged when `id` is not in it. What a card's own
 * "Hide" item and a row's switch do.
 */
export function setLayoutHidden(
  layout: readonly LayoutEntry[],
  id: string,
  hidden: boolean,
): LayoutEntry[] {
  return layout.map((entry) => entry.id === id ? { id, hidden } : entry)
}

/** `layout` with the entry at `from` moved to `to`, as `SortableList`'s `onMove` reports it. */
export function moveLayoutEntry(
  layout: readonly LayoutEntry[],
  from: number,
  to: number,
): LayoutEntry[] {
  const next = [...layout]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return [...layout]
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

/** One row of the {@link LayoutCustomiser}: an entry and the name the person knows it by. */
export interface LayoutCustomiserItem extends LayoutEntry {
  title: string
}

/** The words of a {@link LayoutCustomiser}. */
export interface LayoutCustomiserLabels {
  /** Each row's switch. */
  show: (title: string) => string
  /** The tag on a hidden row. */
  hidden: string
  /** The list's accessible name. */
  list: string
  /** The button that puts the default layout back. */
  reset: string
  /** The button that closes the dialog. */
  done: string
}

/** The English defaults of {@link LayoutCustomiserLabels}. */
export const defaultLayoutCustomiserLabels: LayoutCustomiserLabels = {
  show: (title) => `Show ${title}`,
  hidden: "Hidden",
  list: "Parts",
  reset: "Reset to default",
  done: "Done",
}

/** What {@link LayoutCustomiser} takes. */
export interface LayoutCustomiserProps {
  open: boolean
  /** Closes the dialog: "Done", Escape, the close button. */
  onClose: () => void
  /** The dialog's title, such as "Customise overview". */
  title: string
  /** One muted line under the title. */
  description?: string
  /** Every part the person may see, in the current order. */
  items: readonly LayoutCustomiserItem[]
  /** The whole new layout after one move or one switch; the caller applies and saves it. */
  onChange: (layout: LayoutEntry[]) => void
  /** Puts the default layout back. Omitted, the dialog has no reset button. */
  onReset?: () => void
  /** Why the last change could not be saved, shown under the list. */
  error?: string | null
  labels?: Partial<LayoutCustomiserLabels>
  /** Stamps `data-e2e` on the dialog. */
  dataE2E?: string
}

/**
 * A dialog that reorders and hides the parts of a page: a `SortableList` (drag a handle, or use the
 * keyboard) with a switch per row. Every change goes to `onChange` at once, so the page behind
 * follows it and the caller saves it; the only buttons are "Reset to default" and "Done", because
 * there is nothing to confirm. A failed save shows `error` under the list.
 *
 * @param props See {@link LayoutCustomiserProps}.
 */
export function LayoutCustomiser(
  { open, onClose, title, description, items, onChange, onReset, error, labels, dataE2E }:
    LayoutCustomiserProps,
): JSX.Element {
  const text = { ...defaultLayoutCustomiserLabels, ...labels }
  const layout = items.map(({ id, hidden }) => ({ id, hidden }))
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      dataE2E={dataE2E}
      footer={
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {onReset ? <Button variant="ghost" onClick={onReset}>{text.reset}</Button> : <span />}
          <Button variant="primary" class="w-full sm:w-auto" onClick={onClose}>
            {text.done}
          </Button>
        </div>
      }
    >
      <div class="flex flex-col gap-4">
        {description ? <p class="text-sm text-muted">{description}</p> : null}
        <div role="group" aria-label={text.list}>
          <SortableList
            items={items}
            itemLabel={(item) => item.title}
            onMove={(from, to) => onChange(moveLayoutEntry(layout, from, to))}
            renderItem={(item) => (
              <div class="flex min-h-11 items-center gap-2">
                <span
                  class={item.hidden
                    ? "min-w-0 flex-1 truncate text-muted"
                    : "min-w-0 flex-1 truncate"}
                >
                  {item.title}
                </span>
                {item.hidden ? <Badge color="gray" type="outline">{text.hidden}</Badge> : null}
                <ToggleSwitch
                  value={!item.hidden}
                  label={text.show(item.title)}
                  onToggle={(shown) => onChange(setLayoutHidden(layout, item.id, !shown))}
                />
              </div>
            )}
          />
        </div>
        {error ? <p role="alert" class="text-sm text-danger">{error}</p> : null}
      </div>
    </Modal>
  )
}
