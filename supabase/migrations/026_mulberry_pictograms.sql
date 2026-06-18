-- ============================================================
-- Migration 026 — Swap ARASAAC pictograms for Mulberry Symbols.
--
-- Phase 5 / Sprint 6.
--
-- ARASAAC is an aggregated library spanning multiple artists, eras,
-- and design conventions. The URLs we use don't filter by style, so
-- different steps in the same set looked visually inconsistent —
-- some flat colour, some 3D-ish renders, some line drawings. For SEN
-- children who rely on visual consistency for recognition, that's a
-- meaningful UX problem.
--
-- Mulberry Symbols (CC-BY-SA 4.0, ~3,300 symbols, single artist,
-- single line-and-colour style) is the standard fix. We self-host
-- the PNG variants in a Supabase Storage bucket so we control the CDN
-- and aren't subject to a third-party URL change.
--
-- This migration updates 86 step illustration_urls across the 14
-- built-in activity sets. StepCard already falls back to the step's
-- emoji if an Image fails to load, so the migration is safe to apply
-- BEFORE the bucket is populated — steps just render emoji until the
-- PNGs are uploaded.
--
-- OPERATOR ACTION (one-time):
--   1. Supabase Dashboard → Storage → New bucket → name 'pictograms',
--      public read.
--   2. Inside 'pictograms', create a folder 'mulberry'.
--   3. Use scripts/setup-mulberry-pictograms.md to download the
--      Mulberry PNG variants and upload them to that folder. The
--      script names files using the exact slugs referenced below.
-- ============================================================

-- URL template: https://<project>.supabase.co/storage/v1/object/public/pictograms/mulberry/<slug>.png
-- Hardcoded to this project's ref for simplicity. To deploy elsewhere
-- update the prefix or wrap in a function. Storage URL pattern is
-- stable per Supabase docs.

-- ── SET 1 — Waking Up ────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/open_eyes.png'    WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/sit_up.png'        WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/feet_floor.png'    WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/stand_up.png'      WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/curtains.png'      WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 5;

-- ── SET 2 — Brushing Teeth ───────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/toothbrush.png'    WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/toothpaste.png'    WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wet_brush.png'     WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/brush_teeth.png'   WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/rinse.png'         WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/put_away.png'      WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 6;

-- ── SET 3 — Getting Dressed ──────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/clothes.png'       WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pyjamas_off.png'   WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/top.png'           WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/trousers.png'      WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/socks.png'         WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes.png'         WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 6;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/mirror.png'        WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 7;

-- ── SET 4 — Breakfast ────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wash_hands.png'    WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bowl.png'          WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/cereal.png'        WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/milk.png'          WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/breakfast.png'     WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 5;

-- ── SET 5 — Leaving for School ───────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/school_bag.png'    WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes.png'         WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/coat.png'          WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/carry_bag.png'     WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/checklist.png'     WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wait.png'          WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 6;

-- ── SET 6 — After School ─────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes_off.png'     WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/hang_coat.png'     WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bag_away.png'      WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/snack.png'         WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 4;

-- ── SET 7 — Change Clothes ───────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bedroom.png'       WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes_off.png'     WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/uniform_off.png'   WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/clothes.png'       WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/fold_clothes.png'  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 5;

-- ── SET 8 — Lunch ────────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wash_hands.png'    WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/sit_table.png'     WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/eat.png'           WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/napkin.png'        WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/clear_table.png'   WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 5;

-- ── SET 9 — Homework ─────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/homework.png'      WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/desk.png'          WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pencils.png'       WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/write.png'         WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/check_work.png'    WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pack_away.png'     WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 6;

-- ── SET 10 — Dinner ──────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wash_hands.png'    WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/set_table.png'     WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/sit_table.png'     WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/dinner.png'        WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/clear_table.png'   WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 5;

-- ── SET 11 — Bedtime ─────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pyjamas.png'       WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/wash_face.png'     WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/brush_teeth.png'   WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/toilet.png'        WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pyjamas.png'       WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bed.png'           WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 6;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/night_light.png'   WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 7;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/sleep.png'         WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 8;

-- ── SET 12 — Park ────────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes.png'         WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/coat.png'          WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/toy.png'           WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/walk.png'          WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/park.png'          WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/come_here.png'     WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 6;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/walk_home.png'     WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 7;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shoes_off.png'     WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 8;

-- ── SET 13 — Shopping ────────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bags.png'          WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shopping_list.png' WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/shop.png'          WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/find_items.png'    WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/checkout.png'      WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/pack_bags.png'     WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 6;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/walk_home.png'     WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 7;

-- ── SET 14 — Town Trip ───────────────────────────────────────────────────────

UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/ready.png'         WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 1;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bus.png'           WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 2;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/safety.png'        WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 3;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/look.png'          WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 4;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/bench.png'         WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 5;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/snack.png'         WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 6;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/activity.png'      WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 7;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/home.png'          WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 8;
UPDATE public.steps SET illustration_url = 'https://ujzsteariqmqizzraccw.supabase.co/storage/v1/object/public/pictograms/mulberry/well_done.png'     WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 9;
