import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { type PackageId, packageIds, PACKAGES } from "./registry.ts"

/** One declared subpath module of one package. */
interface SubpathModule {
  /** Specifier between the package name and the file, e.g. `"/badge"`. */
  subpath: string
  /** Absolute URL of the module, so the guard reads the file the specifier names. */
  url: URL
}

/**
 * A covered package's subpath modules, as it declares them.
 *
 * `exports` is the one place that knows which modules a package publishes, and it is the source of
 * truth for this guard: a module missing from it is not a subpath a consumer can reach in the first
 * place, and a module present in it but missing from disk fails the import below.
 */
interface SubpathSet {
  /** Package the modules belong to. */
  id: PackageId
  /** Whether the package declares a subpath besides `"."`. */
  declaresSubpaths: boolean
  /** One entry per declared subpath module, in the order the package declares them. */
  modules: SubpathModule[]
  /**
   * The keys the config's `exports` object really holds, read from the parsed object.
   *
   * This is the **floor**, and it comes from the config rather than from this reader: counting the
   * keys the enumeration happened to produce cannot report that the enumeration produced nothing.
   * When the block was located by a raw-text anchor, a commented decoy satisfied the anchor, the real
   * object was discarded and `0 == 0 + 0` passed while a subpath went unread.
   */
  parsedKeys: string[]
  /** Subpath keys the file declares, as this reader understood them. */
  declaredKeys: string[]
  /** Keys declared with a target this guard does not import, with the target it saw. */
  namedTargets: Array<{ subpath: string; target: string }>
}

/**
 * Blank every comment in JSON-with-comments, preserving string literals and line structure.
 *
 * The config has to be read through something comment-aware *before* anything is located in it: an
 * anchor matched against raw text cannot tell code from a comment, so `// Disabled: "exports": { … }`
 * satisfied `/"exports"\s*:\s*\{/` and the real `exports` object was never read. Comments are
 * replaced by spaces rather than removed so every line and column keeps its position, and a
 * character inside a string literal is never treated as a comment opener — `"./we//ird.ts"` survives
 * whole.
 *
 * Hand-rolled rather than `@std/jsonc`: that module is not in the root import map, and adding it
 * would mean editing the root config (out of scope for this package) for one function this file
 * needs to own anyway. What it must get right is exactly the two properties above, both covered by
 * the fixtures below.
 *
 * @param config Whole `deno.json` text.
 * @returns The same text with comments blanked out.
 */
function withoutComments(config: string): string {
  const kept = [...config]
  let inString = false
  let escaped = false

  for (let index = 0; index < kept.length; index++) {
    const char = kept[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char !== "/") continue

    const next = kept[index + 1]
    if (next === "/") {
      // A line comment: blank to the line break, which is left in place.
      while (index < kept.length && kept[index] !== "\n") kept[index++] = " "
      index--
      continue
    }
    if (next !== "*") continue

    // A block comment: blank through its terminator, keeping newlines so the prose it wraps cannot
    // move a later line's comment onto another line. An unterminated one runs to the end of the file,
    // and the terminator is blanked only when it was actually found — indexing past the end would
    // append a stray character and turn an already-broken config into a confusing parse error.
    let closed = false
    while (index < kept.length && !closed) {
      closed = kept[index] === "*" && kept[index + 1] === "/"
      if (kept[index] !== "\n") kept[index] = " "
      index++
    }
    if (closed) {
      kept[index - 1] = " "
      kept[index] = " "
    }
    index--
  }

  return kept.join("")
}

/**
 * The `exports` object of a Deno config, parsed.
 *
 * Deno accepts comments in these configs and `JSON.parse` does not, so the comments are blanked
 * first, the whole config is parsed as JSON, and the object is read off the parsed result. Nothing is
 * located in raw text: the field is looked up, not matched, so a comment that quotes `"exports"` is
 * inert — the class of bug a text anchor had, where a commented decoy made the reader read nothing at
 * all.
 *
 * @param config Whole `deno.json` text, comments included.
 * @returns The parsed `exports` object.
 * @throws When the config has no `exports` object, or its values are not all strings.
 */
function exportsOf(config: string): Record<string, string> {
  const parsed: { exports?: unknown } = JSON.parse(withoutComments(config))
  const exported = parsed.exports
  if (typeof exported !== "object" || exported === null || Array.isArray(exported)) {
    throw new Error("the package config declares no exports object")
  }

  const named: Record<string, string> = {}
  for (const [subpath, target] of Object.entries(exported)) {
    if (typeof target !== "string") {
      throw new Error(`${subpath} is declared with a conditions object, not a string target`)
    }
    named[subpath] = target
  }
  return named
}

