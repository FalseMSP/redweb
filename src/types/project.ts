/**
 * Project data model (spec §6).
 * Used by portfolio cards, the HTML overlay modal, and the data layer.
 */
export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectStat {
  label: string;
  value: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  /** Path to a preview image/texture for the card face (or a CDN URL). */
  thumbnail: string;
  /** Short tag list — e.g. ['3D', 'Blender', 'Unreal']. */
  tags: string[];
  year: number;
  /** Optional external links — case study, GitHub, video, etc. */
  links?: ProjectLink[];
  /**
   * Relative technical impressiveness — drives card size (0.7 = small,
   * 1.0 = standard, 1.8 = flagship). Cards scale both width and height by
   * this factor so a 1.8 card is ~3.2x the area of a 1.0 card.
   */
  impressiveness?: number;
  /** Optional hard numbers surfaced as a stat strip in the modal. */
  stats?: ProjectStat[];
}

export type DeviceTier = 'high' | 'low';

/**
 * Derived scene state returned by getSceneState(offset).
 * (spec §2) — a pure function so callers don't sprinkle if/else across components.
 */
export type ScenePhase = 'intro' | 'reveal' | 'gallery' | 'close';

export interface SceneState {
  phase: ScenePhase;
  /** Full revolution across the whole scroll range. */
  worldRotationY: number;
  /** Eased dolly t (0..1), only active after offset 0.25. */
  dollyT: number;
  /** Camera z (zoomed out for full ring view). */
  cameraZ: number;
  /** Camera slide factor 0..1 — 1 = hero at left rule-of-thirds line. */
  cameraSlideT: number;
  /** Tagline opacity — visible during the first ~15% of scroll, then fades. */
  taglineOpacity: number;
  /** Hero entrance — scale/opacity in during intro. */
  heroEntrance: number;
  /** Footer/contact cue — appears in close phase. */
  footerOpacity: number;
  /** Per-card visibility — 0..1 swing-in factor driven by phase. */
  cardVisibility: number;
}
