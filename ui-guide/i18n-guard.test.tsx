import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator, pseudoLocalize } from "@spy4x/platform/universal/i18n"
import systemDe from "../system/i18n/de.ts"
import systemEn from "../system/i18n/en.ts"
import uiDe from "../ui/i18n/de.ts"
import uiEn from "../ui/i18n/en.ts"
import { I18nContext } from "../ui/i18n.tsx"
import { catalogueSections, demoRegistry } from "./registry.ts"

/**
 * Every guide demo of the `ui` and `system` packages rendered three times. It checks only what the
 * demos render: a word no demo shows (an empty `DataTable`'s "No rows", for one) is not checked
 * here.
 *
 * Under `en-XA`, the pseudo-language that wraps each catalog message in `⟦ ⟧`, a run of text with
 * no brackets that matches a text written in the package's sources is a component word that skipped
 * the catalog, and it is listed. A run the guide's sources write is the caller's and passes, unless
 * it is a word of the demo's own component (its catalog keys `<name>.…`); the few demos that pass
 * their component its own default English are in `CALLER_WORDS`. A subtree marked `translate="no"`
 * (user content, a brand name) is skipped.
 *
 * Under the English catalog, every demo must render exactly what it renders without a provider: the
 * English written in each component's code and the package's `i18n/en.json` say the same. Under the
 * German catalogs, with an `onMissing` that throws, no demo may ask for a key the catalogs lack. A
 * `system` demo renders `ui` components too, so every translator holds both packages' catalogs.
 */

const FULL_ENGLISH = createTranslator({
  language: "en",
  catalogs: [{ source: uiEn }, { source: systemEn }],
})

const PSEUDO = createTranslator({
  language: "en-XA",
  catalogs: [
    { source: uiEn, translation: pseudoLocalize(uiEn) },
    { source: systemEn, translation: pseudoLocalize(systemEn) },
  ],
})

/** The attributes a person reads or hears, besides the text itself. */
const READ_ATTRIBUTES = ["aria-label", "title", "placeholder", "alt", "aria-roledescription"]

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
])

/** Text runs and read attributes of `html`, outside every `translate="no"` subtree. */
export function readableTexts(html: string): string[] {
  const texts: string[] = []
  const stack: { name: string; skip: boolean }[] = []
  const skipping = () => stack.some((entry) => entry.skip)
  const token =
    /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g
  let inScript = false
  for (const match of html.matchAll(token)) {
    const [whole, closing, opening, attributes, text] = match
    if (closing) {
      const index = stack.findLastIndex((entry) => entry.name === closing)
      if (index !== -1) stack.length = index
      if (closing === "script" || closing === "style") inScript = false
      continue
    }
    if (opening) {
      const attrs = new Map<string, string>()
      for (const attribute of (attributes ?? "").matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
        attrs.set(attribute[1], decode(attribute[2] ?? ""))
      }
      const skip = attrs.get("translate") === "no"
      if (!skipping() && !skip) {
        for (const name of READ_ATTRIBUTES) {
          const value = attrs.get(name)
          if (value) texts.push(value)
        }
      }
      const selfClosing = VOID.has(opening) || whole.endsWith("/>")
      if (!selfClosing) stack.push({ name: opening, skip })
      if (opening === "script" || opening === "style") inScript = !selfClosing
      continue
    }
    if (text && !inScript && !skipping()) texts.push(decode(text))
  }
  return texts
}

function decode(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll("&amp;", "&")
}

/** The runs of a text left once every `⟦…⟧` span is taken out, trimmed, with letters in them. */
export function untranslatedRuns(text: string): string[] {
  return text
    .split(/⟦[^⟧]*⟧/)
    .map((run) => run.replace(/\s+/g, " ").trim())
    .filter((run) => /\p{L}/u.test(run))
}

/** Where two renders part, with a little text on both sides. */
function firstDifference(a: string, b: string): string {
  let index = 0
  while (index < a.length && a[index] === b[index]) index++
  return JSON.stringify({
    code: a.slice(index - 40, index + 40),
    catalog: b.slice(index - 40, index + 40),
  })
}

/** Every non-test `.ts`/`.tsx` file of `dir` (not below it), comments taken out. */
async function sourcesOf(dir: URL): Promise<string[]> {
  const texts: string[] = []
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue
    const text = await Deno.readTextFile(new URL(entry.name, dir))
    texts.push(text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " "))
  }
  return texts
}

/**
 * The texts a source file writes out: quoted strings, template strings and JSX text, each as a
 * pattern that matches a whole rendered run. A `${…}` or `{…}` slot matches any text; a pattern
 * with fewer than two words outside its slots is dropped, since it would match a caller's text.
 */
