import {
  Badge,
  type BadgeColor,
  type BadgeType,
  CiStatusPill,
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

/** Every status a `StatusMark` accepts (#257), for the coverage guard — see {@link colors}. */
const statuses: Record<StatusMarkStatus, string> = {
  ready: "ready",
  beta: "beta",
  wip: "wip",
  paused: "paused",
  archived: "archived",
  "known-issue": "known-issue",
}

function StatusMarkRow() {
  return (
    <div class="flex flex-wrap items-center gap-4">
      {entries(statuses).map(([status]) => <StatusMark key={status} status={status} />)}
    </div>
  )
}

function CiStatusPillRow() {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <CiStatusPill status="passing" />
      <CiStatusPill status="failing" />
      <CiStatusPill status="running" />
      <CiStatusPill status="queued" />
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
  StatusMark: {
    summary:
      "A shape paired with a word (#257): `ready`/`beta`/`wip`/`paused`/`archived`/`known-issue`. The shape is decorative (`aria-hidden`) and told apart without colour — six distinct silhouettes — while `label` carries the real meaning as text. A new component beside `Badge`, not a change to it.",
    snippet: `<StatusMark status="ready" />
<StatusMark status="known-issue" label="Flaky on Safari" />`,
    render: () => <StatusMarkRow />,
  },
  CiStatusPill: {
    summary:
      "A CI status string mapped to a coloured pill, extending `Badge`'s palette. Presentational only — fetching the actual CI state is the consuming site's job. A status this component does not recognise (anything but `passing`/`failing`/`running`) falls back to a neutral pill instead of throwing.",
    snippet: `<CiStatusPill status="passing" />
<CiStatusPill status="queued" />  {/* unrecognised → neutral pill, its own text */}`,
    render: () => <CiStatusPillRow />,
  },
} satisfies DemoFragment
