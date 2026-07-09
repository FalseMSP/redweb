import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * BlobShadow — fake contact-shadow decal (spec §4).
 *
 * A flat dark ellipse plane under an object, textured with a pre-baked
 * radial-gradient toon texture. Zero lighting calculation, drawn with our
 * flat material (or plain MeshBasicMaterial + alpha map) — identically on
 * every tier, since there's no shadow map system to begin with.
 *
 * The radial gradient is generated procedurally on a canvas at module load
 * and shared via singleton — no per-instance allocation.
 */

let blobTexture: THREE.Texture | null = null;

function getBlobTexture(): THREE.Texture {
  if (blobTexture) return blobTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  blobTexture = new THREE.CanvasTexture(canvas);
  blobTexture.needsUpdate = true;
  return blobTexture;
}

interface BlobShadowProps {
  position?: [number, number, number];
  scale?: [number, number] | number;
  opacity?: number;
}

export function BlobShadow({
  position = [0, -1.6, 0],
  scale = 2,
  opacity = 0.7,
}: BlobShadowProps) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => {
    const tex = getBlobTexture();
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
      color: new THREE.Color('#000000'),
    });
  }, [opacity]);

  const sx = typeof scale === 'number' ? scale : scale[0];
  const sy = typeof scale === 'number' ? scale : scale[1];

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[sx, sy, 1]}
    />
  );
}
