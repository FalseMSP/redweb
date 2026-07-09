import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { MathUtils } from 'three';
import * as THREE from 'three';
import type { DeviceTier } from '@/types/project';
import {
  createFlatMaterial,
  setFlatRimIntensity,
  setFlatTexture,
} from './RedLifeFlatMaterial';
import { getSharedTexture } from '@/lib/textureCache';
import {
  useYouTubeVideos,
  type YouTubeVideo,
} from '@/hooks/useYouTubeVideos';
import { useDeviceTier, usePrefersReducedMotion } from '@/hooks/useDeviceTier';
import { useIsRecruiterView } from '@/hooks/useIsRecruiterView';
import { useScrollStore } from '@/scrollStore';

/**
 * YouTubeOrbitField — a ring of small flat-shaded 3D cards that orbit the
 * hero icosahedron, textured with the most recent uploads from the RedLifeMC
 * YouTube channel.
 *
 * Hierarchy:
 *   • Lives inside the world group in Scene.tsx, so it inherits the scroll-
 *     driven rotation that drives the portfolio cards' orbit.
 *   • Adds its OWN slow rotation on top — the YouTube ring drifts even when
 *     the user isn't scrolling, which reads as "floating around" rather than
 *     "static cards that turn with scroll".
 *
 * Behavior:
 *   • Cards billboard to the camera (always face the viewer).
 *   • Reveal/exit uses the same scroll-state-based `cardVisibility` signal
 *     as the portfolio cards — staggered rise-from-below with easeOutBack,
 *     matching the standard card rules so they appear and disappear with
 *     the rest of the gallery.
 *   • On hover: scale boost, rim intensity boost.
 *   • On click: opens the video on YouTube in a new tab.
 *   • Respects prefers-reduced-motion (independent drift stops; cards still
 *     orbit with the world-group scroll rotation, since that's a navigation
 *     gesture, not decoration).
 *   • Renders nothing on low-tier devices (perf budget).
 *   • Renders nothing when the URL contains "recruiter".
 */

interface YouTubeOrbitFieldProps {
  /** Number of cards in the orbit. Defaults to 8 (4 long-form + 4 Shorts). */
  count?: number;
  /** Orbit radius (world units). Portfolio cards sit at 8; YouTube cards
   *  default to 5 so they live on their own ring between the hero and the
   *  portfolio ring. */
  radius?: number;
}

export function YouTubeOrbitField({
  count = 8,
  radius = 5,
}: YouTubeOrbitFieldProps) {
  const tier = useDeviceTier();
  const reducedMotion = usePrefersReducedMotion();
  const isRecruiterView = useIsRecruiterView();

  // Fetch videos. Pass `enabled` so the hook no-ops when we're not going to
  // render (recruiter view, low tier) — saves the network requests entirely.
  const enabled = !isRecruiterView && tier !== 'low';
  const { videos } = useYouTubeVideos(count, enabled);

  // The orbit group — its own slow rotation stacks on top of the parent
  // world group's scroll rotation.
  const orbitRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!orbitRef.current) return;
    if (reducedMotion) return;
    // One full revolution every ~50 seconds. Slow enough to read as ambient
    // drift, fast enough to be visible without staring.
    const radiansPerSecond = (Math.PI * 2) / 50;
    orbitRef.current.rotation.y += delta * radiansPerSecond;
  });

  if (!enabled || videos.length === 0) return null;

  return (
    <group ref={orbitRef}>
      {videos.map((video, i) => (
        <YouTubeCard3D
          key={video.videoId}
          video={video}
          index={i}
          total={videos.length}
          tier={tier}
          radius={radius}
        />
      ))}
    </group>
  );
}

// --- Card -------------------------------------------------------------------

interface YouTubeCard3DProps {
  video: YouTubeVideo;
  index: number;
  total: number;
  tier: DeviceTier;
  radius: number;
}

// YouTube brand red — used for the rim and border so the cards read as
// YouTube videos at a glance, distinct from the red-accent portfolio cards
// (which use the RedLife brand red #FF003C — these are pure #FF0000).
const YT_RED = new THREE.Color('#FF0000');
const YT_BASE = new THREE.Color('#0B0D14');

// Scratch objects — zero allocations inside useFrame.
const SCRATCH_V3 = new THREE.Vector3();

