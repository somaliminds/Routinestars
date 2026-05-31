-- ============================================================
-- Migration 013: ARASAAC pictogram URLs for all 14 built-in activity sets
--
-- Images served directly from ARASAAC CDN — no API key, no runtime dependency.
-- URL format: https://static.arasaac.org/pictograms/{id}/{id}_300.png
--
-- Attribution: ARASAAC (https://arasaac.org)
-- Licence: Creative Commons BY-NC-SA 4.0
-- Used for non-commercial educational / therapeutic purposes only.
--
-- IDs were resolved via api.arasaac.org/api/pictograms/en/search/{keyword}.
-- Pictogram choice: best semantic match available; emoji fallback remains
-- in place inside StepCard for any step whose URL returns 404.
-- ============================================================

-- ── SET 1 — Waking Up Set ────────────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8989/8989_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 1; -- Open Your Eyes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/25900/25900_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 2; -- Sit Up in Bed

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8152/8152_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 3; -- Put Feet on the Floor

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8152/8152_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 4; -- Stand Up

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2357/2357_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000001' AND order_index = 5; -- Open the Curtains

-- ── SET 2 — Brushing Teeth Set ───────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2694/2694_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 1; -- Get Your Toothbrush

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11961/11961_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 2; -- Put On Toothpaste

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/34824/34824_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 3; -- Wet Your Brush

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2326/2326_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 4; -- Brush Your Teeth

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8559/8559_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 5; -- Spit and Rinse

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11963/11963_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000002' AND order_index = 6; -- Put Brush Away

-- ── SET 3 — Getting Dressed Set ──────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6627/6627_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 1; -- Get Your Clothes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11233/11233_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 2; -- Take Off Pyjamas

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/34022/34022_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 3; -- Put On Your Top

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2565/2565_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 4; -- Put On Your Trousers

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2298/2298_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 5; -- Put On Your Socks

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 6; -- Put On Your Shoes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8573/8573_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000003' AND order_index = 7; -- Check in the Mirror

-- ── SET 4 — Breakfast Set ────────────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2443/2443_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 1; -- Wash Your Hands

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3257/3257_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 2; -- Get Your Bowl

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/34749/34749_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 3; -- Pour Your Cereal

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2445/2445_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 4; -- Add Your Milk

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4626/4626_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000004' AND order_index = 5; -- Eat Your Breakfast

-- ── SET 5 — Getting Ready for School Set ────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2475/2475_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 1; -- Pack Your Bag

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 2; -- Put On Your Shoes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2242/2242_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 3; -- Put On Your Coat

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2475/2475_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 4; -- Pick Up Your Bag

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/7144/7144_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 5; -- Do a Final Check

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3244/3244_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000005' AND order_index = 6; -- Wait at the Door

-- ── SET 6 — After-School Set ─────────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 1; -- Take Off Your Shoes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/27731/27731_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 2; -- Hang Up Your Coat

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2475/2475_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 3; -- Put Your Bag Away

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4694/4694_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000006' AND order_index = 4; -- Snack and Rest

-- ── SET 7 — Changing Out of School Clothes ──────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/5988/5988_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 1; -- Go to Your Room

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 2; -- Take Off Shoes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11233/11233_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 3; -- Take Off School Clothes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2522/2522_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 4; -- Put On Comfy Clothes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/22175/22175_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000007' AND order_index = 5; -- Put Clothes Away

-- ── SET 8 — Eating Tea / Lunch Set ──────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2443/2443_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 1; -- Wash Your Hands

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4944/4944_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 2; -- Sit at the Table

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2349/2349_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 3; -- Eat Your Meal

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2569/2569_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 4; -- Use Your Napkin

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2532/2532_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000008' AND order_index = 5; -- Clear Your Place

-- ── SET 9 — Homework / Study Set ────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11228/11228_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 1; -- Get Your Homework

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/36285/36285_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 2; -- Tidy Your Desk

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2440/2440_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 3; -- Get Your Pencils

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/11228/11228_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 4; -- Do Your Homework

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/10312/10312_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 5; -- Check Your Work

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2475/2475_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000009' AND order_index = 6; -- Pack It Away

-- ── SET 10 — Eating Dinner Set ───────────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2443/2443_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 1; -- Wash Your Hands

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3129/3129_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 2; -- Help Set the Table

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4944/4944_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 3; -- Sit at the Table

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2349/2349_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 4; -- Eat Your Dinner

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2532/2532_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000010' AND order_index = 5; -- Help Clear Up

-- ── SET 11 — Washing, Brushing & Bedtime ────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2522/2522_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 1; -- Get Your Pyjamas

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/8975/8975_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 2; -- Wash Your Face

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2326/2326_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 3; -- Brush Your Teeth

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2430/2430_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 4; -- Use the Toilet

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2522/2522_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 5; -- Put On Pyjamas

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6027/6027_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 6; -- Get Into Bed

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4936/4936_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 7; -- Night Light On

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2369/2369_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000011' AND order_index = 8; -- Close Your Eyes

-- ── SET 12 — Going to the Park Set ──────────────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 1; -- Put On Your Shoes

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2242/2242_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 2; -- Put On Your Coat

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3241/3241_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 3; -- Grab Something to Play With

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6044/6044_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 4; -- Walk to the Park

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2859/2859_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 5; -- Play at the Park

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/13024/13024_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 6; -- Come When Called

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6044/6044_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 7; -- Walk Home

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2775/2775_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000012' AND order_index = 8; -- Take Off Your Shoes

-- ── SET 13 — Going to the Supermarket Set ───────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/23849/23849_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 1; -- Get the Bags

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/7144/7144_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 2; -- Look at the List

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6044/6044_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 3; -- Walk to the Shop

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3389/3389_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 4; -- Find the Items

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/9014/9014_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 5; -- Wait at Checkout

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/23849/23849_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 6; -- Pack the Bags

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6044/6044_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000013' AND order_index = 7; -- Walk Home

-- ── SET 14 — Going to the City Centre Set ───────────────────────────────────

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2781/2781_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 1; -- Get Ready to Go

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2704/2704_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 2; -- Travel to Town

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/13024/13024_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 3; -- Remember Safety Rules

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/2704/2704_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 4; -- Look Around Together

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/3255/3255_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 5; -- Find a Place to Rest

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/4694/4694_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 6; -- Have a Snack

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6969/6969_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 7; -- Do Your Main Activity

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6044/6044_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 8; -- Head Home

UPDATE public.steps
  SET illustration_url = 'https://static.arasaac.org/pictograms/6969/6969_300.png'
  WHERE set_id = '00000000-0000-0000-0000-000000000014' AND order_index = 9; -- You Did It!
