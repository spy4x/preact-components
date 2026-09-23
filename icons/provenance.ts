/**
 * Provenance check — compares every exported glyph's geometry against the published icon packs
 * named in issue #111's owner comment (2026-09-23): most of this set's glyphs came from Heroicons,
 * a few possibly from an image search with no known licence. Feather and Lucide are compared too,
 * because the earlier shape-based audit (#111) identified some glyphs as those by eye.
 *
 * Packs compared, pinned in `deno.json` → `imports`:
 *
 * - Heroicons v1 (`heroicons@1.0.6`, the last v1 release) — `outline/` and `solid/`, one size (24).
 * - Heroicons v2 (`heroicons@2.2.0`) — `24/`, `20/`, `16/`, each with the style directories that
 *   size actually ships (24 has outline and solid; 20 and 16 have solid only).
 * - Feather (`feather-icons@4.29.2`, MIT) — `dist/icons/`, one style, one size.
 * - Lucide (`lucide-static@1.47.0`, ISC) — `icons/`, one style, one size.
 *
 * Every `.svg` file in each of those directories is read and its geometry-bearing elements —
 * `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` — are normalised the same way
 * this package's own glyphs are, so the two sides compare on equal footing. Presentation attributes
 * (`fill`, `stroke`, `class`, `id`, …) are dropped on both sides; only geometry counts.
 *
 * ## Normalisation
 *
 * A `<path d="…">`'s data is tokenised into command letters (`M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T`,
 * `A`, `Z`, either case) and numbers, ignoring whatever mix of spaces, commas or no separator at all
 * the source used. Each number is rounded to 4 decimal places and re-rendered through
 * `Number.prototype.toString()`, which drops trailing zeros and a leading `0` the same way
 * regardless of how the source wrote it (`"2.0"`, `"2.00"` and `"2"` all become `"2"`). The
 * canonical form is the command letters and rounded numbers joined by single spaces, in document
 * order. `rect`/`circle`/`ellipse`/`line` are normalised the same way over their fixed numeric
 * attributes (`x`/`y`/`width`/`height`/`rx`/`ry`, `cx`/`cy`/`r`, …), composed in one fixed attribute
 * order regardless of the order the source wrote them in. `polyline`/`polygon` normalise every
 * number in `points` the same way `path` normalises `d`.
 *
 * A glyph is one `<svg>`'s set of normalised elements. Because element order inside an `<svg>` is
 * not claimed to matter for identity here (a redrawn glyph could reorder its own elements without
 * changing what it draws), the elements are sorted before joining, so two glyphs compare as sets
 * rather than as sequences — "the normalised element set" the brief asks for.
 *
 * Two glyphs are an **exact match** when every normalised element (numbers included) is identical
 * as a set. They are a **near match** when the *skeleton* is identical — same tag, same path command
 * letters in order, same non-numeric attribute names present — but at least one number differs, which
 * catches a glyph redrawn at a different size or with hand-adjusted coordinates. Anything else is
 * **no match**; for those, the closest candidate across the whole corpus by skeleton overlap is
 * reported too, when one scores above zero.
 *
 * ## Known limits
 *
 * - Arc flags (`A`'s `large-arc-flag`/`sweep-flag`) are not parsed as single digits the way the SVG
 *   spec allows when they run together with no separator (`"1-2.247"` tokenises correctly because
 *   the sign breaks it, but `"11-2.247"` — two flags then a negative number — would not). None of
 *   this set's or these packs' paths were found to hit that case; it is called out because a general
 *   tokeniser would need real arc-flag parsing to rule it out for certain.
 * - A glyph redrawn with equivalent-but-different commands (an arc rewritten as cubic curves, an
 *   absolute path rewritten as relative) does not match, exact or near. That is a geometry-string
 *   comparison, not a rendering comparison.
 * - This is a shape comparison, not a licence proof. An exact match to a permissively licensed pack
 *   is strong evidence of where a glyph came from; it is not a substitute for the pack's own licence
 *   terms, which the notices file quotes directly.
 *
 * Excluded from `deno task check` (network access, and it is a one-off audit, not a regression
 * gate) and from publish. Run by hand:
 *
 * ```bash
 * deno task --cwd icons provenance
 * ```
 */

