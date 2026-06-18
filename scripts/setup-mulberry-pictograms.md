# Setting up Mulberry pictograms for RoutineStars

Migration 026 swaps every built-in step's `illustration_url` from
ARASAAC to a Mulberry symbol hosted on **our** Supabase Storage bucket.
This is a ~15-minute one-time operator setup.

The reason for self-hosting (vs pointing at a third-party CDN) is
reliability — Mulberry is CC-BY-SA 4.0 and we want guaranteed
availability, not subject to a partner URL changing.

## Step 1 — Create the bucket (Supabase Dashboard)

1. Dashboard → **Storage** → **New bucket**
2. Name: `pictograms`
3. Public: **on** (so the URLs in migration 026 are readable without auth)
4. File size limit: 1 MB (Mulberry PNGs are ~20-60 KB each)
5. Allowed MIME types: `image/png` (optional but tidy)
6. Click **Create bucket**

## Step 2 — Get the Mulberry symbol library

The official source is the Mulberry Symbols GitHub repo. Clone it locally:

```bash
git clone --depth 1 https://github.com/mulberrysymbols/mulberry-symbols.git
cd mulberry-symbols
ls EN-symbols/ | head  # confirm you see .svg files
```

## Step 3 — Convert SVGs to PNG and rename to match migration 026

Migration 026 references these slugs in the bucket (74 unique filenames —
some slugs are reused across multiple steps):

```
activity bag_away bags bed bedroom bench bowl breakfast brush_teeth bus
carry_bag cereal check_work checklist checkout clear_table clothes coat
come_here curtains desk dinner eat feet_floor find_items fold_clothes
hang_coat home homework look milk mirror napkin night_light open_eyes
pack_away pack_bags park pencils put_away pyjamas pyjamas_off ready rinse
safety school_bag set_table shoes shoes_off shop shopping_list sit_table
sit_up sleep snack socks stand_up toilet toothbrush toothpaste top toy
trousers uniform_off walk walk_home wash_face wash_hands wait well_done
wet_brush write
```

The actual filenames in Mulberry's GitHub repo use different names (e.g.
`tooth_brush.svg` instead of `toothbrush.svg`, or `clean_teeth.svg`
instead of `brush_teeth.svg`). The simplest approach is to manually map
+ convert with the snippet below.

### Quick Node.js converter

In the project root:

```bash
npm install --no-save sharp
```

Save this as `scripts/convert-mulberry.mjs`:

```js
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// path to the Mulberry repo you cloned in step 2
const SRC = '/absolute/path/to/mulberry-symbols/EN-symbols';
// where to put the renamed PNGs (created if missing)
const OUT = './mulberry-renamed';

// Migration 026 slug -> the Mulberry SVG filename (without .svg).
// Edit any rows where Mulberry's name differs — `ls ${SRC}` to discover.
const MAP = {
  activity: 'activity',
  bag_away: 'bag',
  bags: 'bag',
  bed: 'bed',
  bedroom: 'bedroom',
  bench: 'bench',
  bowl: 'bowl',
  breakfast: 'breakfast',
  brush_teeth: 'clean_teeth',
  bus: 'bus',
  carry_bag: 'bag',
  cereal: 'cereal',
  check_work: 'check',
  checklist: 'list',
  checkout: 'till',
  clear_table: 'clear_table',
  clothes: 'clothes',
  coat: 'coat',
  come_here: 'come',
  curtains: 'curtains',
  desk: 'desk',
  dinner: 'dinner',
  eat: 'eat',
  feet_floor: 'feet',
  find_items: 'find',
  fold_clothes: 'fold',
  hang_coat: 'hang_coat',
  home: 'home',
  homework: 'homework',
  look: 'look',
  milk: 'milk',
  mirror: 'mirror',
  napkin: 'napkin',
  night_light: 'lamp',
  open_eyes: 'eyes',
  pack_away: 'tidy',
  pack_bags: 'bag',
  park: 'park',
  pencils: 'pencil',
  put_away: 'tidy',
  pyjamas: 'pyjamas',
  pyjamas_off: 'pyjamas',
  ready: 'ready',
  rinse: 'rinse',
  safety: 'safe',
  school_bag: 'school_bag',
  set_table: 'set_table',
  shoes: 'shoes',
  shoes_off: 'shoes',
  shop: 'shop',
  shopping_list: 'shopping_list',
  sit_table: 'sit',
  sit_up: 'sit',
  sleep: 'sleep',
  snack: 'snack',
  socks: 'socks',
  stand_up: 'stand',
  toilet: 'toilet',
  toothbrush: 'toothbrush',
  toothpaste: 'toothpaste',
  top: 't_shirt',
  toy: 'toy',
  trousers: 'trousers',
  uniform_off: 'uniform',
  walk: 'walk',
  walk_home: 'walk',
  wash_face: 'wash_face',
  wash_hands: 'wash_hands',
  wait: 'wait',
  well_done: 'well_done',
  wet_brush: 'toothbrush',
  write: 'write',
};

fs.mkdirSync(OUT, { recursive: true });

for (const [outSlug, mulberryName] of Object.entries(MAP)) {
  const src = path.join(SRC, `${mulberryName}.svg`);
  const dst = path.join(OUT, `${outSlug}.png`);
  if (!fs.existsSync(src)) {
    console.warn(`MISSING: ${src} -> skipping ${outSlug}`);
    continue;
  }
  await sharp(src, { density: 300 })
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(dst);
  console.log(`${outSlug}.png`);
}
```

Run it:

```bash
node scripts/convert-mulberry.mjs
ls mulberry-renamed/ | wc -l   # should be ~74
```

Anything that prints `MISSING:` means Mulberry uses a different name for
that concept than my guess — open the `MAP` and find the right filename
by `ls`ing the EN-symbols folder, then re-run.

## Step 4 — Upload to Supabase Storage

Two options.

### Option A — Dashboard upload (simplest)

1. Dashboard → Storage → `pictograms` → enter the bucket
2. Click **Create folder** → name `mulberry`
3. Open the `mulberry` folder
4. Drag-and-drop every file from `mulberry-renamed/` into the folder
5. Confirm 74 uploads succeeded

### Option B — Supabase CLI (faster if you'll re-do this)

```bash
# from the project root
for f in mulberry-renamed/*.png; do
  supabase storage cp "$f" "pictograms/mulberry/$(basename "$f")" --linked
done
```

## Step 5 — Apply migration 026

Dashboard → SQL Editor → paste `supabase/migrations/026_mulberry_pictograms.sql` → Run.

86 `UPDATE` statements affecting 1 row each → "Success. No rows returned."

## Step 6 — Verify

In the parent app, scroll through any built-in activity set's steps —
illustrations should now all share the same line+colour style. If any
step shows the emoji fallback instead, the corresponding `.png` is
missing from the bucket — re-run step 3-4 with the right Mulberry slug.

## Step 7 — Compliance

Mulberry Symbols are licensed **CC-BY-SA 4.0**. Add this credit
somewhere in your app (Settings → About is conventional):

> Pictograms by **Mulberry Symbols** (Garrett Brick, Paxtoncrafts
> Charitable Trust), used under **CC-BY-SA 4.0**. The Mulberry SVG
> source is available at github.com/mulberrysymbols/mulberry-symbols.

If you make derivatives (you tint or modify them), the derivatives must
ship under the same CC-BY-SA 4.0 licence. Direct upload + display does
not count as modification.

## Reverting

If you ever want to roll back to the ARASAAC URLs, re-run migration 013.
That's idempotent (it just sets `illustration_url` on the same rows).
