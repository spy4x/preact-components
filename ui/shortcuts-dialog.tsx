import type { JSX } from "preact"
import { Kbd, type KbdLabels } from "./kbd.tsx"
import { Modal } from "./modal.tsx"

/** One row of {@link ShortcutsDialog}. A `HotkeyBinding` from `useHotkeys` is one already. */
export interface Shortcut {
  /**
   * The combination, such as `"mod+k"`, or a sequence of presses, such as `"g t"`, drawn with
   * `Kbd`. `useHotkeys` takes one press only, so a sequence row is bound by another matcher.
   */
  keys: string
  /** What it does. A shortcut without one is not listed. */
  description?: string
  /** The heading it is listed under. Left out, it goes under the dialog's default group. */
  group?: string
}

/** A heading of {@link ShortcutsDialog} and the shortcuts under it, in the order given. */
export interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

/**
 * Sort shortcuts into their groups, in the order each group first appears. A shortcut without a
 * description is left out, and one without a group goes under `defaultGroup`.
 *
 * @param shortcuts The shortcuts, in the order to list them.
 * @param defaultGroup The heading for shortcuts that name no group.
 */
export function groupShortcuts(
  shortcuts: readonly Shortcut[],
  defaultGroup: string,
): ShortcutGroup[] {
  const groups: ShortcutGroup[] = []
  for (const shortcut of shortcuts) {
    if (shortcut.description === undefined || shortcut.description === "") continue
    const title = shortcut.group ?? defaultGroup
    let group = groups.find((candidate) => candidate.title === title)
    if (group === undefined) {
      group = { title, shortcuts: [] }
      groups.push(group)
    }
    group.shortcuts.push(shortcut)
  }
  return groups
}

/** Props of {@link ShortcutsDialog}. */
export interface ShortcutsDialogProps {
  /** Whether the dialog is open. The caller owns it, and usually opens it with `?`. */
  open: boolean
  /** Called on Escape, the close button and a backdrop click; set `open` to `false` there. */
  onClose: () => void
  /** The shortcuts to list; pass the same array as `useHotkeys`. */
  shortcuts: readonly Shortcut[]
  /** The dialog's title and accessible name. Defaults to `"Keyboard shortcuts"`. */
  title?: string
  /** The close button's accessible name. Defaults to `"Close"`. */
  closeLabel?: string
  /** The heading of shortcuts that name no group. Defaults to `"General"`. */
  defaultGroup?: string
  /** Whether `Kbd` draws Apple's modifier glyphs; see `KbdProps.apple`. */
  apple?: boolean
  /** The words `Kbd` shows or reads out for a key. */
  kbdLabels?: Partial<KbdLabels>
  /** Extra classes for the dialog element. */
  class?: string
}

/**
 * A dialog that lists keyboard shortcuts, each with what it does and its keys, under group
 * headings. Headings show only when there is more than one group.
 *
 * Built on `Modal`, so Escape, the close button and a backdrop click close it, focus moves into
 * it and returns to where it was. It is controlled: open it from a `useHotkeys` binding and close
 * it in `onClose`.
 */
export function ShortcutsDialog(
  {
    open,
    onClose,
    shortcuts,
    title = "Keyboard shortcuts",
    closeLabel = "Close",
    defaultGroup = "General",
    apple,
    kbdLabels,
    class: className,
  }: ShortcutsDialogProps,
): JSX.Element {
  const groups = groupShortcuts(shortcuts, defaultGroup)
  return (
    <Modal open={open} onClose={onClose} title={title} cancelLabel={closeLabel} class={className}>
      <div class="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.title} class="flex flex-col gap-2">
            {groups.length > 1 && (
              <h3 class="text-xs font-semibold text-muted uppercase">
                {group.title}
              </h3>
            )}
            <dl class="flex flex-col gap-2">
              {group.shortcuts.map((shortcut, index) => (
                <div key={index} class="flex items-center justify-between gap-4">
                  <dt class="text-sm text-foreground">{shortcut.description}</dt>
                  <dd>
                    <Kbd keys={shortcut.keys} apple={apple} labels={kbdLabels} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}
