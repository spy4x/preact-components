import { IconUser } from "@preact-components/icons"
import { cn } from "@preact-components/signals/cn"
import type { JSX } from "preact"
import { useState } from "preact/hooks"

/** Which of the three faces an {@link Avatar} renders. */
export type AvatarFace = "image" | "initials" | "icon"

/** Square box of an {@link Avatar} or an {@link AvatarGroup}. */
export type AvatarSize = "xs" | "sm" | "md" | "lg"

/**
 * The character classes that are a whole word on their own: ideographs, kana and hangul syllables.
 *
 * Latin names are written with spaces between words, CJK names are not, so the two need different
 * word boundaries. Without this split `"王小明"` is one word and an avatar shows `"王"`, which is
 * one letter of a three-letter name; with it the name has three words and the usual rule gives two
 * of them.
 */
const cjk = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}"

/**
 * The words of a name: every CJK character alone, every other run of non-space characters whole.
 *
 * A hyphen or an apostrophe is part of the word, so `"Anne-Marie Dupont"` is
 * `["Anne-Marie", "Dupont"]` — two words, `"AD"` — and `"O'Brien"` is one word. Global, but only
 * ever used through `String.prototype.match`, which aims it at the start of the string first, so
 * `lastIndex` left over from an earlier call cannot skip a name.
 */
const wordPattern = new RegExp(`[${cjk}]|[^\\s${cjk}]+`, "gu")

/** One code point that can stand as an initial: a letter or a digit, never punctuation or emoji. */
const letterOrDigit = /^[\p{L}\p{N}]$/u

/**
 * First usable code point of one word, or `""` when the word has none.
 *
 * Iterates code points rather than UTF-16 units, so an astral letter or a single-code-point emoji
 * comes back whole instead of as half a surrogate pair. Leading punctuation is skipped rather than
 * used, and a word of nothing but symbols contributes nothing.
 */
function initialOf(word: string): string {
  for (const character of word) {
    if (letterOrDigit.test(character)) return character
  }

  return ""
}

/**
 * Reduce a name to one or two initials for an avatar's fallback face.
 *
 * The rule, exactly:
 *
 * 1. A word is a maximal run of non-space characters, except that each CJK character is a word of
 *    its own — `"王小明"` is three words, `"Anne-Marie"` is one.
 * 2. A word's initial is its first code point that is a letter or a digit. Leading punctuation is
 *    skipped (`"-John"` is `"J"`); a word with neither (an emoji, a symbol) contributes nothing.
 * 3. The result is the first initial plus the second when there is one, so a name of three or more
 *    words still yields two characters — `"John Paul Smith"` is `"JP"`, never `"JPS"`.
 * 4. The result is uppercased, so `initials("js")` is `"JS"`. A character that uppercases to more
 *    than one — the German `"ß"` — expands, and the result is then longer than two characters.
 * 5. A name with nothing usable — `""`, `"   "`, `null`, `undefined`, `"!!!"`, `"😀"` — returns
 *    `""`, which is what sends an avatar to its generic-icon face.
 *
 * Two tradeoffs worth stating. The CJK rule gives two characters (`"王小明"` → `"王小"`) rather than
 * the surname alone, because that is one rule for every script; a design that wants `"王"` has to
 * say so. And there is deliberately no `Intl.Segmenter`: it is a fine platform API, but its only
 * win here is a whole grapheme for a name that starts with a ZWJ emoji sequence, it is absent from
 * the `ES2020` lib this repository compiles against, and code-point iteration already handles
 * combining marks and single-code-point emoji with no platform probe and no type assertion.
 *
 * @param name Full name, in any script. `null` and `undefined` are treated as empty.
 * @returns One or two upper-case characters, or `""` when the name has no usable initial.
 */
export function initials(name?: string | null): string {
  if (typeof name !== "string") return ""

  const found: string[] = []

  for (const word of name.match(wordPattern) ?? []) {
    const initial = initialOf(word)
    if (initial) found.push(initial)
    if (found.length === 2) break
  }

  return found.join("").toUpperCase()
}

