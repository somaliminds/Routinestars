/**
 * useChildRewards — Sprint 2.5
 *
 * Fetches:
 *  1. All rewards from the `rewards` table (badges + trophies)
 *  2. Which rewards this child has earned (child_rewards)
 *  3. Child's current total_stars + current_streak from child_profiles
 *
 * Returns a merged list with isEarned flag for the badge grid,
 * plus totalStars and currentStreak for the header meters.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface RewardItem {
  rewardId: string;
  type: 'BADGE' | 'TROPHY' | 'STAR' | 'STREAK_BONUS';
  name: string;
  description: string;
  iconEmoji: string;
  starsRequired: number;
  isEarned: boolean;
  earnedAt: string | null;
}

export interface ChildRewardsData {
  rewards: RewardItem[];
  totalStars: number;
  currentStreak: number;
}

// Static emoji map — reward engine uses names, not icon_url yet
const REWARD_EMOJI: Record<string, string> = {
  'Sparkling Teeth': '🦷',
  'Early Bird': '🌅',
  'School Ready Star': '🎒',
  'Homework Hero': '📚',
  'Sleepy Champion': '😴',
  'Park Explorer': '🌳',
  'Super Shopper': '🛒',
  'City Explorer': '🏙️',
  'Full Week Champion': '🏆',
  'Golden Month': '🌕',
  '3-Day Streak': '🔥',
  '7-Day Super Streak': '🔥🔥',
  'On-Time Bonus': '⚡',
  'Perfect Day': '⭐',
  'Weekend Adventurer': '🎡',
};

async function fetchChildRewards(childId: string): Promise<ChildRewardsData> {
  // 1. All available rewards
  const { data: allRewards, error: rewardsErr } = await supabase
    .from('rewards')
    .select('reward_id, type, name, description, stars_required')
    .order('type')
    .order('name');

  if (rewardsErr) throw rewardsErr;

  // 2. Which rewards the child has earned
  const { data: earned, error: earnedErr } = await supabase
    .from('child_rewards')
    .select('reward_id, earned_at')
    .eq('child_id', childId);

  if (earnedErr) throw earnedErr;

  const earnedMap = new Map((earned ?? []).map((e) => [e.reward_id, e.earned_at as string]));

  // 3. Child's stars + streak
  const { data: profile, error: profileErr } = await supabase
    .from('child_profiles')
    .select('total_stars, current_streak')
    .eq('profile_id', childId)
    .single();

  if (profileErr) throw profileErr;

  const rewards: RewardItem[] = (allRewards ?? []).map((r) => ({
    rewardId: r.reward_id,
    type: r.type as RewardItem['type'],
    name: r.name,
    description: r.description,
    iconEmoji: REWARD_EMOJI[r.name] ?? '🏅',
    starsRequired: r.stars_required,
    isEarned: earnedMap.has(r.reward_id),
    earnedAt: earnedMap.get(r.reward_id) ?? null,
  }));

  // Show earned rewards first, then locked
  rewards.sort((a, b) => {
    if (a.isEarned && !b.isEarned) return -1;
    if (!a.isEarned && b.isEarned) return 1;
    return 0;
  });

  return {
    rewards,
    totalStars: profile?.total_stars ?? 0,
    currentStreak: profile?.current_streak ?? 0,
  };
}

export function useChildRewards(childId: string | null) {
  return useQuery({
    queryKey: ['childRewards', childId],
    queryFn: () => fetchChildRewards(childId!),
    enabled: !!childId,
    staleTime: 60_000, // 1 minute — doesn't need to be real-time
  });
}
