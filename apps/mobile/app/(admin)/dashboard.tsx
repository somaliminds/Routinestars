/**
 * Admin — overview dashboard.
 *
 * Aggregate business metrics only (counts via admin_overview_metrics RPC). No
 * individual child data is read here or anywhere in the admin panel.
 */
import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { fetchOverviewMetrics, type OverviewMetrics } from '@/lib/admin';

// Monthly GBP per plan (annual plans bill the same tier; MRR here is an
// approximation that doesn't divide annual payments — labelled as "est.").
const MONTHLY_PRICE: Record<string, number> = { FREE: 0, STARTER: 7.99, FAMILY: 19.99, SCHOOL: 49 };

function estimatedMrr(byPlan: Record<string, number>): number {
  return Object.entries(byPlan).reduce((sum, [plan, n]) => sum + (MONTHLY_PRICE[plan] ?? 0) * n, 0);
}

export default function AdminDashboard() {
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const onSignOut = useCallback(() => void signOut(), [signOut]);

  const { data: m, isLoading } = useQuery<OverviewMetrics | null>({
    queryKey: ['adminOverview'],
    queryFn: fetchOverviewMetrics,
  });

  const paidSubs = m
    ? (m.subs_by_plan.STARTER ?? 0) + (m.subs_by_plan.FAMILY ?? 0) + (m.subs_by_plan.SCHOOL ?? 0)
    : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>RoutineStars — Admin</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {session?.user.email ?? ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onSignOut} accessibilityRole="button">
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />
        ) : !m ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              Couldn’t load metrics. If you just set up admin access, make sure migration 038 is
              applied and you’ve completed MFA.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Overview</Text>
            <View style={styles.grid}>
              <Stat value={m.users_total} label="Total users" />
              <Stat value={m.parents_total} label="Parents" />
              <Stat value={m.children_total} label="Children" />
              <Stat value={m.signups_30d} label="Signups (30d)" />
            </View>

            <Text style={styles.sectionLabel}>Revenue</Text>
            <View style={styles.grid}>
              <Stat value={paidSubs} label="Paid subscriptions" />
              <Stat value={`£${estimatedMrr(m.subs_by_plan).toFixed(0)}`} label="Est. MRR" />
              <Stat
                value={m.subs_past_due}
                label="Past due"
                tone={m.subs_past_due > 0 ? 'warn' : undefined}
              />
              <Stat value={m.subs_canceled_30d} label="Cancelled (30d)" />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Active subscriptions by plan</Text>
              {(['FREE', 'STARTER', 'FAMILY', 'SCHOOL'] as const).map((p) => (
                <View key={p} style={styles.planRow}>
                  <Text style={styles.planName}>{p}</Text>
                  <Text style={styles.planCount}>{m.subs_by_plan[p] ?? 0}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Platform</Text>
            <View style={styles.grid}>
              <Stat value={m.completions_7d} label="Completions (7d)" />
              <Stat value={m.consents_active} label="Active pro consents" />
              <Stat value={m.activity_sets_builtin} label="Built-in sets" />
              <Stat value={m.activity_sets_custom} label="Custom sets" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: 'warn' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'warn' && { color: '#B45309' }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9F0',
    backgroundColor: '#FFFFFF',
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#101B2D', letterSpacing: -0.2 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5A6B80', marginTop: 2 },
  signOut: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#7C3AED' },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 18,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 16,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: '#101B2D',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#5A6B80', marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 16,
    marginTop: 10,
  },
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    color: '#5A6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  planName: { fontFamily: 'Inter_500Medium', fontSize: 13.5, color: '#101B2D' },
  planCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: '#101B2D',
    fontVariant: ['tabular-nums'],
  },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#5A6B80', lineHeight: 19 },
});
