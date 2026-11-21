#!/bin/bash
# Build the upright scenery sprites (cacti, bushes, grass, flowers, rocks, far mesas) from the SVGs in art/props.
# These are the side-view props that stand on the ground as camera-facing cards under the chase camera.
# The SVGs are the source: edit them, then run this again. Nothing else in public/sprites is touched.
#
#   tools/art-props.sh          rebuild every up_*.png
#   tools/art-props.sh sheet    rebuild, then also draw the contact sheets into .shots/art-props*.png
#
# Needs rsvg-convert and ImageMagick (magick).
#
# Every sprite is drawn at 200 px per map tile, stands on the bottom edge of its image with its base centred,
# and is saved as straight-alpha RGBA. The colour of the art is bled outwards under the transparent pixels
# (alpha is untouched), so linear filtering and mipmaps do not pull a dark fringe in around thin leaves.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=art/props
OUT=public/sprites
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# bleed <in.png> <out.png>: same picture, same alpha, but transparent pixels carry the nearest art colour.
bleed() {
  local size
  size=$(magick identify -format '%wx%h' "$1")
  magick "$1" \
    \( -clone 0 -channel RGBA -blur 0x1.5 -channel A -threshold 3% +channel \) \
    \( -clone 0 -channel RGBA -blur 0x5 -channel A -threshold 1% +channel \) \
    \( -clone 0 -channel RGBA -blur 0x16 -channel A -threshold 0.3% +channel \) \
    \( -clone 0 -resize '1x1!' -alpha off -scale "$size!" \) \
    -background none -compose DstOver -flatten -alpha off \
    \( "$1" -alpha extract \) -compose CopyOpacity -composite \
    -strip -depth 8 -define png:color-type=6 "$2"
}

# render <svg name> <width> <height> <out.png>
render() {
  rsvg-convert -w "$2" -h "$3" "$SRC/$1.svg" -o "$TMP/$1.raw.png"
  bleed "$TMP/$1.raw.png" "$4"
}

# --- single sprites: name width height
while read -r name w h; do
  render "$name" "$w" "$h" "$OUT/$name.png"
done <<'LIST'
up_cactus_1 256 512
up_cactus_2 256 320
up_cactus_3 192 224
up_agave 256 200
up_deadtree 384 512
up_tuft_1 280 260
up_tuft_2 280 260
up_mesa_1 1024 400
up_mesa_2 1024 300
up_mesa_3 640 480
up_rockspire 256 420
LIST

# --- atlases: four cells in a row, left to right
# dry grass: 4 cells of 128x256 -> 512x256
cells=()
for i in 1 2 3 4; do
  render "up_grass_$i" 128 256 "$TMP/grass_$i.png"
  cells+=("$TMP/grass_$i.png")
done
magick "${cells[@]}" +append -strip -depth 8 -define png:color-type=6 "$OUT/up_grass.png"

# flowers (pink, lilac, pale yellow, white): 4 cells of 64x128 -> 256x128
cells=()
for i in 1 2 3 4; do
  render "up_flowers_$i" 64 128 "$TMP/flowers_$i.png"
  cells+=("$TMP/flowers_$i.png")
done
magick "${cells[@]}" +append -strip -depth 8 -define png:color-type=6 "$OUT/up_flowers.png"

echo "upright props:"
magick identify -format '  %f %wx%h\n' "$OUT"/up_*.png

[ "${1:-}" = "sheet" ] || exit 0

# --- contact sheets, for looking at the art next to the family's originals
SHOTS=.shots
mkdir -p "$SHOTS"
SKY='#d8c489'
GROUND='#8a7a45'
SAND='#f0d890'

