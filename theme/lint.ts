/**
 * A `deno lint` plugin for an app that translates its UI. Its one rule, `ui-text/no-literal`, flags
 * text a person reads or hears that is written into the JSX instead of taken from a translation:
 *
 * - JSX text with a letter in it (`<p>Saved</p>`), and a string or template literal written as a
 *   child (`<p>{"Saved"}</p>`);
 * - a literal `aria-label`, `title`, `placeholder`, `alt` or `label` attribute with a letter in it,
 *   on an element or a component (`<Field label="Email" />`).
 *
 * Text with no letter (spaces, punctuation, digits, symbols) is never flagged. Two ways let a
 * literal stay: `translate="no"` on the element or an ancestor, for text no language changes (a
 * brand, a code, a key name), and a `deno-lint-ignore ui-text/no-literal` comment on the line
 * before or earlier on the same line, as a line comment or, inside JSX, a comment in braces. The
 * text of `<style>` and `<script>` is code, not UI text, and is not read.
 *
 * An app lists `jsr:@spy4x/preact-theme@<version>/lint` under `lint.plugins` in its `deno.json`,
 * and starts each file it has yet to translate with a `deno-lint-ignore-file ui-text/no-literal`
 * comment (README → "Untranslated text").
 *
 * The types here describe only the slice of Deno's lint API the rule reads: Deno declares the rest
 * in its unstable library, which a published module may not reference. `lint.test.ts` holds the
 * plugin to Deno's own `Deno.lint.Plugin`.
 *
 * @module
 */

/** The attributes whose literal text the rule flags: each is read or heard by a person. */
export const TRANSLATED_ATTRIBUTES: readonly string[] = [
  "aria-label",
  "title",
  "placeholder",
  "alt",
  "label",
]

/**
 * One node of Deno's lint syntax tree, as much of it as the rule reads. Every other field is read
 * by name and narrowed where it is used, so each of Deno's own node types fits this shape.
 */
export interface UiTextLintNode {
  /** The node's kind, such as `"JSXText"` or `"JSXAttribute"`. */
  type: string
  /** Start and end character offsets in the source. */
  range: [number, number]
}

/** What the rule gets from Deno's linter: the source, its comments and a way to report. */
export interface UiTextRuleContext {
  /** The file being linted. */
  sourceCode: {
    /** The whole source text. */
    text: string
    /** The nodes that contain `node`, outermost first. */
    getAncestors(node: UiTextLintNode): UiTextLintNode[]
    /** Every comment in the source, with its kind (`"Line"` or `"Block"`) and text. */
    getAllComments(): { type: string; value: string; range: [number, number] }[]
  }
  /** Record one finding over a range of the source. */
  report(finding: { range: [number, number]; message: string; hint?: string }): void
}

/** A Deno lint plugin, typed as far as this module builds one. */
export interface UiTextLintPlugin {
  /** The plugin name; a rule's id is `<name>/<rule>`. */
  name: string
  /** Each rule builds its node visitors from the context. */
  rules: Record<string, {
    create(context: UiTextRuleContext): Record<string, (node: UiTextLintNode) => void>
  }>
}

/** Elements whose text is code a browser runs or applies, never shown to a person. */
const CODE_ELEMENTS = ["style", "script"]

const LETTER = /\p{L}/u

/** A field of a node that this module's types do not declare, or `undefined`. */
function field(node: unknown, name: string): unknown {
  return typeof node === "object" && node !== null
    ? (node as Record<string, unknown>)[name]
    : undefined
}

/**
 * The static text of a string or template literal, the one inside `{…}` included, or `undefined`
 * for any other expression. A template literal's text is its fixed parts, joined by a space.
 */
function literalText(node: unknown): string | undefined {
  const type = field(node, "type")
  if (type === "JSXExpressionContainer") return literalText(field(node, "expression"))
  const value = field(node, "value")
  if (type === "Literal" && typeof value === "string") return value
  const quasis = field(node, "quasis")
  if (type === "TemplateLiteral" && Array.isArray(quasis)) {
    return quasis.map((quasi) => String(field(quasi, "cooked") ?? "")).join(" ")
  }
  return undefined
}

