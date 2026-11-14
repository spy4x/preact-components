import { cn } from "@spy4x/preact-cn"
import { IconInformationCircle, IconXMark } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import { Button } from "./button.tsx"
import { useLabels } from "./i18n.tsx"
import { TOUCH_TARGET } from "./touch-target.ts"

export interface HelpPopoverProps {
  /**
   * The trigger's visible text, such as "How it works". Required: only the caller knows what the
   * help is about, and the text is also the trigger's accessible name.
   */
  label: string
  /** The panel's heading, and its accessible name. */
  title: ComponentChildren
  /** The explanation: paragraphs, a list, worked examples. */
  children: ComponentChildren
  /** The close button's accessible name. Defaults to `"Close"`, or the catalog's word for it. */
  closeLabel?: string
  /**
   * The panel's id, which the trigger points at. Left out, one comes from `useId`. Pass one when
   * the page is rendered in separate pieces, where two generated ids could repeat.
   */
  id?: string
  /** Utilities added to the panel, merged with `cn`. */
  class?: string
  /** `data-e2e` on the trigger; the panel gets the same value with `-panel` after it. */
  dataE2E?: string
}

/** The English words of `HelpPopover`, each one a prop of its own. */
const HELP_POPOVER_LABELS: Required<Pick<HelpPopoverProps, "closeLabel">> = {
  closeLabel: "Close",
}

/**
 * The panel: centred in the viewport as the platform places a popover, never wider than the
 * screen less a 16 px gutter on each side, never taller than it less the same (`100%` of the
 * viewport the popover is fixed to, which leaves out a scrollbar where `100vw` would not), with
 * the body scrolling inside. `open:flex`, never a bare `flex`: an author `display` would beat the
 * platform's `display: none` on a closed popover and draw it on the page.
 */
const surfaceClasses =
  "m-auto max-h-[calc(100%-2rem)] w-[min(32rem,calc(100%-2rem))] rounded-lg border border-subtle bg-surface pc-focus-offset-surface p-0 text-foreground shadow-popover backdrop:bg-scrim open:flex open:flex-col"

/**
 * Once hydrated, hides the open panel `panelId` after focus leaves it, so focus never sits on a
 * control the panel covers, after Tab or Shift+Tab. It looks once focus has moved. It leaves the
 * panel open when focus went nowhere (a click on plain text, which light dismiss handles), or to
 * the trigger by a mouse: that click toggles the panel itself, and hiding it first would reopen
 * it. The trigger reached by the keyboard shows `:focus-visible`, and then the panel hides.
 */
function hideWhenFocusLeaves(panelId: string) {
  setTimeout(() => {
    const panel = document.getElementById(panelId)
    const active = document.activeElement
    if (!panel?.matches(":popover-open") || !active || active === document.body) return
    if (panel.contains(active)) return
    const toTrigger = active.getAttribute("popovertarget") === panelId
    if (toTrigger && !active.matches(":focus-visible")) return
    panel.hidePopover()
  })
}

/**
 * A help button that opens a short explanation in a panel, with no JavaScript at all.
 *
 * The trigger is a ghost `Button` with an info icon and visible text, 44 px tall on a phone, and
 * `popovertarget` names a native `popover="auto"` panel, so the browser opens it, closes it on
 * Escape or on a click outside, and returns focus to the trigger. The close button is a second
 * `popovertarget` with `popovertargetaction="hide"`. On open, focus moves to the heading
 * (`autofocus` with `tabindex="-1"`), so a screen reader starts at the title and Tab reaches the
 * close button, then the body, which is focusable so a keyboard can scroll it. Once hydrated, Tab
 * or Shift+Tab out of the panel hides it. It renders the same on the server and after hydration.
 *
 * Use it for help a person reads and closes, beside the thing it explains. A form or a decision
 * goes in a `Modal`; one short hint on a control is a `Tooltip`.
 */
export function HelpPopover({
  label,
  title,
  children,
  closeLabel: closeLabelProp,
  id,
  class: className,
  dataE2E,
}: HelpPopoverProps): JSX.Element {
  const { closeLabel } = useLabels("HelpPopover", HELP_POPOVER_LABELS, {
    closeLabel: closeLabelProp,
  })
  const generated = useId()
  const panelId = id ?? `help-${generated}`
  const titleId = `${panelId}-title`

  return (
    <>
      <Button
        variant="ghost"
        class={TOUCH_TARGET}
        popovertarget={panelId}
        aria-haspopup="dialog"
        aria-controls={panelId}
        data-e2e={dataE2E}
      >
        <IconInformationCircle class="size-4" aria-hidden="true" />
        {label}
      </Button>
      <div
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={titleId}
        data-e2e={dataE2E ? `${dataE2E}-panel` : undefined}
        class={cn(surfaceClasses, className)}
        onFocusOut={() => hideWhenFocusLeaves(panelId)}
      >
        <div class="flex items-start justify-between gap-4 border-b border-subtle px-6 py-4">
          <h2
            id={titleId}
            tabIndex={-1}
            autofocus
            class="text-lg font-semibold text-balance focus-visible:outline-hidden"
          >
            {title}
          </h2>
          <Button
            variant="icon"
            size="sm"
            class={TOUCH_TARGET}
            popovertarget={panelId}
            popovertargetaction="hide"
            aria-label={closeLabel}
            title={closeLabel}
          >
            <IconXMark class="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div
          role="region"
          aria-labelledby={titleId}
          tabIndex={0}
          class="flex flex-col gap-3 overflow-y-auto px-6 py-4 text-sm text-pretty focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          {children}
        </div>
      </div>
    </>
  )
}
