#!/bin/bash
# Build the NEW item sprites (power eggs, breakable rocks, thorns, critters, decor, medals) from the
# SVG drawings in art/items. The family's original art is never touched: tools/assets.sh owns that.
# Needs rsvg-convert (librsvg) and ImageMagick (magick). Run from anywhere, as often as you like:
#   bash tools/art-items.sh          rebuild every PNG
#   bash tools/art-items.sh sheet    rebuild, then write the contact sheets .shots/art-items*.png
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=art/items
OUT=public/sprites
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# name width height. One SVG each, its viewBox the same size as the PNG.
# The atlases (beetle, butterfly, pebbles, flowers, medals) are drawn whole, cell by cell, in one SVG.
SPRITES="
egg_thunder 128 160
egg_ghost 128 160
egg_chili 128 160
egg_rattle 128 160
egg_gold 128 160
rubble_pile 200 200
rubble_1 96 96
rubble_2 96 96
rubble_3 96 96
thorns 200 200
thorns_ash 200 200
beetle 256 128
butterfly 256 128
tumbleweed 160 160
skull 200 200
bones 200 200
pebbles 256 256
flowers 256 256
cracks 256 256
stun_star 64 64
medals 672 96
"

# SVG -> straight-alpha 8-bit RGBA PNG at exactly WxH, no metadata (so rebuilds are byte-stable).
draw() { # name width height out.png
  rsvg-convert -w "$2" -h "$3" "$SRC/$1.svg" -o "$TMP/$1.raw.png"
  magick "$TMP/$1.raw.png" -strip -define png:exclude-chunks=date,time "PNG32:$4"
}

while read -r name w h; do
  [ -n "$name" ] || continue
  draw "$name" "$w" "$h" "$OUT/$name.png"
done <<<"$SPRITES"

# --- cracked boulder: the cracks are painted ON the family's boulder ("atop" keeps its alpha untouched),
# so rock_cracked.png has exactly the silhouette of boulder.png.
draw rock_cracked 200 200 "$TMP/rock_overlay.png"
magick "$OUT/boulder.png" "$TMP/rock_overlay.png" -compose atop -composite \
  -strip -define png:exclude-chunks=date,time "PNG32:$OUT/rock_cracked.png"
same=$(magick compare -metric AE \( "$OUT/boulder.png" -alpha extract \) \( "$OUT/rock_cracked.png" -alpha extract \) null: 2>&1 || true)
case "$same" in 0*) ;; *) echo "WARNING: rock_cracked.png silhouette differs from boulder.png ($same px)" >&2 ;; esac

echo "item sprites:"
for name in $(awk 'NF{print $1}' <<<"$SPRITES") rock_cracked; do
  magick identify -format '  %f %wx%h\n' "$OUT/$name.png"
done

[ "${1:-}" = "sheet" ] || exit 0

# ---------------------------------------------------------------------------------------------------
# Contact sheets: the new sprites beside the originals, on the scrub khaki and on pale sand.
#   .shots/art-items.png        full size
#   .shots/art-items-small.png  in-game size (eggs about 40 px tall, a tile 100 px), shown twice as big
# ---------------------------------------------------------------------------------------------------
mkdir -p .shots
ORIG=../sprites
row() { # out.png scale files...   one row on a transparent background, each sprite at the given scale
  local out=$1 scale=$2
  shift 2
  magick "$@" -resize "$scale" -bordercolor none -border 6 -background none -gravity center +append +repage "$out"
}
for i in 1 2 3; do magick "$OUT/egg_$i.png" -resize 200% "$TMP/ref_egg_$i.png"; done
magick "$OUT/scorpion.png" -crop 208x210+0+0 +repage "$TMP/ref_scorpion.png"
magick "$OUT/lizard.png" -crop 200x200+0+0 +repage "$TMP/ref_lizard.png"
magick "$OUT/stars.png" -crop 100x100+0+0 +repage "$TMP/ref_star.png"
magick "$ORIG/roadrunner_0.png" -resize 50% "$TMP/ref_roadrunner.png"

row "$TMP/r1.png" 100% "$TMP"/ref_egg_{1,2,3}.png "$OUT"/egg_{thunder,ghost,chili,rattle,gold}.png \
  "$OUT/stun_star.png" "$TMP/ref_star.png" "$OUT"/rubble_{1,2,3}.png
row "$TMP/r2.png" 100% "$OUT"/{boulder,rock_cracked,rubble_pile,thorns,thorns_ash,skull,bones,nest_empty}.png
row "$TMP/r3.png" 100% "$OUT"/{beetle,butterfly,tumbleweed}.png "$TMP"/ref_{scorpion,lizard,roadrunner}.png "$OUT/tuft_1.png"
row "$TMP/r4.png" 100% "$OUT"/{pebbles,flowers,cracks}.png "$OUT/tuft_3.png" "$OUT/burrow.png"
row "$TMP/r5.png" 100% "$OUT/medals.png"
magick "$TMP"/r{1,2,3,4,5}.png -background none -gravity west -append +repage "$TMP/all.png"
magick \( "$TMP/all.png" -background '#8a7a45' -flatten \) \( "$TMP/all.png" -background '#f0d890' -flatten \) \
  -append +repage -depth 8 .shots/art-items.png

# in-game size: eggs at 25%, everything else at 50% (1 tile = 100 px), then doubled with hard pixels to look at
row "$TMP/s1.png" 25% "$TMP"/ref_egg_{1,2,3}.png "$OUT"/egg_{thunder,ghost,chili,rattle,gold}.png
row "$TMP/s2.png" 50% "$OUT"/{boulder,rock_cracked,rubble_pile,thorns,thorns,thorns_ash,skull,bones,nest_empty}.png
row "$TMP/s3.png" 50% "$OUT"/{beetle,butterfly,tumbleweed,stun_star}.png "$OUT"/rubble_{1,2,3}.png \
  "$TMP"/ref_{scorpion,lizard,roadrunner}.png "$OUT/tuft_1.png"
row "$TMP/s4.png" 50% "$OUT"/{pebbles,flowers,cracks,medals}.png
magick "$TMP"/s{1,2,3,4}.png -background none -gravity west -append +repage "$TMP/small.png"
magick \( "$TMP/small.png" -background '#8a7a45' -flatten \) \( "$TMP/small.png" -background '#f0d890' -flatten \) \
  -append +repage -filter point -resize 200% -depth 8 .shots/art-items-small.png

echo "contact sheets: .shots/art-items.png .shots/art-items-small.png"
