import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Icosahedron } from './Icosahedron';

/**
 * GLBAsset — hero model loader.
 *
 * Preserves the GLB's original materials (PBR textures, normal maps, etc.)
 * and INJECTS the RedLife rim-light term into each material's fragment
 * shader via `onBeforeCompile`. The result: the model looks as authored in
 * Blender, with the signature red fresnel rim glowing on silhouettes.
 *
 * IMPORTANT — PBR materials need light:
 *   MeshStandardMaterial renders BLACK without lights. The rest of the scene
 *   uses RedLifeFlatMaterial with `lights = false`, so adding lights here is
 *   safe — they only affect lit materials (i.e. only the GLB). Scene.tsx
 *   adds an ambient + directional light inside the hero group when rendering
 *   this component.
 *
 * Pose / animation:
 *   Blender poses set in Pose Mode do NOT change the rest pose — exporting
 *   a posed character without "Apply Pose as Rest Pose" produces a GLB with
 *   the original T-pose (or A-pose) as the rest pose and the pose saved as
 *   an animation clip. To handle both cases, we play the first animation
 *   clip if one exists (which restores the pose), and pass through to the
 *   rest pose otherwise. If your pose is "baked" into the rest pose in
 *   Blender, no animation clip will exist and you'll see the rest pose
 *   directly.
 *
 *   To bake a pose into the rest pose in Blender:
 *     Pose Mode → select all bones (A) → Pose → Apply → Apply Pose as Rest Pose
 *
 * Idle motion (spin + arm sway):
 *   • The whole model slowly spins on its Y axis (default ~1 rotation per
 *     30 seconds). Controlled by `spinSpeed` — set to 0 to disable.
 *   • The "Left Arm" and "Right Arm" bones gently sway with a sinusoidal
 *     oscillation on top of the pose. The animation mixer writes the pose
 *     every frame (infinite loop), then our useFrame applies a fresh delta
 *     quaternion — so the arms oscillate cleanly without compounding.
 *     Controlled by `armSwayEnabled`, `armSwaySpeed`, `armSwayAmplitude`,
 *     and `armSwayAxis`.
 *
 *   NOTE on IK bones: glTF does NOT support IK constraints. Blender "bakes"
 *   IK into the bone rotations during export, so the IK target bones in the
 *   exported GLB are standalone bones with no effect on other bones. Moving
 *   them would be invisible. The arm sway therefore rotates the arm bones
 *   directly (the next best thing). If your GLB has different bone names,
 *   the sway is silently skipped (a console warning is logged).
 *
 * Pipeline guarantees:
 *   • useGLTF + useDraco=true handles both uncompressed and Draco-compressed
 *     GLBs (Draco decoding via Google's CDN-hosted decoder).
 *   • castShadow/receiveShadow are never set — there is no shadow system.
 *   • Auto-centers/normalizes via THREE.Box3, with optional scaleOverride/
 *     offset to preserve artist-authored proportions.
 *   • Wrapped in an ErrorBoundary at the parent so a missing/corrupt GLB
 *     shows the Icosahedron fallback instead of crashing the canvas.
 */

interface GLBAssetProps {
  path: string;
  /** Override auto-normalize scale (preserves artist-authored proportions). */
  scaleOverride?: number;
  /** Manual offset after auto-centering. */
  offset?: [number, number, number];
  /** Base color is no longer applied to the material (PBR textures preserved).
   * Kept in the prop signature for API compatibility but ignored. */
  baseColor?: THREE.ColorRepresentation;
  /** Rim fresnel color (the only effect applied to the original material). */
  rimColor?: THREE.ColorRepresentation;
  /** Rim fresnel power — higher = tighter rim. Default 2.3. */
  rimPower?: number;
  /** Rim fresnel intensity multiplier. Default 0.85. */
  rimIntensity?: number;
  /** Play the first animation clip in the GLB if one exists. Default true.
   * Set to false if your rest pose is already correct and you don't want
   * any animation playback. */
  playAnimations?: boolean;
  /** Slow continuous Y-axis spin speed in radians per second.
   * Default 0.21 (~1 full rotation per 30 seconds).
   * Set to 0 to disable the spin entirely. */
  spinSpeed?: number;
  /** Enable slow oscillating arm sway on top of the pose. Default true.
   * Requires bones named "Left Arm" and "Right Arm" in the armature
   * (matching the hero.glb naming convention). If the bones aren't found,
   * sway is silently skipped. */
  armSwayEnabled?: boolean;
  /** Arm sway oscillation speed in radians per second. Default 1.2
   * (~0.19 Hz, one full sway cycle every ~5.2 seconds). */
  armSwaySpeed?: number;
  /** Arm sway amplitude in radians. Default 0.35 (~20° max rotation). */
  armSwayAmplitude?: number;
  /** Arm sway rotation axis in each bone's local space. Default [1, 0, 0]
   * (local X — swings arms forward/backward). If the arms spin like
   * propellers instead of swaying, try [0, 0, 1] (local Z — lifts arms
   * sideways) or [0, 1, 0] (local Y — spins arms around their length). */
  armSwayAxis?: [number, number, number];
}

