/**
 * OutcomeLinker — tag an activity_set to one or more EHCP outcomes.
 *
 * Used inside the activity-sets editor modal. Renders the currently
 * linked outcomes as chips and opens a per-child checklist when the
 * parent taps "Manage links". Tag inserts/deletes are persisted
 * immediately on toggle, so there's no separate save step.
 *
 * Built-in sets are taggable too — a parent can link the built-in
 * "Brush Teeth" set to their child's "Daily living skills" outcome
 * without needing to clone it as a custom set first.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EhcpOutcomeRow, ChildProfileRow } from '@/types/database';

interface OutcomeLinkerProps {
  /** Set ID to tag against. Component renders nothing if undefined (new set not yet saved). */
  setId: string | undefined;
  /** Parent's auth user_id — used to scope the outcome list. */
  parentUserId: string;
}

interface ChildWithOutcomes {
  child: Pick<ChildProfileRow, 'profile_id' | 'child_name' | 'avatar_emoji'>;
  outcomes: EhcpOutcomeRow[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  COMMUNICATION: '💬',
  COGNITION: '🧠',
  SOCIAL_EMOTIONAL: '💛',
  SENSORY_PHYSICAL: '🤲',
  INDEPENDENCE: '🌱',
  OTHER: '✨',
};

async function fetchOutcomesByChild(parentUserId: string): Promise<ChildWithOutcomes[]> {
  const { data: children, error: cErr } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name, avatar_emoji')
    .eq('parent_id', parentUserId)
    .order('child_name');
  if (cErr) throw cErr;

  const childIds = (children ?? []).map((c) => c.profile_id);
  if (childIds.length === 0) return [];

  // Active outcomes only — Achieved/Discontinued are noise for tagging.
  const { data: outcomes, error: oErr } = await supabase
    .from('ehcp_outcomes')
    .select('*')
    .in('child_id', childIds)
    .eq('status', 'ACTIVE')
    .order('category');
  if (oErr) throw oErr;

  const byChild: Record<string, EhcpOutcomeRow[]> = {};
  for (const o of outcomes ?? []) {
    (byChild[o.child_id] ??= []).push(o as EhcpOutcomeRow);
  }
  return (children ?? []).map((c) => ({
    child: c,
    outcomes: byChild[c.profile_id] ?? [],
  }));
}

async function fetchSetTags(setId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('activity_set_outcome_tags')
    .select('outcome_id')
    .eq('set_id', setId);
  if (error) throw error;
  return (data ?? []).map((r) => r.outcome_id as string);
}

export function OutcomeLinker({ setId, parentUserId }: OutcomeLinkerProps) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: childrenWithOutcomes = [], isLoading: outcomesLoading } = useQuery({
    queryKey: ['outcomesByChild', parentUserId],
    queryFn: () => fetchOutcomesByChild(parentUserId),
    enabled: !!parentUserId,
  });

  const { data: linkedIds = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['setOutcomeTags', setId],
    queryFn: () => fetchSetTags(setId!),
    enabled: !!setId,
  });

  // Quick lookup map for the chips display
  const outcomesById = useMemo(() => {
    const map: Record<string, EhcpOutcomeRow> = {};
    for (const { outcomes } of childrenWithOutcomes) {
      for (const o of outcomes) map[o.outcome_id] = o;
    }
    return map;
  }, [childrenWithOutcomes]);

  const toggleMutation = useMutation({
    mutationFn: async ({ outcomeId, link }: { outcomeId: string; link: boolean }) => {
      if (!setId) return;
      if (link) {
        const { error } = await supabase
          .from('activity_set_outcome_tags')
          .insert({ set_id: setId, outcome_id: outcomeId });
        if (error && (error as { code?: string }).code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('activity_set_outcome_tags')
          .delete()
          .eq('set_id', setId)
          .eq('outcome_id', outcomeId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['setOutcomeTags', setId] });
    },
  });

  const handleToggle = useCallback(
    (outcomeId: string, currentlyLinked: boolean) => {
      toggleMutation.mutate({ outcomeId, link: !currentlyLinked });
    },
    [toggleMutation],
  );

  if (!setId) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Save the set first to link it to EHCP outcomes.</Text>
      </View>
    );
  }

  const totalActiveOutcomes = childrenWithOutcomes.reduce((sum, c) => sum + c.outcomes.length, 0);

  return (
    <View>
      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          {tagsLoading || outcomesLoading ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : linkedIds.length === 0 ? (
            <Text style={styles.placeholderText}>No outcomes linked yet. Tap to add some.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {linkedIds.map((id) => {
                const o = outcomesById[id];
                if (!o) return null;
                return (
                  <View key={id} style={styles.chip}>
                    <Text style={styles.chipEmoji}>{CATEGORY_EMOJI[o.category] ?? '✨'}</Text>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {o.outcome_text}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => setPickerOpen(true)}
          disabled={totalActiveOutcomes === 0}
        >
          <Text style={[styles.manageBtnText, totalActiveOutcomes === 0 && { color: '#D1D5DB' }]}>
            {linkedIds.length === 0 ? 'Add' : 'Manage'}
          </Text>
        </TouchableOpacity>
      </View>

      {totalActiveOutcomes === 0 && (
        <Text style={styles.hint}>
          Add active EHCP outcomes in Settings → EHCP Outcomes first, then come back here to link
          them.
        </Text>
      )}

      {/* Picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalAction}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Link Outcomes</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {childrenWithOutcomes.map(({ child, outcomes }) => (
              <View key={child.profile_id} style={{ marginBottom: 18 }}>
                <Text style={styles.childHeader}>
                  {child.avatar_emoji} {child.child_name}
                </Text>
                {outcomes.length === 0 ? (
                  <Text style={styles.noneText}>No active outcomes.</Text>
                ) : (
                  outcomes.map((o) => {
                    const linked = linkedIds.includes(o.outcome_id);
                    return (
                      <TouchableOpacity
                        key={o.outcome_id}
                        style={[styles.row, linked && styles.rowLinked]}
                        onPress={() => handleToggle(o.outcome_id, linked)}
                      >
                        <Text style={styles.checkbox}>{linked ? '☑' : '☐'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowCategory}>
                            {CATEGORY_EMOJI[o.category] ?? '✨'} {o.category.replace('_', ' ')}
                          </Text>
                          <Text style={styles.rowText} numberOfLines={3}>
                            {o.outcome_text}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#F7F8FC',
    padding: 12,
    borderRadius: 14,
  },
  placeholderText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F7F8FC',
    padding: 12,
    borderRadius: 14,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 200,
  },
  chipEmoji: { fontSize: 12 },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#5B21B6',
    flexShrink: 1,
  },
  manageBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  manageBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.08)',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#111827' },
  modalAction: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  childHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  noneText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  rowLinked: { backgroundColor: '#EDE9FE' },
  checkbox: {
    fontSize: 22,
    color: '#7C3AED',
    marginTop: -2,
  },
  rowCategory: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#5B21B6',
    marginBottom: 4,
  },
  rowText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
});
