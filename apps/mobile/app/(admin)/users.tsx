/**
 * Admin — Users & subscriptions.
 *
 * Look up an account by email, view its plan/status + child COUNT (never child
 * data), comp/override the plan, or delete the account. All privileged ops go
 * through the admin-users edge function (service role + is_admin gate + audit).
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { lookupUser, setUserPlan, deleteUserAccount, type AdminUserResult } from '@/lib/admin';
import { confirmAction, notify } from '@/lib/ui-dialogs';

const PLANS = ['FREE', 'STARTER', 'FAMILY', 'SCHOOL'] as const;

export default function AdminUsers() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdminUserResult | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    if (!email.includes('@')) {
      notify('Enter an email', "Type the account's email address to look it up.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      setResult(await lookupUser(email));
    } catch (e) {
      notify('Lookup failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const u = result?.user;

  const applyPlan = useCallback(
    async (plan: string) => {
      if (!u) return;
      const ok = await confirmAction({
        title: 'Change plan',
        message: `Set ${u.email} to ${plan}? This overrides their subscription.`,
        confirmLabel: `Set ${plan}`,
      });
      if (!ok) return;
      setBusy(true);
      try {
        await setUserPlan(u.id, plan, plan === 'FREE' ? 'canceled' : 'active');
        setResult(await lookupUser(email)); // refresh
      } catch (e) {
        notify('Failed', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setBusy(false);
      }
    },
    [u, email],
  );

  const removeUser = useCallback(async () => {
    if (!u) return;
    const ok = await confirmAction({
      title: 'Delete account',
      message: `Permanently delete ${u.email} and ALL their data (every child profile, routine, report)? This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteUserAccount(u.id);
      setResult(null);
      setEmail('');
      notify('Deleted', 'The account and all its data have been removed.');
    } catch (e) {
      notify('Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [u]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Users & subscriptions</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="account@email.com"
            placeholderTextColor="#94A2B4"
            autoCapitalize="none"
            keyboardType="email-address"
            onSubmitEditing={() => void search()}
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => void search()}
            disabled={loading}
          >
            <Text style={styles.searchBtnText}>{loading ? '…' : 'Search'}</Text>
          </TouchableOpacity>
        </View>

        {result && !result.found && (
          <Text style={styles.empty}>No account found for that email.</Text>
        )}

        {u && (
          <>
            <View style={styles.card}>
              <Text style={styles.name}>{u.name ?? '(no name)'}</Text>
              <Text style={styles.meta}>{u.email}</Text>
              <View style={styles.row}>
                <Text style={styles.k}>Role</Text>
                <Text style={styles.v}>{u.role ?? '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.k}>Children</Text>
                <Text style={styles.v}>{result?.children_count ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.k}>Joined</Text>
                <Text style={styles.v}>{format(new Date(u.created_at), 'd MMM yyyy')}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.k}>Last sign-in</Text>
                <Text style={styles.v}>
                  {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'd MMM yyyy') : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Subscription</Text>
              <View style={styles.row}>
                <Text style={styles.k}>Plan</Text>
                <Text style={styles.v}>{result?.subscription?.plan ?? 'FREE'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.k}>Status</Text>
                <Text style={styles.v}>{result?.subscription?.status ?? '—'}</Text>
              </View>
              {result?.subscription?.current_period_end && (
                <View style={styles.row}>
                  <Text style={styles.k}>Renews/ends</Text>
                  <Text style={styles.v}>
                    {format(new Date(result.subscription.current_period_end), 'd MMM yyyy')}
                  </Text>
                </View>
              )}

              <Text style={[styles.cardLabel, { marginTop: 14 }]}>Override / comp plan</Text>
              <Text style={styles.hint}>
                Sets the plan in our database (grants access immediately). Does not change Stripe
                billing — use for comps / support.
              </Text>
              <View style={styles.chipRow}>
                {PLANS.map((p) => {
                  const current = (result?.subscription?.plan ?? 'FREE') === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, current && styles.chipOn]}
                      onPress={() => void applyPlan(p)}
                      disabled={busy}
                    >
                      <Text style={[styles.chipText, current && styles.chipTextOn]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => void removeUser()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#B91C1C" />
              ) : (
                <Text style={styles.deleteText}>Delete this account</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#101B2D',
  },
  searchBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: '#5A6B80', marginTop: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 16,
    marginBottom: 12,
  },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#101B2D' },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#5A6B80',
    marginTop: 2,
    marginBottom: 8,
  },
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    color: '#5A6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  k: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#5A6B80' },
  v: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#101B2D' },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#94A2B4',
    lineHeight: 16,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#6D28D9' },
  chipTextOn: { color: '#FFFFFF' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#B91C1C' },
});
