/**
 * Compares each guide card's snippet and props table with the props its component really takes, as
 * `deno doc --json` reads them from the source. `registry-props.test.ts` runs it, so renaming a prop
 * without updating a snippet or a props row fails `deno task test`.
 *
 * Reading the props from `deno doc` rather than type-checking each snippet keeps the check to one
 * `deno doc` run: a snippet names values it never declares (`onSave={save}`, `rows={rows}`), so
 * type-checking it would need a declaration for each.
 *
 * A component whose props type this reader cannot list in full is **open**: it extends a type from
 * outside the packages (`JSX.HTMLAttributes`), uses an index signature or a mapped type, or names a
 * type `deno doc` did not report. Any attribute may be valid on it, so it is skipped, and
 * {@link propsReport} counts how many were.
 *
 * @module
 */

import type { DocDeclaration, DocSymbol } from "../infra/scripts/llms-txt.ts"

/** A `deno doc --json` type node, as far as this reader looks into it. */
interface TsType {
  kind: string
  repr?: string
  // deno-lint-ignore no-explicit-any
  value?: any
}

/** The props a component takes: every name, or `null` when the type is open. */
export type PropNames = ReadonlySet<string> | null

/** Generic wrappers whose first argument holds every prop the result can have. */
const WRAPPERS = new Set(["Omit", "Partial", "Readonly", "Required", "Pick"])

/**
 * Every declaration `deno doc` reported, by name: exported ones and the private types an exported
 * one refers to.
 *
 * @param symbolsByFile The symbols of each entry point, from `denoDoc`.
 */
export function declarationsByName(
  symbolsByFile: Iterable<DocSymbol[]>,
): Map<string, DocDeclaration[]> {
  const byName = new Map<string, DocDeclaration[]>()
  for (const symbols of symbolsByFile) {
    for (const { name, declarations } of symbols) {
      for (const declaration of declarations) {
        if (declaration.kind === "reference") continue
        byName.set(name, [...(byName.get(name) ?? []), declaration])
      }
    }
  }
  return byName
}

/**
 * The props a component takes, read from its first parameter's type.
 *
 * @param name The component's export name.
 * @param byName {@link declarationsByName}.
 * @returns The prop names; `null` when the type is open or the component is not a function `deno
 *   doc` reported.
 */
export function propNames(name: string, byName: Map<string, DocDeclaration[]>): PropNames {
  const fn = byName.get(name)?.find((declaration) => declaration.kind === "function")
  // deno-lint-ignore no-explicit-any
  const params = (fn as any)?.def?.params as { tsType?: TsType }[] | undefined
  if (!fn || !params) return null
  if (params.length === 0) return new Set()
  const context = { byName, seen: new Set<string>() }
  return params[0].tsType ? namesOf(params[0].tsType, fn.location?.filename ?? "", context) : null
}

/** What the walk carries: every declaration by name, and the types already walked. */
interface WalkContext {
  byName: Map<string, DocDeclaration[]>
  seen: Set<string>
}

/** The property names a type node in `file` allows, or `null` when it is open. */
function namesOf(type: TsType, file: string, context: WalkContext): PropNames {
  const merge = (types: TsType[]): PropNames => {
    const all = new Set<string>()
    for (const part of types) {
      const names = namesOf(part, file, context)
      if (names === null) return null
      for (const name of names) all.add(name)
    }
    return all
  }

  switch (type.kind) {
    case "union":
    case "intersection":
      return merge(type.value)
    case "parenthesized":
      return namesOf(type.value, file, context)
    case "typeLiteral":
      return membersOf(type.value)
    case "typeRef": {
      const { typeName, typeParams, resolution } = type.value as {
        typeName: string
        typeParams?: TsType[]
        resolution?: { kind: string; specifier?: string }
      }
      if (WRAPPERS.has(typeName)) {
        return typeParams?.[0] ? namesOf(typeParams[0], file, context) : null
      }
      return namedType(typeName, whereDeclared(file, resolution), context)
    }
    default:
      return null
  }
}

/**
 * The file a type reference points into: the referring file for a local name, the imported file for
 * a relative import, and `""` (any file) for a package specifier.
 */
function whereDeclared(file: string, resolution?: { kind: string; specifier?: string }): string {
  if (!resolution || resolution.kind === "local") return file
  const specifier = resolution.specifier ?? ""
  return specifier.startsWith(".") && file ? new URL(specifier, file).href : ""
}

/**
 * The props of a type declared by name, an interface or a type alias, in `file` when one is
 * declared there. Two packages may each declare a `FieldProps`; with no file to tell them apart,
 * the names of all of them count, which can only let an attribute through, never fail one.
 */
function namedType(typeName: string, file: string, context: WalkContext): PropNames {
  const key = `${typeName}|${file}`
  if (context.seen.has(key)) return new Set()
  context.seen.add(key)
  const candidates = (context.byName.get(typeName) ?? []).filter((d) =>
    d.kind === "interface" || d.kind === "typeAlias"
  )
  const here = candidates.filter((d) => d.location?.filename === file)
  const declarations = here.length > 0 ? here : candidates
  if (declarations.length === 0) return null

  const all = new Set<string>()
  // deno-lint-ignore no-explicit-any
  for (const declaration of declarations as any[]) {
    const at = declaration.location?.filename ?? file
    const names = declaration.kind === "typeAlias"
      ? namesOf(declaration.def.tsType, at, context)
      : interfaceNames(declaration.def, at, context)
    if (names === null) return null
    for (const name of names) all.add(name)
  }
  return all
}