export function literalPatterns(source: string): RegExp[] {
  const found = new Set<string>()
  const add = (text: string, slot: RegExp) => {
    const pieces = text.replace(/\s+/g, " ").trim().split(slot)
    // A pattern with slots needs two words around them: `UTC${sign}${hh}` is a format, and
    // `Remove ${name}` would match a caller's own "Remove Ada".
    if (pieces.length > 1) {
      if ((pieces.join(" ").match(/\p{L}{2,}/gu) ?? []).length < 2) return
      if (!pieces.some((piece) => /\p{Ll}{2}/u.test(piece))) return
    } else if (!/\p{L}{2}/u.test(pieces[0])) return
    found.add(pieces.map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+"))
  }
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) add(match[1], /(?!)/)
  for (const match of source.matchAll(/`((?:[^`\\]|\\.)*)`/g)) add(match[1], /\$\{[^}]*\}/)
  for (const match of source.matchAll(/>([^<>]*\p{L}[^<>]*)</gu)) add(match[1], /\{[^{}]*\}/)
  return [...found].map((pattern) => new RegExp(`^${pattern}$`, "u"))
}

/** The texts the guide's sources write as a quoted string or JSX text, for an exact lookup. */
export function writtenTexts(source: string): Set<string> {
  const texts = new Set<string>()
  const add = (text: string) => texts.add(text.replace(/\s+/g, " ").trim())
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) add(match[1])
  for (const match of source.matchAll(/`((?:[^`\\]|\\.)*)`/g)) add(match[1])
  for (const match of source.matchAll(/>([^<>{}]*)[<{]/g)) add(match[1])
  return texts
}

/** The English of every message of the component `name`: the catalog keys `<name>.…`. */
function ownWords(name: string): Set<string> {
  return new Set(
    Object.entries({ ...uiEn, ...systemEn })
      .filter(([key]) => key.startsWith(`${name}.`))
      .flatMap(([, message]) => typeof message === "string" ? [message] : Object.values(message)),
  )
}

/**
 * Words a demo passes to its own component that are also that component's default English, so the
 * text alone cannot tell them apart: the guide wrote each one, in the place named.
 */
const CALLER_WORDS: Readonly<Record<string, readonly string[]>> = {
  // `<Kbd>Tab</Kbd>` in the Kbd demo: the key's face is the caller's children.
  Kbd: ["Tab"],
  // The TagInput demo's field label, `label="Tags"`.
  TagInput: ["Tags"],
  // The DateRangePicker demo passes a whole `labels` object to show the prop.
  DateRangePicker: ["Date range", "From", "To", "Cancel", "Apply"],
  // The AttachmentList demo's own heading over the list, "Attachments 7 of 10".
  AttachmentList: ["Attachments"],
}

/**
 * The packages whose demos this file guards, each with a section count it must exceed, so a list
 * gone empty fails.
 */
const PACKAGES = [
  { name: "ui", minimum: 50 },
  { name: "system", minimum: 10 },
] as const

for (const pkg of PACKAGES) {
  const names = catalogueSections
    .filter((section) => section.package === pkg.name)
    .flatMap((section) => section.names)

  describe(`the ${pkg.name} demos under en-XA`, () => {
    it("show no component text that skipped the catalog", async () => {
      const component = (await sourcesOf(new URL(`../${pkg.name}/`, import.meta.url))).flatMap(
        literalPatterns,
      )
      const guide = new Set(
        [
          ...await sourcesOf(new URL("./", import.meta.url)),
          ...await sourcesOf(new URL("./sections/", import.meta.url)),
        ].flatMap((source) => [...writtenTexts(source)]),
      )
      const found: string[] = []
      for (const name of names) {
        const html = render(
          <I18nContext.Provider value={PSEUDO}>{demoRegistry[name].render()}</I18nContext.Provider>,
        )
        for (const text of readableTexts(html)) {
          for (const run of untranslatedRuns(text)) {
            // A text the guide writes is the caller's, unless it is a word of the demo's own
            // component.
            if (guide.has(run) && !ownWords(name).has(run)) continue
            if (CALLER_WORDS[name]?.includes(run)) continue
            const pattern = component.find((candidate) => candidate.test(run))
            if (pattern) {
              found.push(`${name}: ${JSON.stringify(run)} (${pkg.name} source ${pattern.source})`)
            }
          }
        }
      }
      expect([...new Set(found)]).toEqual([])
    })

    it("render the same English with the English catalog as without a provider", () => {
      const differ: string[] = []
      for (const name of names) {
        const bare = render(<>{demoRegistry[name].render()}</>)
        const english = render(
          <I18nContext.Provider value={FULL_ENGLISH}>
            {demoRegistry[name].render()}
          </I18nContext.Provider>,
        )
        if (bare !== english) differ.push(`${name}: ${firstDifference(bare, english)}`)
      }
      expect(differ).toEqual([])
    })

    it("render under the full German catalogs without asking for a key they lack", () => {
      const missing: string[] = []
      const german = createTranslator({
        language: "de",
        catalogs: [
          { source: uiEn, translation: uiDe },
          { source: systemEn, translation: systemDe },
        ],
        onMissing: (key) => {
          missing.push(key)
          throw new Error(`no message for ${key}`)
        },
      })
      const failed: string[] = []
      for (const name of names) {
        try {
          render(
            <I18nContext.Provider value={german}>
              {demoRegistry[name].render()}
            </I18nContext.Provider>,
          )
        } catch (error) {
          failed.push(`${name}: ${String(error)}`)
        }
      }
      expect({ missing: [...new Set(missing)], failed }).toEqual({ missing: [], failed: [] })
    })

    it(`covers every ${pkg.name} section`, () => {
      expect(names.length).toBeGreaterThan(pkg.minimum)
    })
  })
}

describe("readableTexts", () => {
  it("reads text and the read attributes, and skips a translate=no subtree", () => {
    const html =
      `<div title="Hint"><span translate="no"><b aria-label="Brand">Acme</b></span><i>Text &amp; more</i><img alt="Photo"></div>`
    expect(readableTexts(html)).toEqual(["Hint", "Text & more", "Photo"])
  })
})

describe("untranslatedRuns", () => {
  it("keeps only the runs outside the pseudo brackets that hold letters", () => {
    expect(untranslatedRuns("⟦Ñéxt~~⟧ 3 / 4 Left")).toEqual(["3 / 4 Left"])
    expect(untranslatedRuns("⟦Pááge⟧ 3")).toEqual([])
  })
})
