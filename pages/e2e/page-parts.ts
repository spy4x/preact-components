/**
 * Splits one page's contrast scan into parts of the page, each scanned by a spec of its own, so no
 * scan of a large page comes near a spec's 60-second limit when two shard lanes share an agent
 * (#1052). The parts name whole sections, or a run of one section's cards; a last scan takes
 * everything no part names, so the page is covered whatever is added to it. {@link partGaps} is
 * what a test holds each page's parts to: no section or card in two parts, and no part naming one
 * the page does not draw.
 *
 * @module
 */

/** How many elements one rule fails, or leaves undecided, on one page: `[light, dark]`. */
export type KnownCount = readonly [light: number, dark: number]

/** A run of one section's cards, in the order the page draws them. */
export interface CardRun {
  section: string
  /** The first card of the run, by name; the section's first card when left out. */
  from?: string
  /** The card after the run's last one; the run goes to the section's last card when left out. */
  before?: string
}

/** One part of a page: whole sections, or a run of one section's cards. */
export interface PagePart {
  /** What the spec's name says the part is, such as "the inputs and fields sections". */
  what: string
  sections?: readonly string[]
  cards?: CardRun
  /**
   * The part's share of the page's known contrast counts, keyed as in `KNOWN_VIOLATIONS` and
   * `KNOWN_INCOMPLETE`. A key left out is 0. What the parts do not take stays with the rest of the
   * page.
   */
  known?: Readonly<Record<string, KnownCount>>
}

/** A section as the page draws it: its id and its cards' names, in order. */
export interface DrawnSection {
  id: string
  cards: readonly string[]
}

/**
 * The CSS selectors that pick out a part. A section is `#<id>`; a card is the `article` with the id
 * `demo-<name>`, a direct child of its section's grid.
 */
export function partSelectors(part: PagePart): string[] {
  const sections = (part.sections ?? []).map((id) => `#${id}`)
  if (!part.cards) return sections
  const { section, from, before } = part.cards
  const until = before ? `:has(~ #demo-${before})` : ""
  const run = from
    ? [`#demo-${from}${until}`, `#demo-${from} ~ article${until}`]
    : [`#${section} > div > article${until}`]
  return [...sections, ...run]
}

/** The selectors the scan of the rest of the page leaves out: every part's. */
export function restExcludes(parts: readonly PagePart[]): string[] {
  return parts.flatMap(partSelectors)
}

/**
 * The known counts of the rest of the page: the page's own, less every part's share.
 *
 * @throws When the parts' shares of one key come to more than the page's count, which would leave
 * the rest a negative number to expect.
 */
export function restKnown(
  page: Readonly<Record<string, KnownCount>>,
  parts: readonly PagePart[],
): Record<string, KnownCount> {
  const rest: Record<string, [number, number]> = Object.fromEntries(
    Object.entries(page).map(([key, [light, dark]]) => [key, [light, dark]]),
  )
  for (const part of parts) {
    for (const [key, [light, dark]] of Object.entries(part.known ?? {})) {
      const left = rest[key] ?? [0, 0]
      left[0] -= light
      left[1] -= dark
      if (left[0] < 0 || left[1] < 0) {
        throw new Error(`the parts take more "${key}" than the page's ${page[key] ?? [0, 0]}`)
      }
      rest[key] = left
    }
  }
  return rest
}

/**
 * What is wrong with a page's parts, against the sections it draws: a section or card no section of
 * the page has, a run whose `from` comes after its `before`, and a section or card that falls in two
 * parts. Empty when every element of the page falls in one part at most, so that with the rest of
 * the page it is scanned exactly once.
 */
export function partGaps(drawn: readonly DrawnSection[], parts: readonly PagePart[]): string[] {
  const problems: string[] = []
  const owner = new Map<string, string>()
  const claim = (item: string, part: PagePart) => {
    const other = owner.get(item)
    if (other !== undefined) problems.push(`${item} is in "${other}" and in "${part.what}"`)
    owner.set(item, part.what)
  }
  for (const part of parts) {
    for (const id of part.sections ?? []) {
      const section = drawn.find((candidate) => candidate.id === id)
      if (!section) {
        problems.push(`"${part.what}" names the section ${id}, which the page does not draw`)
        continue
      }
      claim(`section ${id}`, part)
      for (const card of section.cards) claim(`card ${card}`, part)
    }
    if (!part.cards) continue
    const { section: id, from, before } = part.cards
    const section = drawn.find((candidate) => candidate.id === id)
    if (!section) {
      problems.push(`"${part.what}" names the section ${id}, which the page does not draw`)
      continue
    }
    const start = from === undefined ? 0 : section.cards.indexOf(from)
    const end = before === undefined ? section.cards.length : section.cards.indexOf(before)
    for (const [name, at] of [[from, start], [before, end]] as const) {
      if (name !== undefined && at < 0) {
        problems.push(`"${part.what}" names the card ${name}, which ${id} does not draw`)
      }
    }
    if (start < 0 || end < 0) continue
    if (start >= end) problems.push(`"${part.what}" runs from ${from} to before ${before}: no card`)
    for (const card of section.cards.slice(start, end)) claim(`card ${card}`, part)
  }
  return problems
}
