-- ============================================================
-- RoutineStars — Migration 003: Seed Data
-- Default activity sets + steps from Section 10 of the UML spec.
-- Default rewards/badges from Section 9.2.
-- ============================================================

-- ============================================================
-- DEFAULT ACTIVITY SETS
-- ============================================================
INSERT INTO public.activity_sets (set_id, set_name, category, icon_emoji, colour_theme, total_duration_mins, requires_approval, is_custom) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Waking Up Set',                 'MORNING',   '☀️',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000002', 'Brushing Teeth Set',            'MORNING',   '🦷',  'child.sky',    5, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000003', 'Getting Dressed Set',           'MORNING',   '👕',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000004', 'Breakfast Set',                 'MORNING',   '🥣',  'accent.star', 20, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000005', 'Getting Ready for School Set',  'SCHOOL',    '🎒',  'brand.primary',10, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000006', 'After-School Set',              'AFTERNOON', '🏠',  'child.sky',   15, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000007', 'Changing Out of School Clothes','AFTERNOON', '👔',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000008', 'Eating Tea / Lunch Set',        'AFTERNOON', '🍽️', 'accent.star', 25, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000009', 'Homework / Study Set',          'AFTERNOON', '📚',  'brand.primary',45, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000010', 'Eating Dinner Set',             'EVENING',   '🍴',  'accent.star', 30, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000011', 'Washing, Brushing & Bedtime',   'EVENING',   '🌙',  'brand.dark',  20, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000012', 'Going to the Park Set',         'WEEKEND',   '🌳',  'accent.success',60, TRUE, FALSE),
  ('00000000-0000-0000-0000-000000000013', 'Going to the Supermarket Set',  'WEEKEND',   '🛒',  'child.sky',   45, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000014', 'Going to the City Centre Set',  'WEEKEND',   '🏙️', 'child.rose',  90, TRUE,  FALSE);

-- ============================================================
-- BRUSHING TEETH SET — Full step specification (Section 10.3)
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000002', 1, 'Get Your Toothbrush', 'Pick up your toothbrush from the holder', 20, 1),
  ('00000000-0000-0000-0000-000000000002', 2, 'Put On Toothpaste',   'Squeeze a pea-sized blob of toothpaste',  20, 1),
  ('00000000-0000-0000-0000-000000000002', 3, 'Wet Your Brush',      'Turn on the tap and wet your brush',       10, 1),
  ('00000000-0000-0000-0000-000000000002', 4, 'Brush Your Teeth',    'Brush in circles for 2 whole minutes!',   120, 2),
  ('00000000-0000-0000-0000-000000000002', 5, 'Spit and Rinse',      'Spit out, then swish clean water around',  20, 1),
  ('00000000-0000-0000-0000-000000000002', 6, 'Put Brush Away',      'Rinse your brush and put it back in the holder', 15, 1);

-- ============================================================
-- WAKING UP SET
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'Open Your Eyes',       'Time to wake up! Open your eyes slowly',       30, 1),
  ('00000000-0000-0000-0000-000000000001', 2, 'Sit Up in Bed',        'Push yourself up and sit on the edge of the bed', 30, 1),
  ('00000000-0000-0000-0000-000000000001', 3, 'Put Feet on the Floor','Place both feet flat on the floor',             20, 1),
  ('00000000-0000-0000-0000-000000000001', 4, 'Stand Up',             'Push yourself up to standing — great job!',     20, 1),
  ('00000000-0000-0000-0000-000000000001', 5, 'Open the Curtains',    'Walk to the window and open the curtains',      30, 1);

-- ============================================================
-- GETTING DRESSED SET
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 'Get Your Clothes',     'Pick up the clothes laid out for today',        30, 1),
  ('00000000-0000-0000-0000-000000000003', 2, 'Take Off Pyjamas',     'Take off your pyjama top',                      30, 1),
  ('00000000-0000-0000-0000-000000000003', 3, 'Put On Your Top',      'Put on your top or shirt',                      45, 1),
  ('00000000-0000-0000-0000-000000000003', 4, 'Put On Your Trousers', 'Put on your trousers or skirt',                 45, 1),
  ('00000000-0000-0000-0000-000000000003', 5, 'Put On Your Socks',    'Put on both socks — check left then right!',    30, 1),
  ('00000000-0000-0000-0000-000000000003', 6, 'Put On Your Shoes',    'Put on your shoes and do the fastenings',       45, 1),
  ('00000000-0000-0000-0000-000000000003', 7, 'Check in the Mirror',  'Have a look in the mirror — looking great!',    20, 1);

-- ============================================================
-- REWARDS / BADGES (Section 9.2)
-- ============================================================
INSERT INTO public.rewards (reward_id, type, name, description, stars_required) VALUES
  ('10000000-0000-0000-0000-000000000001', 'BADGE', 'Sparkling Teeth',      'Complete Brushing Teeth 5 times',                        0),
  ('10000000-0000-0000-0000-000000000002', 'BADGE', 'Early Bird',           'Complete Waking Up + Breakfast sets before 8am',         0),
  ('10000000-0000-0000-0000-000000000003', 'BADGE', 'School Ready Star',    'Complete Getting Ready for School 10 times',              0),
  ('10000000-0000-0000-0000-000000000004', 'BADGE', 'Homework Hero',        'Complete Homework Set 7 days in a row',                   0),
  ('10000000-0000-0000-0000-000000000005', 'BADGE', 'Sleepy Champion',      'Complete Bedtime Set on time for 5 days',                 0),
  ('10000000-0000-0000-0000-000000000006', 'BADGE', 'Park Explorer',        'Complete Going to the Park set',                          0),
  ('10000000-0000-0000-0000-000000000007', 'BADGE', 'Super Shopper',        'Complete Supermarket set',                                0),
  ('10000000-0000-0000-0000-000000000008', 'BADGE', 'City Explorer',        'Complete City Centre set',                                0),
  ('10000000-0000-0000-0000-000000000009', 'BADGE', 'Full Week Champion',   'Complete every scheduled set for a whole week',           0),
  ('10000000-0000-0000-0000-000000000010', 'BADGE', 'Golden Month',         'Achieve Perfect Day 20 times in one month',              0),
  ('10000000-0000-0000-0000-000000000011', 'TROPHY','3-Day Streak',         '3 consecutive days of full completion',                  15),
  ('10000000-0000-0000-0000-000000000012', 'TROPHY','7-Day Super Streak',   '7 consecutive days of full completion',                  50),
  ('10000000-0000-0000-0000-000000000013', 'STAR',  'On-Time Bonus',        'Finish a set within the allocated time window',           0),
  ('10000000-0000-0000-0000-000000000014', 'TROPHY','Perfect Day',          'Complete all scheduled sets in one day',                 20),
  ('10000000-0000-0000-0000-000000000015', 'BADGE', 'Weekend Adventurer',   'Complete a weekend activity set',                         0);
