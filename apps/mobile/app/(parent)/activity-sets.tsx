/**
 * Activity Set Editor — Sprint 3.3
 *
 * Browse all activity sets (15 built-in + custom).
 * Tap to view/edit steps. Create custom sets.
 * Edit: set name, category, icon, approval toggle.
 * Step editor: title, instruction, duration, stars.
 * Step reorder via up/down arrows.
 * Delete steps with confirm.
 *
 * Spec: Section 5.3 — Activity Set Editor
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
// expo-image-picker is a native module — static `import * as` would load
// it at route-tree evaluation (Expo Router scans every route at boot) and
// crash the entire app when running on a dev client that hasn't been
// rebuilt with the module yet. We import only the TYPE statically (erased
// at compile time, zero runtime impact) and dynamic-import the module
// inside the handler that actually needs it.
import type * as ImagePickerType from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth.store';
import {
  useSubscriptionStore,
  canAddCustomSet,
  canUseAI,
  requiredTierFor,
} from '@/stores/subscription.store';
import { supabase } from '@/lib/supabase';
import { quotaMessageFor } from '@/lib/quota-errors';
import type { ActivitySetRow, StepRow } from '@/types/database';
import { useResponsive } from '@/hooks/useResponsive';
import { OutcomeLinker } from '@/components/parent/OutcomeLinker';
import { useRouter } from 'expo-router';
import {
  getLocalIllustrationUri,
  setLocalIllustration,
  removeLocalIllustration,
} from '@/lib/local-illustrations';

// ── Zod Schemas ──────────────────────────────────────────────────────────────
const stepSchema = z.object({
  title: z.string().min(1).max(120),
  instruction_text: z.string().max(500),
  duration_seconds: z.number().int().min(5).max(600),
  reward_stars: z.number().int().min(1).max(5),
});

const setSchema = z.object({
  set_name: z.string().min(1).max(100),
  category: z.enum(['MORNING', 'SCHOOL', 'AFTERNOON', 'EVENING', 'WEEKEND', 'CUSTOM']),
  icon_emoji: z.string().min(1).max(10),
  requires_approval: z.boolean(),
});

type StepFormData = z.infer<typeof stepSchema>;
type SetFormData = z.infer<typeof setSchema>;

const CATEGORIES = ['MORNING', 'SCHOOL', 'AFTERNOON', 'EVENING', 'WEEKEND', 'CUSTOM'] as const;
const CATEGORY_EMOJIS: Record<string, string> = {
  MORNING: '🌅',
  SCHOOL: '🎒',
  AFTERNOON: '🌤',
  EVENING: '🌙',
  WEEKEND: '🎡',
  CUSTOM: '✨',
};

// ── Data Fetching ────────────────────────────────────────────────────────────
async function fetchActivitySetsWithSteps(
  parentId: string,
): Promise<{ set: ActivitySetRow; steps: StepRow[] }[]> {
  const { data: sets, error } = await supabase
    .from('activity_sets')
    .select('*')
    .or(`is_custom.eq.false,created_by_parent_id.eq.${parentId}`)
    .order('is_custom')
    .order('category')
    .order('set_name');

  if (error) throw error;

  const result: { set: ActivitySetRow; steps: StepRow[] }[] = [];
  for (const set of sets ?? []) {
    const { data: steps } = await supabase
      .from('steps')
      .select('*')
      .eq('set_id', set.set_id)
      .order('order_index');
    result.push({ set: set as ActivitySetRow, steps: (steps ?? []) as StepRow[] });
  }
  return result;
}

// ── Step Editor Modal ────────────────────────────────────────────────────────
function StepEditorModal({
  step,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  step: Partial<StepRow> | null;
  isNew: boolean;
  onSave: (data: StepFormData) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(step?.title ?? '');
  const [instruction, setInstruction] = useState(step?.instruction_text ?? '');
  const initialSecs = step?.duration_seconds ?? 60;
  const [durationMins, setDurationMins] = useState(Math.floor(initialSecs / 60));
  const [durationSecs, setDurationSecs] = useState(initialSecs % 60);
  const [stars, setStars] = useState(step?.reward_stars ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalDurationSeconds = durationMins * 60 + durationSecs;

  // Sprint 7: parent can attach a local-only photo to a saved step.
  // Unsaved/temp steps can't (no stable id to bind the file to).
  const stepId = step?.step_id;
  const canHavePhoto = !!stepId && !stepId.startsWith('temp-');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!canHavePhoto || !stepId) {
      setLocalPhotoUri(null);
      return;
    }
    let cancelled = false;
    void getLocalIllustrationUri(stepId).then((uri) => {
      if (!cancelled) setLocalPhotoUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [stepId, canHavePhoto]);

  const handlePickPhoto = useCallback(
    async (source: 'camera' | 'library') => {
      if (!stepId) return;
      setPhotoBusy(true);
      try {
        // Dynamic import keeps native-module loading out of the route
        // tree scan, so the screen mounts even on dev clients without
        // expo-image-picker linked. If the user actually taps the button
        // on such a client, this throws — caught + reported gracefully.
        let ImagePicker: typeof ImagePickerType;
        try {
          ImagePicker = await import('expo-image-picker');
        } catch {
          Alert.alert(
            'Photo picker unavailable',
            'Rebuild the app (eas build) to enable photo picking on this device.',
          );
          return;
        }
        const perm =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Permission needed',
            source === 'camera'
              ? 'Allow camera access in Settings to take a photo.'
              : 'Allow photo library access in Settings to choose a photo.',
          );
          return;
        }
        const opts: ImagePickerType.ImagePickerOptions = {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        };
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(opts)
            : await ImagePicker.launchImageLibraryAsync(opts);
        if (result.canceled || !result.assets[0]) return;
        const saved = await setLocalIllustration(stepId, result.assets[0].uri);
        setLocalPhotoUri(saved + '?t=' + Date.now()); // bust Image cache
      } finally {
        setPhotoBusy(false);
      }
    },
    [stepId],
  );

  const handleRemovePhoto = useCallback(async () => {
    if (!stepId) return;
    setPhotoBusy(true);
    try {
      await removeLocalIllustration(stepId);
      setLocalPhotoUri(null);
    } finally {
      setPhotoBusy(false);
    }
  }, [stepId]);

  const handleSave = useCallback(() => {
    const result = stepSchema.safeParse({
      title: title.trim(),
      instruction_text: instruction.trim(),
      duration_seconds: durationMins * 60 + durationSecs,
      reward_stars: stars,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }
    onSave(result.data);
  }, [title, instruction, durationMins, durationSecs, stars, onSave]);

  if (!step && !isNew) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-[#F7F8FC]">
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200 bg-white">
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text className="font-inter text-neutral-500">Cancel</Text>
          </TouchableOpacity>
          <Text className="font-inter font-semibold text-neutral-900">
            {isNew ? 'New Step' : 'Edit Step'}
          </Text>
          <TouchableOpacity onPress={handleSave} accessibilityRole="button">
            <Text className="font-inter font-semibold text-brand-primary">Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Title */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-1">
            Step Title *
          </Text>
          <TextInput
            className="bg-white border border-neutral-300 rounded-xl px-4 py-3 font-inter text-neutral-900 mb-1"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Brush teeth for 2 minutes"
            maxLength={120}
          />
          {errors.title && (
            <Text className="font-inter text-accent-danger text-xs mb-3">{errors.title}</Text>
          )}

          {/* Instruction */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-1 mt-3">
            Instructions
          </Text>
          <TextInput
            className="bg-white border border-neutral-300 rounded-xl px-4 py-3 font-inter text-neutral-900 mb-1"
            value={instruction}
            onChangeText={setInstruction}
            placeholder="What should the child do?"
            multiline
            numberOfLines={3}
            maxLength={500}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          {/* Duration */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-2 mt-4">
            Duration
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-neutral-200">
            <View className="flex-row items-center gap-6">
              {/* Minutes */}
              <View className="items-center gap-2">
                <Text className="font-inter text-neutral-500 text-xs">Minutes</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setDurationMins((m) => Math.max(0, m - 1))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F5F3FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease minutes"
                  >
                    <Text style={{ fontSize: 18, color: '#7C3AED' }}>−</Text>
                  </TouchableOpacity>
                  <Text
                    className="font-inter font-bold text-neutral-900"
                    style={{ fontSize: 24, minWidth: 32, textAlign: 'center' }}
                  >
                    {durationMins}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDurationMins((m) => Math.min(60, m + 1))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F5F3FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Increase minutes"
                  >
                    <Text style={{ fontSize: 18, color: '#7C3AED' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text className="font-inter font-bold text-neutral-400 text-xl">:</Text>

              {/* Seconds — steps of 15 */}
              <View className="items-center gap-2">
                <Text className="font-inter text-neutral-500 text-xs">Seconds</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setDurationSecs((s) => (s - 15 + 60) % 60)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F5F3FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease seconds"
                  >
                    <Text style={{ fontSize: 18, color: '#7C3AED' }}>−</Text>
                  </TouchableOpacity>
                  <Text
                    className="font-inter font-bold text-neutral-900"
                    style={{ fontSize: 24, minWidth: 32, textAlign: 'center' }}
                  >
                    {String(durationSecs).padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDurationSecs((s) => (s + 15) % 60)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F5F3FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Increase seconds"
                  >
                    <Text style={{ fontSize: 18, color: '#7C3AED' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Total display */}
              <View className="flex-1 items-end">
                <Text className="font-inter text-neutral-400 text-xs">Total</Text>
                <Text className="font-inter font-semibold text-brand-primary text-sm">
                  {totalDurationSeconds}s
                </Text>
              </View>
            </View>
            {errors.duration_seconds && (
              <Text className="font-inter text-accent-danger text-xs mt-2">
                {errors.duration_seconds}
              </Text>
            )}
          </View>

          {/* Stars */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-2 mt-4">
            Stars Reward (1–5)
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-neutral-200 flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => setStars((s) => Math.max(1, s - 1))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F5F3FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Decrease stars"
            >
              <Text style={{ fontSize: 20, color: '#7C3AED' }}>−</Text>
            </TouchableOpacity>
            <View className="flex-row gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setStars(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${n} stars`}
                >
                  <Text style={{ fontSize: 24 }}>{n <= stars ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setStars((s) => Math.min(5, s + 1))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F5F3FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Increase stars"
            >
              <Text style={{ fontSize: 20, color: '#7C3AED' }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Photo — Sprint 7. Local to this device only; never
              uploaded. Available only for saved steps so the file has a
              stable id to bind to. */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-2 mt-5">
            Custom Photo (this device only)
          </Text>
          {!canHavePhoto ? (
            <View className="bg-white rounded-2xl p-4 border border-neutral-200">
              <Text className="font-inter text-neutral-500 text-sm text-center">
                Save the step first, then re-open it to attach a photo.
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-4 border border-neutral-200">
              {localPhotoUri ? (
                <View className="items-center">
                  <Image
                    source={{ uri: localPhotoUri }}
                    style={{ width: 140, height: 140, borderRadius: 16 }}
                  />
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => void handlePickPhoto('library')}
                      disabled={photoBusy}
                      className="bg-brand-light rounded-xl px-4 py-2"
                      accessibilityRole="button"
                    >
                      <Text className="font-inter text-brand-primary text-sm font-semibold">
                        Change
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void handleRemovePhoto()}
                      disabled={photoBusy}
                      className="bg-accent-danger/10 rounded-xl px-4 py-2"
                      accessibilityRole="button"
                    >
                      <Text className="font-inter text-accent-danger text-sm font-semibold">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="font-inter text-neutral-400 text-xs mt-3 text-center">
                    Saved on this device only. Re-uploading on another device won't sync this photo.
                  </Text>
                </View>
              ) : (
                <View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => void handlePickPhoto('camera')}
                      disabled={photoBusy}
                      className="flex-1 bg-brand-light rounded-xl py-3 items-center"
                      accessibilityRole="button"
                    >
                      <Text className="font-inter text-brand-primary text-sm font-semibold">
                        📷 Take photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void handlePickPhoto('library')}
                      disabled={photoBusy}
                      className="flex-1 bg-brand-light rounded-xl py-3 items-center"
                      accessibilityRole="button"
                    >
                      <Text className="font-inter text-brand-primary text-sm font-semibold">
                        🖼 Choose photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="font-inter text-neutral-400 text-xs mt-2 text-center">
                    A photo of your child's own toothbrush or coat helps them recognise the step
                    faster than a pictogram.
                  </Text>
                </View>
              )}
            </View>
          )}

          {!isNew && onDelete && (
            <TouchableOpacity
              className="bg-accent-danger/10 rounded-2xl p-4 mt-6 items-center"
              onPress={onDelete}
              accessibilityRole="button"
            >
              <Text className="font-inter font-semibold text-accent-danger">Delete Step</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Activity Set Detail Modal ────────────────────────────────────────────────
function ActivitySetModal({
  item,
  parentId,
  onClose,
  onSaved,
}: {
  item: { set: ActivitySetRow; steps: StepRow[] } | null;
  parentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [setName, setSetName] = useState(item?.set.set_name ?? '');
  const [category, setCategory] = useState<SetFormData['category']>(
    (item?.set.category as SetFormData['category']) ?? 'MORNING',
  );
  const [iconEmoji, setIconEmoji] = useState(item?.set.icon_emoji ?? '📋');
  const [requiresApproval, setRequiresApproval] = useState(item?.set.requires_approval ?? false);
  const [steps, setSteps] = useState<StepRow[]>(item?.steps ?? []);
  const [editingStep, setEditingStep] = useState<{ step: Partial<StepRow>; isNew: boolean } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const isNew = !item;
  const isCustom = item?.set.is_custom ?? true;
  const canEdit = isNew || isCustom;

  const handleSave = useCallback(async () => {
    const parsed = setSchema.safeParse({
      set_name: setName.trim(),
      category,
      icon_emoji: iconEmoji,
      requires_approval: requiresApproval,
    });
    if (!parsed.success) {
      setNameError(parsed.error.errors[0]?.message ?? 'Invalid');
      return;
    }
    setIsSaving(true);
    try {
      let setId = item?.set.set_id;
      if (isNew) {
        const { data: newSet, error } = await supabase
          .from('activity_sets')
          .insert({
            ...parsed.data,
            is_custom: true,
            created_by_parent_id: parentId,
            total_duration_mins: Math.ceil(
              steps.reduce((sum, s) => sum + s.duration_seconds, 0) / 60,
            ),
          })
          .select('set_id')
          .single();
        if (error || !newSet) throw error;
        setId = newSet.set_id;

        // Insert all steps
        if (steps.length > 0) {
          await supabase.from('steps').insert(
            steps.map((s, i) => ({
              set_id: setId!,
              order_index: i,
              title: s.title,
              instruction_text: s.instruction_text,
              duration_seconds: s.duration_seconds,
              reward_stars: s.reward_stars,
            })),
          );
        }
      } else {
        await supabase
          .from('activity_sets')
          .update({
            ...parsed.data,
            total_duration_mins: Math.ceil(
              steps.reduce((sum, s) => sum + s.duration_seconds, 0) / 60,
            ),
          })
          .eq('set_id', setId!);
      }
      onSaved();
      onClose();
    } catch (err) {
      setIsSaving(false);
      const quota = quotaMessageFor(err);
      if (quota) Alert.alert(quota.title, quota.body);
    }
  }, [
    setName,
    category,
    iconEmoji,
    requiresApproval,
    steps,
    isNew,
    item,
    parentId,
    onSaved,
    onClose,
  ]);

  const handleStepSave = useCallback(
    async (data: StepFormData) => {
      if (!editingStep) return;
      const { step, isNew: stepIsNew } = editingStep;

      const setId = item?.set.set_id;

      if (stepIsNew || !setId) {
        // Local-only (new set) or new step for existing set
        const tempStep: StepRow = {
          step_id: `temp-${Date.now()}`,
          set_id: setId ?? '',
          order_index: steps.length,
          title: data.title,
          instruction_text: data.instruction_text,
          audio_url: null,
          illustration_url: null,
          duration_seconds: data.duration_seconds,
          reward_stars: data.reward_stars,
        };
        if (setId) {
          // Persist immediately for existing sets
          const { data: newStep } = await supabase
            .from('steps')
            .insert({ set_id: setId, order_index: steps.length, ...data })
            .select('*')
            .single();
          setSteps((prev) => [...prev, (newStep as StepRow) ?? tempStep]);
        } else {
          setSteps((prev) => [...prev, tempStep]);
        }
      } else {
        // Update existing step
        if (step.step_id && !step.step_id.startsWith('temp-')) {
          await supabase.from('steps').update(data).eq('step_id', step.step_id);
        }
        setSteps((prev) => prev.map((s) => (s.step_id === step.step_id ? { ...s, ...data } : s)));
      }
      setEditingStep(null);
    },
    [editingStep, steps, item],
  );

  const handleStepDelete = useCallback(async (step: StepRow) => {
    Alert.alert('Delete Step', `Delete "${step.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!step.step_id.startsWith('temp-')) {
            await supabase.from('steps').delete().eq('step_id', step.step_id);
          }
          // Drop any local photo the parent had attached for this step.
          await removeLocalIllustration(step.step_id);
          setSteps((prev) => prev.filter((s) => s.step_id !== step.step_id));
          setEditingStep(null);
        },
      },
    ]);
  }, []);

  const moveStep = useCallback(
    async (idx: number, direction: -1 | 1) => {
      const newSteps = [...steps];
      const target = idx + direction;
      if (target < 0 || target >= newSteps.length) return;
      [newSteps[idx], newSteps[target]] = [newSteps[target]!, newSteps[idx]!];

      // Update order_index locally
      const updated = newSteps.map((s, i) => ({ ...s, order_index: i }));
      setSteps(updated);

      // Persist if real set
      if (item?.set.set_id) {
        for (const s of updated) {
          if (!s.step_id.startsWith('temp-')) {
            await supabase
              .from('steps')
              .update({ order_index: s.order_index })
              .eq('step_id', s.step_id);
          }
        }
      }
    },
    [steps, item],
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-[#F7F8FC]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200 bg-white">
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text className="font-inter text-neutral-500">Close</Text>
          </TouchableOpacity>
          <Text className="font-inter font-semibold text-neutral-900">
            {isNew ? 'New Activity Set' : item.set.set_name}
          </Text>
          {canEdit && (
            <TouchableOpacity
              onPress={() => void handleSave()}
              disabled={isSaving}
              accessibilityRole="button"
            >
              <Text
                className={`font-inter font-semibold ${isSaving ? 'text-neutral-300' : 'text-brand-primary'}`}
              >
                {isSaving ? '...' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}
          {!canEdit && <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Set metadata */}
          {canEdit ? (
            <View className="bg-white rounded-2xl p-4 mb-4">
              <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-1">
                Set Name *
              </Text>
              <TextInput
                className="border border-neutral-300 rounded-xl px-4 py-2 font-inter text-neutral-900 mb-1"
                value={setName}
                onChangeText={setSetName}
                maxLength={100}
                placeholder="e.g. Morning Routine"
              />
              {nameError ? (
                <Text className="font-inter text-accent-danger text-xs mb-2">{nameError}</Text>
              ) : null}

              <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mt-3 mb-1">
                Icon Emoji
              </Text>
              <TextInput
                className="border border-neutral-300 rounded-xl px-4 py-2 font-inter text-neutral-900 w-20"
                value={iconEmoji}
                onChangeText={setIconEmoji}
                maxLength={4}
              />

              <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mt-3 mb-2">
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      className={`rounded-xl px-3 py-2 border ${
                        category === cat
                          ? 'bg-brand-primary border-brand-primary'
                          : 'bg-[#F7F8FC] border-neutral-200'
                      }`}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        className={`font-inter text-xs font-semibold ${
                          category === cat ? 'text-white' : 'text-neutral-700'
                        }`}
                      >
                        {CATEGORY_EMOJIS[cat]} {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                <Text className="font-inter text-neutral-700 text-sm">Requires Approval</Text>
                <Switch
                  value={requiresApproval}
                  onValueChange={setRequiresApproval}
                  trackColor={{ false: '#D1D5DB', true: '#7C3AED' }}
                  thumbColor="white"
                />
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center">
              <Text style={{ fontSize: 32 }} className="mr-3">
                {item.set.icon_emoji}
              </Text>
              <View className="flex-1">
                <Text className="font-inter font-bold text-neutral-900">{item.set.set_name}</Text>
                <Text className="font-inter text-neutral-500 text-sm">
                  {CATEGORY_EMOJIS[item.set.category]} {item.set.category}
                  {item.set.requires_approval ? ' · Approval required' : ''}
                </Text>
              </View>
              <View className="bg-[#F7F8FC] rounded-lg px-2 py-1">
                <Text className="font-inter text-neutral-500 text-xs">Built-in</Text>
              </View>
            </View>
          )}

          {/* Linked EHCP outcomes — visible for both custom and built-in sets so
              parents can map any set to their child's outcomes. */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-2">
            Linked EHCP Outcomes
          </Text>
          <View className="mb-4">
            <OutcomeLinker setId={item?.set.set_id} parentUserId={parentId} />
          </View>

          {/* Steps */}
          <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3">
            Steps ({steps.length})
          </Text>

          {steps.map((step, idx) => (
            <View
              key={step.step_id}
              className="bg-white rounded-2xl p-4 mb-2 flex-row items-center shadow-sm"
            >
              <View className="bg-brand-light rounded-lg w-8 h-8 items-center justify-center mr-3">
                <Text className="font-inter font-bold text-brand-primary text-sm">{idx + 1}</Text>
              </View>
              <View className="flex-1">
                <Text
                  className="font-inter font-semibold text-neutral-900 text-sm"
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
                <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                  {step.duration_seconds}s · {step.reward_stars}⭐
                </Text>
              </View>
              {canEdit && (
                <View className="flex-row gap-1">
                  <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => void moveStep(idx, -1)}
                    disabled={idx === 0}
                  >
                    <Text
                      className={`font-inter ${idx === 0 ? 'text-neutral-200' : 'text-neutral-500'}`}
                    >
                      ↑
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => void moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                  >
                    <Text
                      className={`font-inter ${idx === steps.length - 1 ? 'text-neutral-200' : 'text-neutral-500'}`}
                    >
                      ↓
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => setEditingStep({ step, isNew: false })}
                  >
                    <Text className="font-inter text-brand-primary">✎</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {canEdit && (
            <TouchableOpacity
              className="border-2 border-dashed border-neutral-300 rounded-2xl p-4 items-center mt-1"
              onPress={() => setEditingStep({ step: {}, isNew: true })}
              accessibilityRole="button"
            >
              <Text className="font-inter font-semibold text-neutral-500 text-sm">+ Add Step</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>

      {editingStep && (
        <StepEditorModal
          step={editingStep.step}
          isNew={editingStep.isNew}
          onSave={(data) => void handleStepSave(data)}
          onDelete={
            !editingStep.isNew
              ? () => void handleStepDelete(editingStep.step as StepRow)
              : undefined
          }
          onClose={() => setEditingStep(null)}
        />
      )}
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ActivitySetsScreen() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const subscription = useSubscriptionStore((s) => s.subscription);
  const canCreateCustom = canAddCustomSet(subscription);
  const aiAllowed = canUseAI(subscription);
  const queryClient = useQueryClient();
  const r = useResponsive();
  const router = useRouter();

  // Feature flag — only show AI generator entry when the parent has opted in
  const { data: aiEnabled = false } = useQuery({
    queryKey: ['aiEnabled', userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from('parent_profiles')
        .select('ai_routine_gen_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.ai_routine_gen_enabled ?? false;
    },
    enabled: !!userId,
  });

  const [selectedItem, setSelectedItem] = useState<{
    set: ActivitySetRow;
    steps: StepRow[];
  } | null>(null);
  const [createNew, setCreateNew] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['activitySetsWithSteps', userId],
    queryFn: () => fetchActivitySetsWithSteps(userId!),
    enabled: !!userId,
  });

  const onSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['activitySetsWithSteps', userId] });
    void queryClient.invalidateQueries({ queryKey: ['activitySets', userId] });
  }, [queryClient, userId]);

  // ── Duplicate & customise ──────────────────────────────────────────────────
  // Built-in sets are shared rows and can't be edited directly (RLS). This
  // clones one — set + all steps (pictograms included) — into a private custom
  // copy the parent CAN edit, then opens the editor on it. Gated to Starter+
  // client-side here and server-side by the custom-set quota trigger (035).
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const handleDuplicate = useCallback(
    async (item: { set: ActivitySetRow; steps: StepRow[] }) => {
      if (!userId || duplicatingId) return;
      if (!canCreateCustom) {
        Alert.alert(
          'Upgrade to customise',
          'Duplicating a built-in set into your own editable copy is available on Starter and above. Upgrade in Settings → Plan.',
          [{ text: 'OK' }],
        );
        return;
      }
      setDuplicatingId(item.set.set_id);
      try {
        const { data: newSet, error: setErr } = await supabase
          .from('activity_sets')
          .insert({
            set_name: `${item.set.set_name} (my version)`,
            category: item.set.category,
            icon_emoji: item.set.icon_emoji,
            colour_theme: item.set.colour_theme,
            total_duration_mins: item.set.total_duration_mins,
            requires_approval: item.set.requires_approval,
            is_custom: true,
            created_by_parent_id: userId,
          })
          .select('*')
          .single();
        if (setErr || !newSet) throw setErr ?? new Error('Could not duplicate set');

        let newSteps: StepRow[] = [];
        if (item.steps.length > 0) {
          const { data: inserted, error: stepsErr } = await supabase
            .from('steps')
            .insert(
              item.steps.map((s) => ({
                set_id: newSet.set_id,
                order_index: s.order_index,
                title: s.title,
                instruction_text: s.instruction_text,
                duration_seconds: s.duration_seconds,
                reward_stars: s.reward_stars,
                audio_url: s.audio_url,
                illustration_url: s.illustration_url,
              })),
            )
            .select('*');
          if (stepsErr) throw stepsErr;
          newSteps = ((inserted ?? []) as StepRow[]).sort((a, b) => a.order_index - b.order_index);
        }

        onSaved();
        // Straight into the editor on the fresh copy.
        setSelectedItem({ set: newSet as ActivitySetRow, steps: newSteps });
      } catch (err) {
        const quota = quotaMessageFor(err);
        if (quota) {
          Alert.alert(quota.title, quota.body);
        } else {
          Alert.alert('Could not duplicate', 'Something went wrong. Please try again.');
        }
      } finally {
        setDuplicatingId(null);
      }
    },
    [userId, canCreateCustom, duplicatingId, onSaved],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F8FC] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const customSets = (items ?? []).filter((i) => i.set.is_custom);
  const builtInSets = (items ?? []).filter((i) => !i.set.is_custom);

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      <View className="px-5 pt-6 pb-4">
        <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
          Activity Sets
        </Text>
        <Text className="font-inter text-neutral-500 text-sm mt-0.5">
          {items?.length ?? 0} sets available
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: r.scrollClearance + 72 }}
      >
        {/* AI Generator entry — gated by BOTH a per-user opt-in flag
            (privacy/safety) AND the subscription tier (Family+). Free
            and Starter users see a locked card that routes to the
            Subscription page; Family+ users see the working entry only
            if they've opted in via Settings → AI Features. */}
        {aiAllowed && aiEnabled && (
          <TouchableOpacity
            className="bg-white rounded-2xl px-4 py-3 mb-4 flex-row items-center shadow-sm"
            style={{ borderWidth: 1, borderColor: '#EDE9FE' }}
            onPress={() => router.push('/(parent)/ai-generate')}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 22 }} className="mr-3">
              ✨
            </Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-sm">
                Generate with AI
              </Text>
              <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                Describe your child and the routine — review the draft before saving.
              </Text>
            </View>
            <Text className="font-inter text-brand-primary">›</Text>
          </TouchableOpacity>
        )}
        {!aiAllowed && (
          <TouchableOpacity
            className="bg-white rounded-2xl px-4 py-3 mb-4 flex-row items-center shadow-sm"
            style={{ borderWidth: 1, borderColor: '#EDE9FE', opacity: 0.95 }}
            onPress={() => router.push('/(parent)/subscription')}
            accessibilityRole="button"
            accessibilityHint="Opens the subscription page to upgrade"
          >
            <Text style={{ fontSize: 22 }} className="mr-3">
              🔒
            </Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-sm">
                AI routine generation
              </Text>
              <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                Available on {requiredTierFor('canUseAI').tierName} ·{' '}
                {requiredTierFor('canUseAI').priceDisplay}
              </Text>
            </View>
            <Text className="font-inter text-brand-primary text-xs font-semibold">UPGRADE ›</Text>
          </TouchableOpacity>
        )}

        {/* Custom sets */}
        {customSets.length > 0 && (
          <>
            <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3">
              My Custom Sets
            </Text>
            {customSets.map((item) => (
              <TouchableOpacity
                key={item.set.set_id}
                className="bg-white rounded-2xl p-4 mb-2 flex-row items-center shadow-sm border-l-4 border-brand-primary"
                onPress={() => setSelectedItem(item)}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 28 }} className="mr-3">
                  {item.set.icon_emoji}
                </Text>
                <View className="flex-1">
                  <Text className="font-inter font-semibold text-neutral-900 text-sm">
                    {item.set.set_name}
                  </Text>
                  <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                    {item.steps.length} steps · {item.set.total_duration_mins} min
                  </Text>
                </View>
                <Text className="font-inter text-neutral-400">›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Built-in sets */}
        <Text className="font-inter font-semibold text-neutral-700 text-xs uppercase tracking-wide mb-3 mt-2">
          Built-in Sets
        </Text>
        {builtInSets.map((item) => (
          <TouchableOpacity
            key={item.set.set_id}
            className="bg-white rounded-2xl p-4 mb-2 flex-row items-center shadow-sm"
            onPress={() => setSelectedItem(item)}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 28 }} className="mr-3">
              {item.set.icon_emoji}
            </Text>
            <View className="flex-1">
              <Text className="font-inter font-semibold text-neutral-900 text-sm">
                {item.set.set_name}
              </Text>
              <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                {item.steps.length} steps · {item.set.total_duration_mins} min
                {item.set.requires_approval ? ' · Approval' : ''}
              </Text>
            </View>
            {/* Duplicate into an editable custom copy (Starter+) */}
            <TouchableOpacity
              className="px-3 py-2 mr-1 rounded-xl bg-brand-light"
              onPress={() => void handleDuplicate(item)}
              disabled={duplicatingId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Duplicate ${item.set.set_name} into an editable copy`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              {duplicatingId === item.set.set_id ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Text className="font-inter font-semibold text-brand-primary text-xs">
                  Duplicate
                </Text>
              )}
            </TouchableOpacity>
            <Text className="font-inter text-neutral-400">›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create button — lifted above the floating tab bar via useResponsive
          so it never sits underneath the nav pill on Samsung/software-nav devices. */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: r.tabBarBottom + r.tabBarHeight + 8,
        }}
      >
        <TouchableOpacity
          className={`rounded-2xl items-center justify-center shadow-lg ${canCreateCustom ? 'bg-brand-primary' : 'bg-neutral-300'}`}
          style={{ height: 56 }}
          onPress={() => {
            if (!canCreateCustom) {
              Alert.alert(
                'Upgrade required',
                'Custom activity sets are available on the Starter plan and above. Upgrade in Settings → Plan.',
                [{ text: 'OK' }],
              );
              return;
            }
            setCreateNew(true);
          }}
          accessibilityRole="button"
        >
          <Text className="font-inter font-semibold text-white text-base">
            {canCreateCustom ? '+ Create Custom Set' : '🔒 Custom Sets (Starter+)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Edit modal */}
      {(selectedItem || createNew) && (
        <ActivitySetModal
          item={createNew ? null : selectedItem}
          parentId={userId ?? ''}
          onClose={() => {
            setSelectedItem(null);
            setCreateNew(false);
          }}
          onSaved={onSaved}
        />
      )}
    </SafeAreaView>
  );
}
