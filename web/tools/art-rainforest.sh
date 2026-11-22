#!/bin/bash
# Build the RAINFOREST level's sprites into public/sprites/rainforest/ (same names and sizes as the desert's).
# Needs ImageMagick (magick) and rsvg-convert. Run from anywhere, as often as you like:
#   bash tools/art-rainforest.sh           rebuild every PNG
#   bash tools/art-rainforest.sh sheet     rebuild, then draw the contact sheet .shots/rainforest-sprites.png
#
# THE ONE RULE: for every output name, if art/rainforest/<name>.png or art/rainforest/<name>.svg exists, that
# is used (resized to the output size) instead of anything made here. A real drawing replaces a placeholder
# by being dropped into art/rainforest/ under the sprite's name. Nothing else needs to change.
#
# Where the placeholders come from:
#   A  art/rainforest/<name>.png           the designer's recoloured sprites (floor, ferns, nests, eggs)
#   B  recoloured desert sprites           a gradient map through the rainforest palette, alpha untouched
#   C  art/rainforest/src/*.png            creature stand-ins, cut into the desert sprites' layouts
#   D  art/rainforest/placeholder/*.svg    simple drawn stand-ins (made by make_placeholders.py, editable by hand)
#
# Every output is straight-alpha RGBA with the art's colour bled out under the transparent pixels, so linear
# filtering and mipmaps pull no dark or white fringe in around the edges.
set -euo pipefail
MODE=${1:-}
cd "$(dirname "$0")/.."
ART=art/rainforest
SPR=public/sprites
OUT=public/sprites/rainforest
SHOTS=.shots
DESIGN=$SHOTS/concepts/rainforest-v2
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT" "$ART/src" "$ART/placeholder"

# the designer's PNGs carry an icc profile that makes ImageMagick grumble on every grey intermediate; hide just that
magick() { command magick "$@" 2> >(grep -v 'iCCP' >&2 || true); }

# The palette. Nothing outside these (and the tones between neighbours) goes into a recolour.
BC='#1A1030'   # Blackcurrant: deepest shade
PL='#3B2350'   # Plum: the forest floor
PLL='#5A3A6E'  # Plum light
DT='#0C4A50'   # Deep teal: trunks, roots
JD='#1E8C7B'   # Jade: leaves, water
MT='#86DDB9'   # Mint: lit leaves
MS='#D9F5E6'   # Mist: pale highlights
LM='#E4F56A'   # Firefly lime: glowing things only
HP='#F23D7F'   # Heliconia pink: flowers only
DP='#B01E5B'   # Deep pink: flowers only

# --- seed the designer's files into art/rainforest (checked in) the first time, if they are not there yet
seed() { # name source-file
  [ -f "$ART/$1.png" ] || [ -f "$ART/$1.svg" ] || { [ -f "$DESIGN/$2" ] && cp "$DESIGN/$2" "$ART/$1.png"; } || true
}
for n in floor fern_1 fern_2 fern_3 fern_4 nest_empty nest_egg_1 nest_egg_2 nest_egg_3 nest_gold nest_clutch; do
  seed "$n" "recoloured-sprites/$n.png"
done
seed egg_1 recoloured-sprites/egg_mint.png
seed egg_2 recoloured-sprites/egg_lime.png
seed egg_3 recoloured-sprites/egg_pink.png
for n in coati bird_eating_spider eyelash_viper jewel_beetle leafcutter_ant morpho_butterfly; do
  [ -f "$ART/src/$n.png" ] || { [ -f "$DESIGN/stand-in-sprites/$n.png" ] && cp "$DESIGN/stand-in-sprites/$n.png" "$ART/src/$n.png"; } || true
done

# bleed <in.png> <out.png>: same picture, same alpha, but transparent pixels carry the nearest art colour.
bleed() {
  local size
  size=$(magick identify -format '%wx%h' "$1")
  magick "$1" +repage \
    \( -clone 0 -channel RGBA -blur 0x1.5 -channel A -threshold 3% +channel \) \
    \( -clone 0 -channel RGBA -blur 0x5 -channel A -threshold 1% +channel \) \
    \( -clone 0 -channel RGBA -blur 0x16 -channel A -threshold 0.3% +channel \) \
    \( -clone 0 -resize '1x1!' -alpha off -scale "$size!" \) \
    -background none -compose DstOver -flatten -alpha off \
    \( "$1" -alpha extract \) -compose CopyOpacity -composite \
    -strip -depth 8 -define png:color-type=6 "$2"
}

