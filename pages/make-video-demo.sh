#!/usr/bin/env bash
# Remakes the LoopVideo card's six-second test loops (light and dark, WebM and MP4), their posters,
# and the DemoVideo card's dark poster, in `video-demo/`. Needs ffmpeg with libvpx-vp9, libx264 and
# libwebp. The loop is seamless: the box crosses the card in six seconds and wraps, and the bar
# fills in the same six seconds and starts empty again.
set -euo pipefail
cd "$(dirname "$0")/video-demo"

loop() { # name, background, card, accent
  local graph="color=c=$2:s=640x400:d=6:r=24,format=yuv420p,
drawbox=x=48:y=48:w=544:h=304:color=$3:t=fill,
drawbox=x=80:y=88:w=240:h=20:color=$4@0.35:t=fill,
drawbox=x=80:y=128:w=360:h=12:color=$4@0.2:t=fill,
drawbox=x=80:y=152:w=320:h=12:color=$4@0.2:t=fill,
drawbox=x=80:y=304:w=480:h=8:color=$4@0.2:t=fill[card];
color=c=$4:s=48x48:r=24[box];
color=c=$4:s=480x8:r=24[bar];
[card][box]overlay=x='80+mod(t*432/6,432)':y=232:shortest=1[moved];
[moved][bar]overlay=x='80-480+t*480/6':y=304:shortest=1,
drawbox=x=48:y=304:w=32:h=8:color=$3:t=fill,drawbox=x=0:y=304:w=48:h=8:color=$2:t=fill"
  ffmpeg -y -hide_banner -loglevel error -f lavfi -i "$graph" \
    -c:v libvpx-vp9 -b:v 0 -crf 45 -row-mt 1 -an "loop-$1.webm"
  ffmpeg -y -hide_banner -loglevel error -f lavfi -i "$graph" \
    -c:v libx264 -crf 32 -preset veryslow -pix_fmt yuv420p -movflags +faststart -an "loop-$1.mp4"
  ffmpeg -y -hide_banner -loglevel error -f lavfi -i "$graph" -frames:v 1 \
    -c:v libwebp -quality 80 "loop-$1.webp"
}

loop light 0xf4f4f5 0xffffff 0x2563eb
loop dark 0x09090b 0x18181b 0x60a5fa

# The DemoVideo card's dark poster: its light poster, inverted and dimmed.
ffmpeg -y -hide_banner -loglevel error -i poster.webp -vf "negate,eq=brightness=-0.25" \
  -c:v libwebp -quality 80 poster-dark.webp