export function GLBAsset({
  path,
  scaleOverride,
  offset = [0, 0, 0],
  rimColor = '#FF003C',
  rimPower = 2.3,
  rimIntensity = 0.85,
  playAnimations = true,
  spinSpeed = (Math.PI * 2) / 30, // ~1 rotation per 30 seconds
  armSwayEnabled = true,
  armSwaySpeed = 1.2,
  armSwayAmplitude = 0.35,
  armSwayAxis = [1, 0, 0],
}: GLBAssetProps) {
  // useDraco=true wires up the DRACOLoader from Google's CDN. This is a no-op
  // for uncompressed GLBs (the decoder just isn't invoked) but enables
  // decoding for Draco-compressed exports. Without this, Blender exports with
  // "Compress" enabled would silently fail and fall back to the icosahedron.
  const gltf = useGLTF(path, true);

  // Clone the scene so we don't mutate the cached gltf.scene (useGLTF caches
  // per path — mutating would leak our rim injection across consumers).
  //
  // IMPORTANT: use SkeletonUtils.clone, NOT scene.clone(true). For skinned
  // meshes (which is what a posed character with an armature is), plain
  // scene.clone(true) does NOT deep-clone the Skeleton — the cloned
  // SkinnedMesh would still reference the ORIGINAL bones, so animating via
  // useAnimations would have no visible effect on the clone. SkeletonUtils
  // handles this correctly by cloning the skeleton and rebinding the
  // SkinnedMesh to the cloned bones.
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;

    // Inject the rim-light term into every material's fragment shader.
    // We do NOT replace the material — the original PBR textures, normal
    // maps, roughness maps, etc. are all preserved. We just append a fresnel
    // term to the emissive output so the rim reads as an additive glow on
    // top of the lit surface.
    //
    // Why onBeforeCompile instead of a separate shader pass: a second pass
    // would require depth-peeling for proper silhouettes (expensive), and
    // back-face rim tricks don't work for arbitrary topology. Injecting into
    // the existing shader gives us a single-pass rim that respects the
    // material's existing alpha/depth behavior for free.
    const rimColorObj = new THREE.Color(rimColor);

    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Force no shadows — there is no shadow system in this pipeline.
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      // Inject the rim into every material on this mesh. A mesh can have
      // multiple materials (multi-material meshes from Blender); handle
      // both single and array cases.
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (!mat) return;
        injectRimIntoMaterial(mat, rimColorObj, rimPower, rimIntensity);
      });
    });

    return clone;
  }, [gltf, rimColor, rimPower, rimIntensity]);

  // Play the first animation clip if one exists. This restores poses that
  // were authored in Pose Mode but not applied as the rest pose — Blender's
  // glTF exporter saves them as the first animation track.
  //
  // Note: animations live on the `gltf` object, NOT on the cloned scene.
  // AnimationClip targets bones by name/UUID, so the same clip works on the
  // cloned scene as long as the bone hierarchy was deep-cloned (which
  // SkeletonUtils.clone does — that's why we use it instead of scene.clone).
  //
  // The action is set to loop infinitely so the mixer continuously writes
  // the pose values to the bones every frame. This matters for the arm sway
  // (below): our useFrame applies a delta rotation ON TOP of whatever the
  // mixer just wrote. If the action didn't loop (and stopped after the first
  // play), the mixer would stop writing, and our delta would compound frame
  // over frame — the arms would spin instead of sway. With infinite loop,
  // the mixer resets the bone to the pose every frame, then we apply a fresh
  // delta. Clean oscillation, no compounding.
  const rootRef = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(gltf.animations, rootRef);
  useEffect(() => {
    if (!playAnimations) return;
    if (names.length === 0) return;
    const first = actions[names[0]];
    if (!first) return;
    first.setLoop(THREE.LoopRepeat, Infinity);
    first.reset().fadeIn(0.3).play();
    return () => {
      first.fadeOut(0.3);
    };
  }, [actions, names, playAnimations]);

  // --- Arm bone lookup -------------------------------------------------------
  // Find the "Left Arm" and "Right Arm" bones (exact name match, with space)
  // via the cloned skeleton. We search the skeleton (not the scene graph)
  // because the scene contains both bones AND mesh-bearing child nodes with
  // similar names (e.g. "LeftArm" without space is the child bone that has
  // the mesh; "Left Arm.001" is an IK target). The skeleton.bones array
  // contains only the actual armature joints, so we get the right ones.
  const armBones = useMemo(() => {
    const result: { leftArm: THREE.Bone | null; rightArm: THREE.Bone | null } = {
      leftArm: null,
      rightArm: null,
    };
    cloned.traverse((obj) => {
      const skinned = obj as THREE.SkinnedMesh;
      if (!skinned.isSkinnedMesh || !skinned.skeleton) return;
      for (const bone of skinned.skeleton.bones) {
        if (bone.name === 'Left Arm' && !result.leftArm) result.leftArm = bone;
        if (bone.name === 'Right Arm' && !result.rightArm) result.rightArm = bone;
      }
    });
    if (armSwayEnabled && (!result.leftArm || !result.rightArm)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[GLBAsset] armSway enabled but could not find "Left Arm" / "Right Arm" bones in the skeleton. Sway will be skipped.',
      );
    }
    return result;
  }, [cloned, armSwayEnabled]);

  // --- Slow spin + arm sway --------------------------------------------------
  // spinRef wraps the animation root so the spin applies to the whole model
  // (including all bones). The spin is a continuous Y-axis rotation; the
  // speed is controlled by `spinSpeed` (default ~1 rotation per 30s).
  //
  // Arm sway runs in the SAME useFrame, AFTER the mixer has updated (drei's
  // useAnimations registers its mixer.update useFrame before this one, so
  // execution order is guaranteed). Each frame:
  //   1. Mixer writes pose quaternions to all bones (overwrites).
  //   2. We multiply the arm bone quaternions by a delta (oscillating sin).
  // Because step 1 overwrites every frame, the delta never compounds — the
  // arms oscillate cleanly around the pose.
  const spinRef = useRef<THREE.Group>(null);
  const swayAxisVec = useMemo(
    () => new THREE.Vector3(armSwayAxis[0], armSwayAxis[1], armSwayAxis[2]).normalize(),
    [armSwayAxis],
  );
  const deltaQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    // Slow continuous spin.
    if (spinRef.current && spinSpeed !== 0) {
      spinRef.current.rotation.y += delta * spinSpeed;
    }

    // Arm sway — applied after mixer update (see comment above).
    if (!armSwayEnabled || (!armBones.leftArm && !armBones.rightArm)) return;
    const t = state.clock.elapsedTime;
    const angle = Math.sin(t * armSwaySpeed) * armSwayAmplitude;

    if (armBones.leftArm) {
      deltaQuat.setFromAxisAngle(swayAxisVec, angle);
      armBones.leftArm.quaternion.multiply(deltaQuat);
    }
    if (armBones.rightArm) {
      // Mirror the rotation for the right arm so both arms sway symmetrically.
      deltaQuat.setFromAxisAngle(swayAxisVec, -angle);
      armBones.rightArm.quaternion.multiply(deltaQuat);
    }
  });

  // Auto-center / normalize via Box3.
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

  // Apply user offset (centerOffset is applied internally to the primitive).
  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(offset[0], offset[1], offset[2]);
  }, [offset]);

  return (
    <group ref={groupRef} scale={finalScale}>
      {/* Slow Y-axis spin group. Wraps the animation root so the spin applies
          to the whole model including all bones. The spin compounds with
          Scene's scroll-driven world rotation — when not scrolling, only this
          spin is visible; when scrolling, both rotations add together. */}
      <group ref={spinRef}>
        <group ref={rootRef}>
          <primitive
            object={cloned}
            position={[centerOffset.x, centerOffset.y, centerOffset.z]}
          />
        </group>
      </group>
    </group>
  );
}

