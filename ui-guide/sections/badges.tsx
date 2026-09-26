import {
  Badge,
  type BadgeColor,
  type BadgeType,
  Cluster,
  Stack,
  StatusMark,
  type StatusMarkStatus,
} from "@spy4x/preact-ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/**
 * Every palette entry the primitive accepts.
 *
 * The record is the coverage guard, not the demo: `Record<BadgeColor, …>` stops compiling when a
 * colour is added to or removed from `BadgeColor`, so the catalogue cannot drift behind the
 * component's palette.
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
  filled: "filled",
  outline: "outline",
}

/** One row per type, each row every colour, with the type named in a fixed-width first column. */
function BadgeMatrix() {
  return (
    <Stack gap="sm">
      {entries(types).map(([type, typeLabel]) => (
        <Cluster key={type} align="baseline" class="flex-nowrap">
          <span class="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">{typeLabel}</span>
          <Cluster>
            {entries(colors).map(([color, label]) => (
              <Badge key={color} type={type} color={color} text={label} />
            ))}
          </Cluster>
        </Cluster>
      ))}
    </Stack>
  )
}

/** Every status a `StatusMark` accepts, for the coverage guard — see {@link colors}. */
const statuses: Record<StatusMarkStatus, string> = {
  ready: "ready",
  beta: "beta",
  wip: "wip",
  paused: "paused",
  archived: "archived",
  "known-issue": "known-issue",
}

/** The six statuses in two rows of three, so no status wraps alone at half width. */
function StatusMarkRow() {
  return (
    <Stack gap="sm">
      {[entries(statuses).slice(0, 3), entries(statuses).slice(3)].map((row) => (
        <Cluster key={row[0][0]} gap="md">
          {row.map(([status]) => <StatusMark key={status} status={status} />)}
        </Cluster>
      ))}
    </Stack>
  )
}

export const badgeDemos = {
  Badge: {
    summary: "A small coloured label for a status or a category, filled or outlined.",
    wide: true,
    props: [
      { name: "text", type: "string", description: "The label." },
      {
        name: "color",
        type: "BadgeColor",
        default: `"purple"`,
        description: "One of the seven palette entries shown here.",
      },
      {
        name: "type",
        type: `"filled" | "outline"`,
        default: `"filled"`,
        description: "Tinted, or only outlined.",
      },
    ],
    snippet: `<Badge text="paid" color="green" />
<Badge text="draft" color="gray" type="outline" />`,
    render: () => <BadgeMatrix />,
  },
  StatusMark: {
    summary:
      "A project's or a feature's lifecycle state, as a shape and a word that read without colour.",
    wide: false,
    snippet: `<StatusMark status="ready" />
<StatusMark status="known-issue" label="Flaky on Safari" />`,
    render: () => <StatusMarkRow />,
  },
} satisfies DemoFragment
