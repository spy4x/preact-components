import { cn } from "@spy4x/preact-cn"
import { IconAlertTriangle, IconCheckCircle, IconInformationCircle } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"

/** What a {@link Notice} is about: news (`info`), something to act on (`warning`), or a success. */
export type NoticeTone = "info" | "warning" | "success"

export interface NoticeProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title" | "role" | "class" | "icon"> {
  /** Defaults to `"info"`. Sets the border, the tint and the glyph. */
  tone?: NoticeTone
  /** The first line, in a heavier weight. Not a heading, so a banner leaves the outline alone. */
  title?: string
  /** The body under the title: a sentence, or richer markup such as a paragraph with a link. */
  children?: ComponentChildren
  /** A caller-owned control (`Button`, link, form) beside the text, or under it on a narrow row. */
  action?: ComponentChildren
  /**
   * Announces the notice at once, interrupting the screen reader (`role="alert"`). Leave it off
   * for anything that can wait: the default `role="status"` is read when the reader is idle.
   */
  urgent?: boolean
  class?: string
}

/**
 * Each tone draws from its theme tokens: the border from the tone's text colour
 * (`--color-info`, `--color-warning`, `--color-success`), the background from its soft tint
 * (`--color-info-soft`, …), so an app that repaints them sees the panel follow, in both palettes.
 * The text stays `text-foreground`, which reads at 4.5:1 or better on every tint; the tone's
 * colour is on the border and the glyph only.
 */
const toneClasses: Record<NoticeTone, string> = {
  info: "border-info bg-info-soft",
  warning: "border-warning bg-warning-soft",
  success: "border-success bg-success-soft",
}

const glyphClasses: Record<NoticeTone, string> = {
  info: "size-5 text-info",
  warning: "size-5 text-warning",
  success: "size-5 text-success",
}

/**
 * A glyph per tone, so the tone does not rest on colour alone. Hidden from assistive tech: the
 * notice's words say what it is about.
 */
function Glyph({ tone }: { tone: NoticeTone }): JSX.Element {
  const className = glyphClasses[tone]
  if (tone === "warning") return <IconAlertTriangle class={className} />
  if (tone === "success") return <IconCheckCircle class={className} />
  return <IconInformationCircle class={className} />
}

/**
 * A banner for a message that is not an error: a trial that ends soon, a plan that will lapse, a
 * change that was saved. Errors belong to `ErrorState`.
 *
 * Every string is a prop: the component owns layout and tone, never copy. With no title, no body
 * and no action it renders `null`, so a caller can pass a possibly-empty notice straight through.
 * Any other attribute, such as `id` or `data-*`, lands on the root.
 *
 * @param props Tone, slots and caller attributes, see {@link NoticeProps}.
 * @returns The banner, or `null` when every slot is empty.
 */
export function Notice(
  { tone = "info", title, children, action, urgent = false, class: className, ...rest }:
    NoticeProps,
): JSX.Element | null {
  const hasBody = children !== undefined && children !== null && children !== false &&
    children !== ""
  if (!title && !hasBody && !action) return null

  return (
    <div
      {...rest}
      role={urgent ? "alert" : "status"}
      class={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border p-4 text-sm text-foreground",
        toneClasses[tone],
        className,
      )}
    >
      <Glyph tone={tone} />
      <div class="min-w-0 flex-1">
        {title && <p class="font-medium">{title}</p>}
        {hasBody && <div class={title ? "mt-1" : undefined}>{children}</div>}
      </div>
      {action && <div class="shrink-0">{action}</div>}
    </div>
  )
}