/** What {@link avatarFace} decides from. */
export interface AvatarFaceInput {
  /** Image URL the caller supplied, if any. */
  src?: string | null
  /** Whether the browser has already reported a load error for {@link src}. Defaults to `false`. */
  failed?: boolean
  /** Full name — where the initials come from. */
  name?: string | null
}

/**
 * Pick an avatar's face: the image while it is usable, then the initials, then the generic icon.
 *
 * The DOM half of the chain — an `<img>`'s `error` event — stays in the component, so the decision
 * itself is pure and testable without a DOM. A missing `src` and a failed one take the same path,
 * and a name that yields no initial skips the initials face rather than rendering an empty box.
 *
 * @param input Source URL, whether it has already failed to load, and the name to fall back to.
 * @returns `"image"`, `"initials"` or `"icon"`.
 */
export function avatarFace({ src, failed = false, name }: AvatarFaceInput): AvatarFace {
  if (src && !failed) return "image"

  return initials(name) ? "initials" : "icon"
}

/** How an {@link AvatarGroup} splits its members between the stack and the `+N` chip. */
export interface GroupSplit {
  /** Avatars to render. */
  visible: number
  /** Members counted behind the `+N` chip; `0` when the stack shows them all. */
  overflow: number
}

/** A count: floored, never negative, and `0` for a value that is not a finite number. */
function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/**
 * Split a group's member count into the avatars that fit and the ones counted behind `+N`.
 *
 * One function rather than two expressions at the call site, so `visible` and `overflow` cannot
 * disagree about the same total: they always add up to the member count. Non-integers are floored,
 * a negative `max` behaves as `0`, and a non-finite argument is treated as `0` rather than
 * producing `NaN` counts in the markup.
 *
 * @param total How many members the group has, normally `items.length`.
 * @param max Most avatars the stack may show before counting the rest behind the chip.
 * @returns The visible count and the overflow count.
 */
export function groupSplit(total: number, max: number): GroupSplit {
  const members = count(total)
  const visible = Math.min(members, count(max))

  return { visible, overflow: members - visible }
}

/**
 * The accessible name of an {@link AvatarGroup}: what it is, and how many members it holds.
 *
 * The avatars in a stack are decorative — the group is one labelled object, not N labelled images —
 * so the count belongs here, and a screen reader hears `"Project members (12)"`. That number is the
 * total, which is what makes the members behind the `+N` chip reachable without announcing the
 * stacked faces one by one. A bare count in brackets rather than a noun phrase, so no plural rule
 * is being guessed at: the caller's own label carries the wording.
 *
 * @param label The caller's description of the group. Blank falls back to `"Avatars"`.
 * @param total Total members, the ones behind the chip included.
 * @returns `"<label> (<total>)"`.
 */
export function groupLabel(label: string | null | undefined, total: number): string {
  const description = typeof label === "string" && label.trim() ? label.trim() : "Avatars"

  return `${description} (${total})`
}

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gray-100 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200"

const boxClasses: Record<AvatarSize, string> = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
}

const textClasses: Record<AvatarSize, string> = {
  xs: "text-[0.625rem]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
}

const glyphClasses: Record<AvatarSize, string> = {
  xs: "size-4",
  sm: "size-5",
  md: "size-6",
  lg: "size-7",
}

/** The ring a stacked avatar draws, so two overlapping faces do not read as one. */
const stackRing = "ring-2 ring-white dark:ring-gray-800"

export interface AvatarProps {
  /** Full name. Supplies the initials, and the accessible name when `alt` is not given. */
  name?: string | null
  /** Image URL. Rendered while it loads and after it loads, until the browser reports an error. */
  src?: string | null
  /**
   * Accessible name. Defaults to `name`.
   *
   * Pass `""` for an avatar that is decorative because something else already names the person — a
   * group's own label, or the name in text beside it. The whole box is then hidden from assistive
   * tech instead of announced a second time.
   */
  alt?: string
  /** Defaults to `"md"`. */
  size?: AvatarSize
  class?: string
}

