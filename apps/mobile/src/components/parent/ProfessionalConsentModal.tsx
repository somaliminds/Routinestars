/**
 * ProfessionalConsentModal — the parent's control over which professionals
 * can see their child's data, for how long, and which categories.
 *
 * This is the human side of the consent ledger (migration 028): grant
 * scoped/time-limited access, withdraw it instantly, and view the access
 * audit log. High-privacy defaults per role (ICO Children's Code); the
 * parent is always in control (§G, DPIA §5).
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
import { format, addMonths } from 'date-fns';
import {
  listConsentsForChild,
  grantConsent,
  withdrawConsent,
  isConsentActive,
  listAuditForChild,
  ROLE_LABEL,
  CATEGORY_LABEL,
  ROLE_DEFAULT_CATEGORIES,
  type ConsentRow,
  type AuditRow,
  type ProfessionalRole,
  type DataCategory,
} from '@/lib/professional-access';

interface Props {
  visible: boolean;
  childId: string;
  childName: string;
  parentUserId: string;
  onClose: () => void;
}

const ROLES = Object.keys(ROLE_LABEL) as ProfessionalRole[];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as DataCategory[];

const ACTION_LABEL: Record<AuditRow['action'], string> = {
  VIEW: 'viewed',
  CONTRIBUTE: 'added input to',
  EXPORT: 'exported',
};

export function ProfessionalConsentModal({
  visible,
  childId,
  childName,
  parentUserId,
  onClose,
}: Props) {
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [showGrant, setShowGrant] = useState(false);

  // Grant form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProfessionalRole>('SENCO');
  const [org, setOrg] = useState('');
  const [cats, setCats] = useState<DataCategory[]>(ROLE_DEFAULT_CATEGORIES.SENCO);
  const [expiry, setExpiry] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [purpose, setPurpose] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [c, a] = await Promise.all([listConsentsForChild(childId), listAuditForChild(childId)]);
    setConsents(c);
    setAudit(a);
    setLoading(false);
  }, [childId]);

  useEffect(() => {
    if (visible) {
      setShowGrant(false);
      void load();
    }
  }, [visible, load]);

  // When role changes, reset categories to that role's least-privilege default.
  const pickRole = (r: ProfessionalRole) => {
    setRole(r);
    setCats(ROLE_DEFAULT_CATEGORIES[r]);
  };

  const toggleCat = (c: DataCategory) =>
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const resetForm = () => {
    setEmail('');
    setRole('SENCO');
    setOrg('');
    setCats(ROLE_DEFAULT_CATEGORIES.SENCO);
    setExpiry(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
    setPurpose('');
  };

  const handleGrant = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      Alert.alert('Enter a valid email', "The professional's email is required.");
      return;
    }
    if (cats.length === 0) {
      Alert.alert('Choose data to share', 'Select at least one data category, or cancel.');
      return;
    }
    setGranting(true);
    try {
      await grantConsent({
        child_id: childId,
        consent_given_by: parentUserId,
        professional_email: email.trim().toLowerCase(),
        professional_role: role,
        professional_org: org.trim() || null,
        data_categories: cats,
        purpose: purpose.trim() || null,
        expiry_date: expiry,
      });
      resetForm();
      setShowGrant(false);
      await load();
      Alert.alert(
        'Access granted',
        `${email.trim()} can access ${childName}'s data once they sign up with that email. You can withdraw access at any time.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert(
        'Could not grant access',
        msg.includes('consent_records') || msg.includes('does not exist')
          ? 'Consent storage is not set up on this account yet. Apply database migration 028 and rebuild.'
          : msg,
      );
    } finally {
      setGranting(false);
    }
  };

  const handleWithdraw = (c: ConsentRow) => {
    Alert.alert(
      'Withdraw access',
      `Immediately stop ${c.professional_email} from accessing ${childName}'s data?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await withdrawConsent(c.consent_id, parentUserId);
                await load();
              } catch (err) {
                Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error');
              }
            })();
          },
        },
      ],
    );
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
            <Text style={styles.headerBtn}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Support team — {childName}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
            <Text style={styles.intro}>
              Give a professional (SENCo, therapist, etc.) secure, time-limited access to
              {` ${childName}'s`} data. You choose exactly what they can see and can withdraw access
              instantly. Every time they view or add anything, it's recorded below.
            </Text>

            {loading ? (
              <ActivityIndicator color="#7C3AED" style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Active + past consents */}
                <Text style={styles.sectionHeader}>People with access</Text>
                {consents.length === 0 && (
                  <Text style={styles.empty}>No professionals have been given access yet.</Text>
                )}
                {consents.map((c) => {
                  const active = isConsentActive(c);
                  return (
                    <View key={c.consent_id} style={styles.consentCard}>
                      <View style={styles.consentTop}>
                        <Text style={styles.consentEmail} numberOfLines={1}>
                          {c.professional_email}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            active ? styles.pillActive : styles.pillInactive,
                          ]}
                        >
                          <Text style={styles.pillText}>
                            {c.withdrawn_at ? 'Withdrawn' : active ? 'Active' : 'Expired'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.consentMeta}>
                        {ROLE_LABEL[c.professional_role as ProfessionalRole] ?? c.professional_role}
                        {c.professional_org ? ` · ${c.professional_org}` : ''}
                      </Text>
                      <Text style={styles.consentMeta}>
                        Can see:{' '}
                        {c.data_categories
                          .map((x) => CATEGORY_LABEL[x as DataCategory] ?? x)
                          .join(', ')}
                      </Text>
                      <Text style={styles.consentMeta}>
                        {c.withdrawn_at ? 'Withdrawn' : `Expires ${c.expiry_date}`}
                      </Text>
                      {active && (
                        <TouchableOpacity
                          style={styles.withdrawBtn}
                          onPress={() => handleWithdraw(c)}
                        >
                          <Text style={styles.withdrawText}>Withdraw access</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* Grant new */}
                {showGrant ? (
                  <View style={styles.grantCard}>
                    <Text style={styles.sectionHeader}>Grant access</Text>

                    <Text style={styles.fieldLabel}>Professional's email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@service.nhs.uk"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />

                    <Text style={styles.fieldLabel}>Their role</Text>
                    <View style={styles.chipWrap}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.chip, role === r && styles.chipActive]}
                          onPress={() => pickRole(r)}
                        >
                          <Text style={[styles.chipText, role === r && styles.chipTextActive]}>
                            {ROLE_LABEL[r]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>Organisation (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={org}
                      onChangeText={setOrg}
                      placeholder="e.g. Oakfield Primary / NHS Trust"
                      placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.fieldLabel}>What they can see</Text>
                    <Text style={styles.fieldHint}>
                      Pre-set to the least this role usually needs — adjust freely.
                    </Text>
                    <View style={styles.catWrap}>
                      {CATEGORIES.map((c) => {
                        const on = cats.includes(c);
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.catChip, on && styles.catChipOn]}
                            onPress={() => toggleCat(c)}
                          >
                            <Text style={[styles.catText, on && styles.catTextOn]}>
                              {on ? '✓ ' : ''}
                              {CATEGORY_LABEL[c]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Access expires</Text>
                    <TextInput
                      style={styles.input}
                      value={expiry}
                      onChangeText={setExpiry}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.fieldLabel}>Purpose (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={purpose}
                      onChangeText={setPurpose}
                      placeholder="e.g. EHC needs assessment advice"
                      placeholderTextColor="#9CA3AF"
                    />

                    <View style={styles.grantActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          resetForm();
                          setShowGrant(false);
                        }}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.grantBtn}
                        onPress={() => void handleGrant()}
                        disabled={granting}
                      >
                        <Text style={styles.grantBtnText}>
                          {granting ? 'Granting…' : 'Grant access'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setShowGrant(true)}>
                    <Text style={styles.addBtnText}>+ Give a professional access</Text>
                  </TouchableOpacity>
                )}

                {/* Access history */}
                <Text style={[styles.sectionHeader, { marginTop: 22 }]}>Access history</Text>
                {audit.length === 0 ? (
                  <Text style={styles.empty}>
                    Nothing yet. Every time a professional views or adds something, it appears here.
                  </Text>
                ) : (
                  audit.map((a) => (
                    <View key={a.event_id} style={styles.auditRow}>
                      <Text style={styles.auditText}>
                        {ACTION_LABEL[a.action]} {a.data_categories.length} item(s)
                      </Text>
                      <Text style={styles.auditTime}>
                        {format(new Date(a.occurred_at), 'd MMM yyyy, HH:mm')}
                      </Text>
                    </View>
                  ))
                )}
              </>
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
  headerBtn: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280', width: 44 },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
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
    marginBottom: 10,
  },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#9CA3AF', marginBottom: 14 },
  consentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  consentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consentEmail: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: '#111827', flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  pillActive: { backgroundColor: '#10B981' },
  pillInactive: { backgroundColor: '#9CA3AF' },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5, color: '#FFFFFF' },
  consentMeta: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#6B7280', marginTop: 5 },
  withdrawBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  withdrawText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#DC2626' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#5B21B6' },
  grantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    padding: 14,
    marginTop: 4,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  catChipOn: { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  catText: { fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#6B7280' },
  catTextOn: { color: '#5B21B6' },
  grantActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#374151' },
  grantBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  grantBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 10,
    marginBottom: 6,
  },
  auditText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' },
  auditTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF' },
});
