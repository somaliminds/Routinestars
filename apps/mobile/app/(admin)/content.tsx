/**
 * Admin — content (built-in activity sets).
 *
 * Edit the shared built-in activity sets + steps that every family sees.
 * Steps are edited IN PLACE (preserving step_id) because children's completion
 * history references them; reordering is applied via a two-phase update to
 * respect UNIQUE(set_id, order_index). Admins have RLS all on activity_sets +
 * steps (migration 038).
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import { confirmAction, notify } from '@/lib/ui-dialogs';

const CATEGORIES = ['MORNING', 'SCHOOL', 'AFTERNOON', 'EVENING', 'WEEKEND', 'CUSTOM'] as const;

interface EditStep {
  step_id: string | null; // null = new
  title: string;
  instruction_text: string;
  duration_seconds: number;
  reward_stars: number;
}
interface EditSet {
  set_id: string | null; // null = new
  set_name: string;
  icon_emoji: string;
  category: string;
  requires_approval: boolean;
  steps: EditStep[];
}

interface SetRow {
  set_id: string;
  set_name: string;
  icon_emoji: string;
  category: string;
  requires_approval: boolean;
  total_duration_mins: number;
}

async function fetchBuiltInSets(): Promise<(SetRow & { stepCount: number })[]> {
  const { data: sets, error } = await supabase
    .from('activity_sets')
    .select('set_id, set_name, icon_emoji, category, requires_approval, total_duration_mins')
    .eq('is_custom', false)
    .order('category');
  if (error) throw error; // surface load failures (error + empty states are distinct)
  const rows = (sets ?? []) as SetRow[];
  if (rows.length === 0) return [];

  // ONE query for every set's active steps, counted here — not a HEAD count per
  // set. The old per-set burst (14 parallel requests) hit the 8s statement
  // timeout on a loaded instance, and since the error was ignored every set
  // silently showed "0 steps". Errors now throw -> the screen's Retry state.
  const { data: stepRows, error: stepsErr } = await supabase
    .from('steps')
    .select('set_id')
    .in(
      'set_id',
      rows.map((s) => s.set_id),
    )
    .eq('is_active', true); // archived steps don't count
  if (stepsErr) throw stepsErr;

  const counts = new Map<string, number>();
  for (const s of stepRows ?? []) counts.set(s.set_id, (counts.get(s.set_id) ?? 0) + 1);
  return rows.map((s) => ({ ...s, stepCount: counts.get(s.set_id) ?? 0 }));
}

async function loadSetForEdit(setId: string): Promise<EditSet> {
  const { data: set, error: setErr } = await supabase
    .from('activity_sets')
    .select('set_id, set_name, icon_emoji, category, requires_approval')
    .eq('set_id', setId)
    .single();
  if (setErr || !set) throw setErr ?? new Error('Set not found');
  const { data: steps, error: stepsErr } = await supabase
    .from('steps')
    .select('step_id, title, instruction_text, duration_seconds, reward_stars')
    .eq('set_id', setId)
    .eq('is_active', true) // only active steps are editable; archived stay hidden
    .order('order_index');
  if (stepsErr) throw stepsErr;
  return {
    set_id: set.set_id,
    set_name: set.set_name,
    icon_emoji: set.icon_emoji,
    category: set.category,
    requires_approval: set.requires_approval,
    steps: (steps ?? []).map((s) => ({
      step_id: s.step_id,
      title: s.title,
      instruction_text: s.instruction_text,
      duration_seconds: s.duration_seconds,
      reward_stars: s.reward_stars,
    })),
  };
}

/**
 * Save the set + steps in ONE atomic, is_admin()-gated, audited transaction
 * (admin_save_activity_set, migration 040). steps[] is the desired ACTIVE list
 * in order; any existing step omitted from it is soft-archived server-side so
 * children's completion history is preserved. postgrest-js never throws, so the
 * `.error` MUST be checked — a swallowed error would look like a successful save.
 */
