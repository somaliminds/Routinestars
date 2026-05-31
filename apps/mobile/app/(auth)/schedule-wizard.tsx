/**
 * schedule-wizard — Sprint 4.2 Onboarding
 *
 * Guided first-schedule setup after plan choice.
 * Fetches the parent's first child profile, offers age-appropriate
 * activity sets to add to a Monday-Friday morning schedule.
 * Parents can skip — they can build a full schedule later.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface ActivitySetOption {
  set_id: string;
  set_name: string;
  icon_emoji: string;
  total_duration_mins: number;
}

interface ChildProfile {
  profile_id: string;
  child_name: string;
  date_of_birth: string;
}

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function suggestedSets(age: number, allSets: ActivitySetOption[]): ActivitySetOption[] {
  const preferred =
    age <= 7
      ? ['Morning', 'Teeth', 'Wash', 'Dress']
      : ['Morning', 'Breakfast', 'School', 'Homework'];
  const sorted = [...allSets].sort((a, b) => {
    const aScore = preferred.findIndex((p) => a.set_name.toLowerCase().includes(p.toLowerCase()));
    const bScore = preferred.findIndex((p) => b.set_name.toLowerCase().includes(p.toLowerCase()));
    return (aScore === -1 ? 99 : aScore) - (bScore === -1 ? 99 : bScore);
  });
  return sorted.slice(0, 4);
}

export default function ScheduleWizardScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [allSets, setAllSets] = useState<ActivitySetOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: childData } = await supabase
        .from('child_profiles')
        .select('profile_id, child_name, date_of_birth')
        .eq('parent_id', userId)
        .order('date_of_birth')
        .limit(1)
        .maybeSingle();

      if (childData) setChild(childData as unknown as ChildProfile);

      const { data: setsData } = await supabase
        .from('activity_sets')
        .select('set_id, set_name, icon_emoji, total_duration_mins')
        .eq('is_custom', false)
        .order('set_name');

      const sets = (setsData ?? []) as unknown as ActivitySetOption[];
      setAllSets(sets);

      if (childData && sets.length > 0) {
        const age = ageFromDob((childData as unknown as ChildProfile).date_of_birth);
        const suggested = suggestedSets(age, sets);
        setSelectedIds(new Set(suggested.map((s) => s.set_id)));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSet = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!child || selectedIds.size === 0) {
      router.replace('/(parent)/dashboard');
      return;
    }
    setSaving(true);
    try {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7));
      const selectedSets = allSets.filter((s) => selectedIds.has(s.set_id));

      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('day_schedules')
          .upsert(
            {
              child_id: child.profile_id,
              schedule_date: dateStr,
              day_of_week: date.getDay(),
              created_by: userId,
            },
            { onConflict: 'child_id,schedule_date' },
          )
          .select('schedule_id')
          .single();

        if (scheduleError || !scheduleData) continue;
        const scheduleId = (scheduleData as unknown as { schedule_id: string }).schedule_id;

        let minuteOffset = 0;
        for (let i = 0; i < selectedSets.length; i++) {
          const set = selectedSets[i];
          const startHour = 8 + Math.floor(minuteOffset / 60);
          const startMin = minuteOffset % 60;
          const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`;
          const endMinutes = minuteOffset + set.total_duration_mins;
          const endTime = `${String(8 + Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

          await supabase.from('scheduled_sets').upsert(
            {
              schedule_id: scheduleId,
              set_id: set.set_id,
              start_time: startTime,
              end_time: endTime,
              order_in_day: i,
            },
            { onConflict: 'schedule_id,set_id' },
          );
          minuteOffset += set.total_duration_mins + 5;
        }
      }
      router.replace('/(parent)/dashboard');
    } catch {
      Alert.alert('Error', 'Could not save schedule. You can set this up from the Schedule tab.');
      router.replace('/(parent)/dashboard');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-100 items-center justify-center">
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100">
      <View className="px-5 pt-12 pb-3">
        <View className="flex-row gap-1.5 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={`h-1.5 rounded-full ${i === 3 ? 'w-6 bg-brand-primary' : 'w-3 bg-neutral-300'}`}
            />
          ))}
        </View>
        <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
          Build {child?.child_name ? `${child.child_name}'s` : 'your'} first schedule
        </Text>
        <Text className="font-inter text-neutral-500 text-sm mt-1">
          Select activity sets for their weekday mornings. Customise times later.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {allSets.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center mt-4">
            <Text className="font-inter text-neutral-500 text-sm text-center">
              No activity sets available yet. Add sets from the Activities tab.
            </Text>
          </View>
        ) : (
          allSets.map((set) => {
            const isSelected = selectedIds.has(set.set_id);
            return (
              <TouchableOpacity
                key={set.set_id}
                onPress={() => toggleSet(set.set_id)}
                className={`flex-row items-center rounded-2xl p-4 mb-2 shadow-sm ${isSelected ? 'bg-brand-primary' : 'bg-white'}`}
                accessibilityLabel={`${set.set_name}, ${isSelected ? 'selected' : 'not selected'}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text className="text-2xl mr-3">{set.icon_emoji ?? '📋'}</Text>
                <View className="flex-1">
                  <Text
                    className={`font-inter font-semibold text-base ${isSelected ? 'text-white' : 'text-neutral-900'}`}
                  >
                    {set.set_name}
                  </Text>
                  <Text
                    className={`font-inter text-xs mt-0.5 ${isSelected ? 'text-white opacity-70' : 'text-neutral-400'}`}
                  >
                    {set.total_duration_mins} min
                  </Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-neutral-300'}`}
                >
                  {isSelected && <Text className="text-brand-primary font-bold text-xs">✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={saving}
          className="bg-brand-primary rounded-2xl py-4 items-center min-h-[60px] justify-center mt-4 shadow-sm"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-inter font-semibold text-white text-base">
              {selectedIds.size > 0
                ? `Add ${selectedIds.size} set${selectedIds.size > 1 ? 's' : ''} & finish`
                : 'Skip for now'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(parent)/dashboard')}
          className="py-3 items-center mt-1"
        >
          <Text className="font-inter text-neutral-400 text-sm">
            Skip — I'll set this up later
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
