import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { controlLoop, type LoopClip } from "./loop-video-control.ts"

/** A `<video>` stand-in that plays, pauses, ends and loads as the media element does. */
class FakeClip extends EventTarget implements LoopClip {
  paused = true
  ended = false
  currentTime = 0
  loop = false
  plays = 0
  loads = 0

  play(): Promise<void> {
    this.plays++
    this.ended = false
    if (this.paused) {
      this.paused = false
      this.dispatchEvent(new Event("play"))
    }
    return Promise.resolve()
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.dispatchEvent(new Event("pause"))
  }

  load(): void {
    this.loads++
    this.paused = true
    this.currentTime = 0
  }

  /** The clip reached its last frame without `loop`. */
  end(): void {
    this.paused = true
    this.ended = true
    this.dispatchEvent(new Event("pause"))
    this.dispatchEvent(new Event("ended"))
  }
}

/** A clip under control, and every playing state it reported. */
function setup(reduced = false) {
  const clip = new FakeClip()
  const reports: boolean[] = []
  const control = controlLoop(clip, { reduced, onPlayingChange: (now) => reports.push(now) })
  return { clip, reports, control }
}

describe("controlLoop", () => {
  it("plays the clip in a loop while it is in view and pauses it when it leaves", () => {
    const { clip, reports, control } = setup()
    expect(clip.loop).toBe(true)
    expect(clip.paused).toBe(true)
    control.view(true)
    expect(clip.paused).toBe(false)
    control.view(false)
    expect(clip.paused).toBe(true)
    control.view(true)
    expect(clip.paused).toBe(false)
    expect(reports).toEqual([true, false, true])
  })

  it("holds the visitor's pause when the clip scrolls out of view and back in", () => {
    const { clip, control } = setup()
    control.view(true)
    control.toggle()
    expect(clip.paused).toBe(true)
    control.view(false)
    control.view(true)
    expect(clip.paused).toBe(true)
    expect(clip.plays).toBe(1)
  })

  it("lifts the hold when the visitor plays the clip again", () => {
    const { clip, control } = setup()
    control.view(true)
    control.toggle()
    control.toggle()
    expect(clip.paused).toBe(false)
    control.view(false)
    control.view(true)
    expect(clip.paused).toBe(false)
  })

  it("never starts by itself under reduced motion", () => {
    const { clip, control } = setup(true)
    control.view(true)
    expect(clip.paused).toBe(true)
    expect(clip.plays).toBe(0)
  })

  it("plays once on a press under reduced motion, then stops on the last frame", () => {
    const { clip, reports, control } = setup(true)
    expect(clip.loop).toBe(false)
    control.view(true)
    control.toggle()
    expect(clip.paused).toBe(false)
    clip.end()
    expect(reports).toEqual([true, false, false])
    // Back in view, the ended clip stays on its last frame.
    control.view(false)
    control.view(true)
    expect(clip.ended).toBe(true)
    expect(clip.plays).toBe(1)
  })

  it("plays an ended clip again on a press", () => {
    const { clip, control } = setup(true)
    control.toggle()
    clip.end()
    control.toggle()
    expect(clip.paused).toBe(false)
    expect(clip.plays).toBe(2)
  })

  it("reloads new sources at the same time and keeps playing a playing clip", () => {
    const { clip, control } = setup()
    control.view(true)
    clip.currentTime = 3.2
    control.reload()
    expect(clip.loads).toBe(1)
    expect(clip.paused).toBe(false)
    clip.dispatchEvent(new Event("loadedmetadata"))
    expect(clip.currentTime).toBe(3.2)
  })

  it("reloads a paused clip without playing it", () => {
    const { clip, control } = setup()
    control.view(true)
    control.toggle()
    clip.currentTime = 1.5
    control.reload()
    expect(clip.paused).toBe(true)
    clip.dispatchEvent(new Event("loadedmetadata"))
    expect(clip.currentTime).toBe(1.5)
  })

  it("ignores a refused play, such as a pause that cancels it", async () => {
    const clip = new FakeClip()
    clip.play = () => Promise.reject(new DOMException("", "AbortError"))
    const control = controlLoop(clip, { reduced: false, onPlayingChange: () => {} })
    control.view(true)
    // An unhandled rejection would fail this test.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it("stops reporting once stopped", () => {
    const { clip, reports, control } = setup()
    control.stop()
    clip.play()
    expect(reports).toEqual([])
  })
})
