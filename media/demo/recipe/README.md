# The demo video's recipe

`media/demo/` holds the library's one demo video: `demo.webm`, `demo.mp4`, the two posters,
`captions.vtt` and the music. This folder remakes all of it. Other sites (antonshubin.com) copy the
files at a pinned commit; they never record their own.

## What it needs

- Deno, as for the rest of the repository.
- Chromium for Playwright 1.64: `deno run -A npm:playwright@1.64.0 install chromium`, or point
  `CHROME_PATH` at a Chromium or Chrome you have.
- ffmpeg with libvpx-vp9, libx264, libopus, libwebp and the `drawtext` filter, and fontconfig
  (`fc-match`) for the captions' font.

## Remake it

1. From the repository root, run `deno task demo-video`. It builds the guide (`pages/dist`), serves
   it on a local port, records a take in headless Chromium, and encodes the four outputs. Two to
   three minutes, most of it the one-minute recording.
2. Read what it prints. Every step of the tour starts at a fixed second (`STEPS` in `record.ts`), and
   a step that ran past the next one's start is printed as `late`. A late step puts the captions out
   of step with the picture: record again, or lengthen the slot in `STEPS` and move the times in
   `captions.vtt` by the same amount.
3. Look at every frame before committing:
   `ffmpeg -i media/demo/demo.mp4 -vf "fps=1,scale=320:-1,tile=6x10" -frames:v 1 sheet.png`.
4. Commit `media/demo/` (the take in `recipe/.take/` is gitignored).

A caption or music change needs no new take: edit `captions.vtt` (or replace `music.opus` and
`MUSIC.md`), then run `deno task demo-video --encode-only`, which encodes the last take again.
`--url <guide>` records another copy of the guide instead of a local build, such as the live one at
`https://spy4x.github.io/preact-components/`.

## The files

- `demo-video.ts`: the one command; builds, serves, records, encodes.
- `record.ts`: the tour. The guide is laid out at 640×400 and painted at twice that, so its text
  stays readable when a site plays the clip about 528 px wide. Frames come from the DevTools
  screencast with their real times, so a loaded machine paints fewer frames without shifting them.
  The jump after the search's Enter is cut, because the guide scrolls past other cards while they
  load.
- `encode.ts`: the title card, the burned-in captions from `captions.vtt`, the end card and the
  music at about -28 LUFS; it refuses unreadable captions and a mix louder than -27 LUFS or above
  -1 dBTP. From the global `demo-video` skill, with two fixes: it reads a frame list's length from
  its durations, and it makes the full-range screencast frames limited-range `yuv420p`.
- `human-mouse.ts`, `pointer.js`, `keys.js`: the pointer that moves like a person, the click marks
  and the key caps, from the same skill.