/**
 * Round image with an initials fallback and a generic-icon last resort.
 *
 * The chain is {@link avatarFace}: the image while `src` is set and has not errored, the initials
 * when `src` is missing or the browser reports a load error for it, and `icons/`'s `IconUser` when
 * the name has no usable initial either.
 *
 * Named or decorative, never both. With a name the box is a single `role="img"` carrying that name;
 * with `alt=""` it is `aria-hidden` and an image inside it gets `alt=""` — an image that can fail
 * cannot be named by its own content, so the label lives on the box, which the initials and the
 * glyph share.
 *
 * Server-renderable, and props-and-ports only: the first render is the image face, the `error`
 * listener that switches to the initials is attached in the browser, and the state that flips is
 * local to this component. The error path itself is therefore not covered by the colocated
 * tests — they render markup with `preact-render-to-string` and this repository has no DOM
 * harness; {@link avatarFace} is the testable half of that decision.
 */
export function Avatar({ name, src, alt, size = "md", class: className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const face = avatarFace({ src, failed, name })
  const text = initials(name)
  const label = alt ?? (typeof name === "string" ? name.trim() : "")
  const box = cn(base, boxClasses[size], className)

  if (face === "image") {
    return (
      <span class={box}>
        <img
          src={src ?? undefined}
          alt={label}
          class="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  const accessible: JSX.HTMLAttributes<HTMLSpanElement> = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true }

  return (
    <span class={box} {...accessible}>
      {face === "initials"
        ? <span class={textClasses[size]}>{text}</span>
        : <IconUser class={glyphClasses[size]} />}
    </span>
  )
}

/** One member of an {@link AvatarGroup}. */
export interface AvatarMember {
  /** Full name — the accessible name and the source of the initials. */
  name?: string | null
  /** Image URL. */
  src?: string | null
}

export interface AvatarGroupProps {
  /** Members, in display order. */
  items: readonly AvatarMember[]
  /** Most avatars to show before the `+N` chip counts the rest. Defaults to 4. */
  max?: number
  /**
   * What the group is, for assistive tech — `"Project members"`.
   *
   * Defaults to `"Avatars"`. The member count is appended either way, so the members behind the
   * `+N` chip are never lost to a screen reader.
   */
  label?: string
  /** Box size of every avatar in the stack. Defaults to `"md"`. */
  size?: AvatarSize
  class?: string
}

/**
 * Overlapping avatar stack for a handful of members, with a `+N` chip for the rest.
 *
 * The stack is one labelled list, not N labelled images: every avatar in it is decorative
 * (`alt=""`), and the single accessible name comes from {@link groupLabel} — the caller's `label`
 * plus the total count. That is what keeps a name from being announced twice, and what keeps the
 * members behind the chip reachable once the chip itself is `aria-hidden`, its number already
 * spoken by the group's label.
 *
 * `max` and the item count are split by {@link groupSplit}, so the stack shows `max` avatars and
 * the chip reads `+<total - max>`. Nothing is rendered for the chip when nothing overflows.
 */
export function AvatarGroup(
  { items, max = 4, label, size = "md", class: className }: AvatarGroupProps,
) {
  const { visible, overflow } = groupSplit(items.length, max)

  return (
    <ul
      role="list"
      aria-label={groupLabel(label, items.length)}
      class={cn("-space-x-2 flex flex-wrap items-center", className)}
    >
      {items.slice(0, visible).map((item, index) => (
        <li key={index} class="flex">
          <Avatar name={item.name} src={item.src} alt="" size={size} class={stackRing} />
        </li>
      ))}
      {overflow > 0 && (
        <li class="flex">
          <span aria-hidden="true" class={cn(base, boxClasses[size], stackRing, textClasses[size])}>
            {`+${overflow}`}
          </span>
        </li>
      )}
    </ul>
  )
}
