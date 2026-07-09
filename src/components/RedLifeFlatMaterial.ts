import * as THREE from 'three';

/**
 * RedLifeFlatMaterial — flat/unlit ShaderMaterial (spec §4).
 *
 * Pipeline guarantees:
 *   • No scene lights, no shadow maps, no PBR, no toon — this material outputs
 *     baseColor directly as the fragment color.
 *   • The only "glow" is a cheap, unlit, view-angle fresnel term computed from
 *     the vertex normal and the camera-to-fragment view vector — no light
 *     contributes to the fragment. This is what makes it cheap enough for the
 *     PowerVR GT7600 on iPhone 7.
 *   • flatShading is achieved by deriving the face normal in the vertex shader
 *     using `dFdx`/`dFdy` on the world position (derivatives are GLSL ES 1.0
 *     fragment-shader features, available even on WebGL1 — so the iPhone 7
 *     fallback path is safe).
 *
 * Singleton: getFlatMaterialShader() lazily compiles and caches the program.
 * Each material instance still gets its own uniforms (so per-card hover colors
 * work without recompiling), but the underlying program is shared — critical
 * for 2GB-RAM devices where redundant shader instances can trip iOS Safari's
 * memory watchdog (spec §4: "Safari on iOS will silently reload the tab").
 */

