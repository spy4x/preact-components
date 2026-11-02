import { join } from "@spy4x/preact-cn/join"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import type { DemoVideoSource } from "./demo-video-clip.tsx"
import { useLabels } from "./i18n.tsx"
import { LoopVideoButton } from "./loop-video-button.tsx"
import { controlLoop, type LoopControl } from "./loop-video-control.ts"
import { aspectRef, type DemoVideoPoster, PosterPicture } from "./poster-picture.tsx"

/** Props of {@link LoopVideo}. */
export interface LoopVideoProps {
  /**
   * The still frame: what the server renders, what shows until the clip has a frame, and what
   * stays when it cannot play. Its size keeps the box still. With `dark`, the dark frame shows
   * while `poster.dark.media` matches, and the same query picks {@link darkSources}.
   */
  poster: DemoVideoPoster
  /** The clip's files in the light theme, the preferred one first (WebM before MP4). */
  sources: readonly DemoVideoSource[]
  /**
   * The clip's files in the dark theme, played while `poster.dark.media` matches. They need
   * `poster.dark`, which holds that query.
   */
  darkSources?: readonly DemoVideoSource[]
  /** What the clip shows, in a sentence: the video's accessible name. */
  title: string
  /** A short name for the clip, such as `"Realtime sync"`: the button says `{label}: {name}`. */
  name: string
  /** The button's first words while the clip plays. Defaults to `"Pause animation"`. */
  pauseLabel?: string
  /** The button's first words while it is stopped. Defaults to `"Play animation"`. */
  playLabel?: string
  /** Utilities for the root, appended to its own and merged with none of them. */
  class?: string
}

/** The English words of `LoopVideo`, each one a prop of its own. */
const LOOP_VIDEO_LABELS: Required<Pick<LoopVideoProps, "pauseLabel" | "playLabel">> = {
  pauseLabel: "Pause animation",
  playLabel: "Play animation",
}

/** The share of the clip that must be on screen for it to play. */
const IN_VIEW_RATIO = 0.5

/** The box the poster and the clip fill; the clip lies over the poster, so nothing moves. */
const frameClass = "relative block w-full overflow-hidden"

/** The poster, and the clip over it, fill the box. */
const fillClass = "block h-full w-full object-cover"

/**
 * A silent, looping clip that proves a claim on a public page: it plays while at least half of it
 * is on screen, and the visitor can pause it.
 *
 * The server renders the poster as an `<img>`, or as a `<picture>` with a dark `<source>` when
 * `poster.dark` is set, so the page works without JavaScript and shows a true still. After
 * hydration a `<video muted loop playsinline preload="none">` lies over the poster, invisible
 * until it has a frame, so nothing moves when it takes the poster's place and no video byte loads
 * before it is in view. It plays while at least half of it is in view and pauses when it leaves.
 * With `darkSources`, the dark files play while `poster.dark.media` matches; when the theme
 * changes the clip loads the other files and keeps its position.
 *
 * One 44 px button at the bottom-end corner pauses and plays it, and so does a click on the clip.
 * It is named `{pauseLabel}: {name}` or `{playLabel}: {name}` ("Pause animation", "Play
 * animation"), with the same words in a hint on hover and focus that Escape hides. A pause by the
 * visitor holds for the rest of the visit, also when the clip scrolls back into view; nothing is
 * stored. Under `prefers-reduced-motion: reduce` the clip never starts by itself; a press plays it
 * once and it stops on its last frame. When no source can play, the poster stays and the button
 * goes away. `class` is joined, not merged, so an island that renders it carries no
 * `tailwind-merge`. It fits inside `WindowFrame variant="plain"`.
 *
 * @param props The poster, the sources and the names, see {@link LoopVideoProps}.
 * @returns The box with the poster, and after hydration the clip and its button.
 * @throws When `sources` is empty, or `darkSources` is set without `poster.dark`.
 */
export function LoopVideo(
  {
    poster,
    sources,
    darkSources,
    title,
    name,
    pauseLabel: pauseLabelProp,
    playLabel: playLabelProp,
    class: className,
  }: LoopVideoProps,
): JSX.Element {
  const { pauseLabel, playLabel } = useLabels("LoopVideo", LOOP_VIDEO_LABELS, {
    pauseLabel: pauseLabelProp,
    playLabel: playLabelProp,
  })
  if (sources.length === 0) throw new Error("LoopVideo needs at least one source")
  if (darkSources !== undefined && poster.dark === undefined) {
    throw new Error("LoopVideo's darkSources need poster.dark, whose media query picks them")
  }
  const darkMedia = darkSources === undefined ? undefined : poster.dark?.media

  const hydrated = useSignal(false)
  const dark = useSignal(false)
  const playing = useSignal(false)
  const failed = useSignal(false)
  const shown = useSignal(false)
  const video = useRef<HTMLVideoElement>(null)
  const control = useRef<LoopControl | null>(null)
  const loadedDark = useRef<boolean | null>(null)

  // Hydration, and the theme the clip plays in.
  useEffect(() => {
    const query = darkMedia === undefined ? null : globalThis.matchMedia(darkMedia)
    const follow = () => dark.value = query?.matches ?? false
    follow()
    hydrated.value = true
    query?.addEventListener("change", follow)
    return () => query?.removeEventListener("change", follow)
  }, [darkMedia])

  // Play in view, pause out of it, once the clip exists and while it can play.
  const live = hydrated.value && !failed.value
  useEffect(() => {
    const clip = video.current
    if (!live || clip === null) return
    const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    const handle = controlLoop(clip, {
      reduced,
      onPlayingChange: (now) => playing.value = now,
    })
    control.current = handle
    const observer = new IntersectionObserver(([entry]) => {
      if (entry !== undefined) handle.view(entry.intersectionRatio >= IN_VIEW_RATIO)
    }, { threshold: IN_VIEW_RATIO })
    observer.observe(clip)
    return () => {
      observer.disconnect()
      handle.stop()
      control.current = null
    }
  }, [live])

  // The theme changed after the clip's files were set: load the others at the same time.
  const isDark = dark.value
  useEffect(() => {
    if (!live) return
    if (loadedDark.current !== null && loadedDark.current !== isDark) control.current?.reload()
    loadedDark.current = isDark
  }, [live, isDark])

  const files = isDark && darkSources !== undefined ? darkSources : sources
  const fail = () => failed.value = true
  const toggle = () => control.current?.toggle()

  return (
    <div ref={aspectRef(poster)} class={join(frameClass, className)}>
      {/* Named until the clip, which carries the name from then on, takes its place. */}
      <PosterPicture poster={poster} eager={false} class={fillClass} alt={live ? "" : title} />
      {live && (
        <>
          <video
            ref={video}
            muted
            playsinline
            preload="none"
            width={poster.width}
            height={poster.height}
            aria-label={title}
            class={join("absolute inset-0", fillClass, !shown.value && "opacity-0")}
            onLoadedData={() => shown.value = true}
            onEmptied={() => shown.value = false}
            onError={fail}
            onClick={toggle}
          >
            {files.map((source, index) => (
              // A `<video>` with `<source>` children reports a failed load on its last source.
              <source
                key={source.src}
                src={source.src}
                type={source.type}
                onError={index === files.length - 1 ? fail : undefined}
              />
            ))}
          </video>
          <LoopVideoButton
            playing={playing.value}
            name={name}
            pauseLabel={pauseLabel}
            playLabel={playLabel}
            onToggle={toggle}
          />
        </>
      )}
    </div>
  )
}
