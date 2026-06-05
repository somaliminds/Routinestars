/**
 * Settings — Sprint 3.5
 *
 * Sections:
 *  1. Child profiles — add / edit name+emoji / delete
 *  2. PIN change — current PIN → new PIN confirm
 *  3. Notification preferences — on_completion / on_request toggles
 *  4. Care team — invite by email with view_only or approver role, revoke
 *
 * Spec: Section 5.5 — Settings
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useParentStore } from '@/stores/parent.store';
import { useSubscriptionStore, canAddChild, canShareCareTeam } from '@/stores/subscription.store';
import { useVoiceStore } from '@/stores/voice.store';
import { listEnglishVoices, previewVoice } from '@/lib/audio';
import type * as Speech from 'expo-speech';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChildProfile {
  profile_id: string;
  child_name: string;
  avatar_emoji: string;
  date_of_birth: string;
  first_then_mode: boolean;
}

interface ParentPrefs {
  notify_on_completion: boolean;
  notify_on_request: boolean;
  notify_transition_warnings: boolean;
}

interface CareTeamMember {
  member_id: string;
  email: string;
  role: 'view_only' | 'approver';
  invited_at: string;
  accepted_at: string | null;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────
const childSchema = z.object({
  child_name: z.string().min(1, 'Name is required').max(50),
  avatar_emoji: z.string().min(1, 'Pick an emoji'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  first_then_mode: z.boolean(),
});

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['view_only', 'approver']),
});

// ── Emoji palette ─────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🦁', '🐼', '🐨', '🦊', '🐸', '🐙', '🦄', '🐬', '🐧', '🦋'];

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchChildren(parentId: string): Promise<ChildProfile[]> {
  const { data, error } = await supabase
    .from('child_profiles')
    .select('profile_id, child_name, avatar_emoji, date_of_birth, first_then_mode')
    .eq('parent_id', parentId)
    .order('child_name');
  if (error) throw error;
  return data ?? [];
}

async function fetchPrefs(userId: string): Promise<ParentPrefs> {
  const { data, error } = await supabase
    .from('parent_profiles')
    .select('notify_on_completion, notify_on_request, notify_transition_warnings')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  // Return defaults if parent_profiles row not yet created (PIN setup skipped)
  return (
    data ?? {
      notify_on_completion: true,
      notify_on_request: true,
      notify_transition_warnings: true,
    }
  );
}

async function fetchCareTeam(parentId: string, childId: string): Promise<CareTeamMember[]> {
  const { data, error } = await supabase
    .from('care_team_members')
    .select('member_id, email, role, invited_at, accepted_at')
    .eq('parent_id', parentId)
    .eq('child_id', childId)
    .order('invited_at');
  if (error) throw error;
  return data ?? [];
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.8,
        color: '#5B21B6', // brand-dark — tighter visual hierarchy than neutral-700
        textTransform: 'uppercase',
        marginTop: 20, // was 24 (mt-6) — closer to its section (Law of Proximity)
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

// ── Child profile card ────────────────────────────────────────────────────────
function ChildCard({
  child,
  onEdit,
  onDelete,
}: {
  child: ChildProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-white rounded-2xl px-4 py-3 mb-2 shadow-sm flex-row items-center">
      <Text style={{ fontSize: 28 }} className="mr-3">
        {child.avatar_emoji}
      </Text>
      <View className="flex-1">
        <Text className="font-inter font-semibold text-neutral-900 text-sm">
          {child.child_name}
        </Text>
        <Text className="font-inter text-neutral-400 text-xs">DOB: {child.date_of_birth}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} className="px-3 py-1">
        <Text className="font-inter text-brand-primary text-sm font-semibold">Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} className="px-2 py-1">
        <Text className="font-inter text-accent-danger text-sm font-semibold">Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Child modal (add / edit) ──────────────────────────────────────────────────
function ChildModal({
  visible,
  initial,
  isLoading,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: ChildProfile | null;
  isLoading: boolean;
  onClose: () => void;
  onSave: (data: {
    child_name: string;
    avatar_emoji: string;
    date_of_birth: string;
    first_then_mode: boolean;
  }) => void;
}) {
  const [name, setName] = useState(initial?.child_name ?? '');
  const [emoji, setEmoji] = useState(initial?.avatar_emoji ?? '🦁');
  const [dob, setDob] = useState(initial?.date_of_birth ?? '');
  const [firstThenMode, setFirstThenMode] = useState(initial?.first_then_mode ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    const result = childSchema.safeParse({
      child_name: name,
      avatar_emoji: emoji,
      date_of_birth: dob,
      first_then_mode: firstThenMode,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    onSave(result.data);
  };

  // Auto-format DOB as user types: insert dashes after YYYY and MM
  const handleDobChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    setDob(formatted);
  };

  const handleOpen = useCallback(() => {
    setName(initial?.child_name ?? '');
    setEmoji(initial?.avatar_emoji ?? '🦁');
    setDob(initial?.date_of_birth ?? '');
    setFirstThenMode(initial?.first_then_mode ?? false);
    setErrors({});
  }, [initial]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
      >
        {/* Header — Cancel only; Save is at the bottom */}
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-neutral-100">
          <TouchableOpacity onPress={onClose} className="py-2 pr-4">
            <Text className="font-inter text-neutral-500 text-sm">Cancel</Text>
          </TouchableOpacity>
          <Text className="font-inter font-bold text-neutral-900 text-base">
            {initial ? 'Edit Child' : 'Add Child'}
          </Text>
          {/* Spacer to keep title centred */}
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          className="px-5 pt-5"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Emoji picker */}
          <Text className="font-inter text-neutral-700 text-sm font-semibold mb-2">Avatar</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {EMOJI_OPTIONS.map((e) => (
              <TouchableOpacity
                key={e}
                onPress={() => setEmoji(e)}
                className={`w-12 h-12 rounded-xl items-center justify-center ${emoji === e ? 'bg-brand-light border-2 border-brand-primary' : 'bg-[#F5F0FF]'}`}
              >
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Name */}
          <Text className="font-inter text-neutral-700 text-sm font-semibold mb-1">
            Child's name
          </Text>
          <TextInput
            className="bg-[#F5F0FF] rounded-xl px-4 py-3 font-inter text-neutral-900 text-sm mb-1"
            placeholder="e.g. Jamie"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          {errors.child_name ? (
            <Text className="font-inter text-accent-danger text-xs mb-3">{errors.child_name}</Text>
          ) : (
            <View className="mb-3" />
          )}

          {/* DOB */}
          <Text className="font-inter text-neutral-700 text-sm font-semibold mb-1">
            Date of birth
          </Text>
          <TextInput
            className="bg-[#F5F0FF] rounded-xl px-4 py-3 font-inter text-neutral-900 text-sm mb-1"
            placeholder="YYYY-MM-DD  (e.g. 2018-05-23)"
            value={dob}
            onChangeText={handleDobChange}
            keyboardType="number-pad"
            maxLength={10}
          />
          {errors.date_of_birth ? (
            <Text className="font-inter text-accent-danger text-xs mb-3">
              {errors.date_of_birth}
            </Text>
          ) : (
            <View className="mb-3" />
          )}

          {/* First-Then mode toggle — ASD support preference, persisted per child */}
          <View
            style={{
              backgroundColor: '#F5F0FF',
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 14,
                    color: '#111827',
                  }}
                >
                  First-Then mode
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    color: '#6B7280',
                    marginTop: 2,
                    lineHeight: 16,
                  }}
                >
                  Show only the current activity and a preview of what's next,
                  instead of the full day. Reduces overwhelm.
                </Text>
              </View>
              <Switch
                value={firstThenMode}
                onValueChange={setFirstThenMode}
                trackColor={{ false: '#D1D5DB', true: '#7C3AED' }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle First-Then mode for this child"
              />
            </View>
          </View>

          {/* Save button — full width, inside scroll so keyboard doesn't cover it */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            className="bg-brand-primary rounded-2xl py-4 items-center min-h-[56px] justify-center mt-2"
            accessibilityLabel="Save child profile"
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-inter font-semibold text-white text-base">
                {initial ? 'Save Changes' : 'Add Child'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── PIN change section ────────────────────────────────────────────────────────
function PinChangeSection({ userId }: { userId: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pinError, setPinError] = useState('');
  const [hasPinSet, setHasPinSet] = useState<boolean | null>(null);

  // Check whether this parent already has a PIN stored
  useEffect(() => {
    void supabase
      .from('parent_profiles')
      .select('pin_hash')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setHasPinSet(!!data?.pin_hash);
      });
  }, [userId]);

  const handleChange = async () => {
    const pinDigits = z.string().length(4, 'PIN must be 4 digits');
    const newSchema = hasPinSet
      ? z.object({ current: pinDigits, next: pinDigits, confirm: pinDigits })
      : z.object({ current: z.string(), next: pinDigits, confirm: pinDigits });
    const result = newSchema.safeParse({ current, next, confirm });
    if (!result.success) {
      setPinError(result.error.errors[0]?.message ?? 'Invalid PIN');
      return;
    }
    if (next !== confirm) {
      setPinError('New PINs do not match');
      return;
    }
    setSaving(true);
    setPinError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('change-pin', {
        body: { userId, currentPin: current, newPin: next },
      });
      if (fnErr || !(data as { success?: boolean } | null)?.success) {
        setPinError((data as { error?: string } | null)?.error ?? 'Current PIN is incorrect');
        return;
      }
      setSuccess(true);
      setHasPinSet(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const fields = hasPinSet
    ? [
        { label: 'Current PIN', value: current, setter: setCurrent },
        { label: 'New PIN', value: next, setter: setNext },
        { label: 'Confirm new PIN', value: confirm, setter: setConfirm },
      ]
    : [
        { label: 'New PIN', value: next, setter: setNext },
        { label: 'Confirm PIN', value: confirm, setter: setConfirm },
      ];

  return (
    <View className="bg-white rounded-2xl p-5 mb-2 shadow-sm">
      {hasPinSet === false && (
        <Text className="font-inter text-neutral-500 text-xs mb-3">
          No PIN set yet. Enter a new 4-digit PIN to protect your settings.
        </Text>
      )}
      {fields.map(({ label, value, setter }) => (
        <View key={label} className="mb-3">
          <Text className="font-inter text-neutral-600 text-xs mb-1">{label}</Text>
          <TextInput
            className="bg-[#F5F0FF] rounded-xl px-4 py-3 font-inter text-neutral-900 tracking-widest text-center text-lg"
            placeholder="••••"
            value={value}
            onChangeText={setter}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
          />
        </View>
      ))}
      {pinError ? (
        <Text className="font-inter text-accent-danger text-xs mb-2 text-center">{pinError}</Text>
      ) : null}
      {success ? (
        <Text className="font-inter text-accent-success text-xs mb-2 text-center">
          PIN updated successfully
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => {
          void handleChange();
        }}
        disabled={saving}
        className="bg-brand-primary rounded-xl py-3 items-center mt-1"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-inter font-semibold text-white text-sm">Change PIN</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Notification prefs section ────────────────────────────────────────────────
// ── Voice section ─────────────────────────────────────────────────────────────
const SAMPLE_TEXT = 'Great job! Brush your teeth in circles for two whole minutes.';

function VoiceSection() {
  const voiceId = useVoiceStore((s) => s.voiceId);
  const setVoiceId = useVoiceStore((s) => s.setVoiceId);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listEnglishVoices();
      if (!cancelled) {
        setVoices(list);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <ActivityIndicator className="my-4" color="#7C3AED" />;
  }

  if (voices.length === 0) {
    return (
      <View className="bg-white rounded-2xl px-5 py-4 mb-2 shadow-sm">
        <Text className="font-inter text-neutral-500 text-sm">
          No English voices available on this device. Install a voice via
          Settings → Language & input → Text-to-speech.
        </Text>
      </View>
    );
  }

  const handlePick = (id: string) => {
    setVoiceId(id);
    previewVoice(id, SAMPLE_TEXT);
  };

  return (
    <View className="bg-white rounded-2xl shadow-sm overflow-hidden mb-2">
      {/* Auto row */}
      <TouchableOpacity
        onPress={() => setVoiceId(null)}
        className="flex-row items-center px-5 py-4 border-b border-neutral-100"
        accessibilityRole="button"
        accessibilityLabel="Auto-pick best voice"
      >
        <View className="flex-1 mr-4">
          <Text className="font-inter font-semibold text-neutral-900 text-sm">Auto</Text>
          <Text className="font-inter text-neutral-500 text-xs mt-0.5">
            Pick the best voice automatically
          </Text>
        </View>
        <View
          className={`w-5 h-5 rounded-full border-2 ${
            voiceId === null ? 'bg-brand-primary border-brand-primary' : 'border-neutral-300'
          }`}
        />
      </TouchableOpacity>

      {voices.map((v, idx) => {
        const selected = voiceId === v.identifier;
        const isLast = idx === voices.length - 1;
        const subtitle = [
          v.language,
          v.quality === 'Enhanced' ? 'Enhanced' : null,
          v.name?.toLowerCase().includes('network') ? 'Network' : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <TouchableOpacity
            key={v.identifier}
            onPress={() => handlePick(v.identifier)}
            className={`flex-row items-center px-5 py-4 ${isLast ? '' : 'border-b border-neutral-100'}`}
            accessibilityRole="button"
            accessibilityLabel={`Use voice ${v.name}`}
          >
            <View className="flex-1 mr-4">
              <Text className="font-inter font-semibold text-neutral-900 text-sm" numberOfLines={1}>
                {v.name}
              </Text>
              <Text className="font-inter text-neutral-500 text-xs mt-0.5">{subtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={() => previewVoice(v.identifier, SAMPLE_TEXT)}
              className="px-3 py-1 mr-2 bg-brand-light rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={`Preview ${v.name}`}
            >
              <Text className="font-inter text-brand-primary text-xs font-semibold">▶ Preview</Text>
            </TouchableOpacity>
            <View
              className={`w-5 h-5 rounded-full border-2 ${
                selected ? 'bg-brand-primary border-brand-primary' : 'border-neutral-300'
              }`}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NotificationsSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['parentPrefs', userId],
    queryFn: () => fetchPrefs(userId),
    enabled: !!userId,
  });

  const toggle = (
    field: 'notify_on_completion' | 'notify_on_request' | 'notify_transition_warnings',
    value: boolean,
  ) => {
    void supabase
      .from('parent_profiles')
      .update({ [field]: value })
      .eq('user_id', userId)
      .then(() => qc.invalidateQueries({ queryKey: ['parentPrefs', userId] }));
  };

  if (isLoading || !prefs) return <ActivityIndicator className="my-4" color="#7C3AED" />;

  const rows = [
    {
      field: 'notify_on_completion' as const,
      label: 'Activity completed',
      sub: 'Notify when child finishes a set',
    },
    {
      field: 'notify_on_request' as const,
      label: 'Approval requested',
      sub: 'Notify when child requests approval',
    },
    {
      field: 'notify_transition_warnings' as const,
      label: 'Transition warnings',
      sub: '5- and 1-minute heads-up before each activity',
    },
  ];

  return (
    <View className="bg-white rounded-2xl shadow-sm overflow-hidden mb-2">
      {rows.map(({ field, label, sub }, idx) => (
        <View
          key={field}
          className={`flex-row items-center px-5 py-4 ${idx < rows.length - 1 ? 'border-b border-neutral-100' : ''}`}
        >
          <View className="flex-1 mr-4">
            <Text className="font-inter font-semibold text-neutral-900 text-sm">{label}</Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">{sub}</Text>
          </View>
          <Switch
            value={prefs[field]}
            onValueChange={(v) => toggle(field, v)}
            trackColor={{ true: '#7C3AED', false: '#E5E7EB' }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );
}

// ── AI features section ──────────────────────────────────────────────────────
// Per-parent opt-in for the (Sprint 3) AI routine generator. Defaulted FALSE
// per UK GDPR Article 22 default-off posture for automated decision-making.
// Even when ON, the AI never writes to the DB directly — drafts are reviewed
// and saved manually by the parent. See migration 023 for the audit log.
function AIFeaturesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: enabled, isLoading } = useQuery({
    queryKey: ['aiEnabled', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parent_profiles')
        .select('ai_routine_gen_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.ai_routine_gen_enabled ?? false;
    },
    enabled: !!userId,
  });

  const toggle = (next: boolean) => {
    void supabase
      .from('parent_profiles')
      .update({ ai_routine_gen_enabled: next })
      .eq('user_id', userId)
      .then(() => qc.invalidateQueries({ queryKey: ['aiEnabled', userId] }));
  };

  if (isLoading) return <ActivityIndicator className="my-4" color="#7C3AED" />;

  return (
    <View>
      <View className="bg-white rounded-2xl px-5 py-4 mb-2 shadow-sm flex-row items-center">
        <View className="flex-1 mr-4">
          <Text className="font-inter font-semibold text-neutral-900 text-sm">
            AI Routine Generator
          </Text>
          <Text className="font-inter text-neutral-500 text-xs mt-0.5">
            Describe your child and we'll draft a routine you can review,
            edit, and save. Drafts never appear on the child's screen
            without your explicit save.
          </Text>
        </View>
        <Switch
          value={enabled ?? false}
          onValueChange={toggle}
          trackColor={{ true: '#7C3AED', false: '#E5E7EB' }}
          thumbColor="#fff"
        />
      </View>
      <View className="bg-amber-50 rounded-2xl px-4 py-3 mb-2 border border-amber-200">
        <Text className="font-inter text-amber-900 text-xs leading-relaxed">
          ⚠️ This feature is rolling out gradually. Toggling it on registers
          your interest; the generator goes live in a future update. We never
          send your child's full name, photo, medical history, or DOB to the
          AI provider — only a first name, age band, and the prompt you write.
        </Text>
      </View>
    </View>
  );
}

// ── Care team section ─────────────────────────────────────────────────────────
function CareTeamSection({
  parentId,
  childId,
  childName,
  parentEmail,
}: {
  parentId: string;
  childId: string;
  childName: string;
  parentEmail: string;
}) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'view_only' | 'approver'>('view_only');
  const [inviteError, setInviteError] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['careTeam', parentId, childId],
    queryFn: () => fetchCareTeam(parentId, childId),
    enabled: !!parentId && !!childId,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: 'view_only' | 'approver' }) => {
      // 1. Create the DB row
      const { error } = await supabase.from('care_team_members').insert({
        parent_id: parentId,
        child_id: childId,
        email,
        role,
      });
      if (error) throw error;

      // 2. Send the branded invitation email via Resend (fire-and-forget —
      //    DB row still persists if the email send fails, so the parent can
      //    re-trigger by revoking + re-inviting if needed)
      try {
        await supabase.functions.invoke('send-care-invite', {
          body: {
            invitee_email: email,
            parent_name: parentEmail,
            child_name: childName,
            role,
          },
        });
      } catch (emailErr) {
        console.warn('[care-team] invite email send failed:', emailErr);
      }
    },
    onSuccess: () => {
      setInviteEmail('');
      setInviteError('');
      void qc.invalidateQueries({ queryKey: ['careTeam', parentId, childId] });
    },
    onError: () => setInviteError('Could not send invite. Email may already be added.'),
  });

  const revokeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('care_team_members').delete().eq('member_id', memberId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['careTeam', parentId, childId] }),
  });

  const handleInvite = () => {
    const result = inviteSchema.safeParse({ email: inviteEmail, role: inviteRole });
    if (!result.success) {
      setInviteError(result.error.errors[0]?.message ?? 'Invalid');
      return;
    }
    inviteMutation.mutate(result.data);
  };

  const confirmRevoke = (member: CareTeamMember) => {
    Alert.alert('Remove member', `Remove ${member.email} from care team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => revokeMutation.mutate(member.member_id),
      },
    ]);
  };

  if (isLoading) return <ActivityIndicator className="my-4" color="#7C3AED" />;

  return (
    <View className="bg-white rounded-2xl p-5 mb-2 shadow-sm">
      {members && members.length > 0 ? (
        <View className="mb-4">
          {members.map((m, idx) => (
            <View
              key={m.member_id}
              className={`flex-row items-center py-3 ${idx < members.length - 1 ? 'border-b border-neutral-100' : ''}`}
            >
              <View className="flex-1">
                <Text className="font-inter font-semibold text-neutral-900 text-sm">{m.email}</Text>
                <Text className="font-inter text-neutral-500 text-xs mt-0.5">
                  {m.role === 'view_only' ? 'View only' : 'Can approve'} ·{' '}
                  {m.accepted_at ? 'Active' : 'Pending'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => confirmRevoke(m)} className="px-2 py-1">
                <Text className="font-inter text-accent-danger text-sm">Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text className="font-inter text-neutral-400 text-sm text-center mb-4">
          No care team members yet
        </Text>
      )}

      {/* Invite form */}
      <Text className="font-inter text-neutral-600 text-xs mb-1">Invite by email</Text>
      <TextInput
        className="bg-[#F5F0FF] rounded-xl px-4 py-3 font-inter text-neutral-900 text-sm mb-2"
        placeholder="teacher@school.edu"
        value={inviteEmail}
        onChangeText={(t) => {
          setInviteEmail(t);
          setInviteError('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View className="flex-row gap-2 mb-3">
        {(['view_only', 'approver'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setInviteRole(r)}
            className={`flex-1 py-2 rounded-xl items-center border ${inviteRole === r ? 'bg-brand-primary border-brand-primary' : 'bg-white border-neutral-200'}`}
          >
            <Text
              className={`font-inter text-sm font-semibold ${inviteRole === r ? 'text-white' : 'text-neutral-500'}`}
            >
              {r === 'view_only' ? 'View only' : 'Can approve'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {inviteError ? (
        <Text className="font-inter text-accent-danger text-xs mb-2">{inviteError}</Text>
      ) : null}

      <TouchableOpacity
        onPress={handleInvite}
        disabled={inviteMutation.isPending}
        className="bg-brand-primary rounded-xl py-3 items-center"
      >
        {inviteMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-inter font-semibold text-white text-sm">Send Invite</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = session?.user.id ?? '';
  const { activeChild } = useParentStore();
  const subscription = useSubscriptionStore((s) => s.subscription);
  const qc = useQueryClient();


  const [childModal, setChildModal] = useState<{ visible: boolean; editing: ChildProfile | null }>({
    visible: false,
    editing: null,
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['settingsChildren', userId],
    queryFn: () => fetchChildren(userId),
    enabled: !!userId,
  });

  const saveChildMutation = useMutation({
    mutationFn: async (payload: {
      profile_id?: string;
      child_name: string;
      avatar_emoji: string;
      date_of_birth: string;
      first_then_mode: boolean;
    }) => {
      if (payload.profile_id) {
        const { error } = await supabase
          .from('child_profiles')
          .update({
            child_name: payload.child_name,
            avatar_emoji: payload.avatar_emoji,
            date_of_birth: payload.date_of_birth,
            first_then_mode: payload.first_then_mode,
          })
          .eq('profile_id', payload.profile_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('child_profiles').insert({
          parent_id: userId,
          child_name: payload.child_name,
          avatar_emoji: payload.avatar_emoji,
          date_of_birth: payload.date_of_birth,
          first_then_mode: payload.first_then_mode,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setChildModal({ visible: false, editing: null });
      void qc.invalidateQueries({ queryKey: ['settingsChildren', userId] });
    },
    onError: (err) => {
      Alert.alert('Error', 'Could not save child profile. Please try again.');
      console.error('saveChild error:', err);
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from('child_profiles').delete().eq('profile_id', profileId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settingsChildren', userId] }),
    onError: () => Alert.alert('Error', 'Could not delete child profile.'),
  });

  const confirmDeleteChild = (child: ChildProfile) => {
    Alert.alert(
      'Delete profile',
      `Delete ${child.child_name}? All their schedule data will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteChildMutation.mutate(child.profile_id),
        },
      ],
    );
  };


  return (
    <SafeAreaView className="flex-1 bg-[#F5F0FF]">
      <View className="px-5 pt-6 pb-4">
        <Text className="font-inter font-bold text-neutral-900" style={{ fontSize: 24 }}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Child Profiles ── */}
        <SectionHeader title="Child Profiles" />
        {childrenLoading ? (
          <ActivityIndicator color="#7C3AED" />
        ) : (
          <>
            {(children ?? []).map((child) => (
              <ChildCard
                key={child.profile_id}
                child={child}
                onEdit={() => setChildModal({ visible: true, editing: child })}
                onDelete={() => confirmDeleteChild(child)}
              />
            ))}
            <TouchableOpacity
              onPress={() => {
                if (!canAddChild(subscription, (children ?? []).length)) {
                  const plan = subscription?.plan ?? 'FREE';
                  const limit = plan === 'FREE' ? '1 child' : '3 children';
                  Alert.alert(
                    'Child limit reached',
                    `Your ${plan} plan supports ${limit}. Upgrade in Settings → Plan to add more.`,
                    [{ text: 'OK' }],
                  );
                  return;
                }
                setChildModal({ visible: true, editing: null });
              }}
              className="bg-white rounded-2xl py-3 items-center mb-2 shadow-sm border border-dashed border-brand-primary"
            >
              <Text className="font-inter font-semibold text-brand-primary text-sm">
                + Add Child
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── EHCP Outcomes ── */}
        <SectionHeader title="EHCP Outcomes" />
        <TouchableOpacity
          className="bg-white rounded-2xl px-4 py-4 mb-2 shadow-sm flex-row items-center"
          onPress={() => router.push('/(parent)/ehcp')}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 24 }} className="mr-3">
            📋
          </Text>
          <View className="flex-1">
            <Text className="font-inter font-semibold text-neutral-900 text-sm">
              Manage outcomes
            </Text>
            <Text className="font-inter text-neutral-500 text-xs mt-0.5">
              Set up the outcomes from your child's EHCP so review-time
              evidence packs generate automatically.
            </Text>
          </View>
          <Text className="font-inter text-neutral-400 ml-2">›</Text>
        </TouchableOpacity>

        {/* ── PIN Change ── */}
        <SectionHeader title="Change PIN" />
        <PinChangeSection userId={userId} />

        {/* ── Voice ── */}
        <SectionHeader title="Step Narration Voice" />
        <Text className="font-inter text-neutral-500 text-xs mb-3 px-1">
          Choose which voice reads the steps aloud. Tap any voice to hear a preview.
        </Text>
        <VoiceSection />

        {/* ── Notifications ── */}
        <SectionHeader title="Notifications" />
        <NotificationsSection userId={userId} />

        {/* ── AI features (experimental) ── */}
        <SectionHeader title="AI Features (Experimental)" />
        <AIFeaturesSection userId={userId} />

        {/* ── Care Team ── */}
        {activeChild && (
          <>
            <SectionHeader title={`Care Team — ${activeChild.child_name}`} />
            {canShareCareTeam(subscription) ? (
              <>
                <Text className="font-inter text-neutral-500 text-xs mb-3 px-1">
                  Invite teachers or therapists to view progress or approve activities.
                </Text>
                <CareTeamSection
                  parentId={userId}
                  childId={activeChild.profile_id}
                  childName={activeChild.child_name}
                  parentEmail={session?.user.email ?? 'A RoutineStars parent'}
                />
              </>
            ) : (
              <View className="bg-white rounded-2xl p-4 mb-2 shadow-sm items-center">
                <Text className="font-inter text-2xl mb-2">🔒</Text>
                <Text className="font-inter font-semibold text-neutral-900 text-sm text-center">
                  Care team sharing requires the Family plan
                </Text>
                <Text className="font-inter text-neutral-500 text-xs text-center mt-1">
                  Upgrade to Family (£9.99/mo) to invite teachers and therapists.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Sign out ── */}
        <SectionHeader title="Account" />
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () => {
                  void signOut();
                },
              },
            ]);
          }}
          className="bg-white rounded-2xl py-4 items-center shadow-sm"
        >
          <Text className="font-inter font-semibold text-accent-danger text-sm">Sign Out</Text>
        </TouchableOpacity>

        {/* Sentry test — dev only. Strip from production by checking __DEV__. */}
        {__DEV__ && (
          <TouchableOpacity
            onPress={() => {
              throw new Error('Sentry test crash from Settings — ' + new Date().toISOString());
            }}
            className="mt-3 bg-white rounded-2xl py-3 items-center border border-neutral-200"
            accessibilityLabel="Trigger test crash (dev only)"
            accessibilityRole="button"
          >
            <Text className="font-inter text-neutral-400 text-xs">
              [dev] Trigger test crash
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Child modal */}
      <ChildModal
        visible={childModal.visible}
        initial={childModal.editing}
        isLoading={saveChildMutation.isPending}
        onClose={() => setChildModal({ visible: false, editing: null })}
        onSave={(data) => {
          saveChildMutation.mutate({
            ...(childModal.editing ? { profile_id: childModal.editing.profile_id } : {}),
            ...data,
          });
        }}
      />
    </SafeAreaView>
  );
}