/** An interface's own members and every member of the interfaces it extends. */
// deno-lint-ignore no-explicit-any
function interfaceNames(def: any, file: string, context: WalkContext): PropNames {
  const all = membersOf(def)
  if (all === null) return null
  for (const parent of def.extends ?? []) {
    const names = namesOf(parent, file, context)
    if (names === null) return null
    for (const name of names) all.add(name)
  }
  return all
}

/** The property and method names of an interface or type literal, or `null` with an index signature. */
// deno-lint-ignore no-explicit-any
function membersOf(def: any): Set<string> | null {
  if ((def.indexSignatures ?? []).length > 0) return null
  return new Set([
    ...(def.properties ?? []).map((p: { name: string }) => p.name),
    ...(def.methods ?? []).map((m: { name: string }) => m.name),
  ])
}

/** One JSX opening tag in a snippet: its component name and the attribute names it writes. */
export interface SnippetTag {
  name: string
  attributes: string[]
}

/**
 * Every opening tag of a PascalCase component in a JSX snippet, with the attributes it writes.
 * Spread attributes (`{...rest}`) are left out. Attribute values are skipped whole, braces, strings
 * and nested JSX included, and a tag nested inside a value is reported as a tag of its own.
 *
 * @param snippet The card's snippet.
 */
export function snippetTags(snippet: string): SnippetTag[] {
  const tags: SnippetTag[] = []
  for (const match of snippet.matchAll(/<([A-Z][\w.]*)/g)) {
    const attributes: string[] = []
    let i = match.index + match[0].length
    while (i < snippet.length) {
      while (/\s/.test(snippet[i] ?? "")) i++
      if (snippet[i] === ">" || snippet.startsWith("/>", i) || i >= snippet.length) break
      if (snippet[i] === "{") {
        i = skipBraces(snippet, i)
        continue
      }
      const name = /^[\w:-]+/.exec(snippet.slice(i))?.[0]
      if (!name) break
      attributes.push(name)
      i += name.length
      while (/\s/.test(snippet[i] ?? "")) i++
      if (snippet[i] !== "=") continue
      i++
      while (/\s/.test(snippet[i] ?? "")) i++
      if (snippet[i] === "{") i = skipBraces(snippet, i)
      else if (snippet[i] === '"' || snippet[i] === "'") {
        const end = snippet.indexOf(snippet[i], i + 1)
        i = end === -1 ? snippet.length : end + 1
      }
    }
    tags.push({ name: match[1], attributes })
  }
  return tags
}

/** The index just past the brace group that opens at `start`, strings and templates skipped. */
function skipBraces(text: string, start: number): number {
  let depth = 0
  let i = start
  while (i < text.length) {
    const char = text[i]
    if (char === '"' || char === "'" || char === "`") {
      i++
      while (i < text.length && text[i] !== char) i += text[i] === "\\" ? 2 : 1
    } else if (char === "{") depth++
    else if (char === "}" && --depth === 0) return i + 1
    i++
  }
  return text.length
}

/**
 * The prop names one props row documents: a row may name several (`busy / busyLabel`), and one
 * that documents a field of a prop (`images[].webpSrc`) names that prop.
 */
export function rowNames(row: string): string[] {
  return row.split("/").map((name) => name.trim().split(/[.[]/)[0]).filter(Boolean)
}

/** Attributes Preact handles itself, valid on every component whatever its props. */
const FRAMEWORK_ATTRIBUTES = new Set(["key", "ref"])

/** What one card's snippet and props rows give the check. */
export interface CardInput {
  /** The card's name: the component it documents. */
  name: string
  snippet: string
  /** The names in the card's props table. */
  propRows: string[]
}

/** What {@link propsReport} found. */
export interface PropsReport {
  /** One sentence per prop a snippet or a props row names and its component does not take. */
  problems: string[]
  /** Components whose props were listed in full and checked. */
  checked: string[]
  /** Components skipped because their props type is open. */
  open: string[]
}

/**
 * Checks every card: each attribute a snippet writes on a component, and each name in the card's
 * props table, must be a prop that component takes.
 *
 * @param cards The cards to check.
 * @param props The prop names of a component by its name, `null` when open, `undefined` when the
 *   name is no component of the packages (an HTML element, a demo helper).
 */
export function propsReport(
  cards: CardInput[],
  props: (component: string) => PropNames | undefined,
): PropsReport {
  const problems: string[] = []
  const checked = new Set<string>()
  const open = new Set<string>()
  const allowed = (component: string) => {
    const names = props(component)
    if (names === null) open.add(component)
    else if (names !== undefined) checked.add(component)
    return names
  }

  for (const card of cards) {
    for (const tag of snippetTags(card.snippet)) {
      const names = allowed(tag.name)
      if (!names) continue
      for (const attribute of tag.attributes) {
        if (names.has(attribute) || FRAMEWORK_ATTRIBUTES.has(attribute)) continue
        problems.push(
          `${card.name}'s snippet writes <${tag.name} ${attribute}>, and ${tag.name} has no prop ${attribute}`,
        )
      }
    }
    const names = allowed(card.name)
    if (!names) continue
    for (const row of card.propRows.flatMap(rowNames)) {
      if (!names.has(row)) {
        problems.push(
          `${card.name}'s props table lists ${row}, and ${card.name} has no prop ${row}`,
        )
      }
    }
  }
  return { problems, checked: [...checked].sort(), open: [...open].sort() }
}