// --- Rim injection ----------------------------------------------------------

/**
 * Inject a fresnel rim-light term into a material's fragment shader.
 *
 * Works for any Three.js material that includes the standard shader chunks
 * (MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, etc.).
 * For materials without `<emissivemap_fragment>` (e.g. MeshBasicMaterial),
 * we fall back to appending the rim directly to `gl_FragColor` via the
 * `<colorspace_fragment>` include (which exists in every material).
 *
 * The injection is idempotent — if called twice on the same material, the
 * second call is a no-op (guarded by a `__rimInjected` flag).
 */
function injectRimIntoMaterial(
  material: THREE.Material,
  rimColor: THREE.Color,
  rimPower: number,
  rimIntensity: number,
): void {
  // Idempotency guard — never inject twice.
  if ((material as any).__rimInjected) return;
  (material as any).__rimInjected = true;

  // Stash uniforms on the material so onBeforeCompile can read them.
  // onBeforeCompile's `shader.uniforms` are per-material-instance, so we
  // bridge via closures on these properties.
  (material as any).userData.rimColor = rimColor.clone();
  (material as any).userData.rimPower = rimPower;
  (material as any).userData.rimIntensity = rimIntensity;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: (material as any).userData.rimColor };
    shader.uniforms.uRimPower = { value: (material as any).userData.rimPower };
    shader.uniforms.uRimIntensity = { value: (material as any).userData.rimIntensity };

    // === Vertex shader: pass world-space normal + view direction ===
    // Both are needed for the fresnel term computed in the fragment shader.
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `
        varying vec3 vRimWorldNormal;
        varying vec3 vRimViewDir;
        void main() {
        `,
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vRimWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 rimWorldPos = modelMatrix * vec4(position, 1.0);
        vRimViewDir = normalize(cameraPosition - rimWorldPos.xyz);
        `,
      );

    // === Fragment shader: add fresnel rim ===
    // For PBR materials (MeshStandardMaterial, MeshPhysicalMaterial), add
    // the rim to `totalEmissiveRadiance` — this is the standard Three.js
    // extension point for additive glow on lit materials.
    //
    // For unlit materials (MeshBasicMaterial), there's no emissive variable
    // — fall back to injecting before colorspace_fragment and add directly
    // to gl_FragColor.
    const isPBR =
      shader.fragmentShader.includes('totalEmissiveRadiance') &&
      shader.fragmentShader.includes('#include <emissivemap_fragment>');

    if (isPBR) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `
          uniform vec3 uRimColor;
          uniform float uRimPower;
          uniform float uRimIntensity;
          varying vec3 vRimWorldNormal;
          varying vec3 vRimViewDir;
          void main() {
          `,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          {
            float rimNdv = clamp(dot(vRimWorldNormal, vRimViewDir), 0.0, 1.0);
            float rimFresnel = pow(1.0 - rimNdv, uRimPower);
            totalEmissiveRadiance += uRimColor * (rimFresnel * uRimIntensity);
          }
          `,
        );
    } else {
      // Fallback for unlit materials — append to gl_FragColor before the
      // colorspace conversion. This works for MeshBasicMaterial and similar.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `
          uniform vec3 uRimColor;
          uniform float uRimPower;
          uniform float uRimIntensity;
          varying vec3 vRimWorldNormal;
          varying vec3 vRimViewDir;
          void main() {
          `,
        )
        .replace(
          '#include <colorspace_fragment>',
          `
          {
            float rimNdv = clamp(dot(vRimWorldNormal, vRimViewDir), 0.0, 1.0);
            float rimFresnel = pow(1.0 - rimNdv, uRimPower);
            gl_FragColor.rgb += uRimColor * (rimFresnel * uRimIntensity);
          }
          #include <colorspace_fragment>
          `,
        );
    }
  };

  // Mark the material as needing recompilation.
  material.needsUpdate = true;
}

// --- Safe wrapper ----------------------------------------------------------

/**
 * Wrapper that falls back to <Icosahedron /> when the GLB is missing or
 * fails to load. Keeps Suspense + error states in one place so Scene.tsx
 * stays simple.
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
// useDraco=true matches the load call above — needed so the preload registers
// the DRACOLoader extension correctly. This is a no-op if the file doesn't
// exist — the Safe wrapper catches the error.
//
// PATH NOTE: import.meta.env.BASE_URL is set by Vite from the `base` config
// option. On GitHub Pages (project site), the workflow sets VITE_BASE_PATH
// to /REPO_NAME, so BASE_URL = '/REPO_NAME' (no trailing slash). Locally or
// with a custom domain, BASE_URL = '/'.
//
// We construct the path as BASE_URL + '/assets/models/hero.glb'. The leading
// slash on '/assets/...' ensures there's always a separator between BASE_URL
// and the path. The .replace(/\/+/g, '/') collapses any double slashes that
// result when BASE_URL ends with '/' (e.g. '/' + '/assets/...' → '//assets/...'
// → '/assets/...').
//
// A hardcoded '/assets/models/hero.glb' would 404 on GitHub Pages because
// it resolves to https://USERNAME.github.io/assets/models/hero.glb
// (missing the /REPO_NAME/ prefix).
export const HERO_GLB_PATH = (import.meta.env.BASE_URL + '/assets/models/hero.glb').replace(/\/+/g, '/');
useGLTF.preload(HERO_GLB_PATH, true);
