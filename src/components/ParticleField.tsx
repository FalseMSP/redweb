import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ParticleField — lightweight ambient particle system (spec §8).
 *
 * Implementation notes:
 *   • Single InstancedMesh — no per-particle React state, no per-frame
 *     array reallocation.
 *   • GPU-driven drift via per-instance offset in useFrame (writes to a
 *     Matrix4 scratch). All math is in-place on pre-allocated objects.
 *   • Rendered unlit with our flat material — no lighting evaluation on
 *     particles either (spec §8: "consistent with the rest of the pipeline").
 *   • Count is tier-scaled via prop (spec §8: ~300 desktop, 60-80 low-tier).
 */
interface ParticleFieldProps {
  count: number;
  /** Bounding box half-extent for particle distribution. */
  radius?: number;
  color?: THREE.ColorRepresentation;
  size?: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export function ParticleField({
  count,
  radius = 14,
  color = '#FF003C',
  size = 0.04,
}: ParticleFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-instance state — pre-allocated, zero per-frame alloc (spec §9).
  const instanceData = useMemo(() => {
    const positions: Float32Array = new Float32Array(count * 3);
    const speeds: Float32Array = new Float32Array(count);
    const phases: Float32Array = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spherical distribution biased to fill a wide cylindrical volume.
      const theta = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * (radius - 4);
      const y = (Math.random() - 0.5) * radius * 0.8;
      positions[i * 3 + 0] = Math.sin(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.cos(theta) * r;
      speeds[i] = 0.05 + Math.random() * 0.15;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, [count, radius]);

  // Pre-allocated scratch objects — never allocated inside useFrame.
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      time: 0,
    }),
    [],
  );

  // Tiny unlit octahedron — reads as a glowing point with our flat material.
  const geometry = useMemo(() => new THREE.OctahedronGeometry(size, 0), [size]);
  const material = useMemo(() => {
    // Inline creation — particles get their own material so they can have
    // a stronger rim (they ARE the glow).
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    scratch.time += delta;

    const { positions, speeds, phases } = instanceData;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      // Vertical drift + slow horizontal orbit.
      const yDrift = Math.sin(scratch.time * speeds[i] + phases[i]) * 0.4;
      scratch.position.set(
        positions[ix + 0],
        positions[ix + 1] + yDrift,
        positions[ix + 2],
      );
      scratch.quaternion.setFromAxisAngle(UP, scratch.time * 0.1 + phases[i]);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}
