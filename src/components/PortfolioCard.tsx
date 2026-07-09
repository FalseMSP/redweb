import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MathUtils } from 'three';
import type { Project, DeviceTier } from '@/types/project';
import {
  createFlatMaterial,
  setFlatBaseColor,
  setFlatRimIntensity,
  setFlatTexture,
} from './RedLifeFlatMaterial';
import { useStore } from '@/store';
import { useScrollStore } from '@/scrollStore';
import { getSharedTexture } from '@/lib/textureCache';

/**
 * PortfolioCard — flat-shaded 3D card.
 *
 * Interaction (view-only — edit mode has been removed):
 *   • Hover: scale ×1.05, color lerp toward #FF003C, rim boost.
 *   • Click: setActiveProject(project) opens the modal.
 *   • Touch: first tap = hover feedback, second tap = click.
 *
 * Geometry: flat rounded-rect plane, sized by the project's impressiveness
 * and the loaded image's aspect ratio. Rendered with RedLifeFlatMaterial —
 * no lighting.
 *
 * Billboard: cards lookAt(camera.position) so the card front always faces
 * the viewer.
 *
 * Motion: cards rise from below the floor with per-card stagger, spring
 * overshoot (easeOutBack), alternating twist, and idle floating bob/sway.
 */
interface PortfolioCardProps {
  project: Project;
  index: number;
  total: number;
  tier: DeviceTier;
  radius?: number;
}

const RIM_COLOR_DEFAULT = new THREE.Color('#FF003C');
const BASE_COLOR_DEFAULT = new THREE.Color('#0B0D14');
const BASE_COLOR_HOVER = new THREE.Color('#FF003C');

// Scratch objects — zero allocations inside useFrame.
const SCRATCH_COLOR = new THREE.Color();
const SCRATCH_V3 = new THREE.Vector3();

