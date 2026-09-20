import { Badge, type BadgeColor, type BadgeType } from "@preact-components/ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/**
 * Every palette entry the primitive accepts.
 *
 * The record is the coverage guard, not the demo: `Record<BadgeColor, …>` stops compiling when a
 * colour is added to or removed from `BadgeColor`, so the catalogue cannot drift behind the
 * component's palette the way it drifted behind `.btn-sm`.
 */
const colors: Record<BadgeColor, string> = {
  red: "red",
  orange: "orange",
  green: "green",
  gray: "gray",
  blue: "blue",
  purple: "purple",
  purpleNav: "purpleNav",
}

const types: Record<BadgeType, string> = {
  filled: "filled (default)",
  outline: "outline",
}

function BadgeMatrix() {
  return (
    <div class="space-y-2">
      {entries(types).map(([type, typeLabel]) => (
        <div key={type} class="flex flex-wrap items-center gap-2">
          <span class="w-32 text-xs text-gray-500 dark:text-gray-400">{typeLabel}</span>
          {entries(colors).map(([color, label]) => (
            <Badge key={color} type={type} color={color} text={label} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const badgeDemos = {
  Badge: {
    summary:
      "Status pill. Static: takes `text`, renders a `span`. `color` defaults to `purple`, `type` to `filled`.",
    snippet: `<Badge text="paid" color="green" />
<Badge text="draft" color="gray" type="outline" />`,
    render: () => <BadgeMatrix />,
  },
} satisfies DemoFragment
