import { join } from "@spy4x/preact-cn/join"
import { IconAdjustmentsHorizontal } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useSignal } from "@preact/signals"
import { useEffect, useId } from "preact/hooks"
import { useLabels } from "./i18n.tsx"

/** Props of {@link Explorable}. */
export interface ExplorableProps {
  /** The figure's `id`, so the text around it can link to it. Generated when left out. */
  id?: string
  /** The figure's name: one short line, set as a paragraph so a table of contents skips it. */
  title: string
  /** One line under the title on what to try. */
  lead?: ComponentChildren
  /** What the controls change: a chart, a number, a table. */
  children: ComponentChildren
  /** The controls, such as `Slider`s, drawn under the result. */
  controls?: ComponentChildren
  /** The figure's caption, under everything, left-aligned: the source, or what the figure shows. */
  caption?: ComponentChildren
  /**
   * Whether the controls work. While it is `false` the controls sit in a disabled `<fieldset>` and
   * the "Interactive" line is hidden. Left out, the figure turns live by itself once it runs in a
   * browser, so the server markup is the disabled one and hydration switches it on.
   */
  live?: boolean
  /** Shown only when scripts are off, inside `<noscript>`: what the figure shows without them. */
  noScriptNote?: ComponentChildren
  /** The words of the line above the title. Defaults to `"Interactive"`. */
  interactiveLabel?: string
  class?: string
}

/** The English words of `Explorable`, each one a prop of its own. */
const EXPLORABLE_LABELS: Required<Pick<ExplorableProps, "interactiveLabel">> = {
  interactiveLabel: "Interactive",
}

/**
 * A frame for an interactive figure inside an article: a result and the controls that change it.
 *
 * A `<figure>` on the card surface with a hairline border and the card radius. Above the title, a
 * small "Interactive" line with an icon says the figure can be played with; it shows only once the
 * controls work, so a page read before its scripts run never promises what it cannot do. The title
 * is a `<p>`, not a heading, so an article's table of contents does not list every figure. The
 * figure is named by its title, and `caption` is its `<figcaption>`.
 *
 * Until it is live, the controls sit in `<fieldset disabled>`: the browser disables every control
 * inside at once, in the server markup too, so nothing is clickable before the code behind it has
 * loaded. With scripts off (`@media (scripting: none)`) the controls are also dimmed, so they do
 * not look usable; while scripts run that rule never matches, so nothing flashes before
 * hydration.
 *
 * Classes are joined with `join`, not `cn`, so the island that hydrates the figure carries no
 * tailwind-merge: a caller's `class` is added to the frame's own, not merged over it.
 *
 * @param props The title, the result, the controls and the caption, see {@link ExplorableProps}.
 * @returns The figure.
 */
export function Explorable({
  id,
  title,
  lead,
  children,
  controls,
  caption,
  live,
  noScriptNote,
  interactiveLabel: interactiveLabelProp,
  class: className,
}: ExplorableProps): JSX.Element {
  const { interactiveLabel } = useLabels(
    "Explorable",
    EXPLORABLE_LABELS,
    { interactiveLabel: interactiveLabelProp },
  )
  const generated = useId()
  const figureId = id ?? `explorable-${generated}`
  const titleId = `${figureId}-title`
  const mounted = useSignal(false)
  useEffect(() => {
    mounted.value = true
  }, [])
  const working = live ?? mounted.value

  return (
    <figure
      id={figureId}
      aria-labelledby={titleId}
      data-live={working ? "true" : "false"}
      class={join(
        "flex min-w-0 flex-col gap-6 rounded-card border border-subtle bg-surface p-4 sm:p-6",
        className,
      )}
    >
      <div class="flex flex-col gap-1">
        <p
          hidden={!working}
          class="flex items-center gap-1 text-xs font-medium text-muted"
          data-explorable-badge
        >
          <IconAdjustmentsHorizontal class="size-4" />
          {interactiveLabel}
        </p>
        <p id={titleId} class="text-base font-semibold text-balance text-foreground">{title}</p>
        {lead !== undefined && <p class="text-sm text-muted">{lead}</p>}
      </div>
      <div class="min-w-0">{children}</div>
      {controls !== undefined && (
        <fieldset
          disabled={!working}
          class="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 noscript:opacity-50"
        >
          {controls}
        </fieldset>
      )}
      {noScriptNote !== undefined && (
        <noscript>
          <p class="text-sm text-muted">{noScriptNote}</p>
        </noscript>
      )}
      {caption !== undefined && (
        <figcaption class="text-start text-sm text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
