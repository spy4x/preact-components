import { join } from "@spy4x/preact-cn/join"
import { IconPlaySolid } from "@spy4x/preact-icons"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"

/** The still frame a {@link DemoVideo} shows until it is pressed. */
export interface DemoVideoPoster {
  /** Where the browser loads the poster image from. */
  src: string
  /** Other sizes of the same image, as the `<img>`'s `srcset`. */
  srcset?: string
  /** The `<img>`'s `sizes`, for `srcset`. */
  sizes?: string
  /** The poster's intrinsic width in pixels; the clip is drawn at the same aspect. */
  width: number
  /** The poster's intrinsic height in pixels. */
  height: number
}

/** One file of the clip, rendered as a `<source>`. */
export interface DemoVideoSource {
  /** Where the browser loads this file from. */
  src: string
  /** Its media type, such as `"video/webm"` or `"video/mp4"`. */
  type: string
}

/**
 * Props of {@link DemoVideo}. Any other attribute, such as `id` or a `data-*` attribute for
 * analytics, goes onto the play link, so a caller can count the press.
 */
export interface DemoVideoProps extends
  Omit<
    JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
    | "href"
    | "class"
    | "className"
    | "style"
    | "title"
    | "children"
    | "onClick"
    | "onKeyDown"
    | "onKeyUp"
    | "aria-label"
    | "loop"
  > {
  /** The still frame shown before the press, with its size so nothing shifts. */
  poster: DemoVideoPoster
  /**
   * The clip's files, the preferred one first (WebM before MP4). The first is also the link a
   * reader without JavaScript follows. At least one is required.
   */
  sources: readonly DemoVideoSource[]
  /** What the clip shows. It names the play link and the video. */
  title: string
  /** Words before the title in the play link's name. Defaults to `"Play video"`. */
  playLabel?: string
  /**
   * The poster is on the first screen: it loads with `loading="eager"` and `fetchpriority="high"`.
   * Defaults to `false`, a lazy poster.
   */
  eager?: boolean
  /** Play the clip in a loop, except when the reader asks for reduced motion. */
  loop?: boolean
  /** Shown in the clip's box when no source can play. Defaults to `"The video didn't load."`. */
  errorLabel?: string
  /** The link to the first source under {@link errorLabel}. Defaults to `"Open the video file"`. */
  openFileLabel?: string
  /** Utilities for the root, appended to its own and merged with none of them. */
  class?: string
}

/** The box both the poster and the clip fill, so the swap moves nothing. */
const frameClass = "relative block w-full overflow-hidden"

/** The poster link: the whole frame is the target; its focus ring is on the overlay. */
const linkClass = join(
  frameClass,
  "group cursor-pointer focus-visible:outline-hidden",
)

const mediaClass = "block h-full w-full object-cover"

/** The message that takes the clip's place when no source can play. */
const failedClass =
  "flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas p-4 text-center text-sm text-foreground"

const fileLinkClass =
  "rounded-sm font-medium underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"

/** Where a {@link DemoVideo} is: the poster, the clip playing, or a clip that could not load. */
type Phase =
  | { kind: "poster" }
  | { kind: "playing"; loop: boolean }
  | { kind: "failed"; hadFocus: boolean }

/**
 * The layer over the poster: it centres the play mark and carries the focus ring, which the link
 * itself would paint under the image.
 */
const overlayClass =
  "pointer-events-none absolute inset-0 flex items-center justify-center group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-focus"

/** The play mark: a round dark disc with a white triangle, a little larger under the pointer. */
const discClass =
  "flex size-16 items-center justify-center rounded-full bg-scrim text-scrim-foreground shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-(--color-scrim-foreground) motion-safe:transition-transform motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"

/** Whether the reader asks for reduced motion. Read in a handler, so never on the server. */
function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

/**
 * A demo clip that costs nothing until it is asked for: a poster with a play mark, swapped for the
 * clip on press.
 *
 * The server renders the poster `<img>` inside a link to the first source, so without JavaScript
 * the link opens the clip in the browser's own player. After hydration, a click, Enter or Space on
 * the link stays on the page and puts `<video controls autoplay muted playsinline>` in the
 * poster's place, at the same aspect, and focus moves to the video so a keyboard reader can pause
 * it at once. No `<video>` element exists before the press, so the browser fetches no video bytes.
 * Under `prefers-reduced-motion: reduce` the clip still plays, since the reader asked for it, but
 * `loop` is ignored. Any other attribute goes onto the play link, so `data-*` analytics attributes
 * count the press.
 *
 * When no source can play (the video, or its last `<source>`, fires `error`), the box keeps its
 * size and shows `errorLabel` with a link to the first source; focus moves to that link when it was
 * on the video.
 *
 * @param props The poster, the sources and the title, see {@link DemoVideoProps}.
 * @returns The poster link, the playing video after the press, or the message when it failed.
 * @throws When `sources` is empty: there is nothing to play or link to.
 */
