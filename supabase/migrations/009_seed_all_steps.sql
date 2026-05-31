-- ============================================================
-- Migration 009: Seed default steps for all remaining activity sets
-- Autism / ADHD friendly — simple language, concrete actions,
-- broken into small achievable steps with positive framing.
-- Sets already seeded in 003: Brushing Teeth, Waking Up, Getting Dressed.
-- ============================================================

-- ============================================================
-- BREAKFAST SET (set 4) — 5 steps, ~20 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000004'::uuid, 1, 'Wash Your Hands',    'Wash your hands with soap and warm water before eating', 30, 1),
  ('00000000-0000-0000-0000-000000000004'::uuid, 2, 'Get Your Bowl',      'Pick up a bowl and a spoon from the cupboard',           20, 1),
  ('00000000-0000-0000-0000-000000000004'::uuid, 3, 'Pour Your Cereal',   'Pour your cereal carefully into the bowl — not too much!', 30, 1),
  ('00000000-0000-0000-0000-000000000004'::uuid, 4, 'Add Your Milk',      'Pour milk slowly over the cereal',                      20, 1),
  ('00000000-0000-0000-0000-000000000004'::uuid, 5, 'Eat Your Breakfast', 'Sit down and eat your breakfast — good job eating well!', 900, 2)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000004'
);

-- ============================================================
-- GETTING READY FOR SCHOOL SET (set 5) — 6 steps, ~10 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000005'::uuid, 1, 'Pack Your Bag',          'Check your bag has your books, lunch, and water bottle', 60, 1),
  ('00000000-0000-0000-0000-000000000005'::uuid, 2, 'Put On Your Shoes',      'Sit down and put on both shoes — fasten them up!',       45, 1),
  ('00000000-0000-0000-0000-000000000005'::uuid, 3, 'Put On Your Coat',       'Put your coat on and zip or button it up',               30, 1),
  ('00000000-0000-0000-0000-000000000005'::uuid, 4, 'Pick Up Your Bag',       'Put your bag on your back',                              15, 1),
  ('00000000-0000-0000-0000-000000000005'::uuid, 5, 'Do a Final Check',       'Bag? Shoes? Coat? Check each one — tick them off!',      30, 1),
  ('00000000-0000-0000-0000-000000000005'::uuid, 6, 'Wait at the Door',       'Stand by the door — you are ready and doing amazingly!', 20, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000005'
);

-- ============================================================
-- AFTER-SCHOOL SET (set 6) — 4 steps, ~15 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000006'::uuid, 1, 'Take Off Your Shoes', 'Sit down and take off your shoes',                       30, 1),
  ('00000000-0000-0000-0000-000000000006'::uuid, 2, 'Hang Up Your Coat',   'Hang your coat on your hook',                            20, 1),
  ('00000000-0000-0000-0000-000000000006'::uuid, 3, 'Put Your Bag Away',   'Put your bag in its special place',                      20, 1),
  ('00000000-0000-0000-0000-000000000006'::uuid, 4, 'Snack and Rest',      'Get your snack and have a quiet rest — you earned it!', 600, 2)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000006'
);

-- ============================================================
-- CHANGING OUT OF SCHOOL CLOTHES (set 7) — 5 steps, ~10 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000007'::uuid, 1, 'Go to Your Room',        'Walk to your bedroom',                                  15, 1),
  ('00000000-0000-0000-0000-000000000007'::uuid, 2, 'Take Off Shoes',         'Sit on the bed and take off your shoes',                 30, 1),
  ('00000000-0000-0000-0000-000000000007'::uuid, 3, 'Take Off School Clothes','Take off your school clothes carefully',                 45, 1),
  ('00000000-0000-0000-0000-000000000007'::uuid, 4, 'Put On Comfy Clothes',   'Put on your cosy clothes or pyjamas',                   60, 1),
  ('00000000-0000-0000-0000-000000000007'::uuid, 5, 'Put Clothes Away',       'Put school clothes in the wash basket or hang them up', 30, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000007'
);

