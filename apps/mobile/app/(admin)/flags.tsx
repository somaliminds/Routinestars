/**
 * Admin — feature flags & config.
 *
 * Toggle the app_config flags (maintenance mode, AI kill-switch, signups) at
 * runtime without a redeploy. Boolean flags render as switches; every change
 * is persisted + audited in one transaction via setConfig (admin_set_config).
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Switch, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchConfig, setConfig, type AppConfigRow } from '@/lib/admin';
import { notify } from '@/lib/ui-dialogs';

export default function AdminFlags() {
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: flags = [], isLoading } = useQuery<AppConfigRow[]>({
    queryKey: ['adminConfig'],
    queryFn: fetchConfig,
  });

  const toggle = useCallback(
    (row: AppConfigRow, next: boolean) => {
      setSaving(row.key);
      void (async () => {
        const { error } = await setConfig(row.key, next);
        if (error) notify('Could not save', error);
        await qc.invalidateQueries({ queryKey: ['adminConfig'] });
        setSaving(null);
      })();
    },
    [qc],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Feature flags</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
        <Text style={styles.hint}>
          Changes take effect the next time each client reads the flag. Every change is logged.
        </Text>
        {isLoading ? (
          <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />
        ) : (
          flags.map((row) => {
            const isBool = typeof row.value === 'boolean';
            return (
              <View key={row.key} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagKey}>{row.key}</Text>
                  {row.description ? <Text style={styles.flagDesc}>{row.description}</Text> : null}
                  {!isBool && <Text style={styles.flagValue}>{JSON.stringify(row.value)}</Text>}
                </View>
                {isBool &&
                  (saving === row.key ? (
                    <ActivityIndicator color="#7C3AED" />
                  ) : (
                    <Switch
                      value={row.value as boolean}
                      onValueChange={(v) => toggle(row, v)}
                      trackColor={{ true: '#7C3AED', false: '#CBD5E1' }}
                    />
                  ))}
              </View>
            );
          })
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
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#5A6B80',
    lineHeight: 17,
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    padding: 16,
    marginBottom: 10,
  },
  flagKey: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: '#101B2D' },
  flagDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#5A6B80',
    marginTop: 3,
    lineHeight: 17,
  },
  flagValue: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#7C3AED', marginTop: 4 },
});