import { fileURLToPath } from "node:url"
import { basename, dirname, join } from "node:path"
import { parseIconBlocks } from "./check-readme.ts"

// Deliberately not a static `import … from "heroicons-v1/package.json" with { type: "json" }` here
// at module scope: this file's pure normalisation and comparison functions are also imported by
// `provenance.test.ts`, which `deno task test` runs with no `--allow-net` (see the root `deno.jsonc`
// `test` task). A static import of an npm specifier runs — and reaches the network — the moment this
// module loads, before any function in it is even called. Each manifest is instead imported
// dynamically, inside the one loader function that needs it, so loading this module for its pure
// functions alone never touches the network. See `packageRoot` below for what the import achieves:
// only after a package has been imported as a real module does `import.meta.resolve` hand back a
// `file:` URL for it, rather than the bare specifier — the same requirement
// `theme/integration/load-stylesheet.ts` documents for `tailwindcss`. Heroicons ships v1 and v2 as
// the same npm package name at different versions, so each has its own import key in `deno.json`.
async function importManifest(specifier: string): Promise<{ version: string }> {
  const module = await import(specifier, { with: { type: "json" } })
  return module.default as { version: string }
}

/** The geometry-bearing SVG element tags this check understands. Anything else is ignored. */
const GEOMETRY_TAGS = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"] as const
type GeometryTag = typeof GEOMETRY_TAGS[number]

/** Fixed numeric attributes per tag, in the order the canonical form always composes them. */
const NUMERIC_ATTRS: Partial<Record<GeometryTag, readonly string[]>> = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
}

/** One geometry-bearing element, normalised. `canonical` includes rounded numbers; `skeleton` does not. */
export interface NormalizedElement {
  tag: string
  canonical: string
  skeleton: string
}

/**
 * Round a raw number string to 4 decimal places and re-render it canonically.
 *
 * `Number.prototype.toString()` drops trailing zeros and a redundant leading `0` on its own
 * (`(2).toString() === "2"`, `(0.5).toString() === "0.5"`), which is what makes `"2.0"`, `"2.00"`
 * and `"2"` compare equal without extra string surgery. Text that is not a number (should not occur
 * inside a `d` or `points` match) is returned trimmed rather than thrown on, so one bad token
 * degrades a comparison instead of crashing the whole run.
 */
export function roundNumber(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw.trim()
  return Number(value.toFixed(4)).toString()
}

