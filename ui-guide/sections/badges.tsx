import { useSignal } from "@preact/signals"
import {
  Badge,
  type BadgeTone,
  type BadgeVariant,
  Cluster,
  Stack,
  StatusMark,
  type StatusMarkStatus,
} from "@spy4x/preact-ui"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

/**
 * Every tone the primitive accepts.
 *
 * The record is the coverage guard, not the demo: `Record<BadgeTone, …>` stops compiling when a
 * tone is added to or removed from `BadgeTone`, so the catalogue cannot drift behind the
 * component's palette.
 */
const tones: Record<BadgeTone, string> = {
  primary: "primary",
  primaryStrong: "primaryStrong",
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
}

const variants: Record<BadgeVariant, string> = {
  filled: "filled",
  outline: "outline",
}

/** One row per variant, each row every tone, with the variant named in a fixed-width column. */
function BadgeMatrix() {
  return (
    <Stack gap="sm">
      {entries(variants).map(([variant, variantLabel]) => (
        <Cluster key={variant} align="baseline" class="flex-nowrap">
          <span class="w-16 shrink-0 text-xs text-muted">{variantLabel}</span>
          <Cluster>
            {entries(tones).map(([tone, label]) => (
              <Badge key={tone} variant={variant} tone={tone} text={label} />
            ))}
          </Cluster>
        </Cluster>
      ))}
    </Stack>
  )
}

/**
 * Element content: a whole-pill link holding a word and a `StatusMark`, and a static pill with a
 * link inside it. The link points at this repository's public CI runs. Then a linked badge with a
 * `navigate` port that only records where it was asked to go, so a plain click shows its href below
 * instead of leaving the page.
 */
function BadgeContentRow() {
  const navigated = useSignal<string | null>(null)
  return (
    <Stack gap="sm">
      <Cluster align="baseline" class="flex-nowrap">
        <span class="w-16 shrink-0 text-xs text-muted">content</span>
        <Cluster>
          <Badge tone="neutral" href={CI_RUNS}>
            <span>CI</span>
            <StatusMark status="ready" label="Passing" />
          </Badge>
          <Badge tone="neutral" variant="outline">
            <StatusMark status="beta" />
            <a href={CI_RUNS} class="underline underline-offset-4">notes</a>
          </Badge>
        </Cluster>
      </Cluster>
      <Cluster align="baseline" class="flex-nowrap">
        <span class="w-16 shrink-0 text-xs text-muted">routed</span>
        <Cluster>
          <Badge
            text="system page"
            tone="info"
            variant="outline"
            href="#/system"
            navigate={(href) => navigated.value = href}
          />
          <span class="text-sm text-muted" data-e2e="badge-navigated">
            {navigated.value === null ? "navigate not called yet" : `navigate(${navigated.value})`}
          </span>
        </Cluster>
      </Cluster>
    </Stack>
  )
}

const CI_RUNS = "https://github.com/spy4x/preact-components/actions"

/** Every status a `StatusMark` accepts, for the coverage guard — see {@link tones}. */
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
        name: "navigate",
        type: "(href: string) => void",
        description: "With `href`: called on a plain click instead of the browser following the " +
          "link, as on `Link` and `Button`. A modified click, or a link to another site, stays " +
          "the browser's.",
      },
      {
        name: "tone",
        type: "BadgeTone",
        default: `"primary"`,
        description: "One of the seven tones shown here, named as on `Notice` and `Progress`. " +
          "`primary` and `primaryStrong` are the theme's accent: they follow `--color-primary` in " +
          "light and `--color-accent` in both. `primaryStrong` is a dark pill in both variants, " +
          "for a counter on a dark surface.",
      },
      {
        name: "variant",
        type: `"filled" | "outline"`,
        default: `"filled"`,
        description: "Tinted, or only outlined.",
      },
      {
        name: "color",
        type: "BadgeColor",
        description: "Deprecated: use `tone`. The old palette names still draw their tone: `red` " +
          "`danger`, `orange` `warning`, `green` `success`, `gray` `neutral`, `blue` `info`, " +
          "`purple` `primary`, `purpleNav` `primaryStrong`.",
      },
      {
        name: "type",
        type: `"filled" | "outline"`,
        description: "Deprecated: use `variant`, which takes the same values.",
      },
    ],
    snippet: `<Badge text="paid" tone="success" />
<Badge text="draft" tone="neutral" variant="outline" />
<Badge tone="neutral" href="https://ci.example.com/my-repo">
  <span>CI</span>
  <StatusMark status="ready" label="Passing" />
</Badge>
<Badge text="system page" href="/system" navigate={router.navigate} />`,
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
