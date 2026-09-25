import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { compile } from "tailwindcss"
import { fileURLToPath } from "node:url"
import { stylesheetLoader } from "./load-stylesheet.ts"

/** Must stay in step with the `tailwindcss` pin in the repo root `deno.jsonc`. */
const TAILWIND_VERSION = "4.1.12"

const THEME_DIRECTORY = fileURLToPath(new URL("../", import.meta.url))

/**
 * The stylesheet an app writes, plus Tailwind's own internals.
 *
 * `@import "tailwindcss"` expands to `theme.css` + `preflight.css` + the
 * `utilities` layer, in that order. This suite compiles from the package
 * directory rather than through a build tool, so the three are imported by name
 * and Tailwind's `index.css` — which contains all three — is never read. That
 * keeps the assertion trail short: everything the preset emits is reachable
 * from the preset.
 *
 * @param documentsCss Extra CSS placed between the tokens and the preset, where
 *   an app's own overrides go.
 * @returns The stylesheet to compile.
 */
function entrypointCss(documentsCss = ""): string {
  return `@import "tailwindcss/theme.css";\n` +
    `@import "tailwindcss/preflight.css";\n` +
    `@import "./tokens.css";\n` +
    `${documentsCss}` +
    `@import "./preset.css";\n` +
    `@import "tailwindcss/utilities.css";\n`
}

/**
 * Compile the shipped preset with Tailwind 4 and emit only `candidates`.
 *
 * The stylesheets are read inside the compile, behind {@link stylesheetLoader},
 * rather than at module scope — so a missing read grant fails the test that
 * needed it instead of failing collection for the whole file.
 *
 * @param css Entrypoint stylesheet, as an app would write it.
 * @param candidates Class names to emit.
 * @param requiredStylesheets Basenames the compiler must have read.
 * @returns The compiled CSS.
 * @throws If the compiler skipped a required stylesheet.
 */
async function compilePreset(
  css: string,
  candidates: string[],
  requiredStylesheets = ["tokens.css", "preset.css"],
): Promise<string> {
  const imported = new Set<string>()
  const load = stylesheetLoader(TAILWIND_VERSION)
  const compiler = await compile(css, {
    // Tailwind only hands the loader a base path when `base` is set here; it
    // ignores `from` for that purpose, and the loader refuses an empty base.
    base: THEME_DIRECTORY,
    async loadStylesheet(id, base) {
      const stylesheet = await load(id, base)
      imported.add(stylesheet.path)
      return stylesheet
    },
    // Reached only by `@plugin` and `@config`, which the preset does not use.
    loadModule() {
      throw new Error("the theme preset loads no JavaScript modules")
    },
  })

  for (const name of requiredStylesheets) {
    if (!imported.has(`${THEME_DIRECTORY}${name}`)) {
      throw new Error(`the compiler did not read ${name}`)
    }
  }

  return compiler.build(candidates)
}

/** Every class the preset is expected to emit, standing in for component output. */
const CANDIDATES = [
  "bg-canvas",
  "bg-danger",
  "bg-primary",
  "bg-surface",
  "bg-success",
  "bg-warning",
  "bar",
  "border-control",
  "border-primary",
  "border-subtle",
  "btn",
  "btn-danger",
  "btn-danger-outline",
  "btn-disabled",
  "btn-icon",
  "btn-input-icon",
  "btn-link",
  "btn-primary",
  "btn-primary-outline",
  "btn-success",
  "btn-success-outline",
  "btn-warning",
  "btn-warning-outline",
  "card",
  "card-body",
  "card-footer",
  "card-header",
  "checkbox",
  "dark:btn-primary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "input",
  "kpi",
  "kpi-label",
  "kpi-value",
  "label",
  "link",
  "list-ul",
  "num",
  "page-layout",
  "radio",
  "rounded-primary",
  "scrollbar",
  "select",
  "text-danger",
  "text-muted",
  "text-primary",
  "text-success",
  "text-warning",
  "textarea",
  "theme-base",
]

/** The classes the gate and the dark scope select, in the order they appear. */
const GATE_CLASS = "theme-base"
const DARK_CLASS = "dark"

/**
 * The host elements a page can put under these rules: the subjects the gate
 * applies to, whether or not `preset.css` gates them today.
 */
const CONTROL_TAILS = [
  "select",
  "input",
  "textarea",
  '[role="combobox"]',
  '[role="listbox"]',
  "option",
  "table",
  "thead",
  "th",
  "td",
]

/**
 * The shipped stylesheet, as written, for the assertions that compare it against
 * its own compiled output.
 *
 * Read from disk rather than restated here: a test that builds the selector it
 * then looks for proves only that two copies of one string agree.
 */
const PRESET_CSS = Deno.readTextFileSync(new URL("../preset.css", import.meta.url))

/** One element of an ancestor chain: its tag, its classes and its attributes. */
interface ChainNode {
  tag: string
  classes: string[]
  attributes: Record<string, string>
}

/** One compound selector: what it requires, and what it refuses. */
interface Compound {
  tag: string
  classes: string[]
  notClasses: string[]
  attributes: Record<string, string>
}

/** The compound selector syntax these rules are written in, and nothing else. */
const COMPOUND = /:where\(([^()]*)\)|:not\(([^()]*)\)|\.([\w-]+)|\[([\w-]+)(?:="([^"\]]*)")?\]/g

/**
 * Read one compound selector into what it requires and what it refuses.
 *
 * Deliberately not a CSS engine: it understands only the syntax `preset.css`'s
 * own rules are written in — an element name, `:where(<tag>)`, `:where(<class>)`,
 * `:where(*)`, `:where(<class> *)`, `:not(<class>)`, `.<class>` and
 * `[attribute="value"]` — and **throws on anything it cannot read**, including
 * leftover text. A matcher that drops what it does not understand is a matcher
 * that guesses, and guessing is how a dead selector passes a gate test.
 *
 * @param compound One selector with no combinator, e.g. `:where(.theme-base)`.
 * @returns The requirements the compound places on an element.
 * @throws If any part of the compound is outside that subset.
 */
function parseCompound(compound: string): Compound {
  const classes: string[] = []
  const notClasses: string[] = []
  const attributes: Record<string, string> = {}
  let tag = ""
  let cursor = 0

  for (const match of compound.matchAll(COMPOUND)) {
    const [text, where, not, bareClass, attribute, value] = match
    const at = match.index
    tag = readTag(compound, compound.slice(cursor, at), tag)
    cursor = at + text.length

    if (where !== undefined) {
      const argument = readPseudoArgument(where, compound)
      tag = readTag(compound, argument.tag, tag)
      classes.push(...argument.classes)
    } else if (not !== undefined) {
      notClasses.push(...readPseudoArgument(not, compound, true).classes)
    } else if (bareClass !== undefined) {
      classes.push(bareClass)
    } else if (attribute !== undefined) {
      attributes[attribute] = value ?? ""
    }
  }

  tag = readTag(compound, compound.slice(cursor), tag)
  return { tag, classes, notClasses, attributes }
}

/**
 * Accept the text between two understood parts, which may only be a tag name.
 *
 * @param compound The whole compound, for the error message.
 * @param text The text found between two tokens.
 * @param tag The tag found so far, if any.
 * @returns The tag name.
 * @throws If the text is not a single element name, or a second one.
 */
function readTag(compound: string, text: string, tag: string): string {
  if (!text) {
    return tag
  }
  if (tag || !/^[a-z][\w-]*$/.test(text)) {
    throw new Error(`unsupported selector syntax: ${compound}`)
  }
  return text
}

