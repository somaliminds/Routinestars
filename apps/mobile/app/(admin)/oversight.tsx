/**
 * Admin — oversight (read-only).
 *
 * Governance visibility: active professional consents, the professional
 * data-access audit trail, AI-generation outcomes, and the admin's own action
 * log. Children appear only as ids (no names / no records) — oversight without
 * breaching the privacy boundary.
 */
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchActiveConsents, fetchAccessAudit, fetchAiLog, fetchAdminAudit } from '@/lib/admin';

type Tab = 'consents' | 'access' | 'ai' | 'admin';
const TABS: { key: Tab; label: string }[] = [
  { key: 'consents', label: 'Consents' },
  { key: 'access', label: 'Access log' },
  { key: 'ai', label: 'AI log' },
  { key: 'admin', label: 'Admin log' },
];

const short = (id: string) => id.slice(0, 8);

export default function AdminOversight() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('consents');

  const consents = useQuery({
    queryKey: ['ovConsents'],
    queryFn: fetchActiveConsents,
    enabled: tab === 'consents',
  });
  const access = useQuery({
    queryKey: ['ovAccess'],
    queryFn: fetchAccessAudit,
    enabled: tab === 'access',
  });
  const ai = useQuery({ queryKey: ['ovAi'], queryFn: fetchAiLog, enabled: tab === 'ai' });
  const adminLog = useQuery({
    queryKey: ['ovAdmin'],
    queryFn: fetchAdminAudit,
    enabled: tab === 'admin',
  });

  const loading =
    (tab === 'consents' && consents.isLoading) ||
    (tab === 'access' && access.isLoading) ||
    (tab === 'ai' && ai.isLoading) ||
    (tab === 'admin' && adminLog.isLoading);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Oversight</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabOn]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {loading && <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />}

        {tab === 'consents' &&
          !consents.isLoading &&
          (consents.data?.length ? (
            consents.data.map((c) => (
              <View key={c.consent_id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowStrong}>{c.professional_email}</Text>
                  <Text style={styles.rowTag}>{c.professional_role}</Text>
                </View>
                <Text style={styles.rowMeta}>
                  child {short(c.child_id)} · {c.data_categories.length} areas · expires{' '}
                  {c.expiry_date}
                </Text>
              </View>
            ))
          ) : (
            <Empty>No active consents.</Empty>
          ))}

        {tab === 'access' &&
          !access.isLoading &&
          (access.data?.length ? (
            access.data.map((a) => (
              <View key={a.event_id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowStrong}>
                    {a.action} · {a.actor_role ?? '—'}
                  </Text>
                  <Text style={styles.rowTime}>
                    {format(new Date(a.occurred_at), 'd MMM HH:mm')}
                  </Text>
                </View>
                <Text style={styles.rowMeta}>
                  child {short(a.child_id)} · {a.data_categories.join(', ') || '—'}
                </Text>
              </View>
            ))
          ) : (
            <Empty>No access events recorded.</Empty>
          ))}

        {tab === 'ai' &&
          !ai.isLoading &&
          (ai.data?.length ? (
            ai.data.map((l) => (
              <View key={l.log_id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowStrong}>{l.tool_called ?? l.feature}</Text>
                  <Text style={styles.rowTime}>
                    {format(new Date(l.created_at), 'd MMM HH:mm')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowMeta,
                    { color: l.passed_validation === false ? '#B91C1C' : '#15803D' },
                  ]}
                >
                  {l.passed_validation === false
                    ? `refused${l.rejection_reason ? ` — ${l.rejection_reason}` : ''}`
                    : 'passed governance'}
                </Text>
              </View>
            ))
          ) : (
            <Empty>No AI generations logged.</Empty>
          ))}

        {tab === 'admin' &&
          !adminLog.isLoading &&
          (adminLog.data?.length ? (
            adminLog.data.map((a) => (
              <View key={a.event_id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowStrong}>{a.action}</Text>
                  <Text style={styles.rowTime}>
                    {format(new Date(a.occurred_at), 'd MMM HH:mm')}
                  </Text>
                </View>
                <Text style={styles.rowMeta}>
                  {a.target_type ?? ''} {a.target_id ? short(a.target_id) : ''} · by{' '}
                  {short(a.admin_id)}
                </Text>
              </View>
            ))
          ) : (
            <Empty>No admin actions logged.</Empty>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FB' },
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
  back: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7C3AED', width: 80 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#101B2D' },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9F0',
  },
  tab: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#EEF2F7' },
  tabOn: { backgroundColor: '#7C3AED' },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#5A6B80' },
  tabTextOn: { color: '#FFFFFF' },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 13,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  rowStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: '#101B2D', flexShrink: 1 },
  rowTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    color: '#5A6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#94A2B4',
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#5A6B80',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#94A2B4',
    marginTop: 20,
    textAlign: 'center',
  },
});
