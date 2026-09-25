/**
 * Guards the ported set's bookkeeping in `README.md` against the module and against the pinned
 * source inventory. "The ported set" is one earlier private application's icon folder (see
 * `README.md` → "How this set was merged"); this file names neither the application nor its paths.
 *
 * The earlier bookkeeping drifted four times because its "counts" were derived from `README.md`
 * itself: a check whose expected values live in the file it guards shrinks with the thing it
 * polices. Everything here is therefore anchored outside the claims:
 *
 * - {@linkcode PORTED_FILES} is the recorded inventory. The source is a private checkout and never
 *   reaches CI, so its 52 `.svelte` names have to be pinned here as a literal. A human edits
 *   this list deliberately when the source changes.
 * - {@linkcode BARREL_EXPORTED} records which of those files the source's `index.ts` re-exports,
 *   read from that file at audit time and pinned here for the same reason.
 * - The source folder, when its path is given, is the truth for the geometry a port carries.
 * - `+index.tsx` is the source of truth for what this package actually ships.
 *
 * Called by `check-readme.test.ts`. Every failure names the file or the count it caught, so a red
 * run is a detection rather than a number.
 *
 * Run it by hand for the full report:
 *
 * ```bash
 * deno run --allow-read icons/check-readme.ts [path/to/the/ported/set/icons/]
 * ```
 *
 * Without the path, the two comparisons against the source report themselves as not run.
 */

/**
 * Pinned inventory of the ported set's `*.svelte` files (52 files).
 *
 * Typed as a `string[]` rather than a literal tuple so a human who edits this list is caught by the
 * audit below instead of by the type checker: a tuple length would make `PORTED_FILES.length !==
 * 52` a compile error, which fails the wrong way round (the mutation has to be observable *at
 * runtime*).
 */
export const PORTED_FILES: string[] = [
  "arrowLeft",
  "arrowRight",
  "back",
  "burger",
  "check",
  "checkCircle",
  "chevron",
  "circleCross",
  "cloudUpload",
  "cross",
  "dash",
  "doc",
  "dot",
  "dots-horizontal",
  "down",
  "download",
  "email",
  "error",
  "externalLink",
  "facebook",
  "film",
  "flashLight",
  "forward",
  "fullscreen-expand",
  "google",
  "info",
  "instagram",
  "lock",
  "lockFilled",
  "microphone",
  "next",
  "out",
  "paper",
  "pencil",
  "pencil-alt",
  "play",
  "play-filled",
  "plus",
  "plus copy",
  "record",
  "refresh",
  "share",
  "smile",
  "star",
  "stop",
  "success",
  "trash",
  "unlock",
  "up",
  "upload",
  "user",
  "warning",
]

/** Files the source's `index.ts` re-exports; the three others: `facebook`, `paper`, `plus copy`. */
export const BARREL_EXPORTED = PORTED_FILES.filter((file) =>
  !["facebook", "paper", "plus copy"].includes(file)
)

/** Files that are not the source's to license as icons: third-party trademarked brand marks. */
export const BRAND_MARKS = ["facebook", "google", "instagram"] as const

/** A file that carries no inline geometry at all, so there is nothing to port. */
export const NO_GEOMETRY = ["dot"] as const

/** A file whose barrel name was dropped for a collision and whose drawing is not published here. */
export const NOT_PORTED = ["upload"] as const

/** This package's directory, for `+index.tsx` and `README.md`. */
const HERE = new URL("./", import.meta.url).pathname

/** One `export function IconX(props: IconProps): JSX.Element { … }` block, with its preceding JSDoc. */
export interface IconBlock {
  name: string
  doc: string
  body: string
}

/** The bookkeeping tables and prose counts parsed out of `README.md`. */
export interface ReadmeClaims {
  ports: { exportName: string; source: string }[]
  folds: { source: string; target: string; kind: string }[]
  /** The rule-4 exclusion table's ported-set row, split into file names. */
  excluded: string[]
  /** Names in the "barrel exported N of the 52 … are the three absent" sentence. */
  barrelAbsent: string[]
}

