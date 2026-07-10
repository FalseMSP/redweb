import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  PerspectiveCamera,
  PerformanceMonitor,
  useProgress,
  AdaptiveDpr,
  Preload,
} from '@react-three/drei';
import * as THREE from 'three';
import type { DeviceTier } from '@/types/project';
import { useDeviceTier, usePrefersReducedMotion, useAdaptiveLowQuality } from '@/hooks/useDeviceTier';
import { getSceneState } from '@/hooks/useScrollTimeline';
import { useStore } from '@/store';
import { useScrollStore } from '@/scrollStore';
import { projects } from '@/data/projects';
import { getSharedTexture } from '@/lib/textureCache';
import { CameraRig } from './CameraRig';
import { ParticleField } from './ParticleField';
import { PortfolioCard } from './PortfolioCard';
import { GLBAssetSafe } from './GLBAsset';
import { BlobShadow } from './BlobShadow';
import { YouTubeOrbitField } from './YouTubeOrbitField';
import { getFallbackYouTubeThumbnailUrls } from '@/hooks/useYouTubeVideos';

/**
 * Scene — top-level 3D entry.
 *
 * Renderer config is tier-dependent: DPR [1,1.5] high / flat 1 low,
 * antialias on high / off low, precision highp/mediump, NoToneMapping,
 * SRGBColorSpace, shadowMap disabled (no shadow system on any tier).
 *
 * PerformanceMonitor flips adaptiveLowQuality in the store on a sustained
 * FPS decline, which the rest of the scene reads.
 *
 * Texture loading is kicked off via the shared texture cache
 * (getSharedTexture) rather than a private TextureLoader, so this preload
 * and each PortfolioCard's own render resolve to the exact same Texture —
 * there's exactly one fetch/decode per thumbnail URL, and drei's
 * useProgress (which hooks into THREE.DefaultLoadingManager) reflects the
 * real load, not a throwaway duplicate.
 *
 * The loading screen dismiss is additionally gated on `assetsResolved`
 * (every thumbnail's aspect ratio has actually been assigned) rather than
 * on manager progress alone, plus a three-frame defer once both signals are
 * true. This matters because "the image finished downloading" (which is
 * all useProgress/the manager knows about) happens before React has
 * re-rendered PortfolioCard with the correct aspect ratio, remounted its
 * mesh (see the `key={imageAspect}` in PortfolioCard), and had a frame to
 * actually upload the texture to the GPU. Without this gate, the loading
 * screen could fade out a frame or two before the border/texture had
 * actually been painted at the right size.
 *
 * NOTE: the card meshes also set `frustumCulled={false}`. During the intro
 * phase (scroll offset 0–0.12) every card sits ~10 units below its target
 * Y, outside the camera frustum. Three.js's default frustum culling would
 * skip those draw calls, so the texture would never upload to the GPU and
 * the border shader would never compile — causing the exact pop-in the
 * loading gate is trying to prevent. Disabling frustum culling on the card
 * meshes guarantees the first draw after the material rebuild actually
 * lands on the GPU, which is what the three RAFs below are waiting for.
 */
