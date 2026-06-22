/**
 * Reads the local photo URI for a step (null if none).
 *
 * StepCard uses this to override illustration_url with a parent-uploaded
 * photo from this device. The hook re-runs whenever stepId changes; call
 * the returned refresh() after saving/removing a photo to update the UI.
 */
import { useEffect, useState } from 'react';
import { getLocalIllustrationUri } from '@/lib/local-illustrations';

export function useLocalIllustration(stepId: string | null | undefined): {
  uri: string | null;
  refresh: () => void;
} {
  const [uri, setUri] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!stepId) {
      setUri(null);
      return;
    }
    let cancelled = false;
    void getLocalIllustrationUri(stepId).then((local) => {
      if (!cancelled) setUri(local);
    });
    return () => {
      cancelled = true;
    };
  }, [stepId, tick]);

  return { uri, refresh: () => setTick((t) => t + 1) };
}