const FLAT_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vObjectNormal;
  varying vec2 vUv;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vViewPos = (viewMatrix * worldPos).xyz;
    // Object-space normal is enough for the fresnel term — we transform in
    // fragment shader so flat shading via derivatives works correctly.
    vObjectNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FLAT_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uRimIntensity;
  uniform float uOpacity;
  uniform float uAO;          // baked ambient-occlusion tint (0..1) — multiplied into base
  uniform vec3 uAOColor;      // tint applied where AO is strong
  uniform sampler2D uTexture; // optional texture (card image)
  uniform float uTextureEnabled; // 0.0 = no texture, 1.0 = use texture

  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vObjectNormal;
  varying vec2 vUv;

  // Derive a per-face normal using derivatives so each triangle reads as a
  // distinct faceted surface — this is what gives flat shading its look
  // (spec §4). Works in WebGL1 fragment shaders.
  vec3 faceNormal() {
    vec3 dx = dFdx(vViewPos);
    vec3 dy = dFdy(vViewPos);
    return normalize(cross(dx, dy));
  }

  void main() {
    // Face normal in view space — flat-shaded.
    vec3 n = faceNormal();

    // View vector (from fragment to camera). In view space, camera is at origin.
    vec3 viewDir = normalize(-vViewPos);

    // View-angle fresnel term: pow(1 - dot(n, viewDir), power).
    // No scene light contributes to this — purely geometry/camera math.
    float ndv = clamp(dot(n, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, uRimPower);

    // Base color with baked AO tint — gives shape-reading without lighting.
    vec3 base = mix(uBaseColor, uAOColor, uAO * 0.35);

    // Optional texture overlay (card images). Mixed on top of the base color
    // using the texture's alpha channel.
    if (uTextureEnabled > 0.5) {
      vec4 tex = texture2D(uTexture, vUv);
      base = mix(base, tex.rgb, tex.a);
    }

    // Rim glow added additively. Intensity scales the whole term.
    vec3 rim = uRimColor * (fresnel * uRimIntensity);

    vec3 finalColor = base + rim;

    gl_FragColor = vec4(finalColor, uOpacity);

    #include <colorspace_fragment>
  }
`;

// --- Singleton program cache ------------------------------------------------

interface FlatShaderProgram {
  vertexShader: string;
  fragmentShader: string;
}

let cachedProgram: FlatShaderProgram | null = null;

/**
 * Lazily compile and cache the flat shader source. Returning the source
 * strings (not a compiled program) lets THREE.ShaderMaterial dedupe the
 * underlying GL program internally — important for memory budget on 2GB
 * devices (spec §4).
 */
export function getFlatMaterialShader(): FlatShaderProgram {
  if (cachedProgram) return cachedProgram;
  cachedProgram = {
    vertexShader: FLAT_VERTEX,
    fragmentShader: FLAT_FRAGMENT,
  };
  return cachedProgram;
}

// --- Uniforms template ------------------------------------------------------

export interface RedLifeFlatMaterialParameters {
  baseColor?: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
  rimPower?: number;
  rimIntensity?: number;
  opacity?: number;
  ao?: number;
  aoColor?: THREE.ColorRepresentation;
  transparent?: boolean;
  depthWrite?: boolean;
  side?: THREE.Side;
  texture?: THREE.Texture;
  textureEnabled?: boolean;
}

const DEFAULT_RIM = new THREE.Color('#FF003C');
const DEFAULT_AO_COLOR = new THREE.Color('#000000');

/**
 * Create a fresh RedLifeFlatMaterial instance. Each instance owns its own
 * uniforms (so per-object hover colors work without recompiling), but the
 * shader source — and therefore the compiled GL program — is shared via
 * getFlatMaterialShader() (spec §4 singleton rule).
 */
export function createFlatMaterial(
  params: RedLifeFlatMaterialParameters = {},
): THREE.ShaderMaterial {
  const shader = getFlatMaterialShader();

  const mat = new THREE.ShaderMaterial({
    name: 'RedLifeFlatMaterial',
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: {
      uBaseColor: { value: new THREE.Color(params.baseColor ?? '#0B0D14') },
      uRimColor: { value: new THREE.Color(params.rimColor ?? DEFAULT_RIM) },
      uRimPower: { value: params.rimPower ?? 2.4 },
      uRimIntensity: { value: params.rimIntensity ?? 0.8 },
      uOpacity: { value: params.opacity ?? 1.0 },
      uAO: { value: params.ao ?? 0.0 },
      uAOColor: { value: new THREE.Color(params.aoColor ?? DEFAULT_AO_COLOR) },
      uTexture: { value: params.texture ?? null },
      uTextureEnabled: { value: params.textureEnabled ? 1.0 : 0.0 },
    },
    transparent: params.transparent ?? false,
    depthWrite: params.depthWrite ?? true,
    side: params.side ?? THREE.FrontSide,
  });

  // Hint to THREE that this material ignores lights — keeps the renderer's
  // light setup loop off the critical path entirely.
  mat.lights = false;
  // Note: ShaderMaterial doesn't have a `flatShading` flag like
  // MeshStandardMaterial does. Flat shading is achieved inside the fragment
  // shader itself via dFdx/dFdy derivatives — see FLAT_FRAGMENT faceNormal().

  return mat;
}

/**
 * Live-update a material's base color without recompiling.
 * Used by portfolio card hover (spec §6: "direct baseColor uniform lerp").
 */
export function setFlatBaseColor(mat: THREE.ShaderMaterial, color: THREE.Color): void {
  const u = mat.uniforms.uBaseColor;
  if (u && u.value instanceof THREE.Color) {
    u.value.copy(color);
  }
}

export function setFlatRimIntensity(mat: THREE.ShaderMaterial, intensity: number): void {
  const u = mat.uniforms.uRimIntensity;
  if (u) u.value = intensity;
}

export function setFlatOpacity(mat: THREE.ShaderMaterial, opacity: number): void {
  const u = mat.uniforms.uOpacity;
  if (u) u.value = opacity;
}

/**
 * Live-update the texture on a material. Used by card image uploads.
 * Pass null to disable the texture and revert to flat color.
 */
export function setFlatTexture(mat: THREE.ShaderMaterial, texture: THREE.Texture | null): void {
  const uTex = mat.uniforms.uTexture;
  const uEnabled = mat.uniforms.uTextureEnabled;
  if (uTex) uTex.value = texture;
  if (uEnabled) uEnabled.value = texture ? 1.0 : 0.0;
}
