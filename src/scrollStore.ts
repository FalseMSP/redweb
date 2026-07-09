import { create } from 'zustand';

/**
 * Scroll state shared between the R3F canvas and the HTML overlays.
 *
 * SceneContents (inside <ScrollControls>) writes scroll.offset to this store
 * on every frame. Overlays + cards subscribe to the slice they need.
 */
interface ScrollState {
  /** Raw scroll offset 0..1. */
  offset: number;
  /** Tagline opacity — visible during first ~15% of scroll. */
  taglineOpacity: number;
  /** Legal/footer overlay opacity — visible during close phase (offset 0.85-1.0). */
  footerOpacity: number;
  /** Card visibility — 0 in intro, 1 in gallery, fades to 0 in close phase. */
  cardVisibility: number;
  /** Whether the user has scrolled past the intro phase. */
  pastIntro: boolean;
  /** Whether the user is still in the very-first-scroll hint zone (<2%). */
  inHintZone: boolean;

  setScrollState: (s: Omit<ScrollState, 'setScrollState'>) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  offset: 0,
  taglineOpacity: 1,
  footerOpacity: 0,
  cardVisibility: 0,
  pastIntro: false,
  inHintZone: true,
  setScrollState: (s) => set(s),
}));
