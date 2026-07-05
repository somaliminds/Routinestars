/**
 * AnnualReviewForm — captures the human-completed parts of the statutory
 * EHCP annual review (metadata, parent contribution, child's views,
 * recommendation) and upserts them to the annual_reviews table.
 *
 * These feed the generated Annual Review Pack (see ehcp-report.ts §C5) so
 * parents fill them once rather than re-typing on every export.
 */
import { useEffect, useState } from 'react';
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
import { fetchAnnualReview, saveAnnualReview } from '@/lib/annual-review';
import type { AnnualReviewUpdate } from '@/lib/annual-review';

type Recommendation = 'MAINTAIN' | 'AMEND' | 'CEASE';

interface Props {
  visible: boolean;
  childId: string;
  childName: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Local editable copy of every review field (all optional strings). */
type FormState = {
  ehcp_date_issued: string;
  review_date: string;
  review_chair: string;
  attendees: string;
  parent_strengths: string;
  parent_progress: string;
  parent_concerns: string;
  parent_aspirations: string;
  parent_requested_changes: string;
  child_communication_method: string;
  child_how_i_feel: string;
  child_going_well: string;
  child_difficult: string;
  child_want_to_change: string;
  child_goals: string;
  recommendation: Recommendation | null;
};

const EMPTY: FormState = {
  ehcp_date_issued: '',
  review_date: '',
  review_chair: '',
  attendees: '',
  parent_strengths: '',
  parent_progress: '',
  parent_concerns: '',
  parent_aspirations: '',
  parent_requested_changes: '',
  child_communication_method: '',
  child_how_i_feel: '',
  child_going_well: '',
  child_difficult: '',
  child_want_to_change: '',
  child_goals: '',
  recommendation: null,
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = true,
  keyboardHint,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardHint?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {keyboardHint ? <Text style={styles.fieldHint}>{keyboardHint}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

export function AnnualReviewForm({ visible, childId, childName, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void (async () => {
      const row = await fetchAnnualReview(childId);
      if (row) {
        setForm({
          ehcp_date_issued: row.ehcp_date_issued ?? '',
          review_date: row.review_date ?? '',
          review_chair: row.review_chair ?? '',
          attendees: row.attendees ?? '',
          parent_strengths: row.parent_strengths ?? '',
          parent_progress: row.parent_progress ?? '',
          parent_concerns: row.parent_concerns ?? '',
          parent_aspirations: row.parent_aspirations ?? '',
          parent_requested_changes: row.parent_requested_changes ?? '',
          child_communication_method: row.child_communication_method ?? '',
          child_how_i_feel: row.child_how_i_feel ?? '',
          child_going_well: row.child_going_well ?? '',
          child_difficult: row.child_difficult ?? '',
          child_want_to_change: row.child_want_to_change ?? '',
          child_goals: row.child_goals ?? '',
          recommendation: row.recommendation,
        });
      } else {
        setForm(EMPTY);
      }
      setLoading(false);
    })();
  }, [visible, childId]);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Empty strings → null so the DB stores absence, not blanks.
      const nn = (s: string) => (s.trim().length ? s.trim() : null);
      const payload: AnnualReviewUpdate = {
        ehcp_date_issued: nn(form.ehcp_date_issued),
        review_date: nn(form.review_date),
        review_chair: nn(form.review_chair),
        attendees: nn(form.attendees),
        parent_strengths: nn(form.parent_strengths),
        parent_progress: nn(form.parent_progress),
        parent_concerns: nn(form.parent_concerns),
        parent_aspirations: nn(form.parent_aspirations),
        parent_requested_changes: nn(form.parent_requested_changes),
        child_communication_method: nn(form.child_communication_method),
        child_how_i_feel: nn(form.child_how_i_feel),
        child_going_well: nn(form.child_going_well),
        child_difficult: nn(form.child_difficult),
        child_want_to_change: nn(form.child_want_to_change),
        child_goals: nn(form.child_goals),
        recommendation: form.recommendation,
      };
      await saveAnnualReview(childId, payload);
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Most likely cause pre-migration: the table doesn't exist yet.
      Alert.alert(
        'Could not save',
        msg.includes('annual_reviews') || msg.includes('does not exist')
          ? 'Annual review storage is not set up on this account yet. Apply database migration 026 and rebuild.'
          : msg,
      );
    } finally {
      setSaving(false);
    }
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
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Annual Review — {childName}</Text>
          <TouchableOpacity
            onPress={() => void handleSave()}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={[styles.headerSave, saving && { opacity: 0.4 }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#7C3AED" size="large" />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <Text style={styles.intro}>
                These details complete the statutory annual review pack. The progress report is
                filled in automatically from RoutineStars data — you only add the sections below.
                All optional; save whatever you have.
              </Text>

              <SectionHeader>Review details</SectionHeader>
              <Field
                label="EHCP first issued"
                value={form.ehcp_date_issued}
                onChange={set('ehcp_date_issued')}
                placeholder="YYYY-MM-DD"
                multiline={false}
                keyboardHint="Used to work out when the review is due."
              />
              <Field
                label="Review meeting date"
                value={form.review_date}
                onChange={set('review_date')}
                placeholder="YYYY-MM-DD"
                multiline={false}
              />
              <Field
                label="Review chair"
                value={form.review_chair}
                onChange={set('review_chair')}
                placeholder="e.g. SENCo name"
                multiline={false}
              />
              <Field
                label="Attendees"
                value={form.attendees}
                onChange={set('attendees')}
                placeholder="Comma-separated names/roles"
              />

              <SectionHeader>Parent / carer contribution</SectionHeader>
              <Field
                label="Strengths and achievements this year"
                value={form.parent_strengths}
                onChange={set('parent_strengths')}
              />
              <Field
                label="Progress observed against the EHCP outcomes"
                value={form.parent_progress}
                onChange={set('parent_progress')}
              />
              <Field
                label="Concerns"
                value={form.parent_concerns}
                onChange={set('parent_concerns')}
              />
              <Field
                label="Aspirations for the next year"
                value={form.parent_aspirations}
                onChange={set('parent_aspirations')}
              />
              <Field
                label="Changes to the EHCP you'd like to request"
                value={form.parent_requested_changes}
                onChange={set('parent_requested_changes')}
              />

              <SectionHeader>Child / young person's views</SectionHeader>
              <Field
                label="Communication method used"
                value={form.child_communication_method}
                onChange={set('child_communication_method')}
                placeholder="e.g. verbal, symbols, AAC"
                multiline={false}
              />
              <Field
                label="How I feel about my support"
                value={form.child_how_i_feel}
                onChange={set('child_how_i_feel')}
              />
              <Field
                label="What is going well"
                value={form.child_going_well}
                onChange={set('child_going_well')}
              />
              <Field
                label="What is difficult"
                value={form.child_difficult}
                onChange={set('child_difficult')}
              />
              <Field
                label="What I want to change"
                value={form.child_want_to_change}
                onChange={set('child_want_to_change')}
              />
              <Field label="My goals" value={form.child_goals} onChange={set('child_goals')} />

              <SectionHeader>Review recommendation</SectionHeader>
              <View style={styles.recRow}>
                {(['MAINTAIN', 'AMEND', 'CEASE'] as Recommendation[]).map((r) => {
                  const active = form.recommendation === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.recBtn, active && styles.recBtnActive]}
                      onPress={() => setForm((f) => ({ ...f, recommendation: active ? null : r }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.recBtnText, active && styles.recBtnTextActive]}>
                        {r === 'MAINTAIN' ? 'Maintain' : r === 'AMEND' ? 'Amend' : 'Cease'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.recNote}>
                The local authority must notify its decision within 4 weeks of the review meeting
                (SEND Regs 2014, reg.18).
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
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
  headerCancel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSave: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginBottom: 16,
  },
  sectionHeader: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: '#5B21B6',
    marginTop: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: '#374151',
    marginBottom: 4,
  },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
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
  inputMultiline: { minHeight: 72 },
  recRow: { flexDirection: 'row', gap: 10 },
  recBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  recBtnActive: { borderColor: '#7C3AED', backgroundColor: '#7C3AED' },
  recBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#374151' },
  recBtnTextActive: { color: '#FFFFFF' },
  recNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    lineHeight: 15,
  },
});
