/**
 * ApdrCyclesModal — manage Assess–Plan–Do–Review cycles for one EHCP
 * outcome (SEND Code 6.44–6.67; research §B). Lists the outcome's cycles
 * with live-computed completion progress for each Do window, and an inline
 * editor to add/edit a cycle's narrative, window, phase and decision.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import {
  fetchApdrCycles,
  createApdrCycle,
  updateApdrCycle,
  deleteApdrCycle,
  nextCycleNumber,
  computeCycleProgress,
  APDR_PHASE_META,
  APDR_DECISION_LABEL,
  type ApdrCycleRow,
  type ApdrStatus,
  type ApdrDecision,
  type CycleProgress,
} from '@/lib/apdr';

interface Props {
  visible: boolean;
  outcomeId: string;
  outcomeText: string;
  childId: string;
  onClose: () => void;
}

const PHASES: ApdrStatus[] = ['ASSESS', 'PLAN', 'DO', 'REVIEW', 'COMPLETE'];
const DECISIONS: ApdrDecision[] = ['CONTINUE', 'MODIFY', 'ESCALATE'];

type EditState = {
  cycle_id?: string;
  cycle_number: number;
  status: ApdrStatus;
  window_from: string;
  window_to: string;
  assess_notes: string;
  plan_target: string;
  plan_provision: string;
  do_notes: string;
  review_progress: string;
  review_decision: ApdrDecision | null;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = true,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export function ApdrCyclesModal({ visible, outcomeId, outcomeText, childId, onClose }: Props) {
  const [cycles, setCycles] = useState<ApdrCycleRow[]>([]);
  const [progress, setProgress] = useState<Record<string, CycleProgress>>({});
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchApdrCycles(outcomeId);
    setCycles(rows);
    // Compute live progress for each cycle window in parallel.
    const entries = await Promise.all(
      rows.map(async (c) => {
        const p = await computeCycleProgress(outcomeId, childId, c.window_from, c.window_to);
        return [c.cycle_id, p] as const;
      }),
    );
    setProgress(Object.fromEntries(entries));
    setLoading(false);
  }, [outcomeId, childId]);

  useEffect(() => {
    if (visible) {
      setEditing(null);
      void load();
    }
  }, [visible, load]);

  const startNew = async () => {
    const n = await nextCycleNumber(outcomeId);
    const today = format(new Date(), 'yyyy-MM-dd');
    setEditing({
      cycle_number: n,
      status: 'ASSESS',
      window_from: format(subDays(new Date(), 42), 'yyyy-MM-dd'), // ~6-week cycle
      window_to: today,
      assess_notes: '',
      plan_target: '',
      plan_provision: '',
      do_notes: '',
      review_progress: '',
      review_decision: null,
    });
  };

  const startEdit = (c: ApdrCycleRow) => {
    setEditing({
      cycle_id: c.cycle_id,
      cycle_number: c.cycle_number,
      status: c.status,
      window_from: c.window_from ?? '',
      window_to: c.window_to ?? '',
      assess_notes: c.assess_notes ?? '',
      plan_target: c.plan_target ?? '',
      plan_provision: c.plan_provision ?? '',
      do_notes: c.do_notes ?? '',
      review_progress: c.review_progress ?? '',
      review_decision: c.review_decision,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const nn = (s: string) => (s.trim().length ? s.trim() : null);
      const fields = {
        window_from: nn(editing.window_from),
        window_to: nn(editing.window_to),
        assess_notes: nn(editing.assess_notes),
        plan_target: nn(editing.plan_target),
        plan_provision: nn(editing.plan_provision),
        do_notes: nn(editing.do_notes),
        review_progress: nn(editing.review_progress),
        review_decision: editing.review_decision,
        status: editing.status,
      };
      if (editing.cycle_id) {
        await updateApdrCycle(editing.cycle_id, fields);
      } else {
        await createApdrCycle({
          outcome_id: outcomeId,
          child_id: childId,
          cycle_number: editing.cycle_number,
          ...fields,
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert(
        'Could not save',
        msg.includes('apdr_cycles') || msg.includes('does not exist')
          ? 'APDR storage is not set up on this account yet. Apply database migration 027 and rebuild.'
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: ApdrCycleRow) => {
    Alert.alert('Delete cycle', `Delete APDR cycle ${c.cycle_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteApdrCycle(c.cycle_id);
              await load();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={editing ? () => setEditing(null) : onClose}
            accessibilityRole="button"
          >
            <Text style={styles.headerCancel}>{editing ? 'Back' : 'Close'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {editing ? `Cycle ${editing.cycle_number}` : 'APDR cycles'}
          </Text>
          {editing ? (
            <TouchableOpacity
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={[styles.headerSave, saving && { opacity: 0.4 }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
            <Text style={styles.outcomeText} numberOfLines={3}>
              {outcomeText}
            </Text>

            {loading ? (
              <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />
            ) : editing ? (
              // ── Editor ──
              <View>
                <Text style={styles.phaseLabel}>Current phase</Text>
                <View style={styles.phaseRow}>
                  {PHASES.map((p) => {
                    const active = editing.status === p;
                    const meta = APDR_PHASE_META[p];
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.phaseChip,
                          active && { backgroundColor: meta.color, borderColor: meta.color },
                        ]}
                        onPress={() => setEditing((e) => (e ? { ...e, status: p } : e))}
                      >
                        <Text style={[styles.phaseChipText, active && { color: '#fff' }]}>
                          {meta.emoji} {meta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.windowRow}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Cycle from"
                      value={editing.window_from}
                      onChange={(t) => setEditing((e) => (e ? { ...e, window_from: t } : e))}
                      placeholder="YYYY-MM-DD"
                      multiline={false}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Cycle to"
                      value={editing.window_to}
                      onChange={(t) => setEditing((e) => (e ? { ...e, window_to: t } : e))}
                      placeholder="YYYY-MM-DD"
                      multiline={false}
                    />
                  </View>
                </View>

                <Text style={styles.sectionHeader}>🔍 Assess</Text>
                <Field
                  label="Baseline, identified need, views"
                  value={editing.assess_notes}
                  onChange={(t) => setEditing((e) => (e ? { ...e, assess_notes: t } : e))}
                />

                <Text style={styles.sectionHeader}>📝 Plan</Text>
                <Field
                  label="Short-term SMART target for this cycle"
                  value={editing.plan_target}
                  onChange={(t) => setEditing((e) => (e ? { ...e, plan_target: t } : e))}
                />
                <Field
                  label="Provision (what support, how often)"
                  value={editing.plan_provision}
                  onChange={(t) => setEditing((e) => (e ? { ...e, plan_provision: t } : e))}
                />

                <Text style={styles.sectionHeader}>▶️ Do</Text>
                <Text style={styles.autoNote}>
                  Completion progress for this window is filled in automatically from RoutineStars
                  data when you view the cycle.
                </Text>
                <Field
                  label="Adaptations / delivery notes"
                  value={editing.do_notes}
                  onChange={(t) => setEditing((e) => (e ? { ...e, do_notes: t } : e))}
                />

                <Text style={styles.sectionHeader}>✅ Review</Text>
                <Field
                  label="Progress against the target"
                  value={editing.review_progress}
                  onChange={(t) => setEditing((e) => (e ? { ...e, review_progress: t } : e))}
                />
                <Text style={styles.fieldLabel}>Decision</Text>
                <View style={styles.phaseRow}>
                  {DECISIONS.map((d) => {
                    const active = editing.review_decision === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.phaseChip, active && styles.phaseChipActive]}
                        onPress={() =>
                          setEditing((e) => (e ? { ...e, review_decision: active ? null : d } : e))
                        }
                      >
                        <Text style={[styles.phaseChipText, active && { color: '#fff' }]}>
                          {APDR_DECISION_LABEL[d]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {editing.cycle_id && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      const row = cycles.find((c) => c.cycle_id === editing.cycle_id);
                      if (row) {
                        setEditing(null);
                        handleDelete(row);
                      }
                    }}
                  >
                    <Text style={styles.deleteBtnText}>Delete this cycle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // ── List ──
              <View>
                {cycles.length === 0 ? (
                  <Text style={styles.empty}>
                    No cycles yet. An APDR cycle records one round of Assess → Plan → Do → Review —
                    the evidence schools and local authorities look for.
                  </Text>
                ) : (
                  cycles.map((c) => {
                    const meta = APDR_PHASE_META[c.status];
                    const p = progress[c.cycle_id];
                    return (
                      <TouchableOpacity
                        key={c.cycle_id}
                        style={styles.cycleCard}
                        onPress={() => startEdit(c)}
                      >
                        <View style={styles.cycleTop}>
                          <Text style={styles.cycleNumber}>Cycle {c.cycle_number}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                            <Text style={styles.statusBadgeText}>
                              {meta.emoji} {meta.label}
                            </Text>
                          </View>
                        </View>
                        {c.window_from && c.window_to ? (
                          <Text style={styles.cycleWindow}>
                            {c.window_from} → {c.window_to}
                          </Text>
                        ) : null}
                        {p?.has_window && (
                          <View style={styles.progressBox}>
                            <Text style={styles.progressText}>
                              <Text style={{ fontWeight: '800' }}>{p.completion_pct}%</Text>{' '}
                              completion · {p.completed} of {p.scheduled} scheduled (auto)
                            </Text>
                          </View>
                        )}
                        {c.plan_target ? (
                          <Text style={styles.cyclePlan} numberOfLines={2}>
                            🎯 {c.plan_target}
                          </Text>
                        ) : null}
                        {c.review_decision ? (
                          <Text style={styles.cycleDecision}>
                            Decision: {APDR_DECISION_LABEL[c.review_decision]}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}

                <TouchableOpacity style={styles.addBtn} onPress={() => void startNew()}>
                  <Text style={styles.addBtnText}>+ New APDR cycle</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCancel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280', width: 44 },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSave: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#7C3AED',
    width: 44,
    textAlign: 'right',
  },
  outcomeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#374151',
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 16,
  },
  cycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  cycleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycleNumber: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: '#111827' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FFFFFF' },
  cycleWindow: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280', marginTop: 6 },
  progressBox: {
    backgroundColor: '#F5F0FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#111827' },
  cyclePlan: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#374151', marginTop: 8 },
  cycleDecision: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#5B21B6', marginTop: 6 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#5B21B6' },
  // Editor
  phaseLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: '#374151',
    marginBottom: 8,
  },
  phaseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  phaseChip: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  phaseChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  phaseChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#374151' },
  windowRow: { flexDirection: 'row', gap: 12 },
  sectionHeader: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: '#5B21B6',
    marginTop: 8,
    marginBottom: 10,
  },
  autoNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 15,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#111827',
  },
  inputMultiline: { minHeight: 64 },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  deleteBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#DC2626' },
});
