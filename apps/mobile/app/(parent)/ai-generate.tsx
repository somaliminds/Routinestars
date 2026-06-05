/**
 * AI Routine Generator — Phase 5 Sprint 3.2.
 *
 * Parent describes their child + the routine they want; the
 * generate-routine Edge Function returns a draft set + steps; the
 * parent reviews and edits in-app; only on explicit Save does anything
 * touch activity_sets.
 *
 * This is the human-in-the-loop layer of the AI governance scaffolding:
 * the AI never writes to the DB. Every step is editable; the parent
 * owns the save action.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

type AgeBand = '4-6' | '7-10' | '11-14';
type Provider = 'anthropic' | 'openai';

const PROVIDER_LABEL: Record<Provider, { label: string; emoji: string; sub: string }> = {
  anthropic: {
    label: 'Claude (Opus 4.8)',
    emoji: '🅰️',
    sub: 'Premium — deeper reasoning, slower, higher cost',
  },
  openai: {
    label: 'GPT-4o-mini',
    emoji: '🅾️',
    sub: 'Fast — lower cost, good for simpler routines',
  },
};

interface DraftStep {
  title: string;
  instruction_text: string;
  duration_seconds: number;
  reward_stars: number;
}

interface DraftRoutine {
  log_id: string;
  set_name: string;
  category: 'MORNING' | 'SCHOOL' | 'AFTERNOON' | 'EVENING' | 'WEEKEND' | 'CUSTOM';
  icon_emoji: string;
  steps: DraftStep[];
}

type GenerateResult =
  | { kind: 'draft'; draft: DraftRoutine }
  | { kind: 'refusal'; reason: string };

const REFUSAL_MESSAGES: Record<string, string> = {
  advice_requested:
    "RoutineGen doesn't give advice or opinions — it just drafts routines. Try describing a daily activity instead.",
  off_topic:
    "RoutineGen only generates daily routines. Try something like 'morning routine for an 8-year-old who hates teeth brushing'.",
  injection_attempt:
    'That prompt looks like it was trying to override the generator. Please rephrase as a normal description.',
  safeguarding_concern:
    "If you're worried about your child's safety or wellbeing, please contact your GP, school SENCO, or NSPCC (0808 800 5000). RoutineGen isn't the right tool here.",
  rule_violation:
    "The generator couldn't produce a routine for that request. Try a more concrete daily activity.",
  underspecified:
    'The description was too vague to act on. Try adding what the routine is for, what your child likes, and any specific struggles.',
};

async function callGenerator(args: {
  prompt: string;
  child_first_name: string;
  age_band: AgeBand;
  provider: Provider;
}): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke('generate-routine', {
    body: args,
  });
  if (error) {
    // The Functions client wraps non-2xx into error; try to pull a JSON body
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 403) throw new Error('AI generation is not enabled on your account.');
    if (status === 429) throw new Error('Daily limit reached. Try again tomorrow.');
    if (status === 401) throw new Error('Please sign in again.');
    throw new Error(error.message ?? 'Generation failed');
  }
  if (data?.kind === 'draft') return { kind: 'draft', draft: data as DraftRoutine };
  if (data?.kind === 'refusal') return { kind: 'refusal', reason: data.reason as string };
  throw new Error('Unexpected response from generator');
}

export default function AIGenerateScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();

  const [childFirstName, setChildFirstName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('7-10');
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<DraftRoutine | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: callGenerator,
    onSuccess: (result) => {
      if (result.kind === 'draft') {
        setDraft(result.draft);
        setRefusal(null);
      } else {
        setRefusal(result.reason);
        setDraft(null);
      }
    },
    onError: (err) => {
      Alert.alert('Generation failed', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (toSave: DraftRoutine) => {
      if (!userId) throw new Error('No user');
      const totalDurationMins = Math.max(
        1,
        Math.ceil(toSave.steps.reduce((sum, s) => sum + s.duration_seconds, 0) / 60),
      );
      const { data: newSet, error } = await supabase
        .from('activity_sets')
        .insert({
          set_name: toSave.set_name,
          category: toSave.category,
          icon_emoji: toSave.icon_emoji,
          requires_approval: false,
          is_custom: true,
          created_by_parent_id: userId,
          total_duration_mins: totalDurationMins,
        })
        .select('set_id')
        .single();
      if (error || !newSet) throw error ?? new Error('Insert failed');

      const stepRows = toSave.steps.map((s, idx) => ({
        set_id: newSet.set_id,
        order_index: idx,
        title: s.title,
        instruction_text: s.instruction_text,
        duration_seconds: s.duration_seconds,
        reward_stars: s.reward_stars,
      }));
      const { error: stepsErr } = await supabase.from('steps').insert(stepRows);
      if (stepsErr) throw stepsErr;

      // Stamp the audit log row with the saved set_id so we can trace
      // AI-generated sets that the parent actually adopted.
      await supabase
        .from('ai_generation_log')
        .update({ saved_as_set_id: newSet.set_id })
        .eq('log_id', toSave.log_id);

      return newSet.set_id;
    },
    onSuccess: () => {
      Alert.alert(
        'Saved',
        'The routine has been added to your activity sets. You can schedule it from the Schedule tab.',
        [
          {
            text: 'OK',
            onPress: () => {
              void qc.invalidateQueries({ queryKey: ['activitySetsWithSteps'] });
              router.back();
            },
          },
        ],
      );
    },
    onError: (err) => {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (trimmed.length < 10) {
      Alert.alert('Tell us more', 'Please describe your child and the routine in at least 10 characters.');
      return;
    }
    if (!childFirstName.trim()) {
      Alert.alert('Missing name', "Please enter your child's first name.");
      return;
    }
    generateMutation.mutate({
      prompt: trimmed,
      child_first_name: childFirstName.trim(),
      age_band: ageBand,
      provider,
    });
  }, [prompt, childFirstName, ageBand, provider, generateMutation]);

  const updateStep = useCallback((idx: number, patch: Partial<DraftStep>) => {
    setDraft((d) => {
      if (!d) return d;
      const steps = d.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...d, steps };
    });
  }, []);

  const removeStep = useCallback((idx: number) => {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, steps: d.steps.filter((_, i) => i !== idx) };
    });
  }, []);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI Routine Generator</Text>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Disclaimer banner — visible above the prompt every time */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                The AI drafts a routine you review and save. It can't see your
                child's full name, photo, or any medical history — only what
                you type below.
              </Text>
            </View>

            {/* Input form — hidden once a draft is shown so the parent focuses */}
            {!draft && (
              <>
                <Text style={styles.label}>Child's first name</Text>
                <TextInput
                  style={styles.input}
                  value={childFirstName}
                  onChangeText={setChildFirstName}
                  placeholder="e.g. Samia"
                  autoCapitalize="words"
                  maxLength={40}
                />

                <Text style={styles.label}>Age band</Text>
                <View style={styles.bandRow}>
                  {(['4-6', '7-10', '11-14'] as AgeBand[]).map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.bandChip, ageBand === b && styles.bandChipActive]}
                      onPress={() => setAgeBand(b)}
                    >
                      <Text style={[styles.bandText, ageBand === b && styles.bandTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>AI provider</Text>
                <View style={styles.providerStack}>
                  {(['anthropic', 'openai'] as Provider[]).map((p) => {
                    const meta = PROVIDER_LABEL[p];
                    const isActive = provider === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.providerRow, isActive && styles.providerRowActive]}
                        onPress={() => setProvider(p)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.providerEmoji}>{meta.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.providerLabel, isActive && styles.providerLabelActive]}>
                            {meta.label}
                          </Text>
                          <Text style={styles.providerSub}>{meta.sub}</Text>
                        </View>
                        <Text style={styles.providerCheck}>{isActive ? '●' : '○'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Describe your child + the routine</Text>
                <Text style={styles.helper}>
                  E.g. "Bedtime routine for my 7-year-old who hates teeth
                  brushing and loves dinosaurs. We get stuck on pyjamas every
                  night."
                </Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={5}
                  maxLength={600}
                  placeholder="Describe your child and the routine you want..."
                />
                <Text style={styles.counter}>{prompt.length} / 600</Text>

                <TouchableOpacity
                  style={[
                    styles.generateBtn,
                    generateMutation.isPending && styles.generateBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={[styles.generateBtnText, { marginLeft: 8 }]}>
                        Drafting…
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.generateBtnText}>✨ Generate Draft</Text>
                  )}
                </TouchableOpacity>

                {refusal && (
                  <View style={styles.refusalCard}>
                    <Text style={styles.refusalEmoji}>🛑</Text>
                    <Text style={styles.refusalText}>
                      {REFUSAL_MESSAGES[refusal] ?? REFUSAL_MESSAGES.rule_violation}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Draft review — editable, save not enabled if no steps */}
            {draft && (
              <>
                <View style={styles.draftHeader}>
                  <Text style={styles.draftEmoji}>{draft.icon_emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TextInput
                      style={styles.draftTitle}
                      value={draft.set_name}
                      onChangeText={(v) => setDraft({ ...draft, set_name: v })}
                      maxLength={100}
                    />
                    <Text style={styles.draftMeta}>
                      {draft.category} · {draft.steps.length} steps
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Steps — tap to edit</Text>

                {draft.steps.map((step, idx) => (
                  <View key={idx} style={styles.stepCard}>
                    <View style={styles.stepHeader}>
                      <Text style={styles.stepNumber}>{idx + 1}</Text>
                      <TouchableOpacity onPress={() => removeStep(idx)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.stepTitleInput}
                      value={step.title}
                      onChangeText={(v) => updateStep(idx, { title: v })}
                      maxLength={120}
                    />
                    <TextInput
                      style={styles.stepBodyInput}
                      value={step.instruction_text}
                      onChangeText={(v) => updateStep(idx, { instruction_text: v })}
                      multiline
                      numberOfLines={2}
                      maxLength={500}
                    />
                    <View style={styles.stepMetaRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>Duration (seconds)</Text>
                        <TextInput
                          style={styles.smallInput}
                          value={String(step.duration_seconds)}
                          onChangeText={(v) => {
                            const n = parseInt(v, 10);
                            updateStep(idx, {
                              duration_seconds: isNaN(n) ? 10 : Math.max(10, Math.min(600, n)),
                            });
                          }}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>Stars (1-3)</Text>
                        <TextInput
                          style={styles.smallInput}
                          value={String(step.reward_stars)}
                          onChangeText={(v) => {
                            const n = parseInt(v, 10);
                            updateStep(idx, {
                              reward_stars: isNaN(n) ? 1 : Math.max(1, Math.min(3, n)),
                            });
                          }}
                          keyboardType="number-pad"
                          maxLength={1}
                        />
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    (saveMutation.isPending || draft.steps.length === 0) &&
                      styles.saveBtnDisabled,
                  ]}
                  onPress={() => saveMutation.mutate(draft)}
                  disabled={saveMutation.isPending || draft.steps.length === 0}
                >
                  {saveMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save as Activity Set</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.discardBtn}
                  onPress={() => {
                    setDraft(null);
                    setPrompt('');
                  }}
                >
                  <Text style={styles.discardText}>Discard and try again</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
  back: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: '#111827' },
  disclaimer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  disclaimerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#5B21B6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
  },
  helper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  counter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  providerStack: { gap: 8, marginBottom: 4 },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  providerRowActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  providerEmoji: { fontSize: 22 },
  providerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#111827',
  },
  providerLabelActive: { color: '#5B21B6' },
  providerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  providerCheck: {
    fontSize: 18,
    color: '#7C3AED',
    width: 18,
    textAlign: 'center',
  },
  bandRow: { flexDirection: 'row', gap: 8 },
  bandChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  bandChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  bandText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#374151' },
  bandTextActive: { color: '#FFFFFF' },
  generateBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  generateBtnDisabled: { backgroundColor: '#A78BFA' },
  generateBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },

  refusalCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  refusalEmoji: { fontSize: 22 },
  refusalText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },

  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  draftEmoji: { fontSize: 36 },
  draftTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: '#111827',
    paddingVertical: 4,
  },
  draftMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#5B21B6',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumber: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#5B21B6',
    backgroundColor: '#EDE9FE',
    width: 22,
    height: 22,
    textAlign: 'center',
    lineHeight: 22,
    borderRadius: 11,
  },
  removeText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#EF4444' },
  stepTitleInput: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#111827',
    paddingVertical: 4,
    marginBottom: 4,
  },
  stepBodyInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#374151',
    paddingVertical: 4,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  stepMetaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  smallLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  smallInput: {
    backgroundColor: '#F5F0FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#111827',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnDisabled: { backgroundColor: '#86EFAC' },
  saveBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#FFFFFF' },
  discardBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  discardText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#9CA3AF',
  },
});