export function DemoVideo(
  {
    poster,
    sources,
    title,
    playLabel = "Play video",
    eager = false,
    loop = false,
    errorLabel = "The video didn't load.",
    openFileLabel = "Open the video file",
    class: className,
    ...rest
  }: DemoVideoProps,
): JSX.Element {
  const first = sources[0]
  if (first === undefined) throw new Error("DemoVideo needs at least one source")
  const phase = useSignal<Phase>({ kind: "poster" })
  const video = useRef<HTMLVideoElement>(null)
  const fileLink = useRef<HTMLAnchorElement>(null)
  const current = phase.value

  // The key that pressed the link, until it is released. Focus waits for the release: the key's
  // own keyup or keypress on a focused `<video controls>` toggles playback and pauses the clip.
  const pressingKey = useRef<string | null>(null)

  useEffect(() => {
    // Started by the press, not by `autoplay` alone: Chromium pauses a muted video that autoplayed
    // once it leaves the viewport, and a page that moves under it would stop a clip asked for.
    if (current.kind === "playing") video.current?.play().catch(() => {})
    if (current.kind === "playing" && pressingKey.current === null) video.current?.focus()
    if (current.kind === "failed" && current.hadFocus) fileLink.current?.focus()
  }, [current])

  const style = { aspectRatio: `${poster.width} / ${poster.height}` }

  if (current.kind === "failed") {
    return (
      <div class={join(frameClass, className)} style={style}>
        <div role="status" class={failedClass}>
          <p>{errorLabel}</p>
          <a ref={fileLink} href={first.src} class={fileLinkClass}>{openFileLabel}</a>
        </div>
      </div>
    )
  }

  if (current.kind === "playing") {
    // A `<video>` with `<source>` children reports a failed load on its last source, not itself.
    const fail = () => {
      const focused = video.current !== null && video.current === document.activeElement
      phase.value = { kind: "failed", hadFocus: focused }
    }
    return (
      <div class={join(frameClass, className)} style={style}>
        <video
          ref={video}
          controls
          autoplay
          muted
          playsinline
          preload="auto"
          loop={current.loop}
          width={poster.width}
          height={poster.height}
          aria-label={title}
          class={join(mediaClass, "bg-scrim-strong focus-visible:outline-hidden")}
          onError={fail}
        >
          {sources.map((source, index) => (
            <source
              key={source.src}
              src={source.src}
              type={source.type}
              onError={index === sources.length - 1 ? fail : undefined}
            />
          ))}
        </video>
      </div>
    )
  }

  const play = (event: Event) => {
    event.preventDefault()
    if (pressingKey.current !== null) {
      const key = pressingKey.current
      const release = (up: KeyboardEvent) => {
        if (up.key !== key) return
        document.removeEventListener("keyup", release, true)
        pressingKey.current = null
        video.current?.focus()
      }
      document.addEventListener("keyup", release, true)
    }
    phase.value = { kind: "playing", loop: loop && !prefersReducedMotion() }
  }

  return (
    <a
      {...rest}
      href={first.src}
      aria-label={`${playLabel}: ${title}`}
      class={join(linkClass, className)}
      style={style}
      onClick={play}
      onKeyUp={() => {
        // Released on the link itself: the press did not play the clip, so nothing waits for it.
        pressingKey.current = null
      }}
      onKeyDown={(event) => {
        // A link acts on Enter alone; Space is the button's key, and this link acts as one.
        if (event.key !== "Enter" && event.key !== " ") return
        if (event.repeat) return event.preventDefault()
        pressingKey.current = event.key
        if (event.key === " ") play(event)
      }}
    >
      <img
        src={poster.src}
        srcset={poster.srcset}
        sizes={poster.sizes}
        width={poster.width}
        height={poster.height}
        alt=""
        aria-hidden="true"
        loading={eager ? "eager" : "lazy"}
        fetchpriority={eager ? "high" : undefined}
        decoding={eager ? undefined : "async"}
        class={mediaClass}
      />
      <span
        aria-hidden="true"
        class={overlayClass}
      >
        <span class={discClass}>
          <IconPlaySolid class="size-8 translate-x-px" />
        </span>
      </span>
    </a>
  )
}