/**
 * Read a `:where()` or `:not()` argument into the condition it places.
 *
 * `:where(option)` is an element condition and `:where(*)` constrains nothing;
 * both matter, because an argument this reader treated as "no condition" would
 * make a rule look like it cannot style the element it plainly styles — which is
 * how `:where(option)` carrying the gate's own declarations stayed invisible.
 *
 * @param inner The argument as written, e.g. `option`, `.dark` or `.dark *`.
 * @param compound The whole compound, for the error message.
 * @param negated Whether the argument must be a class the element denies.
 * @returns The tag the argument names, if any, and the classes it requires.
 * @throws If the argument is outside the syntax these rules are written in.
 */
function readPseudoArgument(
  inner: string,
  compound: string,
  negated = false,
): { tag: string; classes: string[] } {
  const argument = inner.trim()
  if (argument === "*") {
    return { tag: "", classes: [] }
  }

  const tag = /^([a-z][\w-]*)$/.exec(argument)
  if (tag?.[1]) {
    if (negated) {
      throw new Error(`unsupported selector syntax: ${compound}`)
    }
    return { tag: tag[1], classes: [] }
  }

  const single = /^\.([\w-]+)$/.exec(argument)
  if (single?.[1]) {
    return { tag: "", classes: [single[1]] }
  }

  // `:where(.dark *)` is the same test as `:where(.dark)` for matching purposes:
  // the rule applies to a descendant of `.dark`, which is the position this
  // matcher already walks. Accepting it keeps Tailwind's own variant output
  // readable here; a denial of a descendant is not the same statement, so
  // `:not(.dark *)` is refused rather than approximated.
  const descendant = /^\.([\w-]+)\s+\*$/.exec(argument)
  if (!negated && descendant?.[1]) {
    return { tag: "", classes: [descendant[1]] }
  }

  throw new Error(`unsupported selector syntax: ${compound}`)
}

/**
 * Whether one compound selector matches one chain node.
 *
 * A `:not()` in the compound is satisfied only when the node does *not* carry
 * that class. That is the check that separates a real gate from
 * `.dark select:not(.theme-base)`, which reads like a gate, applies to the
 * element the rule styles, and requires no ancestor at all.
 *
 * @param compound Compound selector, e.g. `:where(.dark)` or `select`.
 * @param node Chain node to match against.
 * @returns True when the tag, every class and every attribute match, and no
 *   denied class is present.
 */
function matchesCompound(compound: string, node: ChainNode): boolean {
  const { tag, classes, notClasses, attributes } = parseCompound(compound)
  return (!tag || tag === node.tag) &&
    classes.every((name) => node.classes.includes(name)) &&
    notClasses.every((name) => !node.classes.includes(name)) &&
    Object.entries(attributes).every(([name, value]) => node.attributes[name] === value)
}

/**
 * Whether an emitted selector styles an element of the kind `subject` names.
 *
 * @param selector Selector as the compiler emitted it.
 * @param subject A tail such as `option` or `[role="combobox"]`.
 * @returns True when it matches such an element, false when it cannot, and
 *   `null` when it cannot be read — which the caller must treat as a failure
 *   rather than as a non-match. A check that answers "no" to input it cannot
 *   parse is the same hole as the substring test this file replaced.
 */
function matchesMany(selector: string, subject: string): boolean | null {
  const control = controlFor(subject)

  // A bare `option { … }` styles the element wherever it is, with no ancestor
  // condition at all. `matchesChain` refuses a selector with no combinator, so
  // that case has to be asked separately — and it is the one the coverage check
  // exists for. A descendant selector fails to parse as one compound, which is
  // fine and must not end the search.
  if (!/[\s>+~]/.test(selector.trim())) {
    try {
      return matchesCompound(selector, control)
    } catch {
      return null
    }
  }

  for (const chain of [...chainsFor(true, true), ...chainsFor(true, false)]) {
    try {
      if (matchesChain(selector, control, chain)) {
        return true
      }
    } catch {
      // A `&`-nested fragment, a combinator this matcher does not implement, or
      // syntax outside the preset's own: unreadable, so unjudgeable.
      return null
    }
  }
  return false
}

/**
 * Quote a literal for use inside a regular expression.
 *
 * @param value Literal text.
 * @returns The escaped text.
 */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Split on a delimiter that appears at the top level, not inside brackets.
 *
 * `:where(.dark, .dark *)` is one selector; a plain `split(",")` cuts it in two
 * and hands the matcher a fragment it cannot read.
 *
 * @param value Text to split.
 * @param delimiter Single-character delimiter.
 * @returns The parts, in order.
 */
function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === "(" || character === "[") {
      depth++
    } else if (character === ")" || character === "]") {
      depth--
    } else if (character === delimiter && depth === 0) {
      parts.push(value.slice(start, index))
      start = index + 1
    }
  }

  parts.push(value.slice(start))
  return parts
}

/**
 * Every selector in the compiled stylesheet, in source order, de-duplicated.
 *
 * Reads the output rather than a restatement of it: a test that evaluates a
 * string the test itself built proves only that the two strings agree, never
 * that the emitted CSS is gated.
 *
 * @param css Compiled stylesheet.
 * @returns One entry per comma-separated selector of every declaration block.
 */
function emittedSelectors(css: string): string[] {
  const selectors = new Set<string>()
  for (const rule of emittedRules(css)) {
    for (const selector of rule.selectors) {
      selectors.add(selector)
    }
  }
  return [...selectors]
}

/** One compiled declaration block: the selectors it applies to, and its body. */
interface EmittedRule {
  selectors: string[]
  body: string
}

/**
 * Every declaration block in the compiled stylesheet, with its selectors.
 *
 * @param css Compiled stylesheet.
 * @returns The rules in source order, at-rule chunks skipped.
 */
