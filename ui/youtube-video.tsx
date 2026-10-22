import { join } from "@spy4x/preact-cn/join"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import type { DemoVideoPoster } from "./demo-video.tsx"
import { isPlainClick } from "./link.tsx"
import { playLinkClass, PlayMark, posterClass } from "./play-mark.tsx"

/**
 * Props of {@link YouTubeVideo}. Any other attribute, such as `id` or a `data-*` attribute for
 * analytics, goes onto the play link, so a caller can count the press.
 */
export interface YouTubeVideoProps extends
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
  > {
  /** The video's YouTube id, the `v` of its watch URL. Required. */
  videoId: string
  /**
   * The still frame shown before the press, with its size so nothing shifts. The caller hosts it,
   * so the page asks YouTube for nothing until the press.
   */
  poster: DemoVideoPoster
  /** What the video shows. It names the play link and the player's frame. */
  title: string
  /** Words before the title in the play link's name. Defaults to `"Play video"`. */
  playLabel?: string
  /**
   * The poster is on the first screen: it loads with `loading="eager"` and `fetchpriority="high"`.
   * Defaults to `false`, a lazy poster.
   */
  eager?: boolean
  /** Utilities for the root, appended to its own and merged with none of them. */
  class?: string
}

/** The box both the poster and the player fill, so the swap moves nothing. */
const frameClass = "relative block w-full overflow-hidden"

/** The player fills the box. */
const playerClass = "absolute inset-0 block h-full w-full border-0"

/**
 * A YouTube video that costs nothing until it is asked for: the caller's own poster with a play
 * mark, swapped for YouTube's player on press.
 *
 * The server renders the poster `<img>` inside a link to the video's watch page on youtube.com, so
 * without JavaScript the link opens the video there. After hydration, a click, Enter or Space on
 * the link stays on the page and puts an `<iframe>` of `youtube-nocookie.com/embed/{videoId}` with
 * `autoplay=1` in the poster's place, at the same aspect, and focus moves into the player so a
 * keyboard reader can pause it at once. Space acts on its release, as on a button, so the key
 * never reaches the player. No request goes to YouTube before the press: the poster is the
 * caller's file, and the iframe does not exist until then. Any other attribute goes onto the play
 * link, so `data-*` analytics attributes count the press.
 *
 * A page that shows it needs `frame-src https://www.youtube-nocookie.com` in its
 * Content-Security-Policy, and a referrer policy that sends the origin (the browser default does),
 * since YouTube refuses an embed with no referrer.
 *
 * @param props The id, the poster and the title, see {@link YouTubeVideoProps}.
 * @returns The poster link, or YouTube's player after the press.
 * @throws When `videoId` is empty: there is nothing to play or link to.
 */
export function YouTubeVideo(
  {
    videoId,
    poster,
    title,
    playLabel = "Play video",
    eager = false,
    class: className,
    ...rest
  }: YouTubeVideoProps,
): JSX.Element {
  if (videoId === "") throw new Error("YouTubeVideo needs a videoId")
  const id = encodeURIComponent(videoId)
  const playing = useSignal(false)
  const player = useRef<HTMLIFrameElement>(null)
  const style = { aspectRatio: `${poster.width} / ${poster.height}` }

  useEffect(() => {
    if (playing.value) player.current?.focus()
  }, [playing.value])

  if (playing.value) {
    return (
      <div class={join(frameClass, className)} style={style}>
        <iframe
          ref={player}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
          width={poster.width}
          height={poster.height}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          class={playerClass}
        />
      </div>
    )
  }

  const play = (event: Event) => {
    event.preventDefault()
    playing.value = true
  }

  return (
    <a
      {...rest}
      href={`https://www.youtube.com/watch?v=${id}`}
      aria-label={`${playLabel}: ${title}`}
      class={join(playLinkClass, className)}
      style={style}
      onClick={(event) => {
        // Ctrl, Cmd, Shift or Alt, or another button, opens the link the browser's way.
        if (isPlainClick(event)) play(event)
      }}
      onKeyDown={(event) => {
        // A link acts on Enter alone; Space is the button's key, and this link acts as one. Its
        // keydown would scroll the page, so it is stopped here and acts on release.
        if (event.key === " ") event.preventDefault()
      }}
      onKeyUp={(event) => {
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
        class={posterClass}
      />
      <PlayMark />
    </a>
  )
}