-- ============================================================
-- EATING TEA / LUNCH SET (set 8) — 5 steps, ~25 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000008'::uuid, 1, 'Wash Your Hands', 'Wash your hands before eating',                                    30, 1),
  ('00000000-0000-0000-0000-000000000008'::uuid, 2, 'Sit at the Table', 'Sit down in your chair at the table',                             15, 1),
  ('00000000-0000-0000-0000-000000000008'::uuid, 3, 'Eat Your Meal',    'Eat your food nicely — take small bites and chew well!',         1200, 2),
  ('00000000-0000-0000-0000-000000000008'::uuid, 4, 'Use Your Napkin',  'Wipe your mouth with a napkin or tissue',                         15, 1),
  ('00000000-0000-0000-0000-000000000008'::uuid, 5, 'Clear Your Place', 'Carry your plate and cup carefully to the kitchen sink',           20, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000008'
);

-- ============================================================
-- HOMEWORK / STUDY SET (set 9) — 6 steps, ~45 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000009'::uuid, 1, 'Get Your Homework',  'Find today''s homework in your bag',                               30, 1),
  ('00000000-0000-0000-0000-000000000009'::uuid, 2, 'Tidy Your Desk',     'Clear your desk so it is neat and ready to work',                  30, 1),
  ('00000000-0000-0000-0000-000000000009'::uuid, 3, 'Get Your Pencils',   'Get a pencil, rubber and ruler — line them up neatly!',            20, 1),
  ('00000000-0000-0000-0000-000000000009'::uuid, 4, 'Do Your Homework',   'Work through your homework one question at a time — you can do it!', 1800, 3),
  ('00000000-0000-0000-0000-000000000009'::uuid, 5, 'Check Your Work',    'Read back through what you have done and correct any mistakes',    120, 1),
  ('00000000-0000-0000-0000-000000000009'::uuid, 6, 'Pack It Away',       'Put your homework neatly back in your bag — well done!',           20, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000009'
);

-- ============================================================
-- EATING DINNER SET (set 10) — 5 steps, ~30 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000010'::uuid, 1, 'Wash Your Hands',   'Wash your hands with soap before dinner',                         30, 1),
  ('00000000-0000-0000-0000-000000000010'::uuid, 2, 'Help Set the Table', 'Put out the plates, cups and cutlery — one for each person',     60, 1),
  ('00000000-0000-0000-0000-000000000010'::uuid, 3, 'Sit at the Table',  'Sit in your seat and wait for everyone to be ready',             15, 1),
  ('00000000-0000-0000-0000-000000000010'::uuid, 4, 'Eat Your Dinner',   'Eat your dinner nicely — try a little bit of everything!',      1500, 2),
  ('00000000-0000-0000-0000-000000000010'::uuid, 5, 'Help Clear Up',     'Carry your plate and cup carefully to the kitchen sink',         30, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000010'
);

-- ============================================================
-- WASHING, BRUSHING & BEDTIME (set 11) — 8 steps, ~20 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000011'::uuid, 1, 'Get Your Pyjamas',    'Get your pyjamas from the drawer or under your pillow',   20, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 2, 'Wash Your Face',      'Wash your face and hands with warm water and soap',       90, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 3, 'Brush Your Teeth',    'Brush all your teeth for 2 whole minutes!',              120, 2),
  ('00000000-0000-0000-0000-000000000011'::uuid, 4, 'Use the Toilet',      'Use the toilet before you get into bed',                  90, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 5, 'Put On Pyjamas',      'Put on your pyjama top and then your bottoms',            60, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 6, 'Get Into Bed',        'Climb into bed and pull up the covers — nice and cosy!',  30, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 7, 'Night Light On',      'Turn on your night light if you want one',                15, 1),
  ('00000000-0000-0000-0000-000000000011'::uuid, 8, 'Close Your Eyes',     'Lie still and close your eyes — sweet dreams!',           60, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000011'
);

