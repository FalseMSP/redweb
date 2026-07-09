import { useRef, type ReactNode } from 'react';

/**
 * CameraRig — group wrapper that reserves a transform for future cinematic
 * transitions (spec §3).
 *
 * NOTE: this component does NOT own any camera math itself. All camera writes
 * (dolly on z, parallax on x/y, lookAt) live in a single useFrame in
 * SceneContents to avoid dual-useFrame conflicts. This component exists so
 * future cinematic transitions (camera shake, scripted moves, etc.) have a
 * stable place to compose without touching the existing dolly/parallax logic.
 *
 * On touch devices and reduced-motion users, parallax is disabled upstream
 * (SceneContents reads the disableParallax flag and skips the parallax math).
 */
interface CameraRigProps {
  children?: ReactNode;
}

export function CameraRig({ children }: CameraRigProps) {
  // Use a generic group ref — THREE namespace import would be unused.
  const groupRef = useRef<{ position: { set: (x: number, y: number, z: number) => void }; rotation: { set: (x: number, y: number, z: number) => void } } | null>(null);
  // Group transform reserved for future cinematic transitions — currently
  // pinned at origin so existing scenes compose cleanly.
  return <group ref={groupRef as never}>{children}</group>;
}
