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
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per user; load is stable
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
          const set = selectedSets[i]!;
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
      <View style={styles.loading}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.progressDot, i === 3 && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.title}>
          Build {child?.child_name ? `${child.child_name}'s` : 'your'} first schedule
        </Text>
        <Text style={styles.subtitle}>
          Select activity sets for their weekday mornings. Customise times later.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {allSets.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
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
                style={[styles.setRow, isSelected && styles.setRowSelected]}
                accessibilityLabel={`${set.set_name}, ${isSelected ? 'selected' : 'not selected'}`}
                accessibilityState={{ selected: isSelected }}
                activeOpacity={0.85}
              >
                <Text style={styles.setIcon}>{set.icon_emoji ?? '📋'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.setName, isSelected && { color: '#FFFFFF' }]}>
                    {set.set_name}
                  </Text>
                  <Text
                    style={[styles.setDuration, isSelected && { color: 'rgba(255,255,255,0.75)' }]}
                  >
                    {set.total_duration_mins} min
                  </Text>
                </View>
                <View style={[styles.tick, isSelected && styles.tickSelected]}>
                  {isSelected && <Text style={styles.tickText}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          onPress={() => void handleSave()}
          disabled={saving}
          style={styles.primaryBtn}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {selectedIds.size > 0
                ? `Add ${selectedIds.size} set${selectedIds.size > 1 ? 's' : ''} & finish`
                : 'Skip for now'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(parent)/dashboard')} style={styles.skip}>
          <Text style={styles.skipText}>Skip — I'll set this up later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  loading: {
    flex: 1,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  progressDot: { width: 12, height: 6, borderRadius: 4, backgroundColor: 'rgba(124,58,237,0.25)' },
  progressDotActive: { width: 26, backgroundColor: '#7C3AED' },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: '#5B21B6',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 12,
  },

  empty: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  setRowSelected: { backgroundColor: '#7C3AED', borderColor: '#5B21B6' },
  setIcon: { fontSize: 24, marginRight: 12 },
  setName: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#111827' },
  setDuration: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  tickSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  tickText: { color: '#7C3AED', fontWeight: '700', fontSize: 14 },

  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },

  skip: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  skipText: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 13 },
});
