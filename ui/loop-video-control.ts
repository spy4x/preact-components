/**
 * What a `LoopVideo` does with its `<video>`: play while in view, pause when it leaves, hold the
 * visitor's pause, play once under reduced motion, and keep the position across a source swap.
 * Plain functions over a small slice of `HTMLMediaElement`, so the rules run in a test without a
 * browser. Internal: not one of the package's entry points.
 *
 * @module
 */

/** The slice of a `<video>` {@link controlLoop} drives. */
export interface LoopClip extends EventTarget {
  play(): Promise<void>
  pause(): void
  load(): void
  readonly paused: boolean
  readonly ended: boolean
  currentTime: number
  loop: boolean
}

/** Options of {@link controlLoop}. */
export interface LoopControlOptions {
  /**
   * The visitor asks for reduced motion: the clip never starts by itself, and a press plays it
   * once, stopping on its last frame.
   */
  reduced: boolean
  /** Called whenever the clip starts or stops, with whether it is playing now. */
  onPlayingChange: (playing: boolean) => void
}

/** The handle {@link controlLoop} returns. */
export interface LoopControl {
  /** The visitor pressed the button or the video: pause a playing clip, play a stopped one. */
  toggle(): void
  /** At least half of the clip came into view (`true`) or it left (`false`). */
  view(inView: boolean): void
  /** The `<source>` list changed (the theme did): load it again at the same time, same state. */
  reload(): void
  /** Removes the listeners; for an effect's cleanup. */
  stop(): void
}

/** Starts the clip, ignoring a refusal: a pause that cancels the play, or autoplay not allowed. */
function start(clip: LoopClip): void {
  clip.play().catch(() => {})
}

/**
 * Drives a looping, muted clip by the rules of `LoopVideo`.
 *
 * - In view, it plays; out of view, it pauses.
 * - A pause by the visitor holds for the rest of the visit: coming back into view does not
 *   restart it. A press on a stopped clip plays it and lifts the hold.
 * - Under reduced motion the clip never starts by itself, and `loop` is off, so a press plays it
 *   once and it stops on its last frame.
 *
 * @param clip The `<video>`, or anything with the same slice ({@link LoopClip}).
 * @param options Reduced motion and the playing callback, see {@link LoopControlOptions}.
 * @returns The handle the component calls from its observer, button and theme change.
 */
export function controlLoop(clip: LoopClip, options: LoopControlOptions): LoopControl {
  let held = false
  clip.loop = !options.reduced

  const report = () => options.onPlayingChange(!clip.paused && !clip.ended)
  const events = ["play", "pause", "ended"]
  for (const name of events) clip.addEventListener(name, report)

  return {
    toggle() {
      if (clip.paused || clip.ended) {
        held = false
        start(clip)
      } else {
        held = true
        clip.pause()
      }
    },
    view(next) {
      if (!next) clip.pause()
      else if (!held && !options.reduced) start(clip)
    },
    reload() {
      const time = clip.currentTime
      const playing = !clip.paused && !clip.ended
      clip.load()
      // `preload="none"`: the metadata arrives only once the clip plays, which may be later.
      clip.addEventListener("loadedmetadata", () => clip.currentTime = time, { once: true })
      if (playing) start(clip)
    },
    stop() {
      for (const name of events) clip.removeEventListener(name, report)
    },
  }
}