/** Every exported glyph in `+index.tsx`, in source order. */
export function parseIconBlocks(source: string): IconBlock[] {
  const blocks: IconBlock[] = []
  const pattern =
    /\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*export function (Icon\w+)\(props: IconProps\): JSX\.Element \{([\s\S]*?)\n\}\n/g
  for (const match of source.matchAll(pattern)) {
    blocks.push({ doc: match[1], name: match[2], body: match[3] })
  }
  return blocks
}

/** The `d` attribute of the first `<path>` in an SVG body. */
export function pathData(body: string): string | undefined {
  return /\sd="([^"]+)"/.exec(body)?.[1]
}

/** Every `d` attribute in an SVG body, in document order. */
export function pathDataList(body: string): string[] {
  return [...body.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1])
}

/** `stroke-width` on the root `<svg>`, or `undefined` for a strokeless (filled) glyph. */
export function strokeWidth(body: string): string | undefined {
  const root = body.slice(0, body.indexOf(">"))
  return /stroke-width="([^"]+)"/.exec(root)?.[1]
}

/** Split one Markdown table's data rows into trimmed cells. */
function tableRows(markdown: string, headerNeedle: string): string[][] {
  const lines = markdown.split("\n")
  const header = lines.findIndex((line) => line.includes(headerNeedle))
  if (header < 0) throw new Error(`README.md: no table with header ${JSON.stringify(headerNeedle)}`)
  const rows: string[][] = []
  for (let i = header + 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
  }
  return rows
}

const unwrap = (cell: string): string => cell.replace(/^`|`$/g, "")

/** Parse the port table, fold table and the barrel-absence sentence. */
export function parseReadmeClaims(markdown: string): ReadmeClaims {
  const ports = tableRows(markdown, "| Export ").map(([exportName, source]) => ({
    exportName: unwrap(exportName),
    source: unwrap(source),
  }))
  const folds = tableRows(markdown, "| Ported file ").map(([source, target, kind]) => ({
    source: unwrap(source),
    target: unwrap(target),
    kind,
  }))
  const excluded = tableRows(markdown, "| Excluded ")
    .filter(([, origin]) => unwrap(origin) === "ported")
    .flatMap(([names]) => names.split(",").map((name) => unwrap(name.trim())))
  const sentence = /re-exports \*\*\d+\*\* of the 52 files;([\s\S]*?)are the three absent/.exec(
    markdown,
  )
  if (!sentence) throw new Error("README.md: no 're-exports **N** of the 52 files' sentence")
  const barrelAbsent = [...sentence[1].matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].replace(/\.svelte$/, ""))
    .map((name) => (name === "plus copy" ? name : name))
  return { ports, folds, excluded, barrelAbsent }
}

/** One audit finding. `case` names the file or count that failed, so a red run is diagnosable. */
export interface Finding {
  case: string
  detail: string
}

