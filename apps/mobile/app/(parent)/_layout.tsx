import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useNotifications } from '@/hooks/useNotifications';
import { useApprovalQueue } from '@/hooks/useApprovalQueue';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useResponsive } from '@/hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';
import { MobileOnlyNotice } from '@/components/web/MobileOnlyNotice';

/**
 * Parent app layout — Sprint 2.4
 * Tab bar navigation (professional, Inter font style).
 * Registers for push notifications and shows approval badge count.
 */
export default function ParentLayout() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const r = useResponsive();
  // Six tabs is tight on small phones — drop the labels to keep icons readable
  const hideLabels = r.isPhoneSmall;

  // Register device for push notifications and save token to Supabase
  useNotifications(userId);

  // Badge count for pending approvals
  const { data: pendingApprovals } = useApprovalQueue(userId);
  const pendingCount = pendingApprovals?.length ?? 0;

  // Fetch subscription on mount
  const fetchSubscription = useSubscriptionStore((s) => s.fetch);
  useEffect(() => {
    if (userId) void fetchSubscription(userId);
  }, [userId, fetchSubscription]);

  // Parent app is mobile-only on the web build (Option A ships the professional
  // portal on web; the parent app needs native features).
  if (Platform.OS === 'web') return <MobileOnlyNotice />;

  return (
    <RouteErrorBoundary tone="adult">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#7C3AED',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarShowLabel: !hideLabels,
          tabBarLabelStyle: {
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
            marginTop: -2,
          },
          tabBarItemStyle: {
            paddingVertical: hideLabels ? 14 : 8,
          },
          tabBarStyle: {
            position: 'absolute',
            bottom: r.tabBarBottom,
            left: r.tabBarSideMargin,
            right: r.tabBarSideMargin,
            height: r.tabBarHeight,
            borderRadius: r.tabBarRadius,
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.55)',
            paddingBottom: 0,
            paddingTop: 0,
            paddingHorizontal: 4,
            shadowColor: '#5B21B6',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28,
            shadowRadius: 28,
            elevation: 14,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard', 'Dashboard'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: t('tabs.schedule', 'Schedule'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity-sets"
          options={{
            title: t('tabs.activities', 'Activities'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t('tabs.reports', 'Reports'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings', 'Settings'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="subscription"
          options={{
            title: t('tabs.plan', 'Plan'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="diamond-outline" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden route — approval detail, not shown in tab bar */}
        <Tabs.Screen name="approve/[completionId]" options={{ href: null }} />
        {/* Hidden route — EHCP outcomes manager, opened from Settings */}
        <Tabs.Screen name="ehcp" options={{ href: null }} />
        {/* Hidden route — AI routine generator, opened from Activity Sets */}
        <Tabs.Screen name="ai-generate" options={{ href: null }} />
      </Tabs>
    </RouteErrorBoundary>
  );
}