# stand <out.png> <ground colour> <scale %> <gap> file...: the files side by side, feet on a strip of ground
stand() {
  local out=$1 ground=$2 scale=$3 gap=$4
  shift 4
  local row=()
  for f in "$@"; do
    row+=(\( "$f" -resize "$scale%" -background none -gravity west -splice "${gap}x0" \))
  done
  magick "${row[@]}" -background none -gravity south +append +repage "$TMP/row.png"
  local w h
  w=$(magick identify -format '%w' "$TMP/row.png")
  h=$(magick identify -format '%h' "$TMP/row.png")
  magick -size "$((w + gap))x$((h + 46))" "xc:$SKY" \
    \( -size "$((w + gap))x34" "xc:$ground" \) -gravity south -composite \
    "$TMP/row.png" -gravity southwest -geometry "+0+22" -composite "$out"
}

# the originals are drawn from above; they are here for colour and line, not for size
magick "$OUT/lizard.png" -crop 200x200+0+0 +repage "$TMP/o_lizard.png"
magick "$OUT/roadrunner.png" -crop 200x400+0+0 +repage "$TMP/o_roadrunner.png"
magick "$OUT/nest_clutch.png" -trim +repage "$TMP/o_nest.png"

stand "$TMP/s1.png" "$GROUND" 100 24 "$OUT/boulder.png" "$OUT/tuft_1.png" "$OUT/up_tuft_1.png" "$OUT/up_tuft_2.png" \
  "$OUT/up_agave.png" "$OUT/up_cactus_3.png" "$OUT/up_cactus_2.png" "$OUT/up_cactus_1.png" "$OUT/up_rockspire.png" "$OUT/up_deadtree.png"
stand "$TMP/s2.png" "$GROUND" 100 24 "$TMP/o_lizard.png" "$TMP/o_nest.png" "$OUT/up_grass.png" "$OUT/up_flowers.png" \
  "$OUT/tuft_3.png" "$TMP/o_roadrunner.png" "$OUT/hawk_centre.png" "$OUT/owl.png"
stand "$TMP/s3.png" "$SAND" 33.34 12 "$OUT/boulder.png" "$OUT/tuft_1.png" "$OUT/up_tuft_1.png" "$OUT/up_tuft_2.png" \
  "$OUT/up_agave.png" "$OUT/up_cactus_3.png" "$OUT/up_cactus_2.png" "$OUT/up_cactus_1.png" "$OUT/up_rockspire.png" "$OUT/up_deadtree.png" \
  "$OUT/up_grass.png" "$OUT/up_flowers.png" "$OUT/up_mesa_3.png" "$OUT/up_mesa_1.png"
stand "$TMP/s4.png" "$GROUND" 33.34 12 "$OUT/boulder.png" "$OUT/tuft_1.png" "$OUT/up_tuft_1.png" "$OUT/up_tuft_2.png" \
  "$OUT/up_agave.png" "$OUT/up_cactus_3.png" "$OUT/up_cactus_2.png" "$OUT/up_cactus_1.png" "$OUT/up_rockspire.png" "$OUT/up_deadtree.png" \
  "$OUT/up_grass.png" "$OUT/up_flowers.png" "$OUT/up_mesa_3.png" "$OUT/up_mesa_2.png"
stand "$TMP/s5.png" "$GROUND" 60 20 "$OUT/up_mesa_1.png" "$OUT/up_mesa_3.png" "$OUT/up_mesa_2.png"

# one sheet of everything, plus the full-size rows on their own so they can be read closely
magick "$TMP/s1.png" "$TMP/s2.png" "$TMP/s3.png" "$TMP/s4.png" "$TMP/s5.png" -background "$SKY" -gravity west -append +repage \
  -strip -depth 8 "$SHOTS/art-props.png"
magick "$TMP/s1.png" -strip -depth 8 "$SHOTS/art-props-big.png"
magick "$TMP/s2.png" -strip -depth 8 "$SHOTS/art-props-small.png"
magick "$TMP/s5.png" -strip -depth 8 "$SHOTS/art-props-mesas.png"
magick "$TMP/s3.png" "$TMP/s4.png" -background "$SKY" -gravity west -append +repage -strip -depth 8 "$SHOTS/art-props-third.png"
echo "contact sheets:"
magick identify -format '  %d/%f %wx%h\n' "$SHOTS"/art-props*.png