async function saveSet(edit: EditSet): Promise<void> {
  const payload = {
    set_id: edit.set_id,
    set_name: edit.set_name.trim(),
    icon_emoji: edit.icon_emoji,
    category: edit.category,
    requires_approval: edit.requires_approval,
    steps: edit.steps.map((s) => ({
      step_id: s.step_id,
      title: s.title.trim(),
      instruction_text: s.instruction_text.trim(),
      duration_seconds: s.duration_seconds,
      reward_stars: s.reward_stars,
    })),
  };
  const { error } = await supabase.rpc('admin_save_activity_set', {
    p: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
}

const emptySet = (): EditSet => ({
  set_id: null,
  set_name: '',
  icon_emoji: '📋',
  category: 'MORNING',
  requires_approval: false,
  steps: [],
});

export default function AdminContent() {
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const qc = useQueryClient();
  const {
    data: sets = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['adminBuiltInSets'],
    queryFn: fetchBuiltInSets,
  });
  const [editing, setEditing] = useState<EditSet | null>(null);
  const [saving, setSaving] = useState(false);

  const openSet = useCallback(async (setId: string) => {
    try {
      setEditing(await loadSetForEdit(setId));
    } catch (e) {
      notify('Could not open set', e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    if (!editing.set_name.trim()) {
      notify('Name required', 'Give the set a name.');
      return;
    }
    // Steps are NOT NULL in the DB but '' passes — require real content so a
    // blank-titled step can't reach a child screen (no icon without a label).
    const badStep = editing.steps.findIndex((s) => !s.title.trim() || !s.instruction_text.trim());
    if (badStep !== -1) {
      notify('Step incomplete', `Step ${badStep + 1} needs a title and an instruction.`);
      return;
    }
    setSaving(true);
    try {
      await saveSet(editing);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ['adminBuiltInSets'] });
    } catch (e) {
      notify('Save failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [editing, qc]);

  const updateStep = (i: number, patch: Partial<EditStep>) =>
    setEditing((e) =>
      e ? { ...e, steps: e.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : e,
    );
  const moveStep = (i: number, dir: -1 | 1) =>
    setEditing((e) => {
      if (!e) return e;
      const j = i + dir;
      if (j < 0 || j >= e.steps.length) return e;
      const steps = [...e.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...e, steps };
    });
  const removeStep = (i: number) =>
    setEditing((e) => {
      if (!e) return e;
      // The save RPC soft-archives any existing step omitted from the list, so
      // simply dropping it here is enough — no separate removed-id tracking.
      return { ...e, steps: e.steps.filter((_, idx) => idx !== i) };
    });
  const addStep = () =>
    setEditing((e) =>
      e
        ? {
            ...e,
            steps: [
              ...e.steps,
              {
                step_id: null,
                title: '',
                instruction_text: '',
                duration_seconds: 60,
                reward_stars: 1,
              },
            ],
          }
        : e,
    );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Built-in content</Text>
        <TouchableOpacity onPress={() => setEditing(emptySet())}>
          <Text style={styles.new}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />
        ) : isError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Couldn’t load built-in content.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : sets.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No built-in sets yet. Tap “+ New” to create one.</Text>
          </View>
        ) : (
          sets.map((s) => (
            <TouchableOpacity
              key={s.set_id}
              style={styles.setCard}
              onPress={() => void openSet(s.set_id)}
            >
              <Text style={styles.setEmoji}>{s.icon_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.setName}>{s.set_name}</Text>
                <Text style={styles.setMeta}>
                  {s.category} · {s.stepCount} steps · {s.total_duration_mins} min
                  {s.requires_approval ? ' · approval' : ''}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Editor modal */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && (
          <View style={isWeb ? styles.modalPageWeb : styles.screen}>
            <SafeAreaView style={isWeb ? styles.modalColumnWeb : styles.screen}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setEditing(null)}>
                  <Text style={styles.back}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{editing.set_id ? 'Edit set' : 'New set'}</Text>
                <TouchableOpacity onPress={() => void save()} disabled={saving}>
                  <Text style={styles.new}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={editing.set_name}
                  onChangeText={(t) => setEditing({ ...editing, set_name: t })}
                  placeholder="Morning Routine"
                  placeholderTextColor="#94A2B4"
                  maxLength={100}
                />
                <Text style={styles.fieldLabel}>Emoji</Text>
                <TextInput
                  style={[styles.input, { width: 80 }]}
                  value={editing.icon_emoji}
                  onChangeText={(t) => setEditing({ ...editing, icon_emoji: t })}
                  maxLength={4}
                />
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, editing.category === c && styles.chipOn]}
                      onPress={() => setEditing({ ...editing, category: c })}
                    >
                      <Text style={[styles.chipText, editing.category === c && styles.chipTextOn]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.approvalRow}>
                  <Text style={styles.fieldLabel}>Requires approval</Text>
                  <Switch
                    value={editing.requires_approval}
                    onValueChange={(v) => setEditing({ ...editing, requires_approval: v })}
                    trackColor={{ true: '#7C3AED', false: '#CBD5E1' }}
                  />
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Steps</Text>
                {editing.steps.map((st, i) => (
                  <View key={st.step_id ?? `new-${i}`} style={styles.stepCard}>
                    <View style={styles.stepHead}>
                      <Text style={styles.stepNum}>Step {i + 1}</Text>
                      <View style={styles.stepBtns}>
                        <TouchableOpacity onPress={() => moveStep(i, -1)} disabled={i === 0}>
                          <Text style={[styles.moveBtn, i === 0 && styles.moveDisabled]}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => moveStep(i, 1)}
                          disabled={i === editing.steps.length - 1}
                        >
                          <Text
                            style={[
                              styles.moveBtn,
                              i === editing.steps.length - 1 && styles.moveDisabled,
                            ]}
                          >
                            ↓
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            void confirmAction({
                              title: 'Remove step',
                              message: 'Remove this step when you save?',
                              confirmLabel: 'Remove',
                              destructive: true,
                            }).then((ok) => {
                              if (ok) removeStep(i);
                            })
                          }
                        >
                          <Text style={styles.removeBtn}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={st.title}
                      onChangeText={(t) => updateStep(i, { title: t })}
                      placeholder="Step title"
                      placeholderTextColor="#94A2B4"
                      maxLength={120}
                    />
                    <TextInput
                      style={[styles.input, { minHeight: 56 }]}
                      value={st.instruction_text}
                      onChangeText={(t) => updateStep(i, { instruction_text: t })}
                      placeholder="Instruction"
                      placeholderTextColor="#94A2B4"
                      multiline
                    />
                    <View style={styles.stepMetaRow}>
                      <Text style={styles.stepMetaLabel}>Seconds</Text>
                      <TextInput
                        style={[styles.input, styles.numInput]}
                        value={String(st.duration_seconds)}
                        onChangeText={(t) =>
                          updateStep(i, {
                            // free editing (min 0 while typing); server clamps to [5, 86400]
                            duration_seconds: Math.max(
                              0,
                              Math.min(parseInt(t || '0', 10) || 0, 86400),
                            ),
                          })
                        }
                        keyboardType="number-pad"
                      />
                      <Text style={styles.stepMetaLabel}>Stars</Text>
                      <TextInput
                        style={[styles.input, styles.numInput]}
                        value={String(st.reward_stars)}
                        onChangeText={(t) =>
                          updateStep(i, {
                            reward_stars: Math.max(0, Math.min(parseInt(t || '0', 10) || 0, 100)),
                          })
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addStep} onPress={addStep}>
                  <Text style={styles.addStepText}>+ Add step</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FB' },
  stateBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24, gap: 14 },
  stateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#5A6B80',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  // On web the Modal portals to <body>, escaping the panel's centered column —
  // re-create the centered 1100px column inside the modal so the editor matches.
  modalPageWeb: { flex: 1, backgroundColor: '#EEF2F7', alignItems: 'center' },
  modalColumnWeb: { flex: 1, width: '100%', maxWidth: 1100, backgroundColor: '#F6F8FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9F0',
    backgroundColor: '#FFFFFF',
  },
  back: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#101B2D' },
  new: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 14,
    marginBottom: 10,
  },
  setEmoji: { fontSize: 26 },
  setName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#101B2D' },
  setMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5A6B80', marginTop: 2 },
  arrow: { fontFamily: 'Inter_600SemiBold', fontSize: 22, color: '#94A2B4' },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#5A6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#101B2D',
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#6D28D9' },
  chipTextOn: { color: '#FFFFFF' },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 12,
    marginBottom: 10,
  },
  stepHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNum: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#7C3AED' },
  stepBtns: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  moveBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#5A6B80' },
  moveDisabled: { color: '#CBD5E1' },
  removeBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#B91C1C' },
  stepMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepMetaLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5A6B80' },
  numInput: { width: 72, textAlign: 'center' },
  addStep: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addStepText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
});
