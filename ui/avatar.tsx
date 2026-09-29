import { IconUser } from "@spy4x/preact-icons"
import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useState } from "preact/hooks"
import { initials } from "@spy4x/platform/universal/text"

/** Which of the three faces an {@link Avatar} renders. */
export type AvatarFace = "image" | "initials" | "icon"

/** Square box of an {@link Avatar} or an {@link AvatarGroup}. */
export type AvatarSize = "xs" | "sm" | "md" | "lg"

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

/**
 * Carry an avatar's "this image failed" flag across a change of `src`.
 *
 * An avatar with a broken URL keeps its initials face forever because `failed` is only ever set —
 * so a caller that swaps the bad URL for a good one, or re-uses one component instance for a new
 * user, is stuck on the fallback. A failure is a fact about one URL, so it has to be dropped when
 * that URL changes. This is the pure half of that rule, so the browser-only React-shaped half —
 * the render-time state comparison that applies it inside {@link Avatar} — stays out of the tests.
 *
 * Absent, `null` and `""` are one and the same value here: `src` is an optional prop, and
 * `undefined → null` is not a change of URL, so it must not clear a real failure.
 *
 * The tradeoff: two broken URLs in a row means the second one is attempted once before it errors,
 * because nothing else can tell a good URL from a bad one without loading it. Losing one load of
 * latency there buys a working image for every caller that swaps in a good URL.
 *
 * @param previous Source URL the component was watching before this render.
 * @param current Source URL it is watching now.
 * @param failed Whether the previous URL had already failed to load.
 * @returns Whether the failure still applies to the current URL.
 */
export function failedAfterSrcChange(
  previous: string | null | undefined,
  current: string | null | undefined,
  failed: boolean,
): boolean {
  return (previous ?? "") === (current ?? "") ? failed : false
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
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-hover font-medium text-foreground"

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
const stackRing = "ring-2 ring-surface"

export interface AvatarProps {
  /** Full name. Supplies the initials, and the accessible name when `alt` is not given. */
  name?: string | null
  /**
   * Image URL. Rendered while it loads and after it loads, until the browser reports an error.
   *
   * A load failure is remembered per URL, not forever: changing `src` clears it, so a caller can
   * replace a dead URL with a live one and get the image back.
   */
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
 * local to this component. That state does not outlive its `src` — a failure belongs to one URL, so
 * {@link failedAfterSrcChange} clears it when the URL changes, and a caller can swap a dead URL for
 * a live one or re-use the instance for a different member. The application half of it is the
 * render-time comparison of the previous `src` against the current one, not an effect: rendering
 * the new image in the same pass beats letting one frame of the old failure show through.
 *
 * The browser-only halves are not covered by the colocated tests — they render markup with
 * `preact-render-to-string` and this repository has no DOM harness. {@link avatarFace} and
 * {@link failedAfterSrcChange} are the testable halves of the two decisions; the `error` event and
 * the reset that follows a `src` change are not verified here, only disclosed.
 */
export function Avatar(
  { name, src, alt, size = "md", class: className }: AvatarProps,
): JSX.Element {
  const [failed, setFailed] = useState(false)
  const [watching, setWatching] = useState(src)

  if ((watching ?? "") !== (src ?? "")) {
    const carried = failedAfterSrcChange(watching, src, failed)

    setWatching(src)
    if (carried !== failed) setFailed(carried)
  }

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
 * `role="group"`, not a list. Every avatar in the stack is decorative (`alt=""`) and unnamed, so the
 * list would announce `"list, 4 items"` beside a label that says `"Project members (6)"` — a total
 * that the item count visibly contradicts. A group carries the same single accessible name from
 * {@link groupLabel} and no second count, which keeps the members behind the chip reachable once
 * the chip itself is `aria-hidden`, its number already spoken by the label. There is no ordering to
 * convey either, so nothing is lost: the faces are one object, not a sequence.
 *
 * `max` and the item count are split by {@link groupSplit}, so the stack shows `max` avatars and
 * the chip reads `+<total - max>`. Nothing is rendered for the chip when nothing overflows.
 */
export function AvatarGroup(
  { items, max = 4, label, size = "md", class: className }: AvatarGroupProps,
): JSX.Element {
  const { visible, overflow } = groupSplit(items.length, max)

  return (
    <div
      role="group"
      aria-label={groupLabel(label, items.length)}
      class={cn("-space-x-2 flex flex-wrap items-center", className)}
    >
      {items.slice(0, visible).map((item, index) => (
        <span key={index} class="flex">
          <Avatar name={item.name} src={item.src} alt="" size={size} class={stackRing} />
        </span>
      ))}
      {overflow > 0 && (
        <span class="flex">
          <span aria-hidden="true" class={cn(base, boxClasses[size], stackRing, textClasses[size])}>
            {`+${overflow}`}
          </span>
        </span>
      )}
    </div>
  )
}
