import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import type { DeviceTier } from '@/types/project';

/**
 * Coarse device-tier detection (spec §13).
 *
 * Returns 'high' | 'low' computed once at mount from cheap, available signals.
 * Treat this as a binary switch — it's something you can actually test both
 * branches of, unlike a continuous quality curve which can't be validated on
 * one physical device.
 *
 * The runtime <PerformanceMonitor> fallback (PerformanceMonitor component)
 * catches devices that pass this static check but still struggle once the
 * scene is fully loaded.
 */
function detectTier(): DeviceTier {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'high';
  }

  const cores = navigator.hardwareConcurrency || 8;
  const dpr = window.devicePixelRatio || 1;
  // deviceMemory is Chrome-only and undefined on Safari — guard for that.
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

  const isLowTier =
    cores <= 4 || // 4-core CPUs (e.g. A10 Fusion, older Atoms)
    dpr > 3 || // proxy for older/smaller high-density panels
    (typeof deviceMemory === 'number' && deviceMemory <= 2);

  return isLowTier ? 'low' : 'high';
}

/**
 * Hook returning the static device tier. Recomputes only if the user
 * crosses the reduced-motion boundary (which can change at runtime on macOS).
 */
export function useDeviceTier(): DeviceTier {
  // Compute once.
  const [tier] = useState<DeviceTier>(() => detectTier());

  // Sync the global store so non-component code can read it too.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => useStore.getState().setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return tier;
}

/** Convenience selector for the adaptive quality flag set by PerformanceMonitor. */
export function useAdaptiveLowQuality(): boolean {
  return useStore((s) => s.adaptiveLowQuality);
}

/** Convenience selector for the OS-level reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  return useStore((s) => s.prefersReducedMotion);
}