/** The name of a JSX attribute, or of an element's tag such as `p` or `Field`; `""` otherwise. */
function nameOf(node: unknown): string {
  const name = field(node, "name")
  return field(name, "type") === "JSXIdentifier" ? String(field(name, "name")) : ""
}

/** Whether a JSX element carries `translate="no"`. */
function markedUntranslated(element: UiTextLintNode): boolean {
  const attributes = field(field(element, "openingElement"), "attributes")
  return Array.isArray(attributes) &&
    attributes.some((attribute) =>
      field(attribute, "type") === "JSXAttribute" && nameOf(attribute) === "translate" &&
      literalText(field(attribute, "value")) === "no"
    )
}

/**
 * Whether text is left alone, given its ancestors: an element it sits in, the one it belongs to
 * included, carries `translate="no"`, or is a `<style>` or `<script>`.
 */
function exempt(ancestors: readonly UiTextLintNode[]): boolean {
  return ancestors.some((node) =>
    node.type === "JSXElement" &&
    (markedUntranslated(node) ||
      CODE_ELEMENTS.includes(nameOf(field(node, "openingElement"))))
  )
}

/** The flagged text, cut to a readable length for the message. */
function quote(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ")
  return trimmed.length > 40 ? `${trimmed.slice(0, 39)}…` : trimmed
}

const HINT =
  `Take the text from the app's translations. For text no language changes (a brand, a ` +
  `code, a key name), put translate="no" on the element.`

/** The text of the comment that lets the literal after it stay. */
const IGNORE = "deno-lint-ignore ui-text/no-literal"

/** `ui-text/no-literal`: flags UI text written into JSX instead of taken from a translation. */
function createNoLiteral(
  context: UiTextRuleContext,
): Record<string, (node: UiTextLintNode) => void> {
  const source = context.sourceCode.text
  /** The 0-based line of an offset in the source. */
  const lineOf = (offset: number) => source.slice(0, offset).split("\n").length - 1
  /**
   * The lines whose literal an ignore comment in JSX braces lets stay: the line the comment ends on
   * and the one after it. `deno lint` itself honours the comment only as a line comment, which JSX
   * text cannot hold, so the rule reads block comments itself. Line comments stay with `deno lint`,
   * which would otherwise call them unused.
   */
  const ignored = new Set(
    context.sourceCode.getAllComments()
      .filter((comment) => comment.type === "Block" && comment.value.trim() === IGNORE)
      .flatMap((comment) => [lineOf(comment.range[1]), lineOf(comment.range[1]) + 1]),
  )

  /** Report `text` at `node` unless it has no letter, is ignored or sits in an exempt element. */
  function check(node: UiTextLintNode, text: string | undefined, where: string): void {
    if (text === undefined || !LETTER.test(text)) return
    const raw = source.slice(node.range[0], node.range[1])
    const start = node.range[0] + (raw.length - raw.trimStart().length)
    const end = node.range[1] - (raw.length - raw.trimEnd().length)
    if (ignored.has(lineOf(start)) || exempt(context.sourceCode.getAncestors(node))) return
    context.report({
      range: [start, end],
      message: `${where} "${quote(text)}" is not translated`,
      hint: HINT,
    })
  }

  return {
    JSXText(node) {
      check(node, String(field(node, "value")), "Text")
    },
    JSXExpressionContainer(node) {
      if (field(field(node, "parent"), "type") === "JSXAttribute") return
      check(node, literalText(field(node, "expression")), "Text")
    },
    JSXAttribute(node) {
      const name = nameOf(node)
      if (!TRANSLATED_ATTRIBUTES.includes(name)) return
      check(node, literalText(field(node, "value")), `The ${name} attribute`)
    },
  }
}

/**
 * The `ui-text` plugin for `deno lint`, with its one rule, `no-literal`. Its name has letters and
 * a hyphen only, because `deno lint` refuses a plugin name with a digit in it.
 */
const plugin: UiTextLintPlugin = {
  name: "ui-text",
  rules: { "no-literal": { create: createNoLiteral } },
}

export default plugin
