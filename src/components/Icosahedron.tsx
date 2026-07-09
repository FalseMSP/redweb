import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createFlatMaterial, setFlatRimIntensity } from './RedLifeFlatMaterial';

/**
 * Placeholder Icosahedron — used until hero.glb exists (spec §5).
 * Same component slot, so swapping in <GLBAsset> requires no code changes
 * elsewhere. Flat-shaded with the unlit fresnel rim — same material pipeline
 * as the real asset will use.
 */
interface IcosahedronProps {
  /** Sine-wave vertical float amplitude. */
  floatAmplitude?: number;
  /** Idle Y rotation speed (rad/sec). */
  rotationSpeed?: number;
  scale?: number;
  baseColor?: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
}

export function Icosahedron({
  floatAmplitude = 0.15,
  rotationSpeed = 0.25,
  scale = 1,
  baseColor = '#0B0D14',
  rimColor = '#FF003C',
}: IcosahedronProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Memoize geometry + material — no per-frame allocations.
  const geometry = useMemo(() => {
    // detail=1 gives 80 triangles — reads as faceted without being noisy.
    // Per spec §5: flat shading reads better with fewer, larger triangles.
    const geo = new THREE.IcosahedronGeometry(1.4, 1);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const material = useMemo(
    () =>
      createFlatMaterial({
        baseColor,
        rimColor,
        rimPower: 2.2,
        rimIntensity: 1.0,
        ao: 0.4,
        aoColor: '#000000',
      }),
    [baseColor, rimColor],
  );

  // Reuse scratch vectors — zero allocations inside useFrame (spec §9).
  const scratch = useMemo(
    () => ({
      t: 0,
    }),
    [],
  );

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    scratch.t += delta;
    g.rotation.y += rotationSpeed * delta;
    g.rotation.x = Math.sin(scratch.t * 0.4) * 0.08;
    g.position.y = Math.sin(scratch.t * 0.8) * floatAmplitude;

    // Subtle rim pulse — gives the placeholder a "live" quality without
    // costing a light evaluation.
    if (materialRef.current) {
      const pulse = 0.85 + Math.sin(scratch.t * 1.6) * 0.15;
      setFlatRimIntensity(materialRef.current, pulse);
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      <mesh geometry={geometry} material={material} castShadow={false} receiveShadow={false}>
        <primitive object={material} ref={materialRef} attach="material" />
      </mesh>
    </group>
  );
}
