import type { JSX, Ref } from "preact"

/** One file of the clip, rendered as a `<source>`. */
export interface DemoVideoSource {
  /** Where the browser loads this file from. */
  src: string
  /** Its media type, such as `"video/webm"` or `"video/mp4"`. */
  type: string
}

/** Props of {@link DemoVideoClip}. */
export interface DemoVideoClipProps {
  /** The `<video>` element, for focus and {@link playClip}. */
  videoRef: Ref<HTMLVideoElement>
  /** The clip's files, the preferred one first. */
  sources: readonly DemoVideoSource[]
  /** The video's accessible name. */
  title: string
  /** The clip's intrinsic width in pixels. */
  width: number
  /** The clip's intrinsic height in pixels. */
  height: number
  /** Play the clip in a loop. */
  loop: boolean
  /** Called when no source can play. */
  onFail: () => void
}

/**
 * The playing clip of a `DemoVideo`. `object-contain` shows the whole frame: in full screen on a
 * screen of another aspect the clip gets dark bars instead of losing its top and bottom, where the
 * captions are. It has no `muted`, so the clip plays with its sound; {@link playClip} falls back to
 * muted when the browser refuses that.
 *
 * @param props See {@link DemoVideoClipProps}.
 * @returns The `<video>` with one `<source>` per entry of `sources`.
 */
export function DemoVideoClip(
  { videoRef, sources, title, width, height, loop, onFail }: DemoVideoClipProps,
): JSX.Element {
  return (
    <video
      ref={videoRef}
      controls
      autoplay
      playsinline
      preload="auto"
      loop={loop}
      width={width}
      height={height}
      aria-label={title}
      class="block h-full w-full bg-scrim-strong object-contain focus-visible:outline-hidden"
      onError={onFail}
    >
      {sources.map((source, index) => (
        // A `<video>` with `<source>` children reports a failed load on its last source, not on
        // itself.
        <source
          key={source.src}
          src={source.src}
          type={source.type}
          onError={index === sources.length - 1 ? onFail : undefined}
        />
      ))}
    </video>
  )
}

/**
 * Starts the clip with sound. When the browser refuses (autoplay with sound is not allowed), it
 * mutes the clip and plays again, so the clip always starts; the reader can unmute it in the
 * controls. A second refusal is ignored: the controls stay, and a failed load shows its own
 * message. Any other rejection, such as a pause that cancels the play, leaves the clip as it is.
 *
 * @param video The clip's `<video>`, or anything with its `play()` and `muted`.
 * @returns Settles once the clip plays, or once both attempts were refused.
 */
export async function playClip(
  video: Pick<HTMLMediaElement, "play" | "muted">,
): Promise<void> {
  try {
    await video.play()
  } catch (error) {
    // Only a refusal of sound is retried muted. An `AbortError` means a pause (another clip
    // starting) cancelled this play, and the reader did not ask for this clip any more.
    if (!(error instanceof DOMException && error.name === "NotAllowedError")) return
    video.muted = true
    await video.play().catch(() => {})
  }
}