/**
 * Read one package's `exports` map.
 *
 * `exports` is the one place that knows which modules a package publishes, and it is the source of
 * truth for this guard: a module missing from it is not a subpath a consumer can reach, and a module
 * present in it but missing from disk fails the import below. The object is parsed (`exportsOf`), so
 * each target is read as a value rather than matched as text, and `"."` is the barrel rather than a
 * subpath; a target that is not a TypeScript source (the theme package's stylesheets) is named but
 * not imported.
 *
 * The parsed keys are returned beside the reader's own output so the caller can compare them: an
 * entry this reader missed shows up as a key that produced neither a module nor a named target,
 * *named in the failure*, instead of as a confusing downstream red or as no red at all.
 *
 * @param id Package to read.
 * @param root Repository root, the parent of every package directory.
 * @returns The package's declared subpath modules, and the keys it declares, parsed twice.
 */
async function subpathSetOf(id: PackageId, root: URL): Promise<SubpathSet> {
  const config = await Deno.readTextFile(new URL(`./${id}/deno.json`, root))
  const exported = exportsOf(config)
  const parsedKeys = Object.keys(exported).filter((subpath) => subpath !== ".")
  const modules: SubpathModule[] = []
  const declaredKeys: string[] = []
  const namedTargets: SubpathSet["namedTargets"] = []

  for (const [subpath, target] of Object.entries(exported)) {
    if (subpath === ".") continue
    declaredKeys.push(subpath)

    if (!/^\.\.?\/[^"]+\.tsx?$/.test(target)) {
      namedTargets.push({ subpath, target })
      continue
    }
    modules.push({ subpath: subpath.slice(1), url: new URL(`./${id}/${target}`, root) })
  }

  return {
    id,
    declaresSubpaths: modules.length > 0,
    modules,
    parsedKeys,
    declaredKeys,
    namedTargets,
  }
}

/** Every covered package's declared subpaths. */
const root = new URL("../", import.meta.url)
const subpathSets: SubpathSet[] = []
for (const id of packageIds) subpathSets.push(await subpathSetOf(id, root))

/**
 * `Object.keys` of a module namespace is the value/type split, and the whole rule rests on it.
 *
 * A type-only export does not exist at runtime, so it cannot be a key; a class or an `enum` is a
 * binding like any other and is one. That is the definition of "value export" every assertion below
 * uses, and `registry.test.ts` relies on the same property when it holds the barrel to `Object.keys`.
 *
 * @param namespace Imported module namespace.
 * @returns Its value export names, in module order.
 */
function valueExportNames(namespace: object): string[] {
  return Object.keys(namespace)
}

/** What one subpath contributes to the barrel/subpath pair, and what either side is missing. */
interface SubpathInspection {
  /** Value export names each subpath was read for, keyed by subpath, so an empty read shows up. */
  inspected: Record<string, string[]>
  /** Value exports all subpaths have between them, as `subpath:name`. */
  found: string[]
  /** Every value export any subpath module declares, barrel or not. */
  subpathValueExports: string[]
  /** Value exports the barrel does not re-export. */
  unbarrelledSubpathExports: string[]
  /** Value exports of the barrel that no subpath module exports. */
  undeclaredBarrelExports: string[]
  /** Barrel value exports no list declares as helpers; the components. */
  components: string[]
}

/**
 * Compare one package's subpath modules with its barrel, both ways.
 *
 * The pair has to agree exactly: a subpath export nobody re-exported is a component (or helper) the
 * catalogue can never see, and a barrel export from no module is one no subpath can be checked
 * against — the two directions a hand-maintained barrel drifts in. A declared helper is exempt from
 * both, because a helper is not a catalogue entry: it is named in the package's own list instead,
 * which is what the drift guard reads.
 *
 * The barrel's names are passed in rather than imported here so a test can hand the comparison a
 * barrel with a line added or removed, which is how the guard is proved to bite.
 *
 * @param set The package's declared subpaths.
 * @param barrelValueExportNames The package's barrel value export names.
 * @param declaredHelpers Names the package declares as helpers.
 * @returns What each subpath contributed, and the exports neither side accounts for.
 */
async function inspectPackage(
  set: SubpathSet,
  barrelValueExportNames: readonly string[],
  declaredHelpers: readonly string[],
): Promise<SubpathInspection> {
  const declared = new Set(declaredHelpers)
  const barrelled = new Set(barrelValueExportNames)
  const fromSubpath = new Set<string>()
  const inspection: SubpathInspection = {
    inspected: {},
    found: [],
    subpathValueExports: [],
    unbarrelledSubpathExports: [],
    undeclaredBarrelExports: [],
    components: [],
  }

  for (const module of set.modules) {
    const namespace = await import(module.url.href) as object
    const names = valueExportNames(namespace)
    inspection.inspected[module.subpath] = names

    for (const name of names) {
      fromSubpath.add(name)
      inspection.found.push(`${module.subpath}:${name}`)
      if (!barrelled.has(name) && !declared.has(name)) {
        inspection.unbarrelledSubpathExports.push(`${module.subpath}:${name}`)
      }
    }
  }

  inspection.subpathValueExports = [...fromSubpath]
  for (const name of barrelValueExportNames) {
    if (!fromSubpath.has(name) && !declared.has(name)) inspection.undeclaredBarrelExports.push(name)
    if (!declared.has(name)) inspection.components.push(name)
  }

  return inspection
}

/** What one package's subpath/barrel pair depends on, summarised for the tests that read it. */
interface PairReport {
  /** The package's declared subpaths. */
  set: SubpathSet
  /** The package's declared helper list. */
  declaredHelpers: readonly string[]
  /** Value export names of the package's barrel. */
  barrelValueExportNames: string[]
  /** The comparison itself. */
  inspection: SubpathInspection
}

/** Both sides of every covered package's subpath/barrel pair. */
const pairReports: PairReport[] = await Promise.all(
  subpathSets.map(async (set) => {
    const { namespace, helpers } = PACKAGES[set.id]
    const barrelValueExportNames = valueExportNames(namespace)
    return {
      set,
      declaredHelpers: helpers,
      barrelValueExportNames,
      inspection: await inspectPackage(set, barrelValueExportNames, helpers),
    }
  }),
)

/** A package's entry in {@link pairReports}, by identifier. */
function reportFor(id: PackageId): PairReport {
  const report = pairReports.find((entry) => entry.set.id === id)
  if (!report) throw new Error(`${id} is a covered package but was not compared`)
  return report
}

describe("subpath exports", () => {
  it("reads at least the modules each package is known to declare", () => {
    // The floor, and the one assertion that fails *loudly and early* when the reader collapses. A
    // package whose modules are all in the config declares many more than this; the point of the
    // number is that a wholesale loss cannot be reported as agreement between empty sets, and cannot
    // surface as a confusing red about the barrel having no subpath provenance.
    //
    // The figures are deliberately far below reality (a third of it or less) because they are a floor
    // and not a manifest — a manifest would be the hand-kept list this design avoids everywhere else.
    const floors: Record<PackageId, number> = {
      ui: 30,
      charts: 8,
      system: 8,
      crud: 8,
      signals: 8,
    }

    for (const report of pairReports) {
      const { id, modules, namedTargets } = report.set

      expect(
        modules.length,
        `${id}: subpath modules read (floor ${
          floors[id]
        }) — a collapse here means the config was not read`,
      ).toBeGreaterThanOrEqual(floors[id])
      for (const { target } of namedTargets) {
        // A target this guard does not import has to be one it could not: a stylesheet. Weaker than a
        // `.ts`-only rule would be — it cannot tell a legitimate `.css` export from a source file the
        // guard chose not to read — so it is stated as a bucket guard, not a proof. The floor above is
        // what catches a wholesale loss; this catches a `.ts` module parked in the bucket.
        expect(target, `${id}: not imported, and not a stylesheet`).toMatch(/\.css$/)
      }
    }
  })

  it("reads every subpath key the parsed exports object declares", () => {
    // The floor comes from the config **as parsed**, not from this reader's output. Counting the keys
    // the enumeration produced cannot report that the enumeration produced nothing: that is exactly
    // how a commented decoy passed — the raw-text anchor matched the decoy, the real object was
    // discarded, and `0 == 0 + 0` held while a subpath went unread. Reading the real object as JSON
    // removes the class: the keys are looked up, so a comment that quotes `"exports"` is inert.
    //
    // A key the reader understood appears in `declaredKeys`; one it did not is named in the failure
    // rather than left as a diff between two lists the same reader built.
    for (const report of pairReports) {
      const { declaredKeys, id, modules, namedTargets, parsedKeys } = report.set
      const understood = new Set(declaredKeys)
      const unread = parsedKeys.filter((subpath) => !understood.has(subpath))

      expect(unread, `${id}: subpath keys the config declares and this reader did not read`)
        .toEqual(
          [],
        )
      expect([...declaredKeys].sort(), `${id}: keys read, against the parsed object`).toEqual(
        [...parsedKeys].sort(),
      )
      expect(new Set(declaredKeys).size, `${id}: one declaration per subpath key`).toBe(
        declaredKeys.length,
      )
      expect(declaredKeys.length, `${id}: keys accounted for`).toBe(
        modules.length + namedTargets.length,
      )
    }
  })

  it("imports every subpath it read, and reports the ones it did not", () => {
    // Resolvability is enforced one level up and before this test runs: the `inspected` map is built
    // from imports at file scope, so a specifier in `exports` that points at a missing file fails the
    // suite at load with `Module not found` rather than as a failed assertion — `deno.json` is not
    // type-checked and no other guard reads these paths, so that import is the only thing that would
    // notice. That limit is conditional on the enumeration finding the module in the first place: a
    // reader that read nothing has nothing to import and nothing to fail on, which is why the parsed
    // floor above exists.
    for (const report of pairReports) {
      const { id, modules } = report.set
      const inspected = Object.keys(report.inspection.inspected)

      expect(modules.length, `${id}: subpaths imported`).toBe(inspected.length)
      expect(new Set(inspected).size, `${id}: one import per subpath`).toBe(inspected.length)

      for (const module of modules) {
        expect(
          module.subpath in report.inspection.inspected,
          `${id}${module.subpath} was declared, read and not imported`,
        ).toBe(true)
      }
    }
  })

  it("declares a helper that is exported only from a subpath, and only one that is exported", () => {
    // `registry.test.ts` holds the declared half to the barrel, so it cannot see this half: a
    // subpath module that exports a pure function the barrel does not re-export. Such a name is
    // reachable by a consumer, and a declaration is what keeps it out of the worklist, so it has to
    // exist — and a declaration of a name no module exports is stale, which is the failure the
    // barrel comparison cannot report.
    for (const report of pairReports) {
      const exported = new Set([
        ...report.barrelValueExportNames,
        ...report.inspection.subpathValueExports,
      ])
      const stale = report.declaredHelpers.filter((name) => !exported.has(name))

      expect(stale, `${report.set.id}: declared helpers no module exports`).toEqual([])
    }
  })

  it("leaves no camelCase value export undeclared, on either side of the pair", () => {
    // The completeness half the barrel cannot supply: `registry.test.ts` can see that a declared name
    // exists, but not that a helper-shaped name is missing from the lists, because a name absent from
    // every list is indistinguishable from a component without a second, hand-kept manifest of
    // components — the maintenance the declaration design exists to remove.
    //
    // The convention is what decides here, and only for the shape it is unambiguous about: a
    // lowercase-first value export is a helper by the convention both this guard and the guide's
    // JSDoc state, so it must be declared. That is the assertion `applyScrollLock` slipped through:
    // barrel-exported, camelCase, in no list, and therefore counted as a component — 46 components
    // instead of 45, one extra worklist entry on the rendered page, and no guard said anything.
    //
    // An uppercase-initial name is left alone: it is a component unless declared, and demanding a
    // declaration for every export that is not explicitly a component would mean listing all 46 of
    // `ui`'s, which is the manifest this design rejects.
    for (const report of pairReports) {
      const declared = new Set(report.declaredHelpers)
      const exported = new Set([
        ...report.barrelValueExportNames,
        ...report.inspection.subpathValueExports,
      ])
      const undeclared = [...exported].filter((name) => /^[a-z]/.test(name) && !declared.has(name))

      expect(
        undeclared.sort(),
        `${report.set.id}: helper-shaped value exports in no helper list`,
      ).toEqual([])
    }
  })

  it("re-exports every subpath value export from the barrel, or declares it a helper", () => {
    // The hole this closes: a component exported from its own module was reachable through its
    // subpath and invisible to every other guard whenever nobody added it to the barrel — no card,
    // no worklist entry, no `missingDemo`. Either the barrel carries the name or the package's
    // helper list does, and neither list is written by the module.
    for (const report of pairReports) {
      expect(
        report.inspection.unbarrelledSubpathExports,
        `${report.set.id}: subpath value exports that are neither barrelled nor declared helpers`,
      ).toEqual([])
    }
  })

  it("sources every barrel value export from a subpath, or declares it a helper", () => {
    // The other direction, and the one the naming convention used to leave open. The barrel is a
    // list of re-exports of the package's own modules, so a value that no subpath declares is a line
    // typed into the barrel alone — `clampProgress` was one, and it left `ts:check` green with an
    // undemoed export name nothing had classified.
    for (const report of pairReports) {
      expect(
        report.inspection.undeclaredBarrelExports,
        `${report.set.id}: barrel value exports from no declared subpath and no helper list`,
      ).toEqual([])
    }
  })

  it("accounts for every value export of a package as either a component or a declared helper", () => {
    // Guards 1–5 read the barrel and the helper lists; this is the pair they assume agrees. A
    // component is, by definition, a barrel value export no list declares, so the identity below is
    // arithmetic rather than a second classification — it fails when a value export is added to
    // either half without the other noticing.
    for (const report of pairReports) {
      const { components } = report.inspection
      const declaredHere = report.declaredHelpers.filter((name) =>
        report.barrelValueExportNames.includes(name)
      )

      expect(
        [...components, ...declaredHere].sort(),
        `${report.set.id}: components plus declared helpers`,
      ).toEqual([...report.barrelValueExportNames].sort())
      expect(
        components.filter((name) => declaredHere.includes(name)),
        `${report.set.id}: a name both classified and declared`,
      ).toEqual([])
    }
  })

  it("finds a barrel value export that no subpath module declares", async () => {
    // The guard proved by a line rather than by prose, in the shape of the incident: a name appears
    // on the barrel that no module exports. The reviewer typed `clampProgress` into `ui/+index.ts`,
    // `ts:check` exited 0 and every registry test stayed green; the comparison below is the one that
    // would have gone red, and the barrel it is handed is the real `ui` barrel with one name added.
    const { set, barrelValueExportNames, declaredHelpers } = reportFor("ui")
    const unclassified = "clampProgressToo"

    const report = await inspectPackage(
      set,
      [...barrelValueExportNames, unclassified],
      declaredHelpers,
    )

    expect(report.undeclaredBarrelExports).toEqual([unclassified])
    expect(report.components, "and it is read as a component, not a helper").toContain(unclassified)
  })

  it("reads the real exports object when a comment quotes a decoy one", () => {
    // The evasion that a text anchor could not survive, kept as a fixture so it cannot return. A
    // commented decoy above the real object satisfied `/"exports"\s*:\s*\{/`, the brace walk started
    // at the decoy's brace and closed on it, and the real object was discarded — so the reader read
    // nothing while `deno fmt --check` accepted the file, `GhostWidget` stayed reachable and the only
    // red was an unrelated complaint about a barrel with no subpath provenance.
    //
    // It is asserted at the parser rather than through `pairReports` because the shipped configs have
    // no decoy: `exportsOf` has to be handed the fixture to be exercised. `withoutComments` is what
    // makes it inert — it is string-aware, so the decoy inside the comment is blanked *and* the
    // `"exports"` inside the target string below is left alone, which is the other half of the same
    // coin.
    const decoy = `{
  // Disabled: "exports": { "./legacy": "./legacy.css" },
  "exports": {
    ".": "./+index.ts",
    "./ghost": "./ghost.tsx"
  },
  "imports": {
    // "exports": { "./decoy": "./decoy.ts" },
    "preact-render-to-string": "npm:preact-render-to-string@6.7.0"
  }
}`

    expect(Object.keys(exportsOf(decoy)).sort()).toEqual([".", "./ghost"])
    expect(withoutComments(decoy)).not.toContain("legacy")
    expect(withoutComments(decoy), "the real object survives").toContain('"./ghost"')

    // The key/value split across lines is read by the same parse, which is why it needs no separate
    // treatment: it is not a shape the reader can miss, only one `deno fmt` rewrites.
    const split = `{
  "exports": {
    "./a":
      "./a.ts",
    "./b": "./b.ts"
  }
}`
    expect(Object.keys(exportsOf(split)).sort()).toEqual(["./a", "./b"])

    // A `//` inside a value is content, not a comment: blanking it would produce invalid JSON here.
    const slashes = `{
  "exports": {
    "./weird": "./we//ird.ts"
  }
}`
    expect(exportsOf(slashes)["./weird"]).toBe("./we//ird.ts")
  })
})
