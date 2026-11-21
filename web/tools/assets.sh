#!/bin/bash
# Build the web game's textures from the family's hand-drawn art in ../sprites (the DragonRuby originals).
# Nothing is redrawn: frames are packed into sheets, borders trimmed, and big art resized for the GPU.
# Needs ImageMagick (magick). Run from anywhere: `npm run assets`.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../sprites
OUT=public/sprites
mkdir -p "$OUT" public/fonts

# --- the lizard: two walk frames side by side (400x200)
magick "$SRC/yellow_lizzie_0.png" "$SRC/yellow_lizzie_1.png" +append "$OUT/lizard.png"

# --- roadrunner: four run frames (800x400)
magick "$SRC/roadrunner_0.png" "$SRC/roadrunner_1.png" "$SRC/roadrunner_2.png" "$SRC/roadrunner_3.png" +append "$OUT/roadrunner.png"

# --- scorpion: four snap frames, each cut from the 1663px strip and halved (832x210)
frames=()
for i in 0 1 2 3; do
  magick "$SRC/scorpion.png" -crop "416x421+$((i * 416))+0" +repage -background none -extent 416x421 -resize 208x210! "/tmp/et_scorp_$i.png"
  frames+=("/tmp/et_scorp_$i.png")
done
magick "${frames[@]}" +append "$OUT/scorpion.png"
rm -f "${frames[@]}"

# --- birds
cp "$SRC/hawk_centre.png" "$OUT/hawk_centre.png"
cp "$SRC/hawk_left.png" "$OUT/hawk_left.png"
cp "$SRC/hawk_right.png" "$OUT/hawk_right.png"
cp "$SRC/owl_centre.png" "$OUT/owl.png"

# --- ground: trim the drawn border so tiles meet without a grid line
magick "$SRC/tile_floor.png" -shave 2x2 +repage "$OUT/scrub.png"
magick "$SRC/floortile_large.png" -shave 8x8 +repage -resize 512x512! "$OUT/sand.png"

# --- things on the ground
cp "$SRC/boulder.png" "$OUT/boulder.png"
for i in 1 2 3 4; do cp "$SRC/tuft_$i.png" "$OUT/tuft_$i.png"; done
for i in 1 2 3; do cp "$SRC/EGG_$i.png" "$OUT/nest_egg_$i.png"; done
cp "$SRC/nest_empty.png" "$OUT/nest_empty.png"
magick "$SRC/nest.png" -resize 400x400 "$OUT/nest_clutch.png"
cp "$SRC/exit.png" "$OUT/burrow.png"

# --- loose eggs (the trail behind the lizard, the HUD): cut from the egg counter strip
for i in 1 2 3; do
  magick "$SRC/egg_counter.png" -crop "74x100+74+$(((i - 1) * 100))" +repage -trim +repage -background none -gravity center -extent 64x80 "$OUT/egg_$i.png"
done
magick "$SRC/egg_counter.png" -crop "74x100+0+0" +repage -trim +repage -background none -gravity center -extent 64x80 "$OUT/egg_shade.png"

# --- UI
cp "$SRC/stars.png" "$OUT/stars.png"
magick "$SRC/EndLevel_windowBOX.png" -resize 50% "$OUT/popup.png"
magick ../metadata/icon.png -resize 64x64 public/favicon.png
# The picture a phone or tablet puts on its home screen: the thief at a nest. Square and filled to the edges (each
# system cuts its own corners off).
magick -size 1024x1024 radial-gradient:'#9a8a45'-'#4a3f17' \
  \( "$SRC/EGG_2.png" -trim +repage -resize 430x430 -background none -rotate -12 \) -gravity northwest -geometry +60+70 -composite \
  \( "$SRC/Lizzie_1000x1000_0.png" -trim +repage -resize 1250x1250 -background none -rotate -42 \) -gravity center -geometry +170+190 -composite \
  -resize 512x512 -depth 8 -strip public/icon-512.png
magick public/icon-512.png -resize 192x192 -strip public/icon-192.png
magick public/icon-512.png -resize 180x180 -strip public/apple-touch-icon.png
cp ../fonts/caroni/Caroni-Regular.otf public/fonts/Caroni-Regular.otf

# --- editor-only tiles, so Tiled shows what a tile is (the game reads them by file name)
magick "$SRC/boulder.png" \( "$SRC/scorpion.png" -crop 416x421+0+0 +repage -resize 150x150 \) -gravity center -composite "$OUT/boulder_scorpion.png"
magick "$SRC/exit.png" \( "$SRC/yellow_lizzie_0.png" -resize 170x170 \) -gravity center -composite "$OUT/burrow_start.png"
magick "$SRC/exit.png" \( "$SRC/stars.png" -crop 100x100+0+0 +repage -resize 96x96 \) -gravity center -composite "$OUT/burrow_exit.png"


# --- editor-only tiles for the newer things. Their game art is drawn by tools/art-items.sh and tools/art-props.sh
#     (run those first: `npm run assets` does). These are just so Tiled shows what a tile is.
for k in thunder ghost chili rattle gold; do
  magick "$OUT/nest_empty.png" \( "$OUT/egg_$k.png" -resize 96x120 \) -gravity center -composite "$OUT/nest_$k.png"
done
magick "$OUT/up_grass.png" -crop 128x256+0+0 +repage -resize 200x200 -background none -gravity south -extent 200x200 "$OUT/grass.png"
for k in cactus_1 cactus_2 cactus_3 agave deadtree rockspire; do
  magick "$OUT/up_$k.png" -resize 200x200 -background none -gravity south -extent 200x200 "$OUT/$k.png"
done

echo "sprites:"; magick identify -format '  %f %wx%h\n' "$OUT"/*.png
