/**
 * RouteErrorBoundary — a feature-level React error boundary (audit M2).
 *
 * Without this, a render error anywhere inside a route group takes down the
 * WHOLE app (only the root Sentry.wrap catches it) — leaving an SEN child
 * staring at a blank screen mid-routine. Wrapping each group means a crash is
 * contained to that group and offers a gentle "try again" instead.
 *
 * `tone="child"` uses calm, non-alarming language and no error text (Child UI
 * Non-Negotiables: no error messages shown to a child). `tone="adult"` is for
 * parent/TA/professional groups.
 */
import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reportError } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  tone?: 'child' | 'adult';
}
interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    // Report with context; never surface the raw error to the UI.
    reportError(error, { componentStack: info?.componentStack ?? undefined });
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChild = this.props.tone === 'child';
    return (
      <View style={[styles.container, isChild ? styles.childBg : styles.adultBg]}>
        <Text style={styles.emoji}>{isChild ? '🌈' : '🔧'}</Text>
        <Text style={[styles.title, isChild && styles.childTitle]}>
          {isChild ? 'Let’s try that again' : 'Something went wrong'}
        </Text>
        <Text style={styles.body}>
          {isChild
            ? 'Tap the big button to keep going.'
            : 'This screen hit a problem. Tap below to reload it — your data is safe.'}
        </Text>
        <TouchableOpacity
          style={[styles.button, isChild && styles.childButton]}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel={isChild ? 'Try again' : 'Reload screen'}
        >
          <Text style={styles.buttonText}>{isChild ? 'Try again' : 'Reload'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  childBg: { backgroundColor: '#F5F3FF' },
  adultBg: { backgroundColor: '#F3F4F6' },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  childTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 26, color: '#5B21B6' },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  button: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  childButton: { paddingHorizontal: 44, paddingVertical: 20, borderRadius: 20, minHeight: 80 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
});
