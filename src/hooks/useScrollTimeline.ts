import { useMemo } from 'react';
import type { SceneState, ScenePhase, DeviceTier } from '@/types/project';

/**
 * Pure scroll → scene-state function (spec §2).
 *
 * Page ranges (offset):
 *   0.00 – 0.25  Intro    — hero entrance, tagline visible, camera at rest (z=12)
 *   0.25 – 0.55  Reveal   — camera dolly begins, world starts rotating, first 2 cards swing in
 *   0.55 – 0.85  Gallery  — remaining cards cycle past, full rotation continues
 *   0.85 – 1.00  Close    — rotation completes, camera at closest dolly point, footer cue appears
 *
 * IMPORTANT: this function is PURE. No DOM, no React, no allocation beyond
 * the returned object — it must be cheap to call every frame.
 */
export function getSceneState(
  offset: number,
  tier: DeviceTier = 'high',
  reducedMotion = false,
): SceneState {
  const o = Math.min(1, Math.max(0, offset));

  // Reduced-motion path: discrete static views, no rotation/dolly animation.
  if (reducedMotion) {
    const phase: ScenePhase =
      o < 0.25 ? 'intro' : o < 0.55 ? 'reveal' : o < 0.85 ? 'gallery' : 'close';
    const restingZ = tier === 'low' ? 16 : 15;
    return {
      phase,
      worldRotationY: 0,
      dollyT: 0,
      cameraZ: restingZ,
      cameraSlideT: phase === 'close' ? 1 : 0,
      taglineOpacity: phase === 'intro' ? 1 : 0,
      heroEntrance: 1,
      footerOpacity: phase === 'close' ? 1 : 0,
      cardVisibility: phase === 'intro' ? 0 : 1,
    };
  }

  // Phase classification (used for HTML overlay cues, not for transform math).
  let phase: ScenePhase;
  if (o < 0.25) phase = 'intro';
  else if (o < 0.55) phase = 'reveal';
  else if (o < 0.85) phase = 'gallery';
  else phase = 'close';

  // World rotation: a FULL 360° revolution happens during the cards-fully-
  // visible window (offset 0.30 → 0.72). Before that the world is at rest;
  // after it holds at 360°. This way the user sees every card from every
  // angle while the ring is fully up.
  let worldRotationY: number;
  if (o < 0.30) {
    worldRotationY = 0;
  } else if (o < 0.72) {
    // Linear 0 → 2π across the fully-visible window.
    worldRotationY = ((o - 0.30) / 0.42) * Math.PI * 2;
  } else {
    worldRotationY = Math.PI * 2;
  }

  // Camera dolly: only active after offset 0.25, eased.
  // Zoomed further out — dollyStart 18 (was 12) so the full card ring is
  // visible with breathing room. Dolly ends at 14 (high) / 16 (low).
  const dollyT = Math.min(1, Math.max(0, (o - 0.25) / 0.75));
  const easedDolly = dollyT * dollyT * (3 - 2 * dollyT);
  const dollyStart = 18;
  const dollyEnd = tier === 'low' ? 16 : 14;
  const cameraZ = dollyStart - easedDolly * (dollyStart - dollyEnd);

  // Camera slide factor — during the close phase (offset 0.85 → 1.0), the
  // camera slides right so the hero sits exactly on the LEFT rule-of-thirds
  // line. The actual X offset is computed in Scene.tsx based on the live
  // aspect ratio (so it's exact for any screen size).
  const slideT = Math.min(1, Math.max(0, (o - 0.85) / 0.15));
  const cameraSlideT = slideT * slideT * (3 - 2 * slideT); // smoothstep

  // Tagline: visible during the first ~15% of scroll, fades out after.
  // Visible at full opacity at offset=0, fading to 0 by offset=0.15.
  const taglineOpacity = Math.max(0, 1 - Math.max(0, o - 0.0) / 0.15);

  // Hero entrance: scale/opacity in during intro (0 → 0.15 ramps in).
  const heroEntrance = Math.min(1, o / 0.15);

  // Footer / legal bar: fades in during the close phase.
  const footerOpacity = Math.min(1, Math.max(0, (o - 0.88) / 0.12));

  // Cards: hidden at the very top (only hero), visible in the middle,
  // hidden again at the very bottom (only hero). The fade bands are wider
  // than the footer so cards are fully gone before the footer appears.
  let cardVisibility: number;
  if (o < 0.12) {
    // Intro: cards fully hidden — only hero visible.
    cardVisibility = 0;
  } else if (o < 0.30) {
    // Ramp in.
    cardVisibility = (o - 0.12) / 0.18;
  } else if (o < 0.72) {
    // Full gallery.
    cardVisibility = 1;
  } else if (o < 0.88) {
    // Ramp out — cards fade before footer appears.
    cardVisibility = 1 - (o - 0.72) / 0.16;
  } else {
    // Close: cards fully hidden — only hero + footer visible.
    cardVisibility = 0;
  }

  return {
    phase,
    worldRotationY,
    dollyT: easedDolly,
    cameraZ,
    cameraSlideT,
    taglineOpacity,
    heroEntrance,
    footerOpacity,
    cardVisibility,
  };
}

/**
 * Hook variant — recomputes when tier/reducedMotion change.
 * Most callers should read scroll.offset inside useFrame and call
 * getSceneState() directly to avoid React re-renders on every scroll tick.
 */
export function useScrollTimeline(tier: DeviceTier, reducedMotion: boolean) {
  return useMemo(() => {
    return (offset: number) => getSceneState(offset, tier, reducedMotion);
  }, [tier, reducedMotion]);
}
