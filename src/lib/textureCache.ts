import * as THREE from 'three';

/**
 * Shared texture loader/cache.
 *
 * Why this exists: Scene.tsx wants to know when every card thumbnail has
 * finished loading (to drive the loading screen), while PortfolioCard.tsx
 * needs the actual THREE.Texture to render. Previously each side created
 * its own `new THREE.TextureLoader()` and called `.load(url)` independently.
 * Because `THREE.Cache.enabled` is `false` by default, those were two
 * entirely separate fetch+decode operations per image — both registered
 * with THREE.DefaultLoadingManager (so drei's useProgress counted 28 items
 * for 14 cards instead of 14), but with no guarantee that the copy Scene
 * was tracking was the same one PortfolioCard ended up painting on screen.
 * A fast "throwaway" load could finish and push progress to 100% while the
 * texture actually bound to a card's material was still in flight — the
 * loading screen would then fade out while a card's border/texture popped
 * in late.
 *
 * This module guarantees exactly one TextureLoader().load(url) call per
 * distinct URL. Every caller — Scene's readiness tracking and
 * PortfolioCard's render — gets back the *same* Texture instance and the
 * *same* resolved aspect ratio.
 */

interface CacheEntry {
  texture: THREE.Texture;
  /** null while still loading. */
  aspect: number | null;
  errored: boolean;
  callbacks: Array<(aspect: number | null, errored: boolean) => void>;
}

const cache = new Map<string, CacheEntry>();
const loader = new THREE.TextureLoader();

/**
 * Get (or start) a shared texture load for `url`.
 *
 * Returns the Texture immediately (it renders as transparent/blank until
 * loaded, same as a raw TextureLoader.load() would). `onReady` fires
 * exactly once per call, either on the next microtask (if the URL was
 * already resolved by an earlier caller) or once the load completes.
 */
export function getSharedTexture(
  url: string,
  onReady?: (aspect: number | null, errored: boolean) => void,
): THREE.Texture {
  const existing = cache.get(url);
  if (existing) {
    if (onReady) {
      if (existing.aspect !== null || existing.errored) {
        // Already resolved — notify asynchronously so callers can rely on
        // consistent (never-synchronous) callback timing.
        queueMicrotask(() => onReady(existing.aspect, existing.errored));
      } else {
        existing.callbacks.push(onReady);
      }
    }
    return existing.texture;
  }

  const entry: CacheEntry = {
    // Placeholder until loader.load below assigns the real texture — the
    // loader returns the (initially empty) Texture synchronously, so this
    // is only ever read after that assignment in practice.
    texture: undefined as unknown as THREE.Texture,
    aspect: null,
    errored: false,
    callbacks: onReady ? [onReady] : [],
  };
  cache.set(url, entry);

  const texture = loader.load(
    url,
    (loadedTex) => {
      const img = loadedTex.image as HTMLImageElement | undefined;
      const aspect =
        img?.naturalWidth && img?.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
      loadedTex.needsUpdate = true;
      entry.aspect = aspect;
      const cbs = entry.callbacks;
      entry.callbacks = [];
      cbs.forEach((cb) => cb(aspect, false));
    },
    undefined,
    () => {
      entry.errored = true;
      const cbs = entry.callbacks;
      entry.callbacks = [];
      cbs.forEach((cb) => cb(null, true));
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  entry.texture = texture;
  return texture;
}

/** True once `url`'s load has settled (successfully or with an error). */
export function isSharedTextureSettled(url: string): boolean {
  const entry = cache.get(url);
  return !!entry && (entry.aspect !== null || entry.errored);
}
