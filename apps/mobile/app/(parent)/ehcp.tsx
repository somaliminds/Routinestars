/**
 * EHCP Outcomes — Phase 5 Sprint 2 Feature 1.
 *
 * Parent-facing screen to manage the child's EHCP outcomes. Each child
 * has their own list. Outcomes group by status (Active / Achieved /
 * Discontinued).
 *
 * The annual review evidence pack (Feature 2.3) reads from this table —
 * so the screen is where parents/SENCOs invest a few minutes once a
 * year (or whenever the EHCP is amended) to set up automatic evidence
 * collection.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
// expo-print and expo-sharing are native modules added in Sprint 2.3.
// They are lazy-loaded inside handleExport (below) so a dev client built
// before those deps were added still mounts every screen — only the
// "Generate Evidence Pack" button itself shows an "Update required"
// alert until the user runs an EAS rebuild.
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore, canUseEHCP, requiredTierFor } from '@/stores/subscription.store';
import { useResponsive } from '@/hooks/useResponsive';
import { buildEvidencePack, renderEvidencePackHtml } from '@/lib/ehcp-report';
import type { ChildProfileRow, EhcpOutcomeRow, EhcpCategory, EhcpStatus } from '@/types/database';

const CATEGORIES: { value: EhcpCategory; label: string; emoji: string }[] = [
  { value: 'COMMUNICATION', label: 'Communication', emoji: '💬' },
  { value: 'COGNITION', label: 'Cognition & Learning', emoji: '🧠' },
  { value: 'SOCIAL_EMOTIONAL', label: 'Social & Emotional', emoji: '💛' },
  { value: 'SENSORY_PHYSICAL', label: 'Sensory & Physical', emoji: '🤲' },
  { value: 'INDEPENDENCE', label: 'Independence', emoji: '🌱' },
  { value: 'OTHER', label: 'Other', emoji: '✨' },
];

const outcomeSchema = z.object({
  outcome_text: z.string().min(5, 'Min 5 characters').max(1000, 'Max 1000 characters'),
  category: z.enum([
    'COMMUNICATION',
    'COGNITION',
    'SOCIAL_EMOTIONAL',
    'SENSORY_PHYSICAL',
    'INDEPENDENCE',
    'OTHER',
  ]),
  target_date: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ACHIEVED', 'DISCONTINUED']),
  notes: z.string().max(2000).optional().nullable(),
});

type OutcomeForm = z.infer<typeof outcomeSchema>;

async function fetchChildren(parentId: string): Promise<ChildProfileRow[]> {
  const { data, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('parent_id', parentId)
    .order('child_name');
  if (error) throw error;
  return (data ?? []) as ChildProfileRow[];
}

async function fetchOutcomes(childId: string): Promise<EhcpOutcomeRow[]> {
  const { data, error } = await supabase
    .from('ehcp_outcomes')
    .select('*')
    .eq('child_id', childId)
    .order('status')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EhcpOutcomeRow[];
}

const CATEGORY_BY_VALUE = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<
  EhcpCategory,
  (typeof CATEGORIES)[number]
>;

export default function EhcpScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const r = useResponsive();
  const qc = useQueryClient();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EhcpOutcomeRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: children = [] } = useQuery({
    queryKey: ['ehcpChildren', userId],
    queryFn: () => fetchChildren(userId!),
    enabled: !!userId,
  });

  // Default to first child once loaded
  const activeChildId = selectedChildId ?? children[0]?.profile_id ?? null;

  const { data: outcomes = [], isLoading } = useQuery({
    queryKey: ['ehcpOutcomes', activeChildId],
    queryFn: () => fetchOutcomes(activeChildId!),
    enabled: !!activeChildId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { outcome_id?: string } & OutcomeForm) => {
      if (!activeChildId) throw new Error('No child selected');
      if (payload.outcome_id) {
        const { error } = await supabase
          .from('ehcp_outcomes')
          .update({
            outcome_text: payload.outcome_text,
            category: payload.category,
            target_date: payload.target_date ?? null,
            status: payload.status,
            notes: payload.notes ?? null,
          })
          .eq('outcome_id', payload.outcome_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ehcp_outcomes').insert({
          child_id: activeChildId,
          outcome_text: payload.outcome_text,
          category: payload.category,
          target_date: payload.target_date ?? null,
          status: payload.status,
          notes: payload.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setEditing(null);
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ['ehcpOutcomes', activeChildId] });
    },
    onError: (err) => {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (outcomeId: string) => {
      const { error } = await supabase.from('ehcp_outcomes').delete().eq('outcome_id', outcomeId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['ehcpOutcomes', activeChildId] });
    },
  });

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!activeChildId) return;
    setIsExporting(true);
    try {
      // Lazy-load the native modules. If the dev client was built before
      // expo-print / expo-sharing were added (Sprint 2.3), the dynamic
      // import resolves the JS shim but the native bridge is missing —
      // surface a clear "rebuild required" message instead of crashing.
      let Print: typeof import('expo-print');
      let Sharing: typeof import('expo-sharing');
      try {
        Print = await import('expo-print');
        Sharing = await import('expo-sharing');
      } catch {
        Alert.alert(
          'App update required',
          'PDF export needs an EAS dev client rebuild to include expo-print and expo-sharing. Run `eas build --profile development --platform android` and reinstall the new dev client.',
        );
        return;
      }

      // 12-month period is the standard for an annual review.
      const dateTo = format(new Date(), 'yyyy-MM-dd');
      const dateFrom = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      const pack = await buildEvidencePack(activeChildId, dateFrom, dateTo);
      if (!pack) throw new Error('Could not load evidence');
      const html = renderEvidencePackHtml(pack);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'EHCP Annual Review Pack',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'Evidence pack generated',
          `Saved to:\n${uri}\n\nDevice sharing is unavailable.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // The native module lookup can throw at runtime even after the
      // dynamic import resolves, if the dev client is stale.
      if (msg.includes('ExpoPrint') || msg.includes('ExpoSharing')) {
        Alert.alert(
          'App update required',
          'PDF export needs an EAS dev client rebuild. Run `eas build --profile development --platform android` and reinstall the new dev client.',
        );
      } else {
        Alert.alert('Export failed', msg);
      }
    } finally {
      setIsExporting(false);
    }
  }, [activeChildId]);

  const handleDelete = useCallback(
    (outcome: EhcpOutcomeRow) => {
      Alert.alert(
        'Delete outcome?',
        `"${outcome.outcome_text.slice(0, 60)}${outcome.outcome_text.length > 60 ? '…' : ''}"\n\nThis cannot be undone. The evidence pack will no longer include this outcome.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(outcome.outcome_id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const grouped = {
    ACTIVE: outcomes.filter((o) => o.status === 'ACTIVE'),
    ACHIEVED: outcomes.filter((o) => o.status === 'ACHIEVED'),
    DISCONTINUED: outcomes.filter((o) => o.status === 'DISCONTINUED'),
  };

  const activeChild = children.find((c) => c.profile_id === activeChildId);

  // Hard paywall — EHCP outcomes are Family+. Free/Starter who deep-link
  // here from Settings see a call-to-action that routes to Subscription.
  // (Placed after every hook call to keep Rules of Hooks satisfied.)
  const subscription = useSubscriptionStore((s) => s.subscription);
  const ehcpAllowed = canUseEHCP(subscription);
  if (!ehcpAllowed) {
    const req = requiredTierFor('canUseEHCP');
    return (
      <View style={styles.screen}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>EHCP Outcomes</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ fontSize: 56 }}>📋</Text>
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 20,
                color: '#111827',
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              EHCP outcomes + evidence packs
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: '#4B5563',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Map activities to EHCP outcomes and generate annual review evidence packs
              automatically. Available on {req.tierName} ({req.priceDisplay}).
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(parent)/subscription')}
              style={{
                backgroundColor: '#7C3AED',
                borderRadius: 16,
                paddingHorizontal: 24,
                paddingVertical: 12,
                marginTop: 24,
              }}
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: 'white',
                }}
              >
                See {req.tierName} plan
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EHCP Outcomes</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: r.scrollClearance + 72,
          }}
        >
          <Text style={styles.intro}>
            Set up the outcomes from your child's EHCP. At review time, generate a one-tap evidence
            pack showing progress against each outcome.
          </Text>

          {/* Child switcher */}
          {children.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {children.map((c) => (
                <TouchableOpacity
                  key={c.profile_id}
                  onPress={() => setSelectedChildId(c.profile_id)}
                  style={[
                    styles.childChip,
                    c.profile_id === activeChildId && styles.childChipActive,
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{c.avatar_emoji}</Text>
                  <Text
                    style={[
                      styles.childChipText,
                      c.profile_id === activeChildId && styles.childChipTextActive,
                    ]}
                  >
                    {c.child_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {!activeChild ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👶</Text>
              <Text style={styles.emptyTitle}>No child profile yet</Text>
              <Text style={styles.emptySub}>
                Add a child profile in Settings to start tracking EHCP outcomes.
              </Text>
            </View>
          ) : (
            <>
              {isLoading && (
                <ActivityIndicator size="large" color="#7C3AED" style={{ marginVertical: 32 }} />
              )}

              {!isLoading && outcomes.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>No outcomes yet</Text>
                  <Text style={styles.emptySub}>
                    Tap "Add outcome" below to start. You'll need your child's EHCP document handy —
                    copy each outcome verbatim.
                  </Text>
                </View>
              )}

              {outcomes.length > 0 && (
                <TouchableOpacity
                  style={styles.exportBtn}
                  onPress={handleExport}
                  disabled={isExporting}
                  accessibilityLabel="Generate annual review evidence pack"
                >
                  {isExporting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.exportEmoji}>📄</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exportTitle}>Generate Annual Review Pack</Text>
                        <Text style={styles.exportSub}>
                          Statutory-format PDF: auto-filled progress report plus parent, child-voice
                          and review sections. Ready for the annual review.
                        </Text>
                      </View>
                      <Text style={styles.exportArrow}>→</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {(['ACTIVE', 'ACHIEVED', 'DISCONTINUED'] as EhcpStatus[]).map((status) => {
                const list = grouped[status];
                if (list.length === 0) return null;
                return (
                  <View key={status} style={{ marginBottom: 8 }}>
                    <Text style={styles.groupLabel}>
                      {status === 'ACTIVE'
                        ? 'Active'
                        : status === 'ACHIEVED'
                          ? 'Achieved'
                          : 'Discontinued'}{' '}
                      ({list.length})
                    </Text>
                    {list.map((o) => (
                      <OutcomeCard key={o.outcome_id} outcome={o} onEdit={() => setEditing(o)} />
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* + Add button — lifted above the floating tab bar */}
        {activeChild && (
          <View
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: r.tabBarBottom + r.tabBarHeight + 8,
            }}
          >
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setCreateOpen(true)}
              accessibilityLabel="Add EHCP outcome"
            >
              <Text style={styles.addBtnText}>+ Add outcome</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Editor modal */}
      <OutcomeEditorModal
        visible={createOpen || editing !== null}
        initial={editing}
        isLoading={saveMutation.isPending}
        onClose={() => {
          setEditing(null);
          setCreateOpen(false);
        }}
        onSave={(form) => {
          saveMutation.mutate({
            ...(editing ? { outcome_id: editing.outcome_id } : {}),
            ...form,
          });
        }}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </View>
  );
}

// ── Outcome card ─────────────────────────────────────────────────────────────
function OutcomeCard({ outcome, onEdit }: { outcome: EhcpOutcomeRow; onEdit: () => void }) {
  const cat = CATEGORY_BY_VALUE[outcome.category];
  return (
    <TouchableOpacity style={styles.card} onPress={onEdit} accessibilityRole="button">
      <View style={styles.cardHeader}>
        <Text style={styles.cardCategory}>
          {cat.emoji} {cat.label}
        </Text>
        {outcome.target_date && <Text style={styles.cardDate}>Target: {outcome.target_date}</Text>}
      </View>
      <Text style={styles.cardText} numberOfLines={3}>
        {outcome.outcome_text}
      </Text>
      {outcome.notes && (
        <Text style={styles.cardNotes} numberOfLines={1}>
          📝 {outcome.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Editor modal ─────────────────────────────────────────────────────────────
function OutcomeEditorModal({
  visible,
  initial,
  isLoading,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: EhcpOutcomeRow | null;
  isLoading: boolean;
  onClose: () => void;
  onSave: (form: OutcomeForm) => void;
  onDelete?: () => void;
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<EhcpCategory>('COMMUNICATION');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<EhcpStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpen = useCallback(() => {
    setText(initial?.outcome_text ?? '');
    setCategory((initial?.category as EhcpCategory) ?? 'COMMUNICATION');
    setTargetDate(initial?.target_date ?? '');
    setStatus((initial?.status as EhcpStatus) ?? 'ACTIVE');
    setNotes(initial?.notes ?? '');
    setErrors({});
  }, [initial]);

  const handleSave = () => {
    const parsed = outcomeSchema.safeParse({
      outcome_text: text.trim(),
      category,
      target_date: targetDate || null,
      status,
      notes: notes || null,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }
    onSave(parsed.data);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#F5F0FF' }}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{initial ? 'Edit Outcome' : 'New Outcome'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isLoading}>
            <Text style={[styles.modalSave, isLoading && { color: '#D1D5DB' }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    category === c.value && styles.categoryChipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Outcome text */}
          <Text style={styles.fieldLabel}>Outcome (verbatim from EHCP)</Text>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="e.g. Samia will dress independently in the morning, including socks and shoes, by July 2027."
            multiline
            numberOfLines={4}
            maxLength={1000}
          />
          {errors.outcome_text && <Text style={styles.fieldError}>{errors.outcome_text}</Text>}

          {/* Target date */}
          <Text style={styles.fieldLabel}>Target review date (optional)</Text>
          <TextInput
            style={styles.smallInput}
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            keyboardType="number-pad"
          />

          {/* Status */}
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusRow}>
            {(['ACTIVE', 'ACHIEVED', 'DISCONTINUED'] as EhcpStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, status === s && styles.statusChipActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>
                  {s === 'ACTIVE' ? 'Active' : s === 'ACHIEVED' ? 'Achieved' : 'Discontinued'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Context, supporting strategies, anything the SENCO should see at review."
            multiline
            numberOfLines={3}
            maxLength={2000}
          />

          {onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteBtnText}>Delete this outcome</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  headerTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: '#111827',
  },
  intro: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  childChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  childChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#6B7280' },
  childChipTextActive: { color: '#FFFFFF' },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  groupLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#5B21B6' },
  cardDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF' },
  cardText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  cardNotes: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  addBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  addBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#5B21B6',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  exportEmoji: { fontSize: 26 },
  exportTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  exportSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 15,
  },
  exportArrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
  },

  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.08)',
    backgroundColor: '#FFFFFF',
  },
  modalCancel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },
  modalTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#111827' },
  modalSave: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  fieldError: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#EF4444', marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  categoryChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' },
  categoryChipTextActive: { color: '#FFFFFF' },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: '#111827',
    width: 160,
  },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  statusChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' },
  statusChipTextActive: { color: '#FFFFFF' },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#B91C1C' },
});
