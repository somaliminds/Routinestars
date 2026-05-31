/**
 * Dev component showcase screen — Sprint 1.5
 * Access at /dev/components during development.
 * Shows every design system component in all states.
 * Remove or gate this route before production release.
 */
import { ScrollView, View, Text } from 'react-native';
import {
  ActivityCard,
  ProgressBar,
  StarCounter,
  BadgeDisplay,
  CelebrationModal,
  PINPad,
  ScheduleTimeline,
} from '@/components/ui';
import { useState } from 'react';

const MOCK_BADGES = [
  {
    id: '1',
    name: 'Sparkling Teeth',
    description: 'Brush 5 times',
    iconEmoji: '🦷',
    isEarned: true,
  },
  { id: '2', name: 'Early Bird', description: 'Ready before 8am', iconEmoji: '🐦', isEarned: true },
  { id: '3', name: 'Homework Hero', description: '7 day streak', iconEmoji: '📚', isEarned: false },
  {
    id: '4',
    name: 'Full Week',
    description: 'Complete a whole week',
    iconEmoji: '🏆',
    isEarned: false,
  },
];

const MOCK_SCHEDULED_SETS = [
  {
    scheduled_set_id: '1',
    setName: 'Waking Up Set',
    iconEmoji: '☀️',
    colourTheme: 'child.lime',
    status: 'LOCKED' as const,
    start_time: '07:00',
    end_time: '07:10',
    order_in_day: 1,
  },
  {
    scheduled_set_id: '2',
    setName: 'Brushing Teeth Set',
    iconEmoji: '🦷',
    colourTheme: 'child.sky',
    status: 'IN_PROGRESS' as const,
    start_time: '07:10',
    end_time: '07:15',
    order_in_day: 2,
  },
  {
    scheduled_set_id: '3',
    setName: 'Breakfast Set',
    iconEmoji: '🥣',
    colourTheme: 'accent.star',
    status: 'PENDING' as const,
    start_time: '07:30',
    end_time: '07:50',
    order_in_day: 3,
  },
  {
    scheduled_set_id: '4',
    setName: 'Getting Ready',
    iconEmoji: '🎒',
    colourTheme: 'brand.primary',
    status: 'PENDING' as const,
    start_time: '08:00',
    end_time: '08:10',
    order_in_day: 4,
  },
];

export default function ComponentShowcase() {
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [starCount, setStarCount] = useState(47);

  return (
    <ScrollView className="flex-1 bg-neutral-100" contentContainerClassName="p-5 gap-8">
      <Text className="text-heading font-nunito-bold text-neutral-900">🧩 Component Showcase</Text>

      {/* ActivityCard */}
      <Section title="ActivityCard — All Status States">
        {(['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'LOCKED', 'SKIPPED'] as const).map(
          (status) => (
            <ActivityCard
              key={status}
              title={`Brushing Teeth Set (${status})`}
              iconEmoji="🦷"
              starValue={7}
              status={status}
              startTime="07:10"
            />
          ),
        )}
        <ActivityCard
          title="Loading state"
          iconEmoji="🦷"
          starValue={7}
          status="PENDING"
          startTime=""
          isLoading
        />
      </Section>

      {/* ProgressBar */}
      <Section title="ProgressBar — All Variants">
        <View className="gap-4">
          <ProgressBar progress={0.6} variant="step" label="Step progress" />
          <ProgressBar progress={0.4} variant="timer" label="Timer (on-time)" />
          <ProgressBar progress={0.85} variant="timer" label="Timer (amber)" />
          <ProgressBar progress={1.1} variant="timer" label="Timer (overtime)" />
          <ProgressBar progress={0.75} variant="day" label="Day progress" />
          <ProgressBar progress={0.5} variant="week" label="Week progress" />
        </View>
      </Section>

      {/* StarCounter */}
      <Section title="StarCounter — All Sizes">
        <View className="gap-4">
          <StarCounter count={starCount} size="sm" label="total" />
          <StarCounter count={starCount} size="md" label="stars earned today" />
          <StarCounter count={starCount} size="lg" />
        </View>
        <ActivityCard
          title="Tap to add 5 stars"
          iconEmoji="⭐"
          starValue={5}
          status="PENDING"
          startTime="Now"
          onPress={() => setStarCount((c) => c + 5)}
        />
      </Section>

      {/* BadgeDisplay */}
      <Section title="BadgeDisplay">
        <BadgeDisplay badges={MOCK_BADGES} />
      </Section>
      <Section title="BadgeDisplay — Loading">
        <BadgeDisplay badges={[]} isLoading />
      </Section>
      <Section title="BadgeDisplay — Empty">
        <BadgeDisplay badges={[]} />
      </Section>

      {/* ScheduleTimeline */}
      <Section title="ScheduleTimeline">
        <ScheduleTimeline scheduledSets={MOCK_SCHEDULED_SETS} />
      </Section>

      {/* CelebrationModal */}
      <Section title="CelebrationModal">
        <ActivityCard
          title="Tap to show celebration"
          iconEmoji="🎉"
          starValue={10}
          status="PENDING"
          startTime="Now"
          onPress={() => setCelebrationVisible(true)}
        />
        <CelebrationModal
          visible={celebrationVisible}
          childName="Jamie"
          setName="Brushing Teeth Set"
          starsEarned={7}
          badgesEarned={['Sparkling Teeth']}
          onDismiss={() => setCelebrationVisible(false)}
        />
      </Section>

      {/* PINPad */}
      <Section title="PINPad">
        <PINPad
          title="Parent PIN"
          subtitle="Enter your 6-digit PIN"
          onComplete={(pin) => {
            // In real use: compare against stored bcrypt hash via Edge Function
            console.warn('PIN submitted (dev only)');
          }}
        />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-subhead font-nunito-bold text-neutral-900 mb-3">{title}</Text>
      {children}
    </View>
  );
}