-- ============================================================
-- GOING TO THE PARK SET (set 12) — 8 steps, ~60 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000012'::uuid, 1, 'Put On Your Shoes',      'Put on shoes good for running and playing',                45, 1),
  ('00000000-0000-0000-0000-000000000012'::uuid, 2, 'Put On Your Coat',       'Put on your coat — it might be windy outside!',            30, 1),
  ('00000000-0000-0000-0000-000000000012'::uuid, 3, 'Grab Something to Play With', 'Pick a ball, frisbee or something fun to bring',      30, 1),
  ('00000000-0000-0000-0000-000000000012'::uuid, 4, 'Walk to the Park',       'Walk safely to the park with your grown-up',             600, 2),
  ('00000000-0000-0000-0000-000000000012'::uuid, 5, 'Play at the Park',       'Have fun! Try the swings, slides or play with your toy', 2400, 3),
  ('00000000-0000-0000-0000-000000000012'::uuid, 6, 'Come When Called',       'When a grown-up calls, stop and walk over to them',        30, 1),
  ('00000000-0000-0000-0000-000000000012'::uuid, 7, 'Walk Home',              'Walk home safely with your grown-up',                    600, 1),
  ('00000000-0000-0000-0000-000000000012'::uuid, 8, 'Take Off Your Shoes',    'Take off your shoes at the door — great day out!',         30, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000012'
);

-- ============================================================
-- GOING TO THE SUPERMARKET SET (set 13) — 7 steps, ~45 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000013'::uuid, 1, 'Get the Bags',       'Get the shopping bags from the hook or cupboard',              20, 1),
  ('00000000-0000-0000-0000-000000000013'::uuid, 2, 'Look at the List',   'Look at the shopping list with your grown-up — what do we need?', 30, 1),
  ('00000000-0000-0000-0000-000000000013'::uuid, 3, 'Walk to the Shop',   'Walk safely to the supermarket with your grown-up',           300, 1),
  ('00000000-0000-0000-0000-000000000013'::uuid, 4, 'Find the Items',     'Help find things on the list — look for the pictures on packets!', 1200, 2),
  ('00000000-0000-0000-0000-000000000013'::uuid, 5, 'Wait at Checkout',   'Stand quietly at the checkout while the grown-up pays',       120, 1),
  ('00000000-0000-0000-0000-000000000013'::uuid, 6, 'Pack the Bags',      'Help put things carefully into the bags',                      60, 1),
  ('00000000-0000-0000-0000-000000000013'::uuid, 7, 'Walk Home',          'Walk home helping to carry one bag — well done helper!',      300, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000013'
);

-- ============================================================
-- GOING TO THE CITY CENTRE SET (set 14) — 9 steps, ~90 min
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000014'::uuid, 1, 'Get Ready to Go',      'Put on shoes, coat and grab your bag',                        120, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 2, 'Travel to Town',       'Travel to the city centre safely with your grown-up',         900, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 3, 'Remember Safety Rules','Hold hands in busy places and stay close to your grown-up',    30, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 4, 'Look Around Together', 'Explore the city — look at the shops, buildings and people', 1800, 2),
  ('00000000-0000-0000-0000-000000000014'::uuid, 5, 'Find a Place to Rest', 'Find a bench or café to sit and take a break',                120, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 6, 'Have a Snack',         'Have your snack or a drink — good job so far!',               300, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 7, 'Do Your Main Activity','Do the main thing you came to town for',                      1800, 2),
  ('00000000-0000-0000-0000-000000000014'::uuid, 8, 'Head Home',            'Make your way to the transport home with your grown-up',       600, 1),
  ('00000000-0000-0000-0000-000000000014'::uuid, 9, 'You Did It!',          'Amazing — you had a great trip to town! So proud of you!',     30, 1)
) AS v(set_id, order_index, title, instruction_text, duration_seconds, reward_stars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.steps WHERE set_id = '00000000-0000-0000-0000-000000000014'
);
