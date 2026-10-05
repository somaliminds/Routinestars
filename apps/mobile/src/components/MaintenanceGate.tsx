/**
 * MaintenanceGate — honours the admin `maintenance_mode` feature flag.
 *
 * When maintenance_mode is on, authenticated NON-admin users see a full-screen
 * overlay; admins pass through (so they can still reach the panel to turn it
 * off). It renders the app underneath and overlays on top rather than
 * unmounting the navigator, so expo-router routing never breaks.
 *
 * Fail-OPEN: any flag-read failure (or logged-out state) shows the app — a
 * misread must never lock everyone out.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { getFlag, isAdminMember } from '@/lib/admin';

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);

  const { data: inMaintenance = false } = useQuery({
    queryKey: ['maintenanceMode'],
    queryFn: () => getFlag('maintenance_mode', false),
    enabled: !!session,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ['maintenanceAdminBypass'],
    queryFn: isAdminMember,
    enabled: !!session && inMaintenance === true,
  });

  const blocked = !!session && inMaintenance === true && !isAdmin;

  return (
    <>
      {children}
      {blocked && (
        <View style={styles.overlay} accessibilityRole="alert">
          <Text style={styles.emoji}>🛠️</Text>
          <Text style={styles.title}>We’ll be right back</Text>
          <Text style={styles.body}>
            RoutineStars is briefly down for maintenance. Please check back shortly.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    color: '#5B21B6',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 420,
  },
});