export function Scene() {
  const tier = useDeviceTier();
  const reducedMotion = usePrefersReducedMotion();
  const isLowTier = tier === 'low';

  const setAdaptiveLowQuality = useStore((s) => s.setAdaptiveLowQuality);
  const setLoadProgress = useStore((s) => s.setLoadProgress);
  const setLoading = useStore((s) => s.setLoading);

  const { progress, active } = useProgress();

  // Guard: don't let the loading screen dismiss until preloads have been
  // started AND useProgress has had a chance to report them. Using state
  // (not a ref) so that setting it triggers a re-render, which re-evaluates
  // the useProgress values.
  const [preloadsStarted, setPreloadsStarted] = useState(false);

  // Tracks whether every real (non-SVG-placeholder) thumbnail has actually
  // been assigned an aspect ratio (or errored out) — i.e. the signal that
  // matters for "is it safe to reveal the cards", independent of whatever
  // the LoadingManager's byte-count-based progress says.
  const [assetsResolved, setAssetsResolved] = useState(false);

  // Kick off (or attach to) the shared texture load for every real thumbnail
  // URL, AFTER useProgress is mounted, so the LoadingManager's
  // onStart/onProgress/onLoad callbacks fire and useProgress tracks them.
  // Using the shared cache means this is the SAME load PortfolioCard's own
  // render will resolve to — not a separate throwaway fetch.
  useEffect(() => {
    let cancelled = false;
    // Preload both project thumbnails AND YouTube fallback thumbnails.
    // The YouTube thumbnails are the initial-render set (from the hook's
    // FALLBACK_VIDEOS). Without preloading them here, the loading screen
    // could dismiss before YouTube textures finish loading — the
    // `assetsResolved` gate only counts URLs we explicitly track, so we
    // must include YouTube URLs in the list. (useProgress tracks all
    // DefaultLoadingManager activity, but assetsResolved is an
    // independent gate that requires every URL's onReady callback to fire.)
    const projectUrls = projects
      .map((p) => p.thumbnail)
      .filter((url) => !!url && !url.startsWith('data:image/svg+xml'));
    const youtubeUrls = getFallbackYouTubeThumbnailUrls(8);
    const urls = [...projectUrls, ...youtubeUrls];

    if (urls.length === 0) {
      setAssetsResolved(true);
    } else {
      let resolvedCount = 0;
      urls.forEach((url) => {
        getSharedTexture(url, () => {
          if (cancelled) return;
          resolvedCount += 1;
          if (resolvedCount === urls.length) {
            setAssetsResolved(true);
          }
        });
      });
    }

    setPreloadsStarted(true);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Before preloads have started, always keep loading = true.
    // After preloads start, useProgress will re-render with active=true
    // (because LoadingManager.onStart fires), and this effect re-runs.
    if (!preloadsStarted) {
      setLoading(true);
      return;
    }
    setLoadProgress(progress / 100);

    const managerDone = !active && progress >= 100;
    if (!managerDone || !assetsResolved) {
      setLoading(true);
      return;
    }

    // Both signals say "done" — but React still needs a render pass to
    // commit the aspect-driven mesh remounts (PortfolioCard's
    // `key={imageAspect}`) and the renderer needs a draw call to actually
    // upload the texture to the GPU. Defer the dismiss by three animation
    // frames so that work has landed on screen before the fade starts.
    //   RAF 1: React commit lands; R3F render loop draws the scene. With
    //          frustumCulled=false on card meshes, the draw call fires and
    //          the material compiles + texture upload begins.
    //   RAF 2: Texture upload completes; border shader finishes compiling.
    //   RAF 3: One more paint with the final GPU state before the fade.
    let raf1 = 0;
    let raf2 = 0;
    let raf3 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        raf3 = requestAnimationFrame(() => {
          setLoading(false);
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
    };
  }, [progress, active, setLoadProgress, setLoading, preloadsStarted, assetsResolved]);

  const handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn('[Scene] WebGL context lost — attempting recovery.');
  };

  return (
    <Canvas
      className="canvas-host"
      role="img"
      aria-label="Interactive 3D gallery of portfolio projects — see project list below for keyboard/screen-reader access"
      gl={{
        antialias: !isLowTier,
        powerPreference: isLowTier ? 'default' : 'high-performance',
        alpha: false,
        precision: isLowTier ? 'mediump' : 'highp',
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false,
      }}
      dpr={isLowTier ? 1 : [1, 1.5]}
      flat
      linear={false}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = false;
        gl.setClearColor('#05060A', 1);
        gl.domElement.addEventListener('webglcontextlost', handleContextLost as EventListener);
      }}
    >
      <PerformanceMonitor
        onDecline={() => setAdaptiveLowQuality(true)}
        onIncline={() => {
          if (tier === 'high') setAdaptiveLowQuality(false);
        }}
        flipflops={3}
        onFallback={() => setAdaptiveLowQuality(true)}
      />

      <PerspectiveCamera makeDefault fov={45} near={0.1} far={100} position={[0, 0, 18]} />

      <Suspense fallback={null}>
        <ScrollControls
          pages={4}
          damping={0.2}
          eps={0.0005}
          horizontal={false}
        >
          <SceneContents tier={tier} reducedMotion={reducedMotion} />
        </ScrollControls>
        <Preload all />
      </Suspense>

      <AdaptiveDpr pixelated />
    </Canvas>
  );
}

// --- Scene contents (inside ScrollControls so we can read scroll.offset) ---

interface SceneContentsProps {
  tier: DeviceTier;
  reducedMotion: boolean;
}

