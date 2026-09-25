import type { JSX } from "preact"
import { Badge, type BadgeColor } from "./badge.tsx"

/** A CI run's outcome, as most CI providers report it. */
export type CiStatus = "passing" | "failing" | "running" | "unknown"

export interface CiStatusPillProps {
  /**
   * A CI status string, matched case-insensitively against `passing`, `failing` and `running`.
   * Anything else — including a status the caller's provider spells differently, e.g. `"success"` —
   * falls back to the neutral `unknown` pill rather than throwing.
   */
  status: string
  /** Visible text. Defaults to the recognised status's own English word, or the raw string for an
   * unrecognised one — the caller's spelling is more useful to read than a generic "Unknown". */
  label?: string
  class?: string
}

/** Every recognised status's colour, extending {@link Badge}'s own palette. */
const COLORS: Record<CiStatus, BadgeColor> = {
  passing: "green",
  failing: "red",
  running: "blue",
  unknown: "gray",
}

const DEFAULT_LABELS: Record<CiStatus, string> = {
  passing: "Passing",
  failing: "Failing",
  running: "Running",
  unknown: "Unknown",
}

/**
 * Normalise a raw status string to one of the four this component recognises.
 *
 * @param status Any string, e.g. `"Passing"`, `"FAILING"`, `"queued"`.
 * @returns One of {@link CiStatus}; a string this component does not recognise is `"unknown"`.
 */
export function normalizeCiStatus(status: string): CiStatus {
  const normalized = status.trim().toLowerCase()
  return normalized === "passing" || normalized === "failing" || normalized === "running"
    ? normalized
    : "unknown"
}

/**
 * A CI status string mapped to a coloured pill — passing, failing, running, or a neutral `unknown`
 * fallback for anything else.
 *
 * Presentational only: fetching the actual CI state is the consuming site's job, not this
 * component's. Built on {@link Badge}, extending its palette rather than duplicating the pill
 * markup.
 */
export function CiStatusPill({ status, label, class: className }: CiStatusPillProps): JSX.Element {
  const normalized = normalizeCiStatus(status)
  const fallbackText = normalized === "unknown"
    // An empty or all-whitespace status has no caller spelling worth showing — fall back to the
    // same "Unknown" text a recognised status would get, rather than rendering an empty pill.
    ? (status.trim() || DEFAULT_LABELS.unknown)
    : DEFAULT_LABELS[normalized]
  return (
    <Badge
      text={label ?? fallbackText}
      color={COLORS[normalized]}
      class={className}
    />
  )
}