function emittedRules(css: string): EmittedRule[] {
  const rules: EmittedRule[] = []
  for (const [, prelude, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selectors = selectorsOf(prelude ?? "")
    if (selectors.length) {
      rules.push({ selectors, body: normalizeDeclarations(body ?? "") })
    }
  }
  return rules
}

/**
 * Split a declaration body into the declarations it makes.
 *
 * @param body The text between a rule's braces.
 * @returns One entry per declaration, `property: value`, whitespace-normalised.
 */
function parseDeclarations(body: string): string[] {
  return body.split(";")
    .map((declaration) => declaration.replace(/\s+/g, " ").trim())
    // `!important` is dropped before comparing. Letting it decide whether a rule
    // "carries" a gate's declarations would make the gate's own priority the
    // thing that hides a copy of it: `background-color: X !important` in the
    // gate would stop matching a plain `background-color: X` in a bare rule that
    // restyles the same element with the same value.
    .map((declaration) => declaration.replace(/\s*!\s*important$/i, "").trim())
    // The `var()` fallback is dropped as well: a rule that reads the same custom
    // property in the same slot paints what the gate paints whenever the tokens
    // say so, and fallback *text* must not be what hides it. {@link
    // rawDeclarations} keeps the other half — a byte-identical declaration — so
    // both spellings of a copy are caught.
    // The parentheses have to be balanced: a fallback may itself be a function
    // (`oklch(0.278 0.033 256.848)`), and a pattern that stops at the first `)`
    // leaves an unbalanced string that no longer matches the rule it is meant to.
    .map((declaration) =>
      declaration.replace(/(var\(\s*--[\w-]+)(?:,\s*[^()]*(?:\([^()]*\)[^()]*)*)?\)/g, "$1)")
    )
    .filter(Boolean)
}

/**
 * Whether two rules share any declaration at all.
 *
 * This is the predicate the veto asks, and it is deliberately weaker than
 * "carries a whole gate body". `option { color: var(--color-foreground, …) }`
 * shares one declaration with the option gate next to it and paints the gate's
 * dark foreground on host markup with no opt-in; requiring the whole body let it
 * through. One declaration is enough to be a copy of the chrome the gate owns.
 *
 * @param body A rule's declarations, normalised.
 * @param other The gate's declarations, normalised.
 * @returns True when the two have at least one declaration in common.
 */
function sharesADeclaration(body: string, other: string): boolean {
  const mine = parseDeclarations(body)
  const raw = rawDeclarations(other)
  const theirs = parseDeclarations(other)

  return theirs.some((declaration, index) =>
    mine.includes(declaration) || mine.includes(raw[index] ?? "")
  )
}

/**
 * A body's declarations with `!important` dropped, and nothing else.
 *
 * {@link parseDeclarations} also erases the `var()` fallback, which is what makes
 * a respelled fallback visible as a copy; keeping the raw form as well is what
 * makes the equality case — a byte-identical declaration — visible even when the
 * gate spells it with `!important` and the copy does not. A declaration counts as
 * shared when either form matches.
 *
 * @param body The declarations to read.
 * @returns One entry per declaration, `!important` stripped.
 */
function rawDeclarations(body: string): string[] {
  return body.split(";")
    .map((declaration) => declaration.replace(/\s+/g, " ").trim())
    .map((declaration) => declaration.replace(/\s*!\s*important$/i, "").trim())
    .filter(Boolean)
}

/**
 * Whether a rule makes declarations the preset's gates also make.
 *
 * @param body The rule's declarations, normalised.
 * @param gateBodies The gates' declarations, normalised.
 * @returns True when the rule shares a declaration with any gate.
 */
function sharesGateChrome(body: string, gateBodies: string[]): boolean {
  return gateBodies.some((gate) => sharesADeclaration(body, gate))
}

/**
 * Collapse a declaration body so two spellings of one rule compare equal.
 *
 * @param body The text between a rule's braces.
 * @returns The declarations, whitespace-normalised.
 */
function normalizeDeclarations(body: string): string {
  return body.replace(/\s+/g, " ").trim()
}

/**
 * The classes the preset *defines*, read from `preset.css` and nothing else.
 *
 * This is the one thing that makes the exemption safe. Harvesting class names
 * from the compiled sheet under test — which is what this did — let the rule
 * being judged contribute to its own exemption: `option:not(.zzqq-nothing-ships-this)`
 * names a class no rule ships, the scan added it to the vocabulary, and the rule
 * exempted itself. A rule can now only match a class the preset declares, so it
 * cannot influence its own verdict at all.
 *
 * Two sources, both the preset's own text: every `@utility` name (the bare
 * class, before Tailwind turns it into a selector), and the two classes the
 * document rules use, which are written as literal class selectors rather than
 * `@utility`s.
 *
 * @returns The class names the preset defines.
 */
function presetVocabulary(): Set<string> {
  const names = new Set<string>([GATE_CLASS, DARK_CLASS])
  for (const [, name] of PRESET_CSS.matchAll(/@utility\s+([\w-]+)/g)) {
    if (name) {
      names.add(name)
    }
  }
  return names
}

/**
 * Whether every element a selector can style is one the preset class-styles.
 *
 * The exemption's question, stated so a rule cannot answer it in its own favour:
 * *is there any element this selector reaches that carries no library class?*
 * If there is, the rule is a copy of the gate's chrome for that element and must
 * be reported; it is exempt only when **every** branch of its subject carries a
 * vocabulary class.
 *
 * Three restrictions, each closing a way a rule exempted itself:
 *
 *   - **Subject position only.** `.card option` styles a bare `option`; a class
 *     above it exempts nothing.
 *   - **The subject's own class tokens only.** A class that appears just inside
 *     `:not()`, `:has()` or an attribute value is not a class the element
 *     carries, so `option:not(.card)`, `option:has(.card)` and
 *     `option[data-x=".card"]` are all still copies.
 *   - **Every branch, not some branch.** `:is(option, .card)` reaches a bare
 *     `option` through one of its alternatives, so it is not exempt — checking
 *     only whether a vocabulary class appears *somewhere* in the subject let it
 *     through.
 *
 * @param selector Selector as the compiler emitted it.
 * @param vocabulary The classes from {@link presetVocabulary}.
 * @returns True when no branch of the subject reaches a class-less element.
 */
function usesVocabulary(selector: string, vocabulary: Set<string>): boolean {
  const branches = subjectBranches(subjectOf(selector))
  return branches.length > 0 &&
    branches.every((branch) => classTokensOf(branch).some((name) => vocabulary.has(name)))
}

/**
 * The subject shapes a compound can resolve to, one per `:is()` / `:where()`
 * alternative.
 *
 * `:is(option, .card)` is two subjects, not one: it reaches a bare `option`
 * through its first alternative, so the rule is a copy for that element. The
 * alternatives are expanded here rather than flattened away, which is what makes
 * the per-branch test above able to see the class-less one.
 *
 * @param compound The subject compound.
 * @returns One string per alternative.
 */
function subjectBranches(compound: string): string[] {
  const branches: string[] = []

  const visit = (text: string): void => {
    const withoutPseudos = stripPseudoBlocks(text)
    const args = pseudoArguments(text, ":is").concat(pseudoArguments(text, ":where"))
    if (args.length === 0) {
      branches.push(withoutPseudos)
      return
    }
    for (const argument of args) {
      for (const alternative of splitTopLevel(argument, ",")) {
        visit(alternative)
      }
    }
  }

  visit(compound)
  const expanded = branches.filter(Boolean)
  return expanded.length > 0 ? expanded : [""]
}

/**
 * Drop every bracketed group from a compound.
 *
 * `:not(...)`, `:has(...)` and `[...]` name other elements or a value, never the
 * element being styled, so their contents are removed rather than read.
 *
 * @param text A compound selector, or part of one.
 * @returns The text outside every bracket pair.
 */
function stripPseudoBlocks(text: string): string {
  let out = ""
  let depth = 0
  for (let index = 0; index < text.length; index++) {
    const character = text[index] ?? ""
    if (character === "(" || character === "[") {
      depth++
      continue
    }
    if (character === ")" || character === "]") {
      depth--
      continue
    }
    if (depth === 0) {
      out += character
    }
  }
  return out
}

/**
 * The arguments of every `:is()` / `:where()` in a compound.
 *
 * @param text A compound selector, or part of one.
 * @param name The pseudo-class to read, with its colon.
 * @returns The arguments, in source order.
 */
function pseudoArguments(text: string, name: string): string[] {
  const args: string[] = []
  for (let at = text.indexOf(`${name}(`); at >= 0; at = text.indexOf(`${name}(`, at + 1)) {
    let depth = 0
    for (let index = at + name.length; index < text.length; index++) {
      const character = text[index] ?? ""
      if (character === "(") {
        depth++
      } else if (character === ")") {
        depth--
        if (depth === 0) {
          args.push(text.slice(at + name.length + 1, index))
          break
        }
      }
    }
  }
  return args
}

/**
 * The classes a compound selector actually applies to its element.
 *
 * `:not(...)`, `:has(...)` and `[...]` are stripped first: their contents name
 * *other* elements or a value, never the element being styled. What is left is
 * the compound's own class tokens — plus, for correctness, the tokens inside a
 * `:is()` or `:where()` that share the compound's subject position, which is why
 * the strip is a scan for balanced brackets rather than a single regex.
 *
 * @param compound One selector with no combinator.
 * @returns The class names the element itself must have.
 */
function classTokensOf(compound: string): string[] {
  let text = ""
  let depth = 0
  for (let index = 0; index < compound.length; index++) {
    const character = compound[index] ?? ""
    if (character === "(" || character === "[") {
      depth++
      continue
    }
    if (character === ")" || character === "]") {
      depth--
      continue
    }
    if (depth === 0) {
      text += character
    }
  }
  return classNamesOf(text)
}

/**
 * The compound a selector actually styles: its last one.
 *
 * The vocabulary exemption is a *subject-position* rule and nothing wider. The
 * library ships rules for `.card`, `.kpi`, `.label`, `.radio`, `.bg-surface` and
 * `.border-control`, and those rules style elements carrying that class — which
 * is a different question from the host chrome the gate owns. A class in
 * **ancestor** position is not that: `.card option` styles an `option` that
 * carries no library class at all, and `.card` being anywhere above it must not
 * exempt the rule. Reading the whole selector for a class made every one of
 * those shapes invisible, including `.cardx option`, whose own class the scan
 * then absorbed into the vocabulary.
 *
 * @param selector Selector as the compiler emitted it.
 * @returns The last compound, after any descendant or sibling combinator.
 */
function subjectOf(selector: string): string {
  // Depth-aware, not `split(/\s+/)`: `:is(option, .card)` is one subject, and a
  // naive split hands back `.card)` — which happens to look like a library class
  // and silently exempts the rule. The bracket-aware splitter is the same one
  // the emitted-selector reader uses.
  let spaced = selector.trim()
  for (const combinator of [">", "+", "~"]) {
    spaced = splitTopLevel(spaced, combinator).join(" ")
  }
  const compounds = splitTopLevel(spaced, " ").map((part) => part.trim()).filter(Boolean)
  return compounds.at(-1) ?? ""
}

/**
 * The class names a selector asks for.
 *
 * `classNamesOf("option")` is empty even though the text contains "option": a
 * property name inside `var(--color-surface)` is not a class, and reading it as
 * one is how the vocabulary filter came to exclude the very selectors it exists
 * to judge. A class selector is a dot, a name, and no `-` — the double hyphen of
 * a custom property never appears after one.
 *
 * @param selector Selector as the compiler emitted it.
 * @returns The class names, in order.
 */
function classNamesOf(selector: string): string[] {
  return [...selector.matchAll(/\.([\w-]+)/g)]
    .map((match) => match[1] ?? "")
    .filter((name) => !name.startsWith("-"))
}

/**
 * Whether anything un-gated applies the preset's own declarations to a subject.
 *
 * This is the evasion a scan starting from `.dark`-naming selectors cannot see:
 * a bare `option` shipping the preset's chrome, spelled `option` or
 * `:where(option)`, with no `.dark` and no opt-in.
 *
 * Two things make it precise. Declarations are compared by **overlap**, so a
 * rule that declares the gate's values *beside* its own — `option { <gate body>;
 * cursor: pointer }` — is caught; and the comparison is scoped to bodies the
 * preset itself declares, so preflight's bare `option`/`table`/`select` rules
 * (which declare inheritance and fonts the preset never declares) are not
 * flagged.
 *
 * @param css Compiled stylesheet.
 * @param analysis The findings {@link analyseGate} produced for this stylesheet.
 * @returns The offending selectors, in source order.
 * @throws If a host selector in a rule that carries preset chrome cannot be read.
 */
function unGatedCopiesOfGate(css: string, analysis: GateAnalysis): string[] {
  const preset = presetGateBodies()
  const vocabulary = presetVocabulary()
  const offenders: string[] = []

  for (const rule of emittedRules(css)) {
    /*
     * One shared declaration puts a rule in scope, and the comparison has already
     * dropped `!important` and `var()` fallback text. Gates declare `var()` reads
     * of the preset's own custom properties, so nothing in Tailwind's preflight
     * (`appearance`, `font`, `border-color: inherit`) shares one of them.
     */
    if (!sharesGateChrome(rule.body, preset)) {
      continue
    }
    for (const selector of rule.selectors) {
      if (analysis.findings.find((entry) => entry.selector === selector)?.gated) {
        continue
      }
      if (usesVocabulary(selector, vocabulary)) {
        continue
      }
      /*
       * No positive match is required. A rule that carries a gate's declarations
       * is the preset's own chrome, and if it is not gated it ships that chrome
       * to everything the selector reaches — `option[data-x]` included, which the
       * chain matcher cannot prove matches a plain `option` but a browser will.
       * Requiring a match first is what let the attribute-qualified form through.
       */
      offenders.push(selector)
    }
  }

  return offenders
}

/**
 * Read one declaration block's prelude into its selectors.
 *
 * A prelude may hold several, which is how `th, td { … }` reaches both cells:
 * coverage has to be counted per selector, not per rule, or adding a subject to
 * an existing rule list would look like the rule already accounted for it.
 *
 * @param prelude The text before a declaration block's `{`.
 * @returns The non-empty selectors, in order.
 */
function selectorsOf(prelude: string): string[] {
  return splitTopLevel(prelude, ",").map((selector) => selector.trim())
    // A chunk that opens an at-rule, or that still holds a `;`, is not a
    // selector: `@layer properties;` and `@media …` land here.
    .filter((selector) => selector && !selector.startsWith("@") && !selector.includes(";"))
}

/**
 * The chain a control sits at the end of, with `dark` on `<html>` as the page
 * builds it and the opt-in optionally absent.
 *
 * `wrapper` is the element a host puts between `<body>` and the control: a
 * `div`, or the popup `[role="combobox"]` an app builds. Both are tried, so a
 * selector is judged on either, and neither can stand in for the gate.
 *
 * @param dark Whether `<html>` carries `dark`.
 * @param themed Whether `<body>` carries theme-base.
 * @param wrapper Whether to include the intermediate wrapper element.
 * @returns The chain, outermost ancestor first, the control's parent last.
 */
function shippedChain(
  { dark, themed, wrapper }: { dark: boolean; themed: boolean; wrapper: boolean },
): ChainNode[] {
  const chain: ChainNode[] = [
    { tag: "html", classes: dark ? [DARK_CLASS] : [], attributes: {} },
    { tag: "body", classes: themed ? [GATE_CLASS] : [], attributes: {} },
  ]
  if (wrapper) {
    chain.push({ tag: "div", classes: [], attributes: {} })
  }
  return chain
}

/**
 * The two chains a host control can sit in: with and without a wrapper element
 * between `<body>` and the control, because a host may or may not have one.
 *
 * @param dark Whether `<html>` carries `dark`.
 * @param themed Whether `<body>` carries theme-base.
 * @returns Both chains.
 */
function chainsFor(dark: boolean, themed: boolean): ChainNode[][] {
  return [
    shippedChain({ dark, themed, wrapper: true }),
    shippedChain({ dark, themed, wrapper: false }),
  ]
}

/**
 * The element at the end of a chain that a tail selector targets.
 *
 * `select` and `option` are tags; `[role="combobox"]` is an attribute on the
 * same wrapper element, because the preset styles the popup an app builds with
 * that role rather than a native control.
 *
 * @param tail The tail of the selector, e.g. `select` or `[role="combobox"]`.
 * @returns A node the tail expects, standing in for the real control.
 */
function controlFor(tail: string): ChainNode {
  const parsed = parseCompound(tail)
  return {
    tag: parsed.tag || "div",
    // A tail names no denial: the element a control stands for carries the
    // classes the selector asks for, and `matchesCompound` denies a class only
    // where the selector itself has a `:not()`.
    classes: parsed.classes,
    attributes: parsed.attributes,
  }
}

/**
 * Whether a descendant selector matches a control at the end of `ancestors`.
 *
 * Walks the chain right to left, which is how a browser resolves it: the
 * compounds before the last one are the ancestors of the element the last one
 * matched, each strictly outside the one after it. Direction is the assertion —
 * a gate with the right parts in the wrong order still fails here, which is
 * exactly what the text-only check this replaces could not see.
 *
 * @param selector Selector as the compiler emitted it, space-separated.
 * @param control The element being styled.
 * @param ancestors The chain, outermost first.
 * @returns True when the whole selector matches.
 * @throws If the selector is not a descendant selector.
 */
function matchesChain(selector: string, control: ChainNode, ancestors: ChainNode[]): boolean {
  return chainMatches(selector, control, ancestors, false)
}

/**
 * Whether a descendant selector matches, reading the chain as tentative.
 *
 * {@link matchesChain} walks strictly outward and rejects a selector whose
 * parts are in the wrong order, which is what the gate assertion wants.
 * {@link analyseGate} wants the opposite tolerance: a `.dark` compound that
 * cannot match anything outside the previous one may still match the control's
 * own ancestor, and a selector that only reaches that far is a dark rule all
 * the same. The inward step is permitted only after the outward search finds
 * nothing, so `:where(.theme-base) .dark select` — the order that matches
 * nothing on the shipped page — is still judged by the chain it cannot match.
 *
 * @param selector Selector as the compiler emitted it, space-separated.
 * @param control The element being styled.
 * @param ancestors The chain, outermost first.
 * @returns True when the selector can match the control position.
 */
function chainMatchesLoosely(
  selector: string,
  control: ChainNode,
  ancestors: ChainNode[],
): boolean {
  return chainMatches(selector, control, ancestors, true)
}

/**
 * Match a descendant selector against a chain.
 *
 * @param selector Selector as the compiler emitted it, space-separated.
 * @param control The element being styled.
 * @param ancestors The chain, outermost first.
 * @param relax Inward search of a single step for a compound that matches
 *   nothing outside the previous one.
 * @returns True when the selector matches.
 * @throws If the selector is not a space-separated descendant selector.
 */
function chainMatches(
  selector: string,
  control: ChainNode,
  ancestors: ChainNode[],
  relax: boolean,
): boolean {
  const trimmed = selector.trim()
  if (/[>+~]/.test(trimmed)) {
    throw new Error(`unsupported combinator in: ${trimmed}`)
  }

  const compounds = splitTopLevel(trimmed, " ").map((part) => part.trim()).filter(Boolean)
  const last = compounds.at(-1)
  if (compounds.length < 2 || last === undefined) {
    throw new Error(`expected a descendant selector, got: ${trimmed}`)
  }

  if (!matchesCompound(last, control)) {
    return false
  }

  let limit = ancestors.length - 1
  for (let position = compounds.length - 2; position >= 0; position--) {
    const compound = compounds[position] ?? ""

    let found = -1
    for (let index = limit; index >= 0; index--) {
      if (matchesCompound(compound, ancestors[index]!)) {
        found = index
        break
      }
    }

    if (found < 0 && relax) {
      for (let index = limit + 1; index < ancestors.length; index++) {
        if (matchesCompound(compound, ancestors[index]!)) {
          found = index
          break
        }
      }
    }

    if (found < 0) {
      return false
    }
    limit = found - 1
  }

  return true
}

/**
 * The elements `preset.css` declares a gate for, read from the file itself.
 *
 * `th, td { … }` in that list is two subjects, not one, so `td` gets its own
 * entry — which is the point: a subject sharing a rule with a gated one has not
 * been covered by it.
 *
 * @returns The subjects of every `:where(.dark) :where(.theme-base) …` list.
 */
function gatedSubjectsInSource(): string[] {
  const subjects: string[] = []
  for (
    const [, prelude] of PRESET_CSS.matchAll(/(:where\(\.dark\)\s+:where\(\.theme-base\)[^{]*)\{/g)
  ) {
    for (const selector of selectorsOf(prelude ?? "")) {
      const subject = selector.replace(/^:where\(\.dark\)\s+:where\(\.theme-base\)\s*/, "").trim()
      if (subject) {
        subjects.push(subject)
      }
    }
  }
  return subjects
}

/**
 * One entry of {@link analyseGate}: an emitted selector, and what it requires.
 */
interface GateFinding {
  /** The selector as the compiler emitted it. */
  selector: string
  /** True when it needs a theme-base ancestor, so the gate is what lets it apply. */
  gated: boolean
  /** True when it needs a dark ancestor, so it is dark-scoped. */
  darkScoped: boolean
  /** True when the selector names the gate's own `.dark` class, so it is in scope. */
  darkSubject: boolean
}

/**
 * Classify every emitted selector by what it *requires*, not by what it says.
 *
 * The distinction this exists for: `.dark select:not(.theme-base)` contains the
 * string `theme-base` and is not gated at all — `:not()` applies to the element
 * the rule styles, not to its ancestors, and the shipped `<select>` has no
 * `theme-base` class of its own. A substring test calls that gated; this decides
 * by matching.
 *
 * Both verdicts come from evaluating the selector against the shipped chains:
 * `gated` when it matches only with the opt-in present, `darkScoped` when it
 * matches with `dark` but without it.
 *
 * @param css Compiled stylesheet.
 * @returns One finding per emitted selector, in source order.
 * @throws If a selector cannot be judged, so nothing is waved through.
 */
function analyseGate(css: string): GateFinding[] {
  return analyseGateFindings(css).findings
}

/**
 * The findings and every selector they were derived from, so a test can assert
 * that the scan reached a selector rather than passing over it.
 */
interface GateAnalysis {
  /** One finding per emitted selector, in source order. */
  findings: GateFinding[]
  /** Every selector the scan extracted from the stylesheet. */
  selectors: string[]
}

/**
 * {@link analyseGate}, also reporting what it scanned.
 *
 * @param css Compiled stylesheet.
 * @returns The findings and the selectors they came from.
 * @throws If a selector in scope cannot be judged.
 */
function analyseGateFindings(css: string): GateAnalysis {
  const candidates = [
    ...new Set([
      ...CONTROL_TAILS.map((tail) => tail),
      ...gatedSubjectsInSource(),
    ]),
  ].map((tail) => controlFor(tail))

  const selectors = emittedSelectors(css)
  const findings = selectors.map((selector) => {
    /*
     * A nested rule: its `&` refers to the enclosing selector, so the text on
     * its own does not say what it matches. Nothing in the gate lives there, and
     * guessing at the parent would be exactly the kind of approximation this
     * check exists to avoid.
     */
    if (selector.includes("&")) {
      return { selector, gated: false, darkScoped: false, darkSubject: false }
    }

    if (!GATE_IN_SCOPE.test(selector)) {
      // Not a `.dark` rule at all — preflight's own `select { … }`, a `dark:`
      // utility, an app's arbitrary rule. It cannot be an un-gated dark rule,
      // and judging it would only make this throw on CSS outside the contract.
      return { selector, gated: false, darkScoped: false, darkSubject: false }
    }

    let gated = false
    let darkScoped = false

    /*
     * A selector with no combinator styles an element regardless of ancestry, so
     * it can only be a violation when that element *is* one of the host controls.
     * `.dark { --color-primary: … }` — the token block — is a single compound for
     * a different subject and is not a host rule at all.
     */
    if (!/[\s>+~]/.test(selector.trim())) {
      const stylesHostDirectly = candidates.some((control) => matchesCompound(selector, control))
      return { selector, gated: false, darkScoped: false, darkSubject: stylesHostDirectly }
    }

    for (const control of candidates) {
      const matches = (dark: boolean, themed: boolean): boolean =>
        chainsFor(dark, themed).some((chain) => {
          try {
            return chainMatchesLoosely(selector, control, chain)
          } catch (cause) {
            throw new Error(`cannot judge "${selector}": ${cause}`)
          }
        })

      const withOptIn = matches(true, true)
      const withoutOptIn = matches(true, false)

      /*
       * Gated means the opt-in is what lets the rule apply: it matches the
       * shipped chain, and stops matching the moment `theme-base` is taken off.
       * "Matches with the opt-in" alone is not enough — every un-gated
       * `.dark select` matches a chain that happens to carry `theme-base` too,
       * which is how `select:not(.theme-base)` would read as gated.
       */
      if (withOptIn && !withoutOptIn) {
        gated = true
      }
      if (withoutOptIn) {
        darkScoped = true
      }
      if (gated && darkScoped) {
        break
      }
    }

    return { selector, gated, darkScoped, darkSubject: true }
  })

  return { findings, selectors }
}

/**
 * The `.dark` class as a compound selector, which is what puts a selector in
 * this contract's scope.
 *
 * Deliberately not a substring test: these are all ruled out. `dark:` utilities
 * (`.dark\:bg-gray-900`), a longer class (`.darkish`), and `:not(.dark)` — the
 * last of which styles elements that are *not* dark, so the gate has nothing to
 * say about it.
 */
const GATE_IN_SCOPE = new RegExp(
  `(^|[^-\\w.:])\\.${escapeForRegExp(DARK_CLASS)}(?![-\\w:])`,
)

/**
 * Whether a gated selector styles an element of the kind `subject` names.
 *
 * @param selector A selector the gate scan marked gated.
 * @param subject The element being checked.
 * @returns True when the selector applies to such an element.
 */
function gatedCovers(selector: string, subject: string): boolean {
  const answer = matchesMany(selector, subject)
  if (answer === null) {
    /*
     * Unconditional, and deliberately so. Carving out everything except the
     * preset's own ten selectors made this loud exactly where it could not fail:
     * `select > option` and `:is(option)` are host selectors in scope that this
     * matcher cannot read, and the carve-out answered "not a cover" instead of
     * refusing. Every caller has already scoped itself to the preset's own
     * output — the veto runs only on rules carrying a gate's body, and the
     * coverage check only on selectors that name `.dark` — so nothing readable
     * reaches here, and an unreadable one is a hole in this suite, not a
     * statement about CSS the preset does not own.
     */
    throw new Error(`cannot judge "${selector}" against ${subject}`)
  }
  return answer
}

/**
 * The declaration bodies the preset's gated rules declare.
 *
 * Taken from the same blocks the gate scan reads, so a body is a
 * gate body exactly when a gated rule declares it.
 *
 * @returns The bodies, whitespace-normalised.
 */
function presetGateBodies(): string[] {
  return [...PRESET_CSS.matchAll(/(:where\(\.dark\)\s+:where\(\.theme-base\)[^{]*)\{([^{}]*)\}/g)]
    .map(([, , body]) => normalizeDeclarations(body ?? ""))
    .filter(Boolean)
}

/** The declarations of the first rule matching `selector`, for substring asserts. */
function declarationsOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) {
    throw new Error(`${selector} is not in the compiled output`)
  }

  return css.slice(start, css.indexOf("}", start))
}

describe("theme preset", () => {
  /*
   * Compiled once for the whole suite. Memoised because bdd's `describe`
   * callback is synchronous, and the compile is worth doing only once.
   */
  let compiled: Promise<string> | undefined
  const preset = () => {
    compiled = compiled ?? compilePreset(entrypointCss(), CANDIDATES)
    return compiled
  }

  it("emits every class the components style against", async () => {
    const css = await preset()
    for (const candidate of CANDIDATES) {
      const selector = `.${candidate.replace("dark:", "")}`
      expect(css, `missing ${selector}`).toContain(selector)
    }
  })

  it("emits declarations for a button, not an empty rule", async () => {
    const css = await preset()
    const rule = css.slice(css.indexOf(".btn {"))
    expect(rule).toContain("display: flex")
    expect(rule).toContain("border-radius: var(--radius-primary, 0.5rem)")
  })

  it("colours atoms from tokens instead of literal palette values", async () => {
    const css = await preset()
    expect(declarationsOf(css, ".bg-primary")).toContain(
      "var(--color-primary, oklch(0.38 0.17 293))",
    )
    expect(declarationsOf(css, ".text-primary")).toContain("var(--color-primary-muted, ")
    expect(declarationsOf(css, ".card")).toContain("var(--color-surface, oklch(1 0 0))")
    expect(declarationsOf(css, ".input")).toContain("var(--color-border-control, ")
  })

  it("composes select from the input atom", async () => {
    expect(declarationsOf(await preset(), ".select")).toContain(
      "height: calc(var(--spacing) * 12)",
    )
  })

  it("scopes the dark variant to the .dark class", async () => {
    expect(await preset()).toContain("&:where(.dark, .dark *)")
  })

  it("emits the disabled and focus-visible states of a button", async () => {
    const css = await preset()
    const btn = css.slice(css.indexOf(".btn {"))
    expect(btn).toContain("&:disabled")
    expect(btn).toContain("cursor: not-allowed")
    expect(btn).toContain("&:focus-visible")
    expect(btn).toContain("outline-width: 2px")
  })

  it("emits the scrollbar vendor pseudos", async () => {
    const css = await preset()
    expect(css).toContain("&::-webkit-scrollbar-thumb")
  })

  it("emits the map status rules", async () => {
    expect(declarationsOf(await preset(), ".status-on .map-marker")).toContain(
      "var(--color-success, ",
    )
  })

  it("does not bring back power-anomaly or its blink keyframes", async () => {
    // #143 gave `map/` the marker classes and dropped this one: `power-anomaly` was one source
    // application's own wording, not part of this library, and nothing else in the theme ever used
    // `blink`.
    const css = await preset()
    expect(css).not.toContain("power-anomaly")
    expect(css).not.toContain("@keyframes blink")
  })

  it("keeps the document rules opt-in behind .theme-base", async () => {
    const css = await preset()
    expect(css).toContain(".theme-base")
    expect(css).not.toContain("html {")
  })

  /*
   * The `.dark` base rules restyle bare host elements — `option`, `table`, `th`,
   * `td` carry no library class — so they are gated behind the same opt-in as
   * the document rules. Asserted on the compiled selector and on the stripped
   * output, because a gate that survives in the source but not the build would
   * leave the host restyled anyway.
   */
  /*
   * These three read selectors out of the *compiled stylesheet* and judge them
   * by what they match. Neither half is a text test:
   *
   *   - `gated` means the selector matches the shipped chain with the opt-in and
   *     does not match without it, so the gate is doing the work;
   *   - `darkScoped` means it matches a chain carrying `dark`, so it is a rule
   *     this contract has to account for.
   *
   * The distinction is the whole point. `.dark select:not(.theme-base)` contains
   * the string `theme-base` and is not gated at all: `:not()` applies to the
   * element the rule styles, and the shipped `<select>` has no `theme-base`
   * class of its own — its ancestor does. A substring test calls that gated.
   */
  it("emits every .dark host rule gated behind the theme-base opt-in", async () => {
    const analysis = analyseGateFindings(await preset())
    const subjects = gatedSubjectsInSource()
    expect(subjects.length, "preset.css declares no gated host rule").toBeGreaterThan(0)

    for (const subject of subjects) {
      const selector = analysis.selectors.find((candidate) =>
        candidate.includes(`.${GATE_CLASS}`) && matchesMany(candidate, subject)
      )
      expect(selector, `preset.css gates "${subject}" but the build dropped it`).toBeDefined()

      const finding = analysis.findings.find((entry) => entry.selector === selector)
      expect(finding?.gated, `emitted but not gated: ${selector}`).toBe(true)
      expect(
        chainsFor(true, true).some((chain) => matchesChain(selector!, controlFor(subject), chain)),
        `does not match the shipped page: ${selector}`,
      ).toBe(true)
    }
  })

  /*
   * The hole this closes: a subject that never names `.dark` is invisible to a
   * scan that starts from `.dark`-naming selectors. Appending a bare `option` to
   * the existing `th, td` rule list restyles host markup with no opt-in at all,
   * and every other assertion here stays green.
   */
  it("keeps every host subject gated, and its chrome out of un-gated rules", async () => {
    const css = await preset()
    const analysis = analyseGateFindings(css)

    /*
     * The floor is `CONTROL_TAILS`, a fixed list of the elements a page can put
     * under these rules — not the subjects `preset.css` happens to gate today.
     * Deriving it from the guarded file would let deleting a gate shrink the
     * floor along with the thing the floor exists to police.
     */
    const relevant = analysis.findings.filter((finding) => finding.darkSubject)
      .map((finding) => finding.selector)

    for (const subject of CONTROL_TAILS) {
      const covering = relevant.filter((selector) => gatedCovers(selector, subject))
      const gated = covering.filter((selector) =>
        analysis.findings.find((entry) => entry.selector === selector)?.gated
      )
      expect(gated, `no gated selector covers ${subject}`).not.toEqual([])
    }

    /*
     * And no un-gated rule may replicate a gate's chrome. One shared declaration
     * is enough, either spelling — `option { color: var(--color-foreground, …) }`
     * beside the option gate paints the gate's dark foreground on host markup with
     * no opt-in, and so does the same rule with the fallback respelled.
     */
    const copies = unGatedCopiesOfGate(css, analysis)
    expect(
      copies,
      `the preset's chrome ships without the opt-in via: ${copies.join(" | ")}`,
    ).toEqual([])
  })

  it("matches the emitted .dark host rules on the shipped html.dark / body.theme-base placement", async () => {
    const shipped = chainsFor(true, true)
    const findings = analyseGate(await preset()).filter((finding) => finding.darkSubject)

    expect(findings.length, "no dark-scoped host rule was emitted").toBeGreaterThan(0)
    for (const { selector, gated } of findings) {
      expect(gated, `emitted but not gated: ${selector}`).toBe(true)
      const matched = CONTROL_TAILS.some((element) =>
        shipped.some((chain) => matchesChain(selector, controlFor(element), chain))
      )
      expect(matched, `does not match the shipped page: ${selector}`).toBe(true)
    }

    // And none of them applies once the host stops opting in, so the gate still
    // means what it says.
    for (const { selector } of findings) {
      for (const element of CONTROL_TAILS) {
        const stillMatches = chainsFor(true, false).some((chain) =>
          matchesChain(selector, controlFor(element), chain)
        )
        expect(stillMatches, `applies without theme-base: ${selector}`).toBe(false)
      }
    }
  })

  it("leaves no .dark host rule outside the theme-base gate", async () => {
    const ungated = analyseGate(await preset())
      .filter((finding) => finding.darkSubject && !finding.gated)
      .map((finding) => finding.selector)
    expect(ungated).toEqual([])
  })

  /*
   * The scan judges selectors by what they match, so these are the cases that
   * decide whether it is worth anything. Each is evaluated against a stylesheet
   * the test writes, which keeps the adversarial cases honest: a rule that reads
   * like a gate but is not one has to come out as un-gated.
   */
  it("treats a selector that only mentions theme-base in a :not() as un-gated", () => {
    const css = `
      :where(.dark) :where(.theme-base) select { background-color: black; }
      :where(.dark) select:not(.theme-base) { background-color: red; }
    `
    const analysis = analyseGateFindings(css)
    expect(analysis.selectors).toContain(":where(.dark) select:not(.theme-base)")

    const ungated = analysis.findings
      .filter((finding) => finding.darkSubject && !finding.gated)
      .map((finding) => finding.selector)
    expect(ungated).toEqual([":where(.dark) select:not(.theme-base)"])

    const gated = analysis.findings
      .filter((finding) => finding.gated)
      .map((finding) => finding.selector)
    expect(gated).toEqual([":where(.dark) :where(.theme-base) select"])
  })

  it("treats a theme-base look-alike on an ancestor as un-gated", () => {
    const css = `
      :where(.dark) .foo-theme-base select { background-color: red; }
      :where(.dark) :where(.theme-base) :where(.dark) select { background-color: black; }
    `
    const findings = analyseGate(css).filter((finding) => finding.darkSubject)
    expect(findings.length).toBe(2)
    expect(findings.map((finding) => finding.gated)).toEqual([false, true])
  })

  it("refuses to judge a selector it cannot read", () => {
    // A matcher that drops what it does not understand is a matcher that
    // guesses, and guessing is how a dead selector passes a gate test.
    for (
      const selector of [":where(.dark)NONSENSE select", ":where(.dark) select:is(.theme-base)"]
    ) {
      expect(() => analyseGate(`${selector} { color: red; }`)).toThrow()
    }
  })

  /*
   * The evasion class this covers is the one that stayed green through four
   * rounds: a rule that restyles a host element with a gate's own declarations,
   * spelled in syntax the chain matcher cannot read. Answering "not a cover"
   * there is the same hole as a substring test — `select > option` is idiomatic
   * CSS, and an un-gated copy of the gate's body restyles host markup with no
   * opt-in.
   *
   * These are the exact shapes the reviewer found: the matcher must refuse them
   * loudly rather than pass them.
   */
  it("refuses to judge the host-selector shapes it cannot match", () => {
    for (
      const selector of [
        "select > option",
        ":is(option)",
        "option:is(*)",
        "option::first-line",
        "option:has(span)",
        ":where(option, select)",
        "option:nth-child(2)",
      ]
    ) {
      expect(() => gatedCovers(selector, "select"), selector).toThrow(/cannot judge/)
    }
  })

  /*
   * And the shape that parses but does not match a plain subject:
   * `option[data-x]` carries a gate's body while `matchesMany` cannot prove it
   * reaches a bare `option` — a browser reaches it all the same. The veto must
   * not ask for a positive match before calling a copy a copy.
   */
  it("treats a gate body on an attribute-qualified host selector as un-gated", () => {
    const body = "background-color: var(--color-surface, oklch(0.278 0.033 256.848));" +
      " color: var(--color-foreground, oklch(0.985 0.002 247.839));"
    const css = `
      :where(.dark) :where(.theme-base) option { background-color: red; }
      option[data-x] { ${body} }
    `
    expect(unGatedCopiesOfGate(css, analyseGateFindings(css)))
      .toEqual(["option[data-x]"])
  })

  it("ignores !important when deciding whether a rule carries a gate's declarations", () => {
    const body = "background-color: var(--color-surface, oklch(0.278 0.033 256.848));" +
      " color: var(--color-foreground, oklch(0.985 0.002 247.839));"
    // The gate's own priority must not be what hides a plain copy of its values.
    const css = `
      :where(.dark) :where(.theme-base) option { ${body} !important; }
      option { ${body} }
    `
    expect(unGatedCopiesOfGate(css, analyseGateFindings(css))).toEqual(["option"])
    expect(parseDeclarations("color: red !important")).toEqual(["color: red"])
  })

  /*
   * The subset shape: one shared declaration is a copy, not half a copy.
   * `option { color: <gate value> }` beside the option gate paints the gate's
   * dark foreground on host markup with no opt-in, and a whole-body test called
   * it nothing. These two are the green path the reviewer found.
   */
  it("treats one shared declaration as a copy of a gate's chrome", () => {
    const css = `
      :where(.dark) :where(.theme-base) option { color: var(--color-foreground, oklch(0.985 0.002 247.839)); }
      option { color: var(--color-foreground, oklch(0.985 0.002 247.839)); }
    `
    expect(unGatedCopiesOfGate(css, analyseGateFindings(css))).toEqual(["option"])
  })

  it("treats a respelled var() fallback as a copy of a gate's chrome", () => {
    const css = `
      :where(.dark) :where(.theme-base) option {
        background-color: var(--color-surface, oklch(0.278 0.033 256.848));
        color: var(--color-foreground, oklch(0.985 0.002 247.839));
      }
      option { background-color: var(--color-surface, #fff); color: var(--color-foreground, #fff); }
    `
    expect(unGatedCopiesOfGate(css, analyseGateFindings(css))).toEqual(["option"])
    // The custom property is what decides the colour, so the fallback is not.
    expect(parseDeclarations("color: var(--color-foreground, #fff)")).toEqual([
      "color: var(--color-foreground)",
    ])
    expect(parseDeclarations("color: var(--color-foreground, oklch(0.985 0.002 247.839))"))
      .toEqual(["color: var(--color-foreground)"])
  })

  /*
   * The other side of the same predicate: a rule scoped to a class the preset
   * itself ships is the library styling its own component, not the host chrome
   * the gate owns. Without this scope the one-declaration rule is unusable —
   * `.bg-surface`, `.card`, `.label`, `.radio` and `.kpi` all read a token a
   * gate also reads.
   */
  /*
   * The exemption is a *subject-position* rule, and this is the shape that
   * proved it: `.card` is a class the preset ships, so reading the whole selector
   * for one exempts `.card option` — which styles an `option` that carries no
   * library class at all — and `.cardx option`, whose own class the scan then
   * absorbs into the vocabulary.
   */
  it("reads the vocabulary exemption in subject position only", () => {
    const gate = `:where(.dark) :where(.theme-base) option {
      background-color: var(--color-surface, oklch(0.278 0.033 256.848));
      color: var(--color-foreground, oklch(0.985 0.002 247.839));
    }`
    const copy = (selector: string) =>
      `${selector} { background-color: var(--color-surface, #fff); color: var(--color-foreground, #fff); }`

    // An ancestor carrying a shipped class does not exempt the rule.
    for (
      const selector of [
        ".card option",
        "body .card option",
        ".card>option",
        ":where(.card) option",
        ".cardx option",
        ".zzqq-arbitrary option",
        ".label select",
      ]
    ) {
      const css = `${gate} .card { color: var(--color-foreground, #fff); } ${copy(selector)}`
      expect(unGatedCopiesOfGate(css, analyseGateFindings(css)), selector).toEqual([selector])
    }

    // A shipped class on the subject is the library styling its own component.
    const own = `${gate} .bg-surface { background-color: var(--color-surface, #fff); }`
    expect(unGatedCopiesOfGate(own, analyseGateFindings(own))).toEqual([])
  })

  /*
   * A class inside `:not()`, `:has()` or an attribute value is not a class the
   * styled element carries, so it must not exempt the rule. These shapes were
   * all green while `usesVocabulary` read the subject's class *text*.
   */
  it("does not exempt a rule that only names a class in a pseudo-class or value", () => {
    const gate = `:where(.dark) :where(.theme-base) option {
      background-color: var(--color-surface, oklch(0.278 0.033 256.848));
      color: var(--color-foreground, oklch(0.985 0.002 247.839));
    }`
    const copy = (selector: string) =>
      `${selector} { background-color: var(--color-surface, #fff); color: var(--color-foreground, #fff); }`

    for (
      const selector of [
        "option:not(.card)",
        "option:has(.card)",
        'option[data-x=".card"]',
        "option:not(.zzqq-nothing-ships-this)",
        ":is(option, .card)",
        ":where(option, .card)",
        ":not(:is(option, .card))",
        "option.zzqq-arbitrary",
      ]
    ) {
      const css = `${gate} .card { color: var(--color-foreground, #fff); } ${copy(selector)}`
      expect(unGatedCopiesOfGate(css, analyseGateFindings(css)), selector).toEqual([selector])
    }
  })

  /*
   * The exemption itself, unit-tested: it must be derived from `preset.css`, must
   * need the class in *subject* position, and must hold only when **every**
   * branch of the subject carries one. The tautology this replaces asserted an
   * empty offender list on a stylesheet whose only class was the preset's own —
   * which passes whether the exemption works or not.
   */
  it("classifies the vocabulary exemption by the preset's own definitions", () => {
    const vocabulary = presetVocabulary()

    // Derived from `preset.css`, so the rule under test cannot join it.
    expect(vocabulary.has("card")).toBe(true)
    expect(vocabulary.has("bg-surface")).toBe(true)
    expect(vocabulary.has(GATE_CLASS)).toBe(true)
    expect(vocabulary.has("zzqq-nothing-ships-this")).toBe(false)
    expect(vocabulary.has("cardx")).toBe(false)

    // Subject position only.
    expect(usesVocabulary(".bg-surface", vocabulary)).toBe(true)
    expect(usesVocabulary(".card option", vocabulary)).toBe(false)
    expect(usesVocabulary(".card .label", vocabulary)).toBe(true)
    expect(usesVocabulary("option", vocabulary)).toBe(false)

    // The subject's own tokens, not text inside a pseudo-class or a value.
    expect(usesVocabulary("option:not(.card)", vocabulary)).toBe(false)
    expect(usesVocabulary("option:has(.card)", vocabulary)).toBe(false)
    expect(usesVocabulary('option[data-x=".card"]', vocabulary)).toBe(false)

    // Every branch, not some branch.
    expect(usesVocabulary(":is(option, .card)", vocabulary)).toBe(false)
    expect(usesVocabulary(":where(option, .card)", vocabulary)).toBe(false)
    expect(usesVocabulary(":is(.card, .bg-surface)", vocabulary)).toBe(true)

    // A class no rule ships cannot exempt the rule that introduces it.
    expect(usesVocabulary("option.zzqq-arbitrary", vocabulary)).toBe(false)
  })

  it("splits selector lists on commas that are not inside brackets", () => {
    expect(splitTopLevel(":where(.dark, .dark *) select, .dark option", ","))
      .toEqual([":where(.dark, .dark *) select", " .dark option"])
  })

  it("lets an app override a token with a later declaration", async () => {
    const overridden = await compilePreset(
      entrypointCss(":root {\n  --color-primary: oklch(0.55 0.18 255);\n}\n"),
      ["bg-primary"],
    )
    // The app's declaration survives compilation, and the utility still
    // resolves through the variable, so the new value reaches it.
    expect(overridden).toContain("--color-primary: oklch(0.55 0.18 255)")
    expect(declarationsOf(overridden, ".bg-primary")).toContain(
      "var(--color-primary, oklch(0.38 0.17 293))",
    )
  })

  it("keeps working when an app skips tokens.css", async () => {
    const withoutTokens = await compilePreset(
      `@import "tailwindcss/theme.css";\n@import "tailwindcss/preflight.css";\n` +
        `@import "./preset.css";\n@import "tailwindcss/utilities.css";\n`,
      ["bg-primary", "btn"],
      ["preset.css"],
    )
    expect(declarationsOf(withoutTokens, ".bg-primary")).toContain(
      "var(--color-primary, oklch(0.38 0.17 293))",
    )
    // `.btn`'s dark focus ring reads a token nothing sets without tokens.css or ink.css; with no
    // fallback it would draw the button's own text colour, 1.03:1 on the page (#297's review).
    expect(declarationsOf(withoutTokens, ":where(.dark) &:focus-visible")).toContain(
      "outline-color: var(--color-focus-ring, var(--color-primary-muted, oklch(0.714 0.203 305.504)))",
    )
  })

  it("ships light tokens in :root and dark tokens on .dark", async () => {
    const css = await preset()
    expect(css).toContain("--radius-primary: 0.5rem")
    expect(css.slice(css.lastIndexOf(".dark {"))).toContain("--color-primary:")
  })

  it("does not ship a utility with no declarations", async () => {
    expect(/\.[a-z][a-z0-9-]* \{\s*\}/.test(await preset())).toBe(false)
  })
})