function YouTubeCard3D({
  video,
  index,
  total,
  tier,
  radius,
}: YouTubeCard3DProps) {
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [textureError, setTextureError] = useState(false);

  const groupRef = useRef<THREE.Group>(null);

  // Circular formation — offset by half a step so YouTube cards sit BETWEEN
  // portfolio cards rather than overlapping them in azimuth.
  const angle = (index / total) * Math.PI * 2 + Math.PI / total;
  const isLowTier = tier === 'low';
  const isShort = video.kind === 'short';
  const basePosition = useMemo<[number, number, number]>(() => {
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    // Per-kind vertical offset: Shorts sit below the orbit plane, long-form
    // cards sit above it. This separates the two card types into two
    // distinct rings so the long-form (horizontal) cards read as the
    // "main" content and the Shorts (vertical) feel like ambient flavor
    // tucked underneath. ±0.9 keeps both rings clear of the hero
    // icosahedron (~1.0 radius at y=0) and the blob shadow (y=-1.7).
    const kindY = isShort ? -0.9 : 0.9;
    // Gentle vertical wobble on top of the kind offset (smaller than
    // portfolio cards' 0.75) so cards in the same ring don't sit on a
    // perfectly flat line.
    const y = kindY + Math.sin(angle * 3) * 0.2;
    return [x, y, z];
  }, [angle, radius, isShort]);

  // Card shape: long-form videos use 16:9 landscape; Shorts use 9:16
  // portrait. The shape itself signals the content type — a tall card is
  // unmistakably a Short.
  // Shorts are slightly smaller — they're vertically smaller in feed too.
  const baseSize = isLowTier ? 0.85 : isShort ? 0.9 : 1.0;

  // Track the actual image aspect ratio once the texture loads. This lets us
  // rebuild the geometry to EXACTLY match the thumbnail's dimensions, avoiding
  // any stretching. (Same approach as PortfolioCard — see its comments for
  // why this matters.) While the aspect is unknown, we fall back to the
  // kind-based default (16:9 for long, 9:16 for short).
  const [imageAspect, setImageAspect] = useState<number | null>(null);

  // Texture loaded via the shared cache. i.ytimg.com sends CORS headers, so
  // THREE.TextureLoader can pull these directly without a proxy.
  const cardTexture = useMemo(() => {
    if (textureError || !video.thumbnail) return null;
    return getSharedTexture(video.thumbnail, (aspect, errored) => {
      if (errored) {
        setTextureError(true);
        return;
      }
      if (aspect !== null) {
        setImageAspect(aspect);
      }
    });
  }, [video.thumbnail, textureError]);

  // Compute card dimensions from the actual image aspect ratio if available,
  // falling back to the kind-based default. This mirrors PortfolioCard's
  // approach: the geometry always matches the texture, so there's never any
  // stretching.
  let cardWidth: number;
  let cardHeight: number;
  if (imageAspect !== null && imageAspect > 0) {
    if (imageAspect >= 1) {
      // Landscape (long-form): fit width to baseSize, height = width / aspect.
      cardWidth = baseSize;
      cardHeight = baseSize / imageAspect;
    } else {
      // Portrait (Short): fit height to baseSize * 2 (so the card is roughly
      // the same visual mass as a long-form card), width = height * aspect.
      cardHeight = baseSize * 2;
      cardWidth = cardHeight * imageAspect;
    }
  } else {
    // Pre-load fallback: use the kind-based default.
    cardWidth = isShort ? baseSize : baseSize * (16 / 9);
    cardHeight = isShort ? baseSize * 2 : baseSize;
  }

  const geometry = useMemo(
    () => makeCardGeometry(cardWidth, cardHeight, isLowTier),
    [cardWidth, cardHeight, isLowTier],
  );
  const borderGeometry = useMemo(
    () => makeBorderGeometry(cardWidth, cardHeight, isLowTier),
    [cardWidth, cardHeight, isLowTier],
  );

  const material = useMemo(
    () =>
      createFlatMaterial({
        baseColor: YT_BASE.getHex(),
        rimColor: YT_RED.getHex(),
        rimPower: 2.6,
        rimIntensity: 0.7,
        ao: 0.25,
        aoColor: '#000000',
        texture: cardTexture ?? undefined,
        // Only enable the texture once imageAspect has been set — this
        // ensures the geometry has been rebuilt to match the image's aspect
        // ratio before the texture becomes visible. Without this, the texture
        // would appear on the default-aspect geometry for a frame before the
        // rebuild happens, causing a visible squish.
        textureEnabled: !!cardTexture && imageAspect !== null,
      }),
    [cardTexture, imageAspect],
  );

  const borderMaterial = useMemo(
    () =>
      createFlatMaterial({
        baseColor: YT_RED.getHex(),
        rimColor: YT_RED.getHex(),
        rimPower: 1.8,
        rimIntensity: 1.4,
        ao: 0.0,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );

  // Per-frame state — pre-allocated, mutated in place inside useFrame.
  const state = useMemo(
    () => ({
      hoverT: 0,
      visibilityT: 0,
      idleTime: 0,
      lastTapTime: 0,
    }),
    [],
  );

  // Per-card stagger constants — same scheme as PortfolioCard so the entry
  // animation reads as part of the same family. The stagger range is
  // slightly tighter so all YouTube cards finish entering around the same
  // time as the portfolio cards.
  const cardConstants = useMemo(() => {
    const staggerRange = 0.3;
    const cardDelay = (index / Math.max(1, total - 1)) * staggerRange;
    const springK = 4 + (index % 3) * 0.7;
    const twistDir = index % 2 === 0 ? 1 : -1;
    const idlePhase = index * 1.3;
    const idleSwayPhase = index * 2.1 + 0.7;
    return { cardDelay, staggerRange, springK, twistDir, idlePhase, idleSwayPhase };
  }, [index, total]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // === Scroll-state reveal — mirrors PortfolioCard exactly ===
    // The base `cardVisibility` (0 → 1) is published by Scene's useFrame
    // from `getSceneState(o, …)`. We stagger it per-card so the YouTube
    // fleet enters in a wave rather than all at once.
    const baseVis = useScrollStore.getState().cardVisibility;
    const { cardDelay, staggerRange, springK, twistDir, idlePhase, idleSwayPhase } = cardConstants;
    const staggeredVis = Math.max(0, Math.min(1,
      (baseVis - cardDelay) / (1 - staggerRange),
    ));

    state.visibilityT = MathUtils.damp(state.visibilityT, staggeredVis, springK, delta);
    state.idleTime += delta;

    const target = hovered ? 1 : 0;
    state.hoverT = MathUtils.damp(state.hoverT, target, 8, delta);

    const v = state.visibilityT;
    const eased = easeOutBack(v);

    // Position: rise from below with overshoot + idle bob.
    const dropDistance = 10;
    const yOffset = (1 - eased) * -dropDistance;
    const idleFactor = v > 0.6 ? (v - 0.6) / 0.4 : 0;
    const idleBob = Math.sin(state.idleTime * 0.7 + idlePhase) * 0.08 * idleFactor;

    g.position.set(
      basePosition[0],
      basePosition[1] + yOffset + idleBob,
      basePosition[2],
    );

    // Scale: grow from small + hover boost.
    const entryScale = 0.5 + eased * 0.5;
    const hoverScale = 1 + state.hoverT * 0.15;
    g.scale.setScalar(entryScale * hoverScale);

    // Billboard + twist + idle sway.
    SCRATCH_V3.copy(camera.position);
    g.lookAt(SCRATCH_V3);
    const twist = (1 - v) * 0.5 * twistDir;
    g.rotation.z += twist;
    const idleSway = Math.sin(state.idleTime * 0.5 + idleSwayPhase) * 0.025 * idleFactor;
    g.rotation.z += idleSway;

    // Rim intensity: pulse while texture is still loading, boost on hover.
    const textureLoading = !cardTexture && !textureError;
    let rimBase = 0.7 + state.hoverT * 0.8;
    let borderBase = 1.2 + state.hoverT * 0.6;
    if (textureLoading) {
      const shimmer = 0.5 + Math.sin(state.idleTime * 3 + idlePhase) * 0.5;
      rimBase += shimmer * 0.8;
      borderBase += shimmer * 0.6;
    }
    // Fade rim out as the card exits (when cardVisibility drops back to 0).
    rimBase *= v;
    borderBase *= v;
    setFlatRimIntensity(material, rimBase);
    setFlatRimIntensity(borderMaterial, borderBase);
  });

  // --- Pointer handlers ---

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = '';
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const native = e.nativeEvent as unknown as { pointerType?: string };
    const isTouch = native.pointerType === 'touch' || 'ontouchstart' in window;

    if (isTouch) {
      // First tap = hover feedback, second tap within 600ms = open.
      const now = performance.now();
      if (state.lastTapTime > 0 && now - state.lastTapTime < 600) {
        window.open(video.watchUrl, '_blank', 'noopener,noreferrer');
        state.lastTapTime = 0;
      } else {
        setHovered(true);
        state.lastTapTime = now;
        window.setTimeout(() => setHovered(false), 1200);
      }
      return;
    }

    window.open(video.watchUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  // Ensure the texture uniform tracks the cached texture's resolution state.
  // Only enable the texture once imageAspect is set (see material useMemo
  // comment for why). setFlatTexture passes null when imageAspect isn't
  // ready yet, which disables the texture in the shader.
  useEffect(() => {
    setFlatTexture(material, imageAspect !== null ? cardTexture : null);
  }, [material, cardTexture, imageAspect]);

  return (
    <group
      ref={groupRef}
      position={basePosition}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {/* key includes imageAspect so the mesh remounts atomically when the
          aspect ratio changes — geometry, material, and texture all swap in
          the same commit with no one-frame gap showing the old geometry.
          This is the same pattern PortfolioCard uses. */}
      <mesh
        key={imageAspect ?? 'pre-aspect'}
        geometry={geometry}
        material={material}
        castShadow={false}
        receiveShadow={false}
      />
      <mesh
        key={`border-${imageAspect ?? 'pre-aspect'}`}
        geometry={borderGeometry}
        material={borderMaterial}
        position={[0, 0, 0.01]}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}

// --- Easing -----------------------------------------------------------------

function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// --- Geometry helpers (simplified copies of PortfolioCard's geometry funcs) -
// Duplicated rather than imported because the originals are not exported and
// pulling them out would touch more files. These are byte-identical to the
// versions in PortfolioCard.tsx — keep them in sync if those change.

function makeCardGeometry(width: number, height: number, lowTier: boolean): THREE.BufferGeometry {
  if (lowTier) {
    return new THREE.PlaneGeometry(width, height, 1, 1);
  }
  const radius = Math.min(width, height) * 0.08;
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  return new THREE.ShapeGeometry(shape, 6);
}

function makeBorderGeometry(width: number, height: number, lowTier: boolean): THREE.BufferGeometry {
  const inset = 0.04;
  const w = width / 2 - inset;
  const h = height / 2 - inset;
  const r = lowTier ? 0 : Math.min(width, height) * 0.06;
  const t = 0.04;

  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];

  if (lowTier) {
    outer.push(new THREE.Vector2(-w - t, -h - t), new THREE.Vector2(w + t, -h - t), new THREE.Vector2(w + t, h + t), new THREE.Vector2(-w - t, h + t));
    inner.push(new THREE.Vector2(-w, -h), new THREE.Vector2(w, -h), new THREE.Vector2(w, h), new THREE.Vector2(-w, h));
  } else {
    const segs = 4;
    for (let q = 0; q < 4; q++) {
      const cx = q === 0 || q === 3 ? -w : w;
      const cy = q === 0 || q === 1 ? -h : h;
      const sx = q === 0 || q === 3 ? 1 : -1;
      const sy = q === 0 || q === 1 ? 1 : -1;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI / 2;
        outer.push(new THREE.Vector2(cx + sx * Math.cos(a) * (r + t), cy + sy * Math.sin(a) * (r + t)));
        inner.push(new THREE.Vector2(cx + sx * Math.cos(a) * r, cy + sy * Math.sin(a) * r));
      }
    }
  }

  const vertices: number[] = [];
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    vertices.push(outer[i].x, outer[i].y, 0, outer[j].x, outer[j].y, 0, inner[j].x, inner[j].y, 0);
    vertices.push(outer[i].x, outer[i].y, 0, inner[j].x, inner[j].y, 0, inner[i].x, inner[i].y, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}
