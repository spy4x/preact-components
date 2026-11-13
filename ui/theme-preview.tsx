import { join } from "@spy4x/preact-cn/join"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import { RadioChips } from "./radio-chips.tsx"
import { useLabels } from "./i18n.tsx"

/** The words of a {@link ThemePreview}. */
export interface ThemePreviewLabels {
  /** The switch's legend. Defaults to `"Theme"`. */
  legend?: string
  /** Defaults to `"Dark"`. */
  dark?: string
  /** Defaults to `"Light"`. */
  light?: string
}

/** Props of {@link ThemePreview}. */
export interface ThemePreviewProps {
  /** What the frame shows: real components, drawn in the chosen palette. */
  children: ComponentChildren
  /** The palette checked in the server markup. Defaults to `"dark"`. */
  defaultTheme?: "dark" | "light"
  /** Shared `name` of the two radios. Defaults to an id from `useId`. */
  name?: string
  labels?: ThemePreviewLabels
  /** Keeps the legend for screen readers only. */
  hideLegend?: boolean
  /** Utilities on the root. */
  class?: string
  /** Utilities added to the frame. */
  frameClass?: string
  /**
   * Extra attributes on each radio, by its value, such as an analytics event:
   * `{ light: { "data-umami-event": "theme-light" } }`. The radio's own `data-preview-theme`, which
   * the palette is chosen by, wins over an attribute of the same name.
   */
  inputAttributes?: Partial<Record<"dark" | "light", Record<string, string>>>
}

/** The English words of `ThemePreview`. */
const THEME_PREVIEW_LABELS: Required<ThemePreviewLabels> = {
  legend: "Theme",
  dark: "Dark",
  light: "Light",
}

/**
 * A frame that shows its children in the library's dark or light palette, switched by a Dark /
 * Light `RadioChips` pair, with no script.
 *
 * The palette lives in `@spy4x/preact-theme`'s opt-in `theme-preview.css`: while a radio is
 * checked, `:has()` declares that palette's tokens on the frame alone, so the page around it keeps
 * its own. `preact-theme`'s `dark` variant follows the frame too, so `dark:` utilities inside it
 * match the frame's palette, not the page's. The frame draws the canvas, a
 * border and the text colour of its palette. The radios are native, so Tab reaches the checked one
 * and the arrow keys switch it.
 *
 * The frame shows the library's own palette, not the app's: an app that wants its brand inside sets
 * its tokens on `[data-preview-frame]` itself.
 */
export function ThemePreview(
  {
    children,
    defaultTheme = "dark",
    name,
    labels,
    hideLegend = false,
    class: className,
    frameClass,
    inputAttributes,
  }: ThemePreviewProps,
): JSX.Element {
  const generated = useId()
  const words = useLabels("ThemePreview", THEME_PREVIEW_LABELS, labels)
  const { dark, light } = words
  return (
    <div class={join("flex flex-col gap-3", className)}>
      <RadioChips
        legend={words.legend}
        hideLegend={hideLegend}
        name={name ?? `theme-preview-${generated}`}
        defaultValue={defaultTheme}
        options={[
          {
            value: "dark",
            label: dark,
            inputAttributes: { ...inputAttributes?.dark, "data-preview-theme": "dark" },
          },
          {
            value: "light",
            label: light,
            inputAttributes: { ...inputAttributes?.light, "data-preview-theme": "light" },
          },
        ]}
      />
      <div
        data-preview-frame=""
        class={join(
          "rounded-card border border-subtle bg-canvas p-6 text-foreground",
          frameClass,
        )}
      >
        {children}
      </div>
    </div>
  )
}