# override <name> <w> <h>: if art/rainforest/<name>.svg or .png exists, build the output from it and succeed.
# Upright cards (up_*) keep their foot on the bottom edge when the aspect differs; everything else is centred.
override() {
  local n=$1 w=$2 h=$3 src="" grav=center
  case "$n" in up_*) grav=south ;; esac
  if [ -f "$ART/$n.svg" ]; then
    rsvg-convert -w "$w" -h "$h" "$ART/$n.svg" -o "$TMP/ov.png"
  elif [ -f "$ART/$n.png" ]; then
    magick "$ART/$n.png" -background none -resize "${w}x${h}" -gravity "$grav" -extent "${w}x${h}" "$TMP/ov.png"
  else
    return 1
  fi
  bleed "$TMP/ov.png" "$OUT/$n.png"
}

# --- tools for group B ---------------------------------------------------------------------------------------
# ramp <colour@pos ...>: a 256x1 gradient in $TMP/ramp.png. pos is the source grey level (0-100) the colour sits at;
# between two stops the colours blend, so two stops close together make a hard step (no muddy in-between greys).
ramp() {
  local a=() prev="" ppos=0 c pos col
  for c in "$@"; do
    col=${c%@*}; pos=${c#*@}
    [ "$pos" -le 0 ] 2>/dev/null && pos=0
    [ -z "$prev" ] && a+=("-size" "$((pos * 256 / 100 > 0 ? pos * 256 / 100 : 1))x1" "xc:$col") || {
      local w=$(((pos - ppos) * 256 / 100)); [ "$w" -lt 1 ] && w=1
      a+=("-size" "${w}x1" "-define" "gradient:direction=east" "gradient:$prev-$col")
    }
    prev=$col; ppos=$pos
  done
  a+=("-size" "$((256 - ppos * 256 / 100 > 0 ? 256 - ppos * 256 / 100 : 1))x1" "xc:$prev")
  magick "${a[@]}" +append -resize 256x1! "$TMP/ramp.png"
}

# gmap <in.png> <out.png> "<grey ops>" <colour@pos...>: colour channels go through the ramp by brightness; alpha is copied
# back untouched. <grey ops> are ImageMagick operators applied to the greyscale first (levels, gamma).
gmap() {
  local in=$1 out=$2 ops=$3
  shift 3
  ramp "$@"
  # shellcheck disable=SC2086
  magick "$in" -alpha off -grayscale Rec709Luma -colorspace Gray $ops "$TMP/ramp.png" -clut -colorspace sRGB \
    \( "$in" -alpha extract \) -compose CopyOpacity -composite "$out"
}

# flecks <img.png> <colour> <share-%> <blur> <seed> [<stroke-length> <angle>]: scatter marks of one palette colour over the
# art, only where it is already opaque (alpha untouched). A small blur makes flecks, a big one makes patches of a close
# tone; a stroke length and angle makes short dashes (bark, frond lines). Deterministic.
flecks() {
  local img=$1 col=$2 dens=$3 blur=$4 seed=$5 len=${6:-0} ang=${7:-0} size mb=()
  size=$(magick identify -format '%wx%h' "$img")
  [ "$len" != 0 ] && mb=(-motion-blur "0x${len}+${ang}")
  magick -seed "$seed" -size "$size" xc:gray +noise Random -colorspace Gray -blur "0x$blur" "${mb[@]}" \
    -contrast-stretch 0.3%x0.3% -threshold "$(awk "BEGIN{print 100 - $dens}")%" \
    \( "$img" -alpha extract \) -compose Multiply -composite "$TMP/fm.png"
  magick "$img" \( -size "$size" "xc:$col" "$TMP/fm.png" -compose CopyOpacity -composite \) -compose Over -composite \
    \( "$img" -alpha extract \) -compose CopyOpacity -composite "$img"
}

# finish <tmp.png> <name>: write the output
finish() { bleed "$1" "$OUT/$2.png"; }

# b <name> <desert source> "<grey ops>" <colour@pos...>  (size stays the source's)
b() {
  local n=$1 src=$2 ops=$3
  shift 3
  local size
  size=$(magick identify -format '%w %h' "$SPR/$src.png")
  # shellcheck disable=SC2086
  override "$n" $size && return 0
  gmap "$SPR/$src.png" "$TMP/$n.png" "$ops" "$@"
  local f c d z l a k=3             # FK="colour:share%:blur[:len:angle] ..." marks this sprite, then is cleared
  for f in ${FK:-}; do
    IFS=: read -r c d z l a <<< "$f"
    flecks "$TMP/$n.png" "$c" "$d" "$z" "$k" "${l:-0}" "${a:-0}"; k=$((k + 5))
  done
  FK=""
  finish "$TMP/$n.png" "$n"
}

# ========================================================================================================
# A. the designer's recoloured sprites
# ========================================================================================================
override floor 256 256 || { echo "missing $ART/floor.png" >&2; exit 1; }
for i in 1 2 3 4; do override "fern_$i" 280 240 || { echo "missing fern_$i" >&2; exit 1; }; done
for n in nest_empty nest_egg_1 nest_egg_2 nest_egg_3 nest_gold; do override "$n" 200 200 || { echo "missing $n" >&2; exit 1; }; done
override nest_clutch 400 400 || { echo "missing nest_clutch" >&2; exit 1; }
for i in 1 2 3; do override "egg_$i" 64 80 || { echo "missing egg_$i" >&2; exit 1; }; done

# ========================================================================================================
# B. recoloured desert sprites (gradient maps; the hand-drawn marks stay because only brightness is mapped)
# ========================================================================================================
# Stops are colour@grey, where grey is the desert sprite's own brightness (0-100), so each map is tuned to the
# tones that sprite really uses.
FK="#15695F:35:6 $DT:14:3 $MT:3:1 $MT:6:1:6:80 $BC:7:1:7:15 $MS:1:1 $DT:8:2:8:100"
b buttress boulder "" "$BC@14" "$DT@18" "$DT@21" "$JD@25" "$JD@28"
FK="$PL:22:6 $BC:10:1:7:20 $PLL:14:1:6:90 $MT:1.5:1"
b stump rock_cracked "" "$BC@7" "$BC@12" "$PL@18" "$PLL@25" "$PLL@34" "$MT@45" "$MT@65"
FK="$BC:10:1 $MT:2.5:1 $PLL:8:1"
b stump_rubble rubble_pile "" "$BC@14" "$PL@20" "$PLL@30" "$PLL@40" "$MT@52" "$MT@65"
for i in 1 2 3; do FK="$PL:30:5 $BC:14:1:6:70 $PLL:12:1:5:10 $MT:2:1"; b "stump_bit_$i" "rubble_$i" "" "$BC@12" "$PL@19" "$PL@24" "$PLL@28" "$PLL@65"; done
FK="$HP:1.5:1 $MT:0.4:1 $JD:6:1:6:40"
b vines thorns "" "$BC@13" "$DT@16" "$DT@22" "$JD@26" "$JD@30" "$DP@34" "$HP@39"
FK="$PLL:3:1 $PL:5:3"
b vines_ash thorns_ash "" "$BC@7" "$BC@10" "$PL@30" "$PLL@40" "$PLL@85"
b up_fern_1 up_tuft_1 "" "$BC@12" "$DT@19" "$DT@30" "$JD@36" "$MT@44"
b up_fern_2 up_tuft_2 "" "$BC@12" "$DT@19" "$DT@30" "$JD@36" "$MT@44"
b ears grass "" "$DT@36" "$JD@46" "$JD@58" "$MT@68" "$MT@78" "$MS@88"
b up_ears up_grass "" "$DT@36" "$JD@46" "$JD@58" "$MT@68" "$MT@78" "$MS@88"
FK="$DT:25:4 $BC:14:1:9:90 $JD:12:1:8:90 $MT:4:1:6:80"
b trunk rockspire "" "$BC@14" "$DT@20" "$DT@27" "$JD@32" "$MT@36"
b pebbles pebbles "" "$JD@13" "$MT@22" "$MT@33" "$MS@50"
b litter cracks "" "#27183F@0" "#27183F@100"

# flowers: a sheet of four blooms (pink, lilac, yellow, white). Each cell is recoloured on its own: stems (the green
# hues) go teal, the bloom goes pink / mint / lime / mist. Grid and alpha are exactly the desert sheet's.
bloomsheet() { # name src cols rows
  local n=$1 src=$2 cols=$3 rows=$4 w h cw ch i=0 x y
  local -a cells=()
  override "$n" $(magick identify -format '%w %h' "$SPR/$src.png") && return 0
  read -r w h <<< "$(magick identify -format '%w %h' "$SPR/$src.png")"
  cw=$((w / cols)); ch=$((h / rows))
  local rampc=("$DP@25 $HP@50 $HP@72 $MS@92" "$JD@35 $MT@55 $MT@75 $MS@92" "$MT@45 $LM@68 $LM@100" "$MT@40 $MS@70 $MS@100")
  for ((y = 0; y < rows; y++)); do for ((x = 0; x < cols; x++)); do
    magick "$SPR/$src.png" -crop "${cw}x${ch}+$((x * cw))+$((y * ch))" +repage "$TMP/c.png"
    # shellcheck disable=SC2086
    gmap "$TMP/c.png" "$TMP/bloom.png" "" ${rampc[$((i % 4))]}
    gmap "$TMP/c.png" "$TMP/stem.png" "" "$DT@10" "$DT@30" "$JD@45"
    magick "$TMP/c.png" -alpha off -colorspace HSL -fx 'r>0.17&&r<0.45&&g>0.3?1:0' -set colorspace Gray -blur 0x0.5 -colorspace Gray "$TMP/stemmask.png"
    magick "$TMP/bloom.png" \( "$TMP/stem.png" -alpha off "$TMP/stemmask.png" -compose CopyOpacity -composite \) -compose Over -composite \
      \( "$TMP/c.png" -alpha extract \) -compose CopyOpacity -composite "$TMP/cell_$i.png"
    cells+=("$TMP/cell_$i.png"); i=$((i + 1))
  done; done
  # lay the cells back in the same grid
  local args=(-size "${w}x${h}" xc:none) k=0
  for ((y = 0; y < rows; y++)); do for ((x = 0; x < cols; x++)); do
    args+=("${cells[$k]}" -geometry "+$((x * cw))+$((y * ch))" -compose Copy -composite); k=$((k + 1))
  done; done
  magick "${args[@]}" "$TMP/$n.png"
  finish "$TMP/$n.png" "$n"
}
bloomsheet flowers flowers 2 2
bloomsheet up_flowers up_flowers 4 1

# burrows: plum and blackcurrant earth; the gold lizard and star (the viper gold) are kept exactly as drawn.
# A few firefly dots round the rim, teal root strokes.
burrow() { # name
  local n=$1
  override "$n" 200 200 && return 0
  gmap "$SPR/$n.png" "$TMP/$n.png" "-posterize 7" "$BC@7" "$BC@13" "$PL@18" "$PL@24" "$PLL@27"
  flecks "$TMP/$n.png" "$DT" 4 2 11 14 35
  flecks "$TMP/$n.png" "$DT" 2 1 17 12 120
  flecks "$TMP/$n.png" "$PLL" 5 1 19 5 0
  # rim band: opaque, but not within 14px of the middle
  magick "$TMP/$n.png" -alpha extract -morphology Erode Disk:12 "$TMP/inner.png"
  magick "$TMP/$n.png" -alpha extract "$TMP/inner.png" -compose Minus -composite "$TMP/rim.png"
  magick -seed 23 -size 200x200 xc:gray +noise Random -colorspace Gray -blur 0x0.8 -contrast-stretch 0.3%x0.3% -threshold 99.3% \
    "$TMP/rim.png" -compose Multiply -composite "$TMP/limemask.png"
  magick "$TMP/$n.png" \( -size 200x200 "xc:$LM" "$TMP/limemask.png" -compose CopyOpacity -composite \) -compose Over -composite \
    \( "$SPR/$n.png" -alpha extract \) -compose CopyOpacity -composite "$TMP/$n.png"
  if [ "$n" != burrow ]; then
    magick "$SPR/$n.png" -alpha off -grayscale Rec709Luma -colorspace Gray -threshold 34% -morphology Close Disk:2 -blur 0x0.5 -colorspace Gray "$TMP/gold.png"
    magick "$TMP/$n.png" \( "$SPR/$n.png" -alpha off "$TMP/gold.png" -compose CopyOpacity -composite \) -compose Over -composite \
      \( "$SPR/$n.png" -alpha extract \) -compose CopyOpacity -composite "$TMP/$n.png"
  fi
  finish "$TMP/$n.png" "$n"
}
burrow burrow; burrow burrow_start; burrow burrow_exit

# nest icons for the map editor: the recoloured empty nest with the desert's power egg in the middle (colours unchanged)
for k in thunder ghost chili rattle; do
  override "nest_$k" 200 200 && continue
  magick "$OUT/nest_empty.png" \( "$SPR/egg_$k.png" -resize 96x120 \) -gravity center -composite -strip -depth 8 "$OUT/nest_$k.png"
done

# ========================================================================================================
# C. creatures (the designer's stand-ins, NOT recoloured), cut into the desert sprites' layouts.
#    All the desert's creatures face up the image (north), so these do too.
# ========================================================================================================
# trimmed <name>: the stand-in with its empty margin cut off
trimmed() { magick "$ART/src/$1.png" -background none -alpha on -trim +repage "$TMP/$1.trim.png"; }

# coati: 4 identical frames of 200x400 side by side, like the roadrunner's strip; the animal fitted and centred
if ! override coati 800 400; then
  trimmed coati
  magick "$TMP/coati.trim.png" -background none -resize 184x384 -gravity center -extent 200x400 +repage "$TMP/coati1.png"
  magick "$TMP/coati1.png" "$TMP/coati1.png" "$TMP/coati1.png" "$TMP/coati1.png" +append +repage "$TMP/coati.png"
  finish "$TMP/coati.png" coati
fi

# spider and viper: top-down, fitted in 400x400
for pair in "spider bird_eating_spider" "viper eyelash_viper"; do
  read -r out src <<< "$pair"
  override "$out" 400 400 && continue
  trimmed "$src"
  magick "$TMP/$src.trim.png" -background none -resize 388x388 -gravity center -extent 400x400 +repage "$TMP/$out.png"
  finish "$TMP/$out.png" "$out"
done

# beetle: two 128x128 frames like the desert's, walking legs swapped by mirroring the second frame
if ! override beetle 256 128; then
  trimmed jewel_beetle
  magick "$TMP/jewel_beetle.trim.png" -background none -resize 116x122 -gravity center -extent 128x128 +repage "$TMP/bt1.png"
  magick "$TMP/bt1.png" -flop "$TMP/bt2.png"
  magick "$TMP/bt1.png" "$TMP/bt2.png" +append +repage "$TMP/beetle.png"
  finish "$TMP/beetle.png" beetle
fi

# butterfly: frame 1 wings open, frame 2 wings half closed (the same picture squeezed to 52% width), 128x128 each
if ! override butterfly 256 128; then
  trimmed morpho_butterfly
  magick "$TMP/morpho_butterfly.trim.png" -background none -resize 124x110 -gravity center -extent 128x128 +repage "$TMP/bf1.png"
  magick "$TMP/morpho_butterfly.trim.png" -background none -resize 124x110 -resize 52%x100% -gravity center -extent 128x128 +repage "$TMP/bf2.png"
  magick "$TMP/bf1.png" "$TMP/bf2.png" +append +repage "$TMP/butterfly.png"
  finish "$TMP/butterfly.png" butterfly
fi

# ant: 128x128
if ! override ant 128 128; then
  trimmed leafcutter_ant
  magick "$TMP/leafcutter_ant.trim.png" -background none -resize 120x120 -gravity center -extent 128x128 +repage "$TMP/ant.png"
  finish "$TMP/ant.png" ant
fi

# ========================================================================================================
# D. drawn stand-ins: art/rainforest/placeholder/<name>.svg (edit them, or run make_placeholders.py to redraw them all)
# ========================================================================================================
while read -r n w h; do
  override "$n" "$w" "$h" && continue
  rsvg-convert -w "$w" -h "$h" "$ART/placeholder/$n.svg" -o "$TMP/$n.png"
  finish "$TMP/$n.png" "$n"
done <<'LIST'
up_trunk 256 512
log 600 200
hollow_log 600 200
log_mouth 256 256
spider_legs 256 256
coati_tail 128 256
up_far_1 1024 400
up_far_2 1024 400
up_far_3 1024 400
up_heliconia 256 512
heliconia 200 200
bromeliad 200 200
up_bromeliad 256 200
fungi 200 200
puddle 256 256
LIST

# --- the viper in two pieces (the coil on its flower, and the head and neck that sweep and strike), and pieces
# only the designer draws. Without a drawing of its own the coil is the whole snake and the head is nothing.
override viper_coil 400 400 || cp "$OUT/viper.png" "$OUT/viper_coil.png"
override viper_head 200 400 || magick -size 200x400 xc:none "$OUT/viper_head.png"
override up_buttress 256 320 || true
override up_liana 256 512 || true

# --- water: a tile of deep water the game lays over the streams, and pebbles under thin water for the fords. They
# are also what the water is painted with in Tiled, with a third plain tile for the bank that floods.
override water 256 256 || magick -size 256x256 xc:'#0C4A50' -fill '#1E8C7B' -draw 'rectangle 20,60 120,72 rectangle 90,130 180,142' "$OUT/water.png"
override ford 200 200 || magick -size 200x200 xc:'#1E8C7B' -fill '#D9F5E6' -draw 'circle 50,60 50,84 circle 130,90 130,118 circle 80,150 80,170 circle 160,160 160,176' "$OUT/ford.png"
magick -size 200x200 xc:'#5A3A6E' -fill '#0C4A50' -draw 'rectangle 0,0 200,24 rectangle 0,176 200,200' -fill '#1E8C7B' -draw 'rectangle 40,90 160,102' "$OUT/flood.png"

# --- the canopy (a proposal, built to try it out): the designer's pieces as they are, then the map tiles made
# from them. The game knows a tile by its file name, so a bough lying east to west is its own picture for Tiled.
while read -r n w h; do
  override "$n" "$w" "$h" || echo "  no drawing yet for $n" >&2
done <<'LIST'
canopy_floor 512 512
floor_below 512 512
spray_1 280 240
spray_2 280 240
spray_3 280 240
spray_4 280 240
up_spray_1 280 260
up_spray_2 280 260
up_hollow_giant 512 1024
hollow_door 200 200
door_glow 400 400
bough 200 200
bough_fork 200 200
bough_tip 200 200
leaf_clump_1 200 200
leaf_clump_2 200 200
leaf_clump_3 200 200
knothole 200 200
LIST
if [ -f "$OUT/bough.png" ]; then
  magick "$OUT/canopy_floor.png" -resize 200x200 "$OUT/mat.png"
  magick "$OUT/floor_below.png" -resize 200x200 "$OUT/gap.png"
  cp "$OUT/bough.png" "$OUT/bough_ns.png"
  magick "$OUT/bough.png" -rotate 90 "$OUT/bough_ew.png"
  # a fork is named for the way its stem points, a tip for the way it points (as drawn: stem south, tip north)
  cp "$OUT/bough_fork.png" "$OUT/fork_s.png"
  magick "$OUT/bough_fork.png" -rotate 90 "$OUT/fork_w.png"
  magick "$OUT/bough_fork.png" -rotate 180 "$OUT/fork_n.png"
  magick "$OUT/bough_fork.png" -rotate 270 "$OUT/fork_e.png"
  cp "$OUT/bough_tip.png" "$OUT/tip_n.png"
  magick "$OUT/bough_tip.png" -rotate 90 "$OUT/tip_e.png"
  magick "$OUT/bough_tip.png" -rotate 180 "$OUT/tip_s.png"
  magick "$OUT/bough_tip.png" -rotate 270 "$OUT/tip_w.png"
  # the foot of the hollow tree, and the ground between the forest floor and the canopy's corner of the map
  magick -size 200x200 xc:'#0C4A50' -fill '#082F3A' -draw 'circle 100,100 100,20' "$OUT/giant.png"
  magick -size 200x200 xc:'#1A1030' "$OUT/beyond.png"
fi

echo "rainforest sprites:"
magick identify -format '  %f %wx%h\n' "$OUT"/*.png

[ "$MODE" = "sheet" ] || exit 0

# --- contact sheet: everything on the forest floor colour, labelled
mkdir -p "$SHOTS"
cells=()
for f in "$OUT"/*.png; do
  n=$(basename "$f" .png)
  magick "$f" -background none -resize 256x256 -gravity center -extent 256x256 \
    -background "$PL" -alpha remove -alpha off \
    -gravity south -fill "$MS" -pointsize 14 -annotate +0+3 "$n" "$TMP/cell_$n.png" 2>/dev/null || \
  magick "$f" -background none -resize 256x256 -gravity center -extent 256x256 -background "$PL" -alpha remove -alpha off "$TMP/cell_$n.png"
  cells+=("$TMP/cell_$n.png")
done
magick montage "${cells[@]}" -background "$PL" -tile 8x -geometry +4+4 "$SHOTS/rainforest-sprites.png"
echo "wrote $SHOTS/rainforest-sprites.png"