const PATH_TOKEN_PATTERN = /[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g
const PATH_COMMAND_LETTER = /^[MLHVCSQTAZmlhvcsqtaz]$/
const NUMBER_PATTERN = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g

/** Tokenise a `d` attribute into command letters and rounded numbers. See the module JSDoc. */
export function normalizePathData(d: string): { canonical: string; skeleton: string } {
  const tokens = d.match(PATH_TOKEN_PATTERN) ?? []
  const canonicalParts: string[] = []
  const skeletonParts: string[] = []
  for (const token of tokens) {
    if (PATH_COMMAND_LETTER.test(token)) {
      canonicalParts.push(token)
      skeletonParts.push(token)
    } else {
      canonicalParts.push(roundNumber(token))
    }
  }
  return { canonical: canonicalParts.join(" "), skeleton: skeletonParts.join("") }
}

/** Normalise one geometry element's attributes into its canonical form and its skeleton. */
export function normalizeElement(tag: string, attrs: Record<string, string>): NormalizedElement {
  if (tag === "path") {
    const { canonical, skeleton } = normalizePathData(attrs.d ?? "")
    return { tag, canonical: `path:${canonical}`, skeleton: `path:${skeleton}` }
  }
  if (tag === "polyline" || tag === "polygon") {
    const numbers = (attrs.points ?? "").match(NUMBER_PATTERN) ?? []
    return {
      tag,
      canonical: `${tag}:${numbers.map(roundNumber).join(" ")}`,
      skeleton: `${tag}:points(${numbers.length})`,
    }
  }
  const names = (NUMERIC_ATTRS[tag as GeometryTag] ?? []).filter((name) =>
    attrs[name] !== undefined
  )
  const canonical = names.map((name) => `${name}=${roundNumber(attrs[name])}`).join(",")
  const skeleton = [...names].sort().join(",")
  return { tag, canonical: `${tag}:${canonical}`, skeleton: `${tag}:${skeleton}` }
}

const ELEMENT_PATTERN = /<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*)>/g
const ATTR_PATTERN = /([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"/g

/**
 * Extract every geometry-bearing element from a fragment of SVG or JSX-SVG source.
 *
 * Works on raw markup text, not a parsed DOM or a rendered vnode tree: `[^>]*` matches across
 * lines, so an element whose attributes `deno fmt` wrapped onto several lines is still read as one
 * match. Closing tags (`</path>`) never match, because the pattern requires the tag name to follow
 * `<` directly. Every element in both this package's source and the four packs below is a flat leaf
 * with no children — confirmed by `grep -rc '<g' <pack>` returning 0 for all four — so this is a
 * complete read of a glyph's geometry, not a partial one.
 */
export function extractElements(source: string): NormalizedElement[] {
  const elements: NormalizedElement[] = []
  for (const match of source.matchAll(ELEMENT_PATTERN)) {
    const [, tag, attrText] = match
    const attrs: Record<string, string> = {}
    for (const attrMatch of attrText.matchAll(ATTR_PATTERN)) {
      attrs[attrMatch[1]] = attrMatch[2]
    }
    elements.push(normalizeElement(tag, attrs))
  }
  return elements
}

/** A glyph's two comparison keys: its elements' canonical forms, and their skeletons, each as a set. */
export function glyphKeys(
  elements: NormalizedElement[],
): { canonicalKey: string; skeletonKey: string } {
  const canonicalKey = elements.map((element) => element.canonical).sort().join("\n")
  const skeletonKey = elements.map((element) => element.skeleton).sort().join("\n")
  return { canonicalKey, skeletonKey }
}

/**
 * Skeleton overlap between two glyphs, as a fraction of the larger one's element count.
 *
 * Used only to rank a "closest candidate" for a glyph with no exact or near match — never to grant
 * a match on its own. Multiset overlap (an element skeleton shared twice on one side only counts
 * twice), not a plain set intersection, so a glyph with five paths and one shared with a
 * one-path candidate does not score as 100% similar to it.
 */
export function skeletonSimilarity(a: NormalizedElement[], b: NormalizedElement[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const counts = new Map<string, number>()
  for (const element of a) counts.set(element.skeleton, (counts.get(element.skeleton) ?? 0) + 1)
  let shared = 0
  const seen = new Map<string, number>()
  for (const element of b) {
    const used = seen.get(element.skeleton) ?? 0
    const available = counts.get(element.skeleton) ?? 0
    if (used < available) {
      shared += 1
      seen.set(element.skeleton, used + 1)
    }
  }
  return shared / Math.max(a.length, b.length)
}

/** One glyph exported by `+index.tsx`. */
export interface RepoGlyph {
  name: string
  doc: string
  elements: NormalizedElement[]
}

/** Parse every exported glyph out of `+index.tsx`'s source, reusing `check-readme.ts`'s block parser. */
export function repoGlyphs(source: string): RepoGlyph[] {
  return parseIconBlocks(source).map((block) => ({
    name: block.name,
    doc: block.doc.replace(/\s+/g, " ").trim(),
    elements: extractElements(block.body),
  }))
}

/** One glyph from a published icon pack. */
export interface PackIcon {
  pack: "Heroicons" | "Feather" | "Lucide"
  version: string
  style: string
  size: string
  name: string
  elements: NormalizedElement[]
}

/** `{ pack, version, style, size, name }` with no `elements` — what a match result names. */
export type PackRef = Omit<PackIcon, "elements">

function ref(icon: PackIcon): PackRef {
  const { elements: _elements, ...rest } = icon
  return rest
}

/** `Heroicons v1@1.0.6 outline/24 "archive"` — one line, for console output and the PR table. */
export function formatRef(candidate: PackRef): string {
  return `${candidate.pack} ${candidate.version} ${candidate.style}/${candidate.size} "${candidate.name}"`
}

/**
 * Resolve an npm package's directory through Deno's own resolver.
 *
 * Mirrors `theme/integration/load-stylesheet.ts` → `tailwindPackageRoot`: the location is asked of
 * Deno rather than guessed from `HOME` or a hard-coded cache path, so it holds under any `DENO_DIR`.
 *
 * @throws If Deno answers with the specifier itself rather than a `file:` path — meaning the
 *   package was never imported as a real module (see the manifest imports above this function).
 */
function packageRoot(manifestSpecifier: string): string {
  const resolved = import.meta.resolve(manifestSpecifier)
  if (!resolved.startsWith("file:")) {
    throw new Error(
      `cannot locate "${manifestSpecifier}": deno resolved it to "${resolved}" rather than a ` +
        "path. It must be imported as a real module before `import.meta.resolve` can locate it " +
        "on disk — see the manifest imports at the top of this file.",
    )
  }
  return dirname(fileURLToPath(resolved))
}

/** Every `.svg` file under `dir`, recursively. */
async function collectSvgFiles(dir: string, out: string[] = []): Promise<string[]> {
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name)
    if (entry.isDirectory) await collectSvgFiles(path, out)
    else if (entry.isFile && entry.name.endsWith(".svg")) out.push(path)
  }
  return out
}

async function loadSvgIcons(
  dir: string,
  pack: PackIcon["pack"],
  version: string,
  style: string,
  size: string,
): Promise<PackIcon[]> {
  const files = await collectSvgFiles(dir).catch(() => [] as string[])
  const icons: PackIcon[] = []
  for (const file of files) {
    const body = await Deno.readTextFile(file)
    icons.push({
      pack,
      version,
      style,
      size,
      name: basename(file, ".svg"),
      elements: extractElements(body),
    })
  }
  return icons
}

/** Heroicons v1 (last release, `1.0.6`) — `outline/` and `solid/`, one size. */
async function loadHeroiconsV1(): Promise<PackIcon[]> {
  const manifest = await importManifest("heroicons-v1/package.json")
  const root = packageRoot("heroicons-v1/package.json")
  const version = `v1@${manifest.version}`
  const icons: PackIcon[] = []
  for (const style of ["outline", "solid"]) {
    icons.push(...await loadSvgIcons(join(root, style), "Heroicons", version, style, "24"))
  }
  return icons
}

/** Heroicons v2 (`2.2.0`) — every `<size>/<style>` directory the package actually ships. */
async function loadHeroiconsV2(): Promise<PackIcon[]> {
  const manifest = await importManifest("heroicons-v2/package.json")
  const root = packageRoot("heroicons-v2/package.json")
  const version = `v2@${manifest.version}`
  const icons: PackIcon[] = []
  for await (const sizeEntry of Deno.readDir(root)) {
    if (!sizeEntry.isDirectory) continue
    const sizeDir = join(root, sizeEntry.name)
    for await (const styleEntry of Deno.readDir(sizeDir)) {
      if (!styleEntry.isDirectory) continue
      icons.push(
        ...await loadSvgIcons(
          join(sizeDir, styleEntry.name),
          "Heroicons",
          version,
          styleEntry.name,
          sizeEntry.name,
        ),
      )
    }
  }
  return icons
}

/** Feather (`4.29.2`, MIT) — `dist/icons/`, one style, one size. */
async function loadFeather(): Promise<PackIcon[]> {
  const manifest = await importManifest("feather-icons/package.json")
  const root = packageRoot("feather-icons/package.json")
  return loadSvgIcons(join(root, "dist", "icons"), "Feather", manifest.version, "outline", "24")
}

/** Lucide (`1.47.0`, ISC) — `icons/`, one style, one size. */
async function loadLucide(): Promise<PackIcon[]> {
  const manifest = await importManifest("lucide-static/package.json")
  const root = packageRoot("lucide-static/package.json")
  return loadSvgIcons(join(root, "icons"), "Lucide", manifest.version, "outline", "24")
}

interface PackIndex {
  byCanonical: Map<string, PackIcon[]>
  bySkeleton: Map<string, PackIcon[]>
  all: PackIcon[]
}

function buildIndex(corpus: PackIcon[]): PackIndex {
  const byCanonical = new Map<string, PackIcon[]>()
  const bySkeleton = new Map<string, PackIcon[]>()
  for (const icon of corpus) {
    const { canonicalKey, skeletonKey } = glyphKeys(icon.elements)
    byCanonical.set(canonicalKey, [...(byCanonical.get(canonicalKey) ?? []), icon])
    bySkeleton.set(skeletonKey, [...(bySkeleton.get(skeletonKey) ?? []), icon])
  }
  return { byCanonical, bySkeleton, all: corpus }
}

export type MatchKind = "exact" | "near" | "none"

export interface Match {
  kind: MatchKind
  candidates: PackRef[]
  closest?: PackRef & { score: number }
}

/** Compare one glyph against the indexed corpus. Exact match wins over near; near wins over none. */
function matchGlyph(glyph: RepoGlyph, index: PackIndex): Match {
  const { canonicalKey, skeletonKey } = glyphKeys(glyph.elements)
  const exact = index.byCanonical.get(canonicalKey)
  if (exact?.length) return { kind: "exact", candidates: exact.map(ref) }
  const near = index.bySkeleton.get(skeletonKey)
  if (near?.length) return { kind: "near", candidates: near.map(ref) }
  let best: PackIcon | undefined
  let bestScore = 0
  for (const candidate of index.all) {
    const score = skeletonSimilarity(glyph.elements, candidate.elements)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return {
    kind: "none",
    candidates: [],
    closest: best && bestScore > 0 ? { ...ref(best), score: bestScore } : undefined,
  }
}

export interface ProvenanceResult {
  corpusSize: number
  totals: { exact: number; near: number; none: number }
  glyphs: { name: string; doc: string; match: Match }[]
}

/** Load every pack, parse every glyph this package exports, and compare each against the corpus. */
export async function runProvenanceCheck(indexSourcePath?: string): Promise<ProvenanceResult> {
  const corpus = [
    ...await loadHeroiconsV1(),
    ...await loadHeroiconsV2(),
    ...await loadFeather(),
    ...await loadLucide(),
  ]
  const index = buildIndex(corpus)
  const source = await Deno.readTextFile(
    indexSourcePath ?? new URL("./+index.tsx", import.meta.url),
  )
  const glyphs = repoGlyphs(source).map((glyph) => ({
    name: glyph.name,
    doc: glyph.doc,
    match: matchGlyph(glyph, index),
  }))
  const totals = {
    exact: glyphs.filter((glyph) => glyph.match.kind === "exact").length,
    near: glyphs.filter((glyph) => glyph.match.kind === "near").length,
    none: glyphs.filter((glyph) => glyph.match.kind === "none").length,
  }
  return { corpusSize: corpus.length, totals, glyphs }
}

if (import.meta.main) {
  const result = await runProvenanceCheck()
  console.log(
    `corpus: ${result.corpusSize} pack icons (Heroicons v1 + v2, Feather, Lucide)\n` +
      `${result.glyphs.length} glyphs: ${result.totals.exact} exact, ${result.totals.near} near, ` +
      `${result.totals.none} none\n`,
  )
  for (const glyph of result.glyphs) {
    const { match } = glyph
    if (match.kind === "exact") {
      console.log(`EXACT ${glyph.name.padEnd(28)} ${match.candidates.map(formatRef).join(" | ")}`)
    } else if (match.kind === "near") {
      console.log(`NEAR  ${glyph.name.padEnd(28)} ${match.candidates.map(formatRef).join(" | ")}`)
    } else if (match.closest) {
      console.log(
        `NONE  ${glyph.name.padEnd(28)} closest: ${formatRef(match.closest)} ` +
          `(${(match.closest.score * 100).toFixed(0)}% skeleton overlap)`,
      )
    } else {
      console.log(`NONE  ${glyph.name.padEnd(28)} no candidate found`)
    }
  }
}
