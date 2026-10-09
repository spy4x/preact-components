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
          <span class="w-16 shrink-0 text-xs text-muted">{typeLabel}</span>
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

/**
 * Element content: a whole-pill link holding a word and a `StatusMark`, and a static pill with a
 * link inside it. The link points at this repository's public CI runs.
 */
function BadgeContentRow() {
  return (
    <Cluster align="baseline" class="flex-nowrap">
      <span class="w-16 shrink-0 text-xs text-muted">content</span>
      <Cluster>
        <Badge color="gray" href={CI_RUNS}>
          <span>CI</span>
          <StatusMark status="ready" label="Passing" />
        </Badge>
        <Badge color="gray" type="outline">
          <StatusMark status="beta" />
          <a href={CI_RUNS} class="underline underline-offset-4">notes</a>
        </Badge>
      </Cluster>
    </Cluster>
  )
}

const CI_RUNS = "https://github.com/spy4x/preact-components/actions"

/** Every status a `StatusMark` accepts, for the coverage guard — see {@link colors}. */
const statuses: Record<StatusMarkStatus, string> = {
  ready: "ready",
  "in-use": "in-use",
  beta: "beta",
  wip: "wip",
  paused: "paused",
  archived: "archived",
  "known-issue": "known-issue",
  outcome: "outcome",
  live: "live",
  offline: "offline",
}

/** The ten statuses in rows of at most three, so no row wraps a lone status at half width. */
function StatusMarkRow() {
  const all = entries(statuses)
  const rows = [all.slice(0, 3), all.slice(3, 6), all.slice(6, 8), all.slice(8)]
  return (
    <Stack gap="sm">
      {rows.map((row) => (
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
      {
        name: "text",
        type: "string",
        description:
          "A plain text label, shown in the case you give it. Give this or `children`, not both.",
      },
      {
        name: "children",
        type: "ComponentChildren",
        description: "Element content in place of `text`, such as a `StatusMark` beside a word, " +
          "or a link inside the pill; its parts get a small gap.",
      },
      {
        name: "href",
        type: "string",
        description: "Makes the whole pill one link, with the focus ring; its content is the " +
          "link's name.",
      },
      {
        name: "color",
        type: "BadgeColor",
        default: `"purple"`,
        description: "One of the seven palette entries shown here. `purple` and `purpleNav` are " +
          "the theme's accent: they follow `--color-primary` in light and `--color-accent` in both.",
      },
      {
        name: "type",
        type: `"filled" | "outline"`,
        default: `"filled"`,
        description: "Tinted, or only outlined.",
      },
    ],
    snippet: `<Badge text="paid" color="green" />
<Badge text="draft" color="gray" type="outline" />
<Badge color="gray" href="https://ci.example.com/my-repo">
  <span>CI</span>
  <StatusMark status="ready" label="Passing" />
</Badge>`,
    render: () => (
      <Stack gap="sm">
        <BadgeMatrix />
        <BadgeContentRow />
      </Stack>
    ),
  },
  StatusMark: {
    summary:
      "A project's or a feature's lifecycle state, as a shape and a word that read without colour.",
    wide: false,
    snippet: `<StatusMark status="ready" />
<StatusMark status="known-issue" label="Flaky on Safari" />
<StatusMark status="outcome" label="Acquired 2023" />`,
    render: () => <StatusMarkRow />,
  },
} satisfies DemoFragment
