/**
 * The words every component shows, from one translator an app builds once. The library ships its
 * own catalog in every supported language (`@spy4x/preact-ui/i18n/en`, `…/de`, `…/ar`), so an app
 * translates only its own words:
 *
 * ```tsx
 * import uiEn from "@spy4x/preact-ui/i18n/en"
 * import uiDe from "@spy4x/preact-ui/i18n/de"
 * import { createTranslator } from "@spy4x/platform/universal/i18n"
 *
 * const translator = createTranslator({
 *   language: "de",
 *   catalogs: [{ source: uiEn, translation: uiDe }, { source: appEn, translation: appDe }],
 * })
 * <I18nContext.Provider value={translator}>{app}</I18nContext.Provider>
 * ```
 *
 * Without a provider every component speaks English, as `FormatContext` is the device's format
 * without one. A component reads its words with `useLabels`; an app's own screens with `useT()`.
 *
 * @module
 */

import { type ComponentChildren, type Context, createContext, Fragment, type JSX } from "preact"
import { useContext } from "preact/hooks"
import {
  type MessagePart,
  type MessageValues,
  type Translator,
} from "@spy4x/platform/universal/i18n"
import type en from "./i18n/en.ts"

/** A key of the `ui` package's own catalog, `"Pagination.previous"`. */
export type UiKey = keyof typeof en

/**
 * The translator the components read when no `I18nContext` provider is around them. It knows no
 * key, so each component shows the English written in its own code: an island bundles only its own
 * words, never the whole catalog. `@spy4x/preact-ui/i18n/en` holds the same English, for a
 * translator's `source`; a test holds the two equal.
 */
export const ENGLISH: Translator<string> = {
  language: "en",
  dir: "ltr",
  // A translator returns the key itself for a key it lacks: this one lacks every key.
  t: (key) => key,
  parts: (key) => [key],
}

/**
 * The translator the components read. An app provides its own with
 * `<I18nContext.Provider value={createTranslator({ language, catalogs })}>`, the library's catalog
 * first in `catalogs`; without a provider it is English.
 */
export const I18nContext: Context<Translator<string>> = createContext<Translator<string>>(ENGLISH)

/**
 * The translator of the nearest `I18nContext`: `useT().t("Pagination.nextLabel")`. Called outside
 * a render, as a test that calls a component as a plain function does, it is English.
 */
export function useT(): Translator<string> {
  try {
    return useContext(I18nContext)
  } catch {
    // Preact has no component to read the context from: not inside a render.
    return ENGLISH
  }
}

/**
 * For a label that is a function, the names its arguments take in the message, in order:
 * `{ page: ["page"] }` turns `"Page {page}"` into `(page) => "Page 3"`. `"values"` passes the one
 * argument on as the message's values: `{ moved: "values" }` turns `"Moved {item}"` into
 * `(at) => "Moved " + at.item`.
 */
export type LabelParams<Labels> = {
  readonly [Field in keyof Labels]?: readonly string[] | "values"
}

/**
 * The words a component shows: each field of `defaults` taken from the caller's `labels` when it
 * gives one, else from the catalog key `<name>.<field>`, else from `defaults`. A field that is a
 * function is built from its message, with `params` naming its arguments.
 *
 * A translator that does not know a key (an app left the library's catalog out) leaves that field
 * at its English default instead of showing the key.
 */
export function useLabels<Labels extends object>(
  name: string,
  defaults: Labels,
  labels?: Partial<Labels>,
  params?: LabelParams<Labels>,
): Labels {
  return labelsFrom(useT(), name, defaults, labels, params)
}

/** {@link useLabels} for a given translator, outside a component. */
export function labelsFrom<Labels extends object>(
  translator: Translator<string>,
  name: string,
  defaults: Labels,
  labels?: Partial<Labels>,
  params?: LabelParams<Labels>,
): Labels {
  const result = { ...defaults } as Record<string, unknown>
  for (const field of Object.keys(defaults)) {
    const given = (labels as Record<string, unknown> | undefined)?.[field]
    if (given !== undefined) {
      result[field] = given
      continue
    }
    const names = (params as Record<string, readonly string[] | "values" | undefined> | undefined)
      ?.[field]
    // Only a string, or a function with named arguments, has a message: look nothing else up, so
    // an `onMissing` hears only of keys a catalog should have.
    if (!names && typeof result[field] !== "string") continue
    const key = `${name}.${field}`
    if (!knows(translator, key)) continue
    if (names === "values") {
      result[field] = (values: MessageValues) => translator.t(key, values)
    } else if (names) {
      result[field] = (...args: unknown[]) => translator.t(key, valuesOf(names, args))
    } else if (typeof result[field] === "string") {
      result[field] = translator.t(key)
    }
  }
  return result as Labels
}

/**
 * The `ui` message `key` from `translator`, or `english` when the translator lacks it: what a
 * component calls for a word that is not a field of its labels, such as one that switches on a
 * case. `english` is the component's own English for the same message, already filled in.
 */
export function translate(
  translator: Translator<string>,
  key: UiKey,
  english: string,
  values?: MessageValues,
): string {
  return knows(translator, key) ? translator.t(key, values) : english
}

/** True when the translator has text for `key`: it returns the key itself for one it lacks. */
function knows(translator: Translator<string>, key: string): boolean {
  return translator.t(key) !== key
}

function valuesOf(names: readonly string[], args: readonly unknown[]): MessageValues {
  const values: Record<string, string | number> = {}
  names.forEach((name, index) => {
    const value = args[index]
    values[name] = typeof value === "number" ? value : String(value ?? "")
  })
  return values
}

/** Props of `Rich`. */
export interface RichProps {
  /** The message as spans, from `useT().parts(key, values)`. */
  parts: readonly MessagePart[]
  /**
   * How each tag of the message renders, given its text: `{ terms: (text) => <a href="/terms">{text}</a> }`.
   * A tag with no renderer here shows as its plain text.
   */
  tags?: Readonly<Record<string, (text: string) => ComponentChildren>>
}

/**
 * A translated message with spans the caller renders, such as a link inside a sentence. Every
 * part is text: a message or a value never becomes markup, and an `href` comes only from `tags`.
 */
export function Rich({ parts, tags = {} }: RichProps): JSX.Element {
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === "string") return <Fragment key={index}>{part}</Fragment>
        const render = Object.hasOwn(tags, part.tag) ? tags[part.tag] : undefined
        return <Fragment key={index}>{render ? render(part.text) : part.text}</Fragment>
      })}
    </>
  )
}
