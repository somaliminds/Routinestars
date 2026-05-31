/**
 * useResponsive — adapts UI dimensions to phone / tablet automatically.
 *
 * Breakpoints follow Material Design / iPad mini sizing:
 *   - phoneSmall: < 380dp wide  (older / compact phones)
 *   - phone:     < 600dp wide   (standard phones — most users)
 *   - tablet:    >= 600dp wide  (tablets, foldables unfolded)
 *
 * Re-runs on orientation change automatically (useWindowDimensions hook).
 */
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ResponsiveMetrics {
  width: number;
  height: number;
  isPhoneSmall: boolean;
  isPhone: boolean;
  isTablet: boolean;
  /** Side margin for floating tab bar. */
  tabBarSideMargin: number;
  /** Bottom offset for floating tab bar. */
  tabBarBottom: number;
  /** Height of floating tab bar. */
  tabBarHeight: number;
  /** Border radius for floating tab bar pill. */
  tabBarRadius: number;
  /** Padding-bottom to add to ScrollViews so content clears the floating tab bar. */
  scrollClearance: number;
  /** Horizontal page padding for content. */
  pagePadding: number;
}

const TABLET_MAX_TAB_WIDTH = 540;

export function useResponsive(): ResponsiveMetrics {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 600;
  const isPhoneSmall = width < 380;
  const isPhone = !isTablet;

  // On tablets, cap the tab bar width and centre it; on phones, use tight margins
  // proportional to screen width so we never overflow.
  const tabBarSideMargin = isTablet
    ? Math.max(20, Math.round((width - TABLET_MAX_TAB_WIDTH) / 2))
    : isPhoneSmall
      ? 10
      : 16;

  // Sit above any system navigation (gesture handle or 3-button nav).
  // Phones with software nav often have insets.bottom of 24-48px.
  const baseBottom = isTablet ? 28 : isPhoneSmall ? 14 : 20;
  const tabBarBottom = baseBottom + Math.max(insets.bottom, 0);
  const tabBarHeight = isTablet ? 76 : isPhoneSmall ? 64 : 70;
  const tabBarRadius = tabBarHeight / 2;
  const scrollClearance = tabBarHeight + tabBarBottom + 24;
  const pagePadding = isTablet ? 28 : isPhoneSmall ? 16 : 20;

  return {
    width,
    height,
    isPhoneSmall,
    isPhone,
    isTablet,
    tabBarSideMargin,
    tabBarBottom,
    tabBarHeight,
    tabBarRadius,
    scrollClearance,
    pagePadding,
  };
}
