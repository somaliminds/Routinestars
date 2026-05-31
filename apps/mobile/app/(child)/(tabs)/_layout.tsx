import { useState, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Text,
  TouchableOpacity,
  Modal,
  View,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { useResponsive } from '@/hooks/useResponsive';
import { usePinGate } from '@/stores/pinGate.store';

const PIN_LENGTH = 4;

/**
 * Child app tab bar — Sprint 2.5
 * Home (today's schedule) + Rewards (badges, stars, streak).
 * "← Parent" button opens a PIN gate modal before switching to parent app.
 */
export default function ChildTabsLayout() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? '';
  const r = useResponsive();

  const modalVisible = usePinGate((s) => s.isOpen);
  const closePinGate = usePinGate((s) => s.close);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  const closePinModal = () => {
    closePinGate();
    setPinEntry('');
    setPinError('');
  };

  const handleDigit = useCallback(
    async (digit: string) => {
      if (loading) return;
      if (digit === '⌫') {
        setPinEntry((p) => p.slice(0, -1));
        setPinError('');
        return;
      }
      const next = pinEntry + digit;
      if (next.length > PIN_LENGTH) return;
      setPinEntry(next);

      if (next.length === PIN_LENGTH) {
        setLoading(true);
        setPinError('');
        try {
          const { data, error } = await supabase.functions.invoke('verify-pin', {
            body: { user_id: userId, pin: next },
          });
          if (error || !(data as { valid: boolean } | null)?.valid) {
            setPinError('Incorrect PIN. Try again.');
            setPinEntry('');
          } else {
            closePinGate();
            setPinEntry('');
            router.replace('/(parent)/dashboard');
          }
        } catch {
          setPinError('Could not verify PIN. Try again.');
          setPinEntry('');
        } finally {
          setLoading(false);
        }
      }
    },
    [pinEntry, loading, userId, router, closePinGate],
  );

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];

  return (
    <>
      {/* ── PIN Gate Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePinModal}
      >
        <SafeAreaView className="flex-1 bg-neutral-100 items-center justify-center px-8">
          <Text className="font-inter font-bold text-neutral-900 mb-2" style={{ fontSize: 22 }}>
            Parent Access
          </Text>
          <Text
            className="font-inter text-neutral-500 text-center mb-8"
            style={{ fontSize: 14 }}
          >
            Enter your 4-digit PIN to switch to the parent app.
          </Text>

          {/* PIN dots */}
          <View className="flex-row gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                className={`w-4 h-4 rounded-full ${
                  i < pinEntry.length ? 'bg-brand-primary' : 'bg-neutral-300'
                }`}
              />
            ))}
          </View>

          {pinError ? (
            <Text
              className="font-inter text-accent-danger text-sm text-center mb-4"
              accessibilityLiveRegion="polite"
            >
              {pinError}
            </Text>
          ) : null}

          {loading ? <ActivityIndicator color="#7C3AED" className="mb-4" /> : null}

          {/* Numpad */}
          <View className="w-full max-w-[280px]">
            {rows.map((row, ri) => (
              <View key={ri} className="flex-row justify-between mb-3">
                {row.map((digit, di) => (
                  <TouchableOpacity
                    key={di}
                    className={`w-[80px] h-[64px] rounded-2xl items-center justify-center ${
                      digit === '' ? 'opacity-0' : 'bg-white shadow-sm'
                    }`}
                    disabled={digit === '' || loading}
                    onPress={() => void handleDigit(digit)}
                    accessibilityLabel={digit === '⌫' ? 'Delete' : digit}
                    accessibilityRole="button"
                  >
                    <Text
                      className="font-inter font-semibold text-neutral-900"
                      style={{ fontSize: 22 }}
                    >
                      {digit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            className="mt-6 items-center py-3"
            onPress={closePinModal}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text className="font-inter text-neutral-500" style={{ fontSize: 14 }}>
              Cancel
            </Text>
          </TouchableOpacity>

          {/* Forgot PIN */}
          <TouchableOpacity
            className="mt-2 items-center py-3"
            onPress={() => {
              closePinModal();
              router.push('/(auth)/forgot-pin');
            }}
            accessibilityLabel="Forgot PIN — send reset email"
            accessibilityRole="button"
          >
            <Text className="font-inter text-brand-primary" style={{ fontSize: 13 }}>
              Forgot PIN?
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ── Tab Navigator ────────────────────────────────────────────────── */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#7C3AED',
          tabBarInactiveTintColor: '#9CA3AF',
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
            // MY24 floating glass shadow
            shadowColor: '#5B21B6',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28,
            shadowRadius: 28,
            elevation: 14,
          },
          tabBarLabelStyle: {
            fontFamily: 'Nunito_700Bold',
            fontSize: 12,
            marginTop: -2,
          },
          tabBarItemStyle: {
            paddingVertical: 8,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Today',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: focused ? 28 : 22, opacity: focused ? 1 : 0.5 }}>
                📅
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: 'My Rewards',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: focused ? 28 : 22, opacity: focused ? 1 : 0.5 }}>
                ⭐
              </Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