export function PortfolioCard({
  project,
  index,
  total,
  tier,
  radius = 6,
}: PortfolioCardProps) {
  const setActiveProject = useStore((s) => s.setActiveProject);

  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Card base position (circular formation formula).
  const angle = (index / total) * Math.PI * 2;
  const basePosition = useMemo<[number, number, number]>(() => {
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = Math.sin(angle * 2) * 0.75;
    return [x, y, z];
  }, [angle, radius]);

  // Tier-driven base size, scaled by impressiveness.
  const isLowTier = tier === 'low';
  const impressiveness = project.impressiveness ?? 1.0;
  const baseSize = (isLowTier ? 1.8 : 2.0) * impressiveness;

  let cardWidth: number;
  let cardHeight: number;
  if (imageAspect !== null && imageAspect > 0) {
    if (imageAspect >= 1) {
      cardWidth = baseSize;
      cardHeight = baseSize / imageAspect;
    } else {
      cardHeight = baseSize;
      cardWidth = baseSize * imageAspect;
    }
  } else {
    cardWidth = (isLowTier ? 1.5 : 1.7) * impressiveness;
    cardHeight = (isLowTier ? 2.1 : 2.3) * impressiveness;
  }

  const geometry = useMemo(() => makeCardGeometry(cardWidth, cardHeight, isLowTier), [cardWidth, cardHeight, isLowTier]);
  const borderGeometry = useMemo(() => makeBorderGeometry(cardWidth, cardHeight, isLowTier), [cardWidth, cardHeight, isLowTier]);

  // Texture loaded via the shared texture cache (getSharedTexture), which
  // guarantees exactly one THREE.TextureLoader().load() call per URL. Scene
  // requests the same URL for its own readiness tracking — using the shared
  // cache means Scene and this card always resolve from the same underlying
  // load, so the loading screen can't dismiss based on a throwaway "preload"
  // copy finishing while this card's actual texture is still in flight.
  const thumbnailSrc = project.thumbnail;
  const [textureError, setTextureError] = useState(false);
  const cardTexture = useMemo(() => {
    if (!thumbnailSrc) return null;
    if (thumbnailSrc.startsWith('data:image/svg+xml')) return null;
    if (textureError) return null;

    return getSharedTexture(thumbnailSrc, (aspect, errored) => {
      if (errored) {
        setTextureError(true);
        return;
      }
      if (aspect !== null) {
        setImageAspect(aspect);
      }
    });
  }, [thumbnailSrc, textureError]);

  const material = useMemo(
    () =>
      createFlatMaterial({
        baseColor: BASE_COLOR_DEFAULT.getHex(),
        rimColor: RIM_COLOR_DEFAULT.getHex(),
        rimPower: 2.6,
        rimIntensity: 0.6,
        ao: 0.25,
        aoColor: '#000000',
        texture: cardTexture ?? undefined,
        // Only enable the texture once imageAspect has been set — this
        // ensures the geometry has been rebuilt to match the image's aspect
        // ratio before the texture becomes visible. Without this, the
        // texture appears on the default portrait geometry for a frame
        // before the landscape rebuild happens, causing a visible squish.
        textureEnabled: !!cardTexture && imageAspect !== null,
      }),
    [cardTexture, imageAspect],
  );

  const borderMaterial = useMemo(
    () =>
      createFlatMaterial({
        baseColor: '#FF003C',
        rimColor: '#FF003C',
        rimPower: 1.8,
        rimIntensity: 1.4,
        ao: 0.0,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );

  // Per-frame state.
  const state = useMemo(
    () => ({
      hoverT: 0,
      visibilityT: 0,
      lastTapTime: 0,
      idleTime: 0,
    }),
    [],
  );

  // Per-card constants for stagger + idle motion.
  const cardConstants = useMemo(() => {
    const staggerRange = 0.3;
    const cardDelay = (index / Math.max(1, total - 1)) * staggerRange;
    const springK = 4 + (index % 3) * 0.7;
    const twistDir = index % 2 === 0 ? 1 : -1;
    const idlePhase = index * 1.7;
    const idleSwayPhase = index * 2.3 + 1.0;
    return { cardDelay, staggerRange, springK, twistDir, idlePhase, idleSwayPhase };
  }, [index, total]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

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

    g.position.x = basePosition[0];
    g.position.y = basePosition[1] + yOffset + idleBob;
    g.position.z = basePosition[2];

    // Scale: grow from small + hover boost.
    const entryScale = 0.5 + eased * 0.5;
    const hoverScale = 1 + state.hoverT * 0.05;
    g.scale.setScalar(entryScale * hoverScale);

    // Billboard + twist + idle sway.
    SCRATCH_V3.copy(camera.position);
    g.lookAt(SCRATCH_V3);
    const twist = (1 - v) * 0.5 * twistDir;
    g.rotation.z += twist;
    const idleSway = Math.sin(state.idleTime * 0.5 + idleSwayPhase) * 0.025 * idleFactor;
    g.rotation.z += idleSway;

    // Colors.
    SCRATCH_COLOR.copy(BASE_COLOR_DEFAULT).lerp(BASE_COLOR_HOVER, state.hoverT * 0.6);
    setFlatBaseColor(material, SCRATCH_COLOR);

    // Loading shimmer — pulse rim while texture is pending.
    const textureLoading = !cardTexture && !thumbnailSrc.startsWith('data:image/svg+xml') && !!thumbnailSrc && !textureError;
    let rimBase = 0.6 + state.hoverT * 0.9;
    let borderBase = 1.4 + state.hoverT * 0.8;
    if (textureLoading) {
      const shimmer = 0.5 + Math.sin(state.idleTime * 3 + idlePhase) * 0.5;
      rimBase += shimmer * 0.8;
      borderBase += shimmer * 0.6;
    }
    setFlatRimIntensity(material, rimBase);
    setFlatRimIntensity(borderMaterial, borderBase);
  });

  // --- Pointer handlers (view-only) ---

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
      const now = performance.now();
      if (state.lastTapTime > 0 && now - state.lastTapTime < 600) {
        setActiveProject(project);
        state.lastTapTime = 0;
      } else {
        setHovered(true);
        state.lastTapTime = now;
        window.setTimeout(() => setHovered(false), 1200);
      }
      return;
    }

    setActiveProject(project);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  useEffect(() => {
    // Only enable the texture once imageAspect is set (see material useMemo
    // comment for why). setFlatTexture passes null when imageAspect isn't
    // ready yet, which disables the texture in the shader.
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
          the same commit with no one-frame gap showing the old geometry. */}
      <mesh
        key={imageAspect ?? 'pre-aspect'}
        geometry={geometry}
        material={material}
        castShadow={false}
        receiveShadow={false}
      >
        <primitive object={material} ref={materialRef} attach="material" />
      </mesh>
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

// --- Easing helpers ---------------------------------------------------------

function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// --- Geometry helpers -------------------------------------------------------

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
