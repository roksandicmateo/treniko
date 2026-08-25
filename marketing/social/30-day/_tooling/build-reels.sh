#!/usr/bin/env bash
# TRENIKO — assemble the five Reels from their rendered 1080x1920 frames.
#
#   bash marketing/social/30-day/_tooling/build-reels.sh [reel-01 ...]
#
# Deterministic: same frames in, same MP4 out. Needs ffmpeg on PATH.
#
# The audio track is pure silence, deliberately. There is no music — the Reels
# are written to be read with the sound off, and nothing we do not hold the
# rights to goes near them. The stream exists only because Instagram's web
# uploader stalls indefinitely on a video carrying no audio stream at all.
set -euo pipefail

R=marketing/social/30-day/reels
FPS=30

# seconds per shot: hook, pain, three product cards, CTA
D_HOOK=2.4; D_PAIN=2.6; D_PROD=2.6; D_CTA=3.6
XF=0.30                       # crossfade length between shots

# A still becomes a moving shot: a slow push-in over its whole duration.
#
# zoompan emits `d` frames for *every* frame it is given, so the input must be
# a single frame and the output length must be capped with -frames:v. Feeding
# it `-t` instead produces d x t frames — the first cut of this script did that
# and rendered a 400-second Reel.
shot () {                     # shot <png> <seconds> <zoom-from> <zoom-to> <out>
  local png=$1 secs=$2 z0=$3 z1=$4 out=$5
  local n; n=$(awk -v s="$secs" -v f="$FPS" 'BEGIN{printf "%d", s*f}')
  ffmpeg -nostdin -v error -y -loop 1 -i "$png" \
    -vf "scale=1620:2880:flags=lanczos,zoompan=z='${z0}+(${z1}-${z0})*on/${n}':d=${n}:s=1080x1920:fps=${FPS}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',setsar=1,format=yuv420p" \
    -frames:v "$n" -an -c:v libx264 -preset veryfast -crf 14 -pix_fmt yuv420p "$out"
}

build () {
  local d=$1 tmp; tmp=$(mktemp -d)
  echo "-- $d"

  shot "$R/$d/frame-1-hook.png"        $D_HOOK 1.000 1.055 "$tmp/1.mp4"
  shot "$R/$d/frame-2-pain.png"        $D_PAIN 1.055 1.000 "$tmp/2.mp4"
  shot "$R/$d/frame-3-1-product.png"   $D_PROD 1.000 1.045 "$tmp/3.mp4"
  shot "$R/$d/frame-3-2-product.png"   $D_PROD 1.045 1.000 "$tmp/4.mp4"
  shot "$R/$d/frame-3-3-product.png"   $D_PROD 1.000 1.045 "$tmp/5.mp4"
  shot "$R/$d/frame-4-cta.png"         $D_CTA  1.040 1.000 "$tmp/6.mp4"

  # chain the six shots with short crossfades; every offset is the running
  # total of the preceding shots minus the fades already consumed
  local o1 o2 o3 o4 o5
  o1=$(awk -v a=$D_HOOK -v x=$XF 'BEGIN{printf "%.3f", a-x}')
  o2=$(awk -v a=$D_HOOK -v b=$D_PAIN -v x=$XF 'BEGIN{printf "%.3f", a+b-2*x}')
  o3=$(awk -v a=$D_HOOK -v b=$D_PAIN -v c=$D_PROD -v x=$XF 'BEGIN{printf "%.3f", a+b+c-3*x}')
  o4=$(awk -v a=$D_HOOK -v b=$D_PAIN -v c=$D_PROD -v x=$XF 'BEGIN{printf "%.3f", a+b+2*c-4*x}')
  o5=$(awk -v a=$D_HOOK -v b=$D_PAIN -v c=$D_PROD -v x=$XF 'BEGIN{printf "%.3f", a+b+3*c-5*x}')

  ffmpeg -nostdin -v error -y \
    -i "$tmp/1.mp4" -i "$tmp/2.mp4" -i "$tmp/3.mp4" -i "$tmp/4.mp4" -i "$tmp/5.mp4" -i "$tmp/6.mp4" \
    -filter_complex "\
[0][1]xfade=transition=fade:duration=$XF:offset=$o1[a];\
[a][2]xfade=transition=fade:duration=$XF:offset=$o2[b];\
[b][3]xfade=transition=slideleft:duration=$XF:offset=$o3[c];\
[c][4]xfade=transition=slideleft:duration=$XF:offset=$o4[e];\
[e][5]xfade=transition=fade:duration=$XF:offset=$o5[v]" \
    -f lavfi -t 30 -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -map "[v]" -map 6:a -shortest \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    -profile:v high -level 4.0 -c:a aac -b:a 96k \
    -movflags +faststart -r $FPS "$R/$d/$d.mp4"

  rm -rf "$tmp"
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt \
    -show_entries format=duration -of default=nw=1 "$R/$d/$d.mp4"
}

for d in ${@:-reel-01 reel-02 reel-03 reel-04 reel-05}; do build "$d"; done
