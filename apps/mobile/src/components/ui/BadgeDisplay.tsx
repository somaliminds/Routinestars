import { View, Text, TouchableOpacity } from 'react-native';

interface Badge {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  isEarned: boolean;
  earnedAt?: string | null;
}

interface BadgeDisplayProps {
  badges: Badge[];
  onBadgePress?: (badge: Badge) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

function BadgeSkeleton() {
  return <View className="w-[88px] h-[100px] bg-neutral-200 rounded-2xl" />;
}

/**
 * BadgeDisplay — grid of earned and locked badges.
 * Earned: full colour. Locked: greyed out with unlock condition text.
 * Min touch target: 60x60px per badge.
 */
export function BadgeDisplay({
  badges,
  onBadgePress,
  isLoading = false,
  emptyMessage = 'No badges yet — keep completing routines!',
}: BadgeDisplayProps) {
  if (isLoading) {
    return (
      <View className="flex-row flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <BadgeSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (badges.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-[48px] mb-3">🌟</Text>
        <Text className="text-body font-nunito text-neutral-500 text-center">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-3">
      {badges.map((badge) => (
        <TouchableOpacity
          key={badge.id}
          className={`w-[88px] items-center rounded-2xl p-2 ${
            badge.isEarned ? 'bg-accent-star/10' : 'bg-neutral-100'
          }`}
          onPress={() => onBadgePress?.(badge)}
          accessibilityLabel={`${badge.name} badge${badge.isEarned ? ', earned' : ', locked'}`}
          style={{ minHeight: 60 }}
        >
          <Text
            className={`text-[36px] ${badge.isEarned ? '' : 'opacity-30'}`}
            style={{ fontSize: 36 }}
          >
            {badge.iconEmoji}
          </Text>
          <Text
            className={`text-caption font-nunito-bold text-center mt-1 ${
              badge.isEarned ? 'text-neutral-900' : 'text-neutral-500'
            }`}
            numberOfLines={2}
          >
            {badge.name}
          </Text>
          {!badge.isEarned && (
            <View className="absolute top-1 right-1">
              <Text className="text-[12px]">🔒</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
