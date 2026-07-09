import { create } from 'zustand';
import type { Project } from '@/types/project';

/**
 * Global app store.
 * Kept intentionally minimal: only cross-cutting UI state lives here.
 * Per-frame 3D state stays inside useFrame loops — never in Zustand.
 *
 * Note: Edit mode, card overrides, and runtime GLB loading have been removed
 * — the site is view-only. See Section 5.1 of the improvement tasks.
 */
interface AppState {
  /** The active project opened in the HTML overlay modal. null = closed. */
  activeProject: Project | null;
  /** True while any 3D asset is still resolving inside Suspense. */
  isLoading: boolean;
  /** 0..1 — overall load progress reported by drei's useProgress. */
  loadProgress: number;
  /** Adaptive quality flag flipped by <PerformanceMonitor>. */
  adaptiveLowQuality: boolean;
  /** True when the user has opted into reduced motion (OS-level). */
  prefersReducedMotion: boolean;

  setActiveProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (progress: number) => void;
  setAdaptiveLowQuality: (low: boolean) => void;
  setPrefersReducedMotion: (reduced: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  activeProject: null,
  isLoading: true,
  loadProgress: 0,
  adaptiveLowQuality: false,
  prefersReducedMotion: false,

  setActiveProject: (project) => set({ activeProject: project }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),
  setAdaptiveLowQuality: (low) => set({ adaptiveLowQuality: low }),
  setPrefersReducedMotion: (reduced) => set({ prefersReducedMotion: reduced }),
}));