function SceneContents({ tier, reducedMotion }: SceneContentsProps) {
  const scroll = useScroll();
  const adaptiveLow = useAdaptiveLowQuality();
  const { camera, pointer } = useThree();

  const effectiveTier: DeviceTier = adaptiveLow ? 'low' : tier;

  const worldRef = useRef<THREE.Group>(null);
  const heroRef = useRef<THREE.Group>(null);

  const particleCount = effectiveTier === 'low' ? 70 : 300;

  const disableParallax = reducedMotion || tier === 'low';
  const parallax = useRef({ x: 0, y: 0 });

  // --- Scroll forwarding (wheel + touch) -------------------------------------
  // The canvas can intercept wheel AND touch events before they reach drei's
  // scroll container. This listener finds the scroll container ONCE and caches
  // it, then forwards wheel deltas and touch drags to it. Cache is invalidated
  // on window resize.
  //
  // MOBILE FIX: the original code only handled `wheel` events (desktop mice).
  // On mobile, swiping on the canvas produced `touchstart`/`touchmove`/
  // `touchend` events that the canvas swallowed — drei's scroll container
  // never saw them, so scrolling didn't work. Now we forward touch events
  // too, manually translating touch deltas to scrollTop changes. This gives
  // mobile users the same scroll behavior as desktop (with momentum via
  // drei's built-in damping).
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const findScrollContainer = (): HTMLElement | null => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      let parent: HTMLElement | null = canvas.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        const divs = parent.querySelectorAll('div');
        for (const div of divs) {
          const style = getComputedStyle(div);
          if (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            div.scrollHeight > div.clientHeight
          ) {
            return div as HTMLElement;
          }
        }
        parent = parent.parentElement;
      }
      return null;
    };

    // Initial lookup (deferred to next tick so drei has mounted its container).
    const initTimer = setTimeout(() => {
      scrollContainerRef.current = findScrollContainer();
    }, 100);

    // Invalidate cache on resize (drei may rebuild the container).
    const onResize = () => {
      scrollContainerRef.current = findScrollContainer();
    };
    window.addEventListener('resize', onResize);

    // --- Wheel (desktop) ---
    const onWheel = (e: WheelEvent) => {
      if (document.body.classList.contains('modal-open')) return;
      // Use cached container; re-lookup only if cache is empty.
      let container = scrollContainerRef.current;
      if (!container) {
        container = findScrollContainer();
        scrollContainerRef.current = container;
      }
      if (!container) return;
      e.preventDefault();
      container.scrollTop += e.deltaY;
    };

    // --- Touch (mobile) ---
    // Track the last touch Y position to compute drag deltas. We use
    // `passive: false` so we can call preventDefault() — this stops the
    // browser from also trying to scroll the page body (which has
    // overflow:hidden and would cause weird rubber-banding on iOS).
    let touchStartY = 0;
    let lastTouchY = 0;
    let isTouching = false;

    const onTouchStart = (e: TouchEvent) => {
      if (document.body.classList.contains('modal-open')) return;
      if (e.touches.length !== 1) return; // ignore multi-touch (pinch-zoom etc)
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
      isTouching = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouching) return;
      if (document.body.classList.contains('modal-open')) return;
      if (e.touches.length !== 1) return;

      let container = scrollContainerRef.current;
      if (!container) {
        container = findScrollContainer();
        scrollContainerRef.current = container;
      }
      if (!container) return;

      // Prevent the browser's native scroll — we're handling it ourselves.
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentY; // dragging down = positive = scroll down
      container.scrollTop += deltaY;
      lastTouchY = currentY;
    };

    const onTouchEnd = () => {
      isTouching = false;
    };

    // Attach wheel to window (desktop). Attach touch to the canvas itself —
    // touch events target the element under the finger, and the canvas is
    // what's under the finger on mobile. Using `passive: false` on touchmove
    // is critical so we can call preventDefault().
    window.addEventListener('wheel', onWheel, { passive: false });

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: true });
      canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      if (canvas) {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
      }
    };
  }, []);

  useFrame((_, delta) => {
    const o = scroll.offset;
    const state = getSceneState(o, tier, reducedMotion);

    // World rotation (full revolution across the whole scroll range).
    if (worldRef.current) {
      const target = state.worldRotationY;
      const current = worldRef.current.rotation.y;
      const diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
      worldRef.current.rotation.y = current + diff * (1 - Math.pow(0.001, delta));
    }

    // Hero — always fully visible (no entrance animation). The sphere/GLTF
    // stays at scale 1 for the entire scroll range.
    if (heroRef.current) {
      const current = heroRef.current.scale.x;
      heroRef.current.scale.setScalar(THREE.MathUtils.damp(current, 1, 4, delta));
    }

    // Camera dolly on z.
    camera.position.z = THREE.MathUtils.damp(camera.position.z, state.cameraZ, 4, delta);

    // === Rule-of-thirds camera slide ===
    // During the close phase, slide the camera right so the hero (at world
    // origin) sits EXACTLY on the left rule-of-thirds line. The offset is
    // computed from the live camera aspect ratio so it's exact for any screen.
    //
    // Math: for the hero to appear at screen x = width/3 (1/3 from left),
    // it needs to be at angle θ left of the camera's forward axis where:
    //   θ = atan((1/3) * tan(half_horizontal_FOV))
    //   half_horizontal_FOV = atan(tan(vFOV/2) * aspect)
    // And the camera X offset (looking straight ahead) = cameraZ * tan(θ).
    const FOV = 45 * Math.PI / 180;
    const perspCam = camera as THREE.PerspectiveCamera;
    const aspect = perspCam.aspect;
    const halfHFov = Math.atan(Math.tan(FOV / 2) * aspect);
    const thirdAngle = Math.atan((1 / 3) * Math.tan(halfHFov));
    const slideOffset = camera.position.z * Math.tan(thirdAngle) * state.cameraSlideT;

    // Mouse parallax on x/y — desktop only.
    if (!disableParallax) {
      const damp = 1 - Math.pow(0.001, delta);
      parallax.current.x += (pointer.x - parallax.current.x) * damp;
      parallax.current.y += (pointer.y - parallax.current.y) * damp;
    } else {
      parallax.current.x *= 0.98;
      parallax.current.y *= 0.98;
    }
    const ampX = disableParallax ? 0 : effectiveTier === 'low' ? 0.4 : 1.0;
    const ampY = disableParallax ? 0 : effectiveTier === 'low' ? 0.3 : 0.6;
    // Camera X = parallax + rule-of-thirds slide.
    const targetX = parallax.current.x * ampX + slideOffset;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 4, delta);
    camera.position.y = parallax.current.y * ampY;

    // Look at the slide offset point so the camera looks straight ahead (parallel
    // to -z) — this keeps the hero at the exact rule-of-thirds left position.
    camera.lookAt(slideOffset, 0, 0);

    // Publish scroll state for HTML overlays.
    useScrollStore.getState().setScrollState({
      offset: o,
      taglineOpacity: Math.round(state.taglineOpacity * 20) / 20,
      footerOpacity: Math.round(state.footerOpacity * 20) / 20,
      cardVisibility: Math.round(state.cardVisibility * 20) / 20,
      pastIntro: o >= 0.25,
      inHintZone: o < 0.02 && !reducedMotion,
    });
  });

  return (
    <>
      <CameraRig />

      {/* World group — rotates with scroll. */}
      <group ref={worldRef}>
        {/* Hero object — always visible. Renders the Draco-compressed (or
            uncompressed) GLB at /public/assets/models/hero.glb. If the file
            is missing or fails to load, GLBAssetSafe falls back to the
            faceted Icosahedron. To revert to the icosahedron permanently,
            set usePlaceholder={true} or swap this back to <Icosahedron>.

            GLBAsset preserves the GLB's original PBR materials/textures and
            only adds a red fresnel rim on top. PBR materials need light to
            render (without lights, MeshStandardMaterial is black), so we add
            an ambient + directional light here. These lights ONLY affect lit
            materials — every other object in the scene uses RedLifeFlatMaterial
            with `lights = false`, so they're completely unaffected. */}
        <group ref={heroRef}>
          {/* Lighting for the GLB only. Intensity tuned to look "lit but
              moody" — adjust if your model comes in too dark or too bright.
              The directional light is positioned to come from above-front,
              matching the camera's viewing direction so the rim reads on
              the silhouette. */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 5]} intensity={1.2} color="#FFFFFF" />

          <GLBAssetSafe
            path="/assets/models/hero.glb"
            usePlaceholder={false}
            rimColor="#FF003C"
            rimPower={2.3}
            rimIntensity={0.85}
          />
          <BlobShadow position={[0, -1.7, 0]} scale={[2.2, 0.6]} opacity={0.75} />
        </group>

        {/* Portfolio cards — circular formation. Radius 8 gives 14 cards
            enough breathing room; camera dolly (12 → 9 high / 12 → 11 low)
            keeps the closest card-to-camera distance comfortable. */}
        <group>
          {projects.map((project, i) => (
            <PortfolioCard
              key={project.id}
              project={project}
              index={i}
              total={projects.length}
              tier={effectiveTier}
              radius={8}
            />
          ))}
        </group>

        {/* YouTube orbit — a smaller ring of "mini" video cards that orbit
            the hero on their own slow drift, sitting between the hero and
            the portfolio cards. Inherits the parent world-group scroll
            rotation; adds its own slow rotation on top so the cards visibly
            drift even when the user isn't scrolling. Self-suppresses in
            recruiter view (URL contains "recruiter") and on low-tier
            devices. Default count = 8 (4 long-form + 4 Shorts interleaved,
            no livestreams). Reveal/exit tracks the same `cardVisibility`
            scroll-state signal as the portfolio cards. */}
        <YouTubeOrbitField count={8} radius={5} />
      </group>

      <ParticleField count={particleCount} color="#FF003C" size={effectiveTier === 'low' ? 0.05 : 0.04} />

      <mesh position={[0, 0, -20]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#05060A" />
      </mesh>
    </>
  );
}
