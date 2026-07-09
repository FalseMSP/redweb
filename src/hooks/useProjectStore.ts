import { useStore } from '@/store';
import type { Project } from '@/types/project';

/**
 * Thin selector hook over the Zustand store for the project overlay state.
 * Kept separate from store.ts so callers don't import the entire store API
 * just to read/write the project overlay.
 */
export function useProjectStore() {
  const activeProject = useStore((s) => s.activeProject);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const isLoading = useStore((s) => s.isLoading);
  const loadProgress = useStore((s) => s.loadProgress);

  return {
    activeProject: activeProject as Project | null,
    setActiveProject,
    isLoading,
    loadProgress,
    isOpen: activeProject !== null,
  };
}
