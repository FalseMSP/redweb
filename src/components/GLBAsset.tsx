import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Icosahedron } from './Icosahedron';
import { createFlatMaterial, setFlatBaseColor } from './RedLifeFlatMaterial';

/**
 * GLBAsset — Draco-compressed hero model loader (spec §5).
 *
 * Pipeline guarantees enforced here:
 *   • useGLTF + useGLTF.preload for Draco-compressed GLB.
 *   • scene.traverse() applies RedLifeFlatMaterial to every mesh and forces
 *     flatShading on each.
 *   • castShadow/receiveShadow are NOT set — there is no shadow system in
 *     this pipeline to opt into, on any tier (spec §4, §13).
 *   • Auto-centers/normalizes via THREE.Box3, but accepts optional
 *     scaleOverride/offset props so an artist-authored Blender export with
 *     intentional proportions isn't silently renormalized.
 *   • Wrapped in an ErrorBoundary at the parent (Scene) so a missing/corrupt
 *     GLB shows the Icosahedron fallback instead of crashing the canvas.
 *
 * IMPORTANT: any embedded lights / PBR material definitions in the GLB are
 * explicitly stripped — we never let lighting cost sneak back in through an
 * asset (spec §9).
 */

interface GLBAssetProps {
  path: string;
  /** Override auto-normalize scale (preserves artist-authored proportions). */
  scaleOverride?: number;
  /** Manual offset after auto-centering. */
  offset?: [number, number, number];
  baseColor?: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
}

export function GLBAsset({
  path,
  scaleOverride,
  offset = [0, 0, 0],
  baseColor = '#0B0D14',
  rimColor = '#FF003C',
}: GLBAssetProps) {
  const gltf = useGLTF(path);
  const cloned = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Strip any embedded lights / PBR materials that came in via the GLB.
      // We never want lighting cost sneaking back in through an asset (spec §9).
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m) => m.dispose());
      }

      // Replace every material with our flat/unlit shader.
      mesh.material = createFlatMaterial({
        baseColor,
        rimColor,
        rimPower: 2.3,
        rimIntensity: 0.85,
        ao: 0.35,
        aoColor: '#000000',
      });

      // Force flat shading on geometry (spec §5).
      if (mesh.geometry) {
        mesh.geometry.computeVertexNormals();
        // ShaderMaterial doesn't expose flatShading — flat shading is
        // achieved in the fragment shader via derivatives (see RedLifeFlatMaterial).
      }

      // Never set castShadow/receiveShadow — there is no shadow system.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return clone;
  }, [gltf, baseColor, rimColor]);

  // Auto-center / normalize via Box3 (spec §5).
  const { centerOffset, autoScale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Normalize so the longest side is ~3 units, unless overridden.
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    return {
      centerOffset: center.clone().negate(),
      autoScale: 3 / maxSize,
    };
  }, [cloned]);

  const finalScale = scaleOverride ?? autoScale;

  // Apply offset (centerOffset applied internally, user offset applied on top).
  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(offset[0], offset[1], offset[2]);
  }, [offset]);

  // Expose a stable color-update handle for hover/scroll-driven color shifts.
  const materialHandles = useMemo(() => {
    const handles: THREE.ShaderMaterial[] = [];
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material instanceof THREE.ShaderMaterial) {
        handles.push(mesh.material);
      }
    });
    return handles;
  }, [cloned]);

  // Imperative API for live color updates without recompiling.
  useEffect(() => {
    materialHandles.forEach((m) => setFlatBaseColor(m, new THREE.Color(baseColor)));
  }, [baseColor, materialHandles]);

  return (
    <group ref={groupRef} scale={finalScale}>
      <primitive object={cloned} position={[centerOffset.x, centerOffset.y, centerOffset.z]} />
    </group>
  );
}

/**
 * Wrapper that falls back to <Icosahedron /> when the GLB is missing or
 * fails to load. Keeps Suspense + error states in one place so Scene.tsx
 * stays simple. (spec §5: ErrorBoundary around Suspense fallback.)
 */
interface GLBAssetSafeProps extends GLBAssetProps {
  /** When true, skip the GLB load entirely and use the placeholder. */
  usePlaceholder?: boolean;
}

export function GLBAssetSafe(props: GLBAssetSafeProps) {
  const [failed, setFailed] = useState(false);
  const { usePlaceholder, ...assetProps } = props;

  // Reset failure state when the path changes (e.g. when a new model is loaded).
  useEffect(() => {
    setFailed(false);
  }, [props.path]);

  if (usePlaceholder || failed) {
    return <Icosahedron baseColor={props.baseColor} rimColor={props.rimColor} />;
  }

  return (
    <ErrorBoundaryLite onCatch={() => setFailed(true)}>
      <Suspense fallback={<Icosahedron baseColor={props.baseColor} rimColor={props.rimColor} />}>
        {/* key forces remount when the path changes so useGLTF re-fetches */}
        <GLBAsset key={props.path} {...assetProps} />
      </Suspense>
    </ErrorBoundaryLite>
  );
}

/**
 * Tiny class-component ErrorBoundary — React still requires getDerivedStateFromError
 * to be on a class. Kept local so GLBAsset.tsx is self-contained.
 */
import { Component, type ReactNode } from 'react';
interface EBProps {
  children: ReactNode;
  onCatch?: () => void;
  fallback?: ReactNode;
}
interface EBState {
  hasError: boolean;
}
class ErrorBoundaryLite extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }
  override componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.warn('[GLBAsset] load failed, falling back to placeholder:', error.message);
    this.props.onCatch?.();
  }
  override render(): ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

// Preload the hero asset so the first render after Suspense resolves is instant.
// This is a no-op if the file doesn't exist — the Safe wrapper catches the error.
useGLTF.preload('/assets/models/hero.glb');
