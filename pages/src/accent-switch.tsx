/**
 * The header's accent switch: repaints the page in another accent colour, so a reader sees every
 * component follow the theme's tokens rather than a colour written into its classes (#380).
 *
 * It does what an app does: it writes `--color-primary` and `--color-accent` on `:root`, in a
 * stylesheet placed after the theme's (`theme/README.md` → "Theming" → "Accent"). `--color-primary`
 * alone recolours the light palette; `--color-accent` carries the colour into the dark one too,
 * where `--color-primary` is near-black chrome. The default entry removes the stylesheet, which
 * puts the page back on the theme's own purple.
 */

import { useState } from "preact/hooks"

/** The id of the stylesheet the switch writes, which `pages/checks/theme.ts` also reads. */
export const ACCENT_STYLE_ID = "accent-override"

/** One entry of the switch: its name and the colour it sets, `undefined` for the theme's own. */
interface Accent {
  label: string
  color: string | undefined
}

/**
 * The accents offered. Each is Tailwind's 800 step of its hue, about as dark as the default
 * purple-900, because the components set white text on step 900 of the scale.
 */
export const ACCENTS: Record<string, Accent> = {
  purple: { label: "Purple", color: undefined },
  blue: { label: "Blue", color: "oklch(0.424 0.199 265.638)" },
  green: { label: "Green", color: "oklch(0.448 0.119 151.328)" },
  rose: { label: "Rose", color: "oklch(0.455 0.188 13.697)" },
}

/**
 * Write the stylesheet for `color`, or remove it for the theme's own accent.
 *
 * @param color The accent to set, or `undefined` for none.
 */
function applyAccent(color: string | undefined): void {
  document.getElementById(ACCENT_STYLE_ID)?.remove()
  if (color === undefined) return
  const style = document.createElement("style")
  style.id = ACCENT_STYLE_ID
  style.textContent = `:root { --color-primary: ${color}; --color-accent: ${color}; }`
  document.head.append(style)
}

/** A labelled `<select>` of {@link ACCENTS}. Not remembered: every page view starts on purple. */
export function AccentSwitch() {
  const [accent, setAccent] = useState("purple")
  return (
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <span class="hidden md:inline">Accent</span>
      <select
        value={accent}
        aria-label="Accent colour"
        data-e2e="accent-switch"
        class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        onChange={(event) => {
          const next = event.currentTarget.value
          setAccent(next)
          applyAccent(ACCENTS[next]?.color)
        }}
      >
        {Object.entries(ACCENTS).map(([id, { label }]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
    </label>
  )
}