/** Every source file the source's `index.ts` re-exports, parsed from the barrel itself. */
export async function barrelFromSource(dir: string): Promise<Set<string>> {
  const barrel = await Deno.readTextFile(`${dir}/index.ts`)
  return new Set([...barrel.matchAll(/from "\.\/([^"]+)\.svelte"/g)].map((match) => match[1]))
}

/**
 * Audit `README.md` against the pinned inventory, the source and `+index.tsx`.
 *
 * @param sourceDir The ported set's icon folder, ending in `/`. Only the barrel and geometry
 *   comparisons need it; without it they are reported as not run, and everything else still runs.
 */
export async function audit(sourceDir?: string): Promise<{
  findings: Finding[]
  checked: string[]
  skipped: string[]
}> {
  const findings: Finding[] = []
  const checked: string[] = []
  const skipped: string[] = []
  const fail = (name: string, detail: string) => findings.push({ case: name, detail })

  // Does the sibling checkout exist? Determines whether the source-comparison half can run at all.
  const sourcePresent = sourceDir !== undefined &&
    await Deno.stat(sourceDir).then(() => true, () => false)
  const moduleSource = await Deno.readTextFile(`${HERE}+index.tsx`)
  const markdown = await Deno.readTextFile(`${HERE}README.md`)
  const blocks = parseIconBlocks(moduleSource)
  const byName = new Map(blocks.map((block) => [block.name, block]))
  const exported = new Set(byName.keys())
  const claims = parseReadmeClaims(markdown)

  // --- the pinned inventory is self-consistent ------------------------------------------------
  const duplicates = PORTED_FILES.filter((file, i) => PORTED_FILES.indexOf(file) !== i)
  if (duplicates.length) fail("PORTED_FILES", `recorded twice: ${duplicates.join(", ")}`)
  if (PORTED_FILES.length !== 52) {
    fail("PORTED_FILES.length", `${PORTED_FILES.length} recorded, expected 52`)
  }
  checked.push(`inventory: ${PORTED_FILES.length} pinned files, no duplicates`)

  // --- every file lands on exactly one side of the ledger -------------------------------------
  const sides = new Map<string, string[]>()
  const add = (file: string, side: string) => {
    if (!PORTED_FILES.includes(file)) {
      fail(file, `README.md lists ${file} as ${side}, but it is not in the recorded inventory`)
      return
    }
    sides.set(file, [...(sides.get(file) ?? []), side])
  }
  for (const port of claims.ports) add(port.source, "port")
  for (const fold of claims.folds) add(fold.source, "fold")
  for (const file of BRAND_MARKS) add(file, "brand mark")
  for (const file of NO_GEOMETRY) add(file, "no geometry")
  for (const file of NOT_PORTED) add(file, "barrelled, not ported")

  for (const file of PORTED_FILES) {
    const on = sides.get(file)
    if (!on) fail(file, "not accounted for on any side of the ledger")
    else if (on.length > 1) fail(file, `on ${on.length} sides at once: ${on.join(" + ")}`)
  }
  const onBothTables = claims.ports
    .map((port) => port.source)
    .filter((source) => claims.folds.some((fold) => fold.source === source))
  for (const file of onBothTables) fail(file, "listed as both a port and a fold")
  checked.push(`ledger: ${PORTED_FILES.length} files, each on exactly one side`)

  // --- rule 4 is the exclusion list: every non-export must be on it, nothing else may be ------
  const nonExports = [...sides.keys()].filter((file) => !sides.get(file)!.includes("port"))
  for (const file of nonExports) {
    if (!claims.excluded.includes(file)) {
      fail(file, "is not a port but is missing from the rule-4 exclusion table")
    }
  }
  for (const file of claims.excluded) {
    if (!PORTED_FILES.includes(file)) {
      fail(file, "listed in the rule-4 exclusion table but not in the recorded inventory")
    }
    if (sides.get(file)?.includes("port")) {
      fail(file, "listed as excluded but also carries a port in the port table")
    }
  }
  checked.push(
    `rule-4 exclusions: ${claims.excluded.length} ported-set files, ` +
      `${nonExports.length} non-exporting files all listed`,
  )

  // --- barrel membership, against the barrel's own name for each file -------------------------
  // The source is a private checkout and never reaches CI, so this half reports itself as
  // unverified there instead of failing: the inventory stays pinned above, which is what carries
  // the check to a machine without the source tree.
  const barrel = sourcePresent
    ? await barrelFromSource(sourceDir).catch(() => new Set<string>())
    : new Set<string>()
  if (barrel.size === 0) {
    skipped.push(
      `barrel membership: no source index.ts given or readable; ` +
        `${BARREL_EXPORTED.length} exports recorded as pinned`,
    )
  } else {
    const absent = PORTED_FILES.filter((file) => !barrel.has(file))
    for (const file of claims.barrelAbsent) {
      if (!absent.includes(file)) {
        fail(file, `README.md says it is absent from the source's barrel, but index.ts exports it`)
      }
    }
    for (const file of absent) {
      if (!claims.barrelAbsent.includes(file)) {
        fail(file, `absent from the source's barrel but not named in the README's absent list`)
      }
    }
    for (const file of NO_GEOMETRY) {
      if (!barrel.has(file)) {
        fail(file, "README.md says the source exports it, but the barrel does not")
      }
    }
    if (barrel.size !== BARREL_EXPORTED.length) {
      fail("source index.ts", `${barrel.size} exports on disk, ${BARREL_EXPORTED.length} recorded`)
    }
    checked.push(`barrel: ${barrel.size} exports, ${absent.length} absent (${absent.join(", ")})`)
  }

  // --- every port names an export that exists, and carries the source's exact geometry ------
  for (const port of claims.ports) {
    const block = byName.get(port.exportName)
    if (!block) {
      fail(port.source, `port table names ${port.exportName}, which +index.tsx does not export`)
      continue
    }
    if (!block.doc.includes("from a source application")) {
      fail(port.exportName, `JSDoc does not mark the ported source family`)
    }
    if (!sourcePresent) continue
    const sourceBody = await Deno.readTextFile(`${sourceDir}${port.source}.svelte`)
      .catch(() => undefined)
    if (sourceBody === undefined) {
      fail(port.source, `cannot read the source file to compare ${port.exportName}'s geometry`)
      continue
    }
    const mine = pathDataList(block.body).join("|")
    const theirs = pathDataList(sourceBody).join("|")
    // `IconSuccess` is fed by two byte-identical source files; either is an acceptable match.
    const alsoMatches = (["checkCircle", "success"] as const).filter((file) => file !== port.source)
    if (mine !== theirs && !alsoMatches.length) {
      fail(port.source, `${port.exportName}'s path data is not byte-identical to the source's`)
    } else if (mine !== theirs) {
      const sibling = await Deno.readTextFile(`${sourceDir}${alsoMatches[0]}.svelte`)
        .catch(() => "")
      if (pathDataList(sibling).join("|") !== mine) {
        fail(port.source, `${port.exportName}'s path data matches neither source`)
      }
    }
  }
  checked.push(
    sourcePresent
      ? `ports: ${claims.ports.length} rows, geometry compared to the source files`
      : `ports: ${claims.ports.length} rows (geometry not compared; no source folder given)`,
  )
  if (!sourcePresent) {
    skipped.push(`per-port geometry vs the source: no source folder given or readable`)
  }

  // --- derived counts, computed here and compared to what the prose claims --------------------
  const foldTargets = new Set<string>()
  for (const fold of claims.folds) {
    if (!exported.has(fold.target)) {
      fail(fold.source, `fold target ${fold.target} is not an export of +index.tsx`)
    }
    foldTargets.add(fold.target)
  }
  const derived = {
    ports: claims.ports.length,
    folds: claims.folds.length,
    foldTargets: foldTargets.size,
    bodyIdentical: claims.folds.filter((fold) => fold.kind === "body-identical").length,
    concept: claims.folds.filter((fold) => fold.kind === "concept").length,
    brandMarks: BRAND_MARKS.length,
    noGeometry: NO_GEOMETRY.length,
    notPorted: NOT_PORTED.length,
  }
  if (
    derived.ports + derived.folds + derived.brandMarks + derived.noGeometry + derived.notPorted !==
      PORTED_FILES.length
  ) {
    fail(
      "ledger arithmetic",
      `${derived.ports} ports + ${derived.folds} folds + ${derived.brandMarks} brand + ` +
        `${derived.noGeometry} no-geometry + ${derived.notPorted} not-ported = ` +
        `${
          derived.ports + derived.folds + derived.brandMarks + derived.noGeometry +
          derived.notPorted
        }, expected ${PORTED_FILES.length}`,
    )
  }
  checked.push(
    `derived: ${derived.ports} ports, ${derived.folds} folds ` +
      `(${derived.bodyIdentical} body-identical, ${derived.concept} concept) onto ` +
      `${derived.foldTargets} distinct exports`,
  )

  // --- stroke-width split of the ported family, from the module -------------------------------
  const portedBlocks = blocks.filter((block) => block.doc.includes("from a source application"))
  const stroked = portedBlocks.filter((block) => strokeWidth(block.body) === "2").length
  const strokeless = portedBlocks.filter((block) => strokeWidth(block.body) === undefined).length
  const otherWidths = portedBlocks
    .filter((block) => {
      const width = strokeWidth(block.body)
      return width !== undefined && width !== "2"
    })
    .map((block) => `${block.name}.svelte@${strokeWidth(block.body)}`)
  const claimedTotal = /Merged icon set\. (\d+) glyphs/.exec(markdown)
  if (!claimedTotal) {
    fail("README.md opening line", "no 'Merged icon set. N glyphs' sentence")
  } else if (Number(claimedTotal[1]) !== blocks.length) {
    fail(
      "README.md opening line",
      `claims ${claimedTotal[1]} glyphs, +index.tsx exports ${blocks.length}`,
    )
  }
  if (portedBlocks.length !== derived.ports) {
    fail(
      "ported family in +index.tsx",
      `${portedBlocks.length} glyphs marked as ported, but the port table lists ${derived.ports}`,
    )
  }
  for (const odd of otherWidths) {
    fail(odd, "ported glyph is neither stroke-2 nor strokeless; the README's split is stale")
  }
  const claimed = new RegExp(`(\\d+) \\\`stroke-2\\\`[^.]*?(\\d+) filled`).exec(markdown)
  if (!claimed) {
    fail("README.md style-families prose", "no '<N> stroke-2 … <M> filled' sentence to check")
  } else if (Number(claimed[1]) !== stroked || Number(claimed[2]) !== strokeless) {
    fail(
      "README.md style-families prose",
      `claims ${claimed[1]} stroke-2 + ${claimed[2]} filled, module has ${stroked} + ${strokeless}`,
    )
  }
  checked.push(
    `ported family: ${stroked} stroke-2 + ${strokeless} strokeless = ${portedBlocks.length}`,
  )

  // --- the contract's size counts, from the module --------------------------------------------
  const defaultSizes = blocks.map((block) => /props\.class \|\| "([^"]+)"/.exec(block.body)?.[1])
  const sized = (size: string) => defaultSizes.filter((value) => value === size).length
  const contract = new RegExp(
    "`size-5` \\((\\d+) glyphs\\)[\\s\\S]*?`size-6` \\((\\d+) glyphs\\)",
  ).exec(markdown)
  if (!contract) {
    fail("README.md contract prose", "no '`size-5` (N glyphs) … `size-6` (M glyphs)' sentence")
  } else if (Number(contract[1]) !== sized("size-5") || Number(contract[2]) !== sized("size-6")) {
    fail(
      "README.md contract prose",
      `claims ${contract[1]} size-5 + ${contract[2]} size-6, module has ` +
        `${sized("size-5")} + ${sized("size-6")}`,
    )
  }
  const unsized = defaultSizes.filter((value) => value === undefined).length
  if (unsized > 0) fail("+index.tsx", `${unsized} glyphs have no default size in their class`)
  checked.push(
    `size defaults: ${sized("size-5")} size-5, ${sized("size-6")} size-6, ` +
      `${blocks.length - sized("size-5") - sized("size-6")} other`,
  )

  // --- README glyph tokens must all be real exports -------------------------------------------
  const removed = new Set([
    "IconBulb",
    "IconExclamationTriangle",
    "IconMagnifyingGlass",
    "IconLock",
  ])
  const tokens = new Set([...markdown.matchAll(/`(Icon[A-Za-z0-9]+)`/g)].map((match) => match[1]))
  for (const token of tokens) {
    if (!exported.has(token) && !removed.has(token)) {
      fail(token, "named in README.md but not exported by +index.tsx")
    }
  }
  checked.push(`README tokens: ${tokens.size} glyph names, all resolvable`)

  return { findings, checked, skipped }
}

if (import.meta.main) {
  const { findings, checked, skipped } = await audit(Deno.args[0])
  for (const line of checked) console.log(`  ok   ${line}`)
  for (const line of skipped) console.log(`  --   ${line}`)
  for (const { case: name, detail } of findings) console.error(`  FAIL ${name}: ${detail}`)
  console.log(
    findings.length
      ? `\n${findings.length} finding(s)`
      : `\n${checked.length} checks passed, ${skipped.length} not run`,
  )
  if (findings.length) Deno.exit(1)
}
