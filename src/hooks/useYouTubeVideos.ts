import { useEffect, useRef, useState } from 'react';

/**
 * useYouTubeVideos — fetches recent uploads from the RedLifeMC YouTube channel
 * and classifies them as long-form vs Shorts, excluding livestreams entirely.
 *
 * Strategy
 * --------
 * YouTube exposes three channel tabs at:
 *   • /videos   — long-form videos
 *   • /shorts   — Shorts (vertical videos ≤ 60s)
 *   • /streams  — livestreams and livestream VODs
 *
 * We fetch only the first two (skipping livestreams by design). Each tab's
 * HTML contains the list of recent uploads for that tab; we parse the HTML
 * to extract video IDs + titles.
 *
 * Browsers cannot fetch youtube.com directly (no CORS headers), so requests
 * are routed through a small CORS proxy chain. If both proxies fail, the
 * hook falls back to a build-time snapshot of recent uploads captured from
 * the same tabs.
 *
 * Output
 * ------
 * Returns an interleaved list of `maxResults` videos, half long-form and
 * half Shorts (rounded down on the long-form side, so 8 → 4 long + 4 short).
 * The list is stable across re-renders thanks to a per-request nonce.
 *
 * The hook is intentionally tolerant: any network error, parse error, or
 * empty result silently falls back to the snapshot.
 */

export type VideoKind = 'long' | 'short';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  /** i.ytimg.com thumbnail URL (mqdefault for long, hqdefault for short). */
  thumbnail: string;
  /** Watch URL — /watch?v= for long, /shorts/ for short. */
  watchUrl: string;
  /** 'long' = long-form video, 'short' = YouTube Short. */
  kind: VideoKind;
}

/** Channel handle and ID for youtube.com/@RedLifeMC. */
export const REDLIFE_CHANNEL_HANDLE = '@RedLifeMC';
export const REDLIFE_CHANNEL_URL = 'https://www.youtube.com/@RedLifeMC';
export const REDLIFE_CHANNEL_ID = 'UC0b2v3Pm6rAyvbj_wE9ahHA';

/** Public CORS proxies tried in order. The first that returns parseable HTML wins. */
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

/**
 * Build-time snapshot of recent uploads from the /videos and /shorts tabs.
 * Used as an immediate render source (so the first paint already has videos)
 * and as a fallback if the live fetch fails. Update by re-running the build;
 * the live fetch will keep the list fresh between builds.
 */
const FALLBACK_LONG: YouTubeVideo[] = [
  { videoId: 'CiJRgfrzK38', title: 'I attempted a Bingo 1v6',                                       kind: 'long', thumbnail: 'https://i.ytimg.com/vi/CiJRgfrzK38/mqdefault.jpg', watchUrl: 'https://www.youtube.com/watch?v=CiJRgfrzK38' },
  { videoId: 'XN5OXq3ApS8', title: 'Horror with RAY TRACED audio was not a good idea...',          kind: 'long', thumbnail: 'https://i.ytimg.com/vi/XN5OXq3ApS8/mqdefault.jpg', watchUrl: 'https://www.youtube.com/watch?v=XN5OXq3ApS8' },
  { videoId: 'R9XKhTUpPKM', title: 'Delulu Chicken thinks he can beat Valorant agents in a fight', kind: 'long', thumbnail: 'https://i.ytimg.com/vi/R9XKhTUpPKM/mqdefault.jpg', watchUrl: 'https://www.youtube.com/watch?v=R9XKhTUpPKM' },
  { videoId: 'HtCk7lwAgBk', title: 'I Mastered Minecraft VFX',                                     kind: 'long', thumbnail: 'https://i.ytimg.com/vi/HtCk7lwAgBk/mqdefault.jpg', watchUrl: 'https://www.youtube.com/watch?v=HtCk7lwAgBk' },
];

const FALLBACK_SHORT: YouTubeVideo[] = [
  { videoId: '0nwkgS4IjQ8', title: 'i need your help',           kind: 'short', thumbnail: 'https://i.ytimg.com/vi/0nwkgS4IjQ8/frame0.jpg', watchUrl: 'https://www.youtube.com/shorts/0nwkgS4IjQ8' },
  { videoId: 'Bc29JzH6wyw', title: '3 more features of RLO',     kind: 'short', thumbnail: 'https://i.ytimg.com/vi/Bc29JzH6wyw/frame0.jpg', watchUrl: 'https://www.youtube.com/shorts/Bc29JzH6wyw' },
  { videoId: '8-FieY59qFo', title: "You can't leave...",         kind: 'short', thumbnail: 'https://i.ytimg.com/vi/8-FieY59qFo/frame0.jpg', watchUrl: 'https://www.youtube.com/shorts/8-FieY59qFo' },
  { videoId: '08pLRPfadRQ', title: 'wonderland.jar',             kind: 'short', thumbnail: 'https://i.ytimg.com/vi/08pLRPfadRQ/frame0.jpg', watchUrl: 'https://www.youtube.com/shorts/08pLRPfadRQ' },
];

/** Build-time fallback list: long-form and Shorts interleaved (long, short, long, short, …). */
const FALLBACK_VIDEOS: YouTubeVideo[] = (() => {
  const out: YouTubeVideo[] = [];
  const max = Math.max(FALLBACK_LONG.length, FALLBACK_SHORT.length);
  for (let i = 0; i < max; i++) {
    if (i < FALLBACK_LONG.length) out.push(FALLBACK_LONG[i]);
    if (i < FALLBACK_SHORT.length) out.push(FALLBACK_SHORT[i]);
  }
  return out;
})();

/**
 * Returns the thumbnail URLs from the build-time fallback video list, sliced
 * to `maxResults`. Used by Scene.tsx's preload effect to ensure YouTube
 * thumbnails are tracked by the loading gate — without this, the loading
 * screen can dismiss before YouTube textures finish loading, causing
 * visible pop-in / stretching.
 *
 * This only covers the fallback URLs (the initial render). If the live RSS
 * fetch returns different video IDs, those textures will load lazily — but
 * the fallback is what the user sees first, so preloading it eliminates the
 * most visible pop-in.
 */
export function getFallbackYouTubeThumbnailUrls(maxResults = 8): string[] {
  return FALLBACK_VIDEOS.slice(0, maxResults).map((v) => v.thumbnail);
}

// --- HTML parsers -----------------------------------------------------------

/**
 * Extract long-form videos from a /videos tab HTML page.
 *
 * Structure (per lockupViewModel block):
 *   "lockupViewModel":{ ..., "metadata":{"lockupMetadataViewModel":{
 *     "title":{"content":"TITLE"}
 *   }}, ..., "contentId":"VIDEO_ID","contentType":"LOCKUP_CONTENT_TYPE_VIDEO"
 *
 * The title appears BEFORE contentId in the JSON, so we split on
 * lockupViewModel and parse each block.
 */
function parseLongFormHtml(html: string): YouTubeVideo[] {
  const results: YouTubeVideo[] = [];
  const seen = new Set<string>();
  const parts = html.split('"lockupViewModel":{');
  // parts[0] is the preamble before the first lockup; skip it.
  for (let i = 1; i < parts.length; i++) {
    // Truncate at 50KB per block to avoid runaway regex on malformed input.
    const block = parts[i].slice(0, 50000);
    const vidMatch = block.match(
      /"contentId":"([A-Za-z0-9_-]{11})","contentType":"LOCKUP_CONTENT_TYPE_VIDEO"/,
    );
    if (!vidMatch) continue;
    const videoId = vidMatch[1];
    if (seen.has(videoId)) continue;
    // Title lives in the portion of the block BEFORE the contentId.
    const before = block.slice(0, vidMatch.index ?? 0);
    const titleMatch = before.match(
      /"lockupMetadataViewModel":\{"title":\{"content":"([^"]+)"/,
    );
    const title = titleMatch ? titleMatch[1] : '';
    seen.add(videoId);
    results.push({
      videoId,
      title,
      kind: 'long',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return results;
}

/**
 * Extract Shorts from a /shorts tab HTML page.
 *
 * Structure:
 *   "shortsLockupViewModel":{"entityId":"shorts-shelf-item-VIDEO_ID",
 *     "accessibilityText":"TITLE, 收看次數：X 次 - 播 Shorts", ...}
 *
 * The accessibilityText contains the title followed by view count and a
 * "Play Shorts" suffix in the user's locale. We strip the suffix and the
 * view count to recover just the title.
 */
function parseShortsHtml(html: string): YouTubeVideo[] {
  const results: YouTubeVideo[] = [];
  const seen = new Set<string>();
  const re = /"shortsLockupViewModel":\{"entityId":"shorts-shelf-item-([A-Za-z0-9_-]{11})","accessibilityText":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const videoId = m[1];
    if (seen.has(videoId)) continue;
    let title = m[2];
    // Strip localized " - Play Shorts" / " - 播 Shorts" suffix.
    title = title.replace(/\s*-\s*(Play Shorts|播 Shorts|Shorts abspielen|Lire le Short)\s*$/i, '');
    // Strip ", X views" / ", 收看次數：X 次" suffix.
    title = title.replace(/,\s*[^,]{3,40}(views|views|次|Aufrufe|vues)\s*$/i, '');
    seen.add(videoId);
    results.push({
      videoId,
      title: title.trim(),
      kind: 'short',
      // frame0.jpg is the vertical thumbnail YouTube generates for Shorts
      // (268×480, ~9:16). hqdefault.jpg is 4:3 with black bars — wrong for
      // vertical cards. oardefault.jpg is 1080×1920 but ~120KB each (too
      // much GPU memory for 4+ ambient mini-cards). frame0 is the sweet
      // spot: ~24KB, true vertical, no black bars.
      thumbnail: `https://i.ytimg.com/vi/${videoId}/frame0.jpg`,
      watchUrl: `https://www.youtube.com/shorts/${videoId}`,
    });
  }
  return results;
}

/** Interleave two arrays: [a0, b0, a1, b1, a2, b2, …], stopping when either runs out. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

interface UseYouTubeVideosResult {
  videos: YouTubeVideo[];
  /** True until the first fetch attempt completes (success or fail). */
  loading: boolean;
  /** True if the live fetch failed and we're serving the fallback list. */
  usingFallback: boolean;
}

/**
 * @param maxResults cap on the returned list. Defaults to 8 (4 long + 4 short).
 * @param enabled when false, the hook returns an empty list immediately
 *   without any network activity. Useful to gate the fetch behind a feature
 *   flag (e.g. recruiter view or low-tier device).
 */
export function useYouTubeVideos(
  maxResults = 8,
  enabled = true,
): UseYouTubeVideosResult {
  // Initial state: fallback list sliced to maxResults (so first paint has
  // videos; the live fetch will replace it once it resolves).
  const [videos, setVideos] = useState<YouTubeVideo[]>(() =>
    enabled ? FALLBACK_VIDEOS.slice(0, maxResults) : [],
  );
  const [loading, setLoading] = useState<boolean>(enabled);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      setVideos([]);
      setLoading(false);
      setUsingFallback(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutMs = 9000;

    const videosUrl = `https://www.youtube.com/@${REDLIFE_CHANNEL_HANDLE.slice(1)}/videos`;
    const shortsUrl = `https://www.youtube.com/@${REDLIFE_CHANNEL_HANDLE.slice(1)}/shorts`;

    const fetchWithProxy = async (targetUrl: string): Promise<string> => {
      // Try each proxy in order; first non-empty, parseable response wins.
      for (const proxy of CORS_PROXIES) {
        try {
          const res = await fetch(proxy(targetUrl), {
            signal: controller.signal,
            headers: { Accept: 'text/html, */*' },
          });
          if (!res.ok) continue;
          const text = await res.text();
          if (text && text.length > 5000) return text; // sanity check
        } catch {
          // try next proxy
        }
      }
      throw new Error('all proxies failed');
    };

    const run = async () => {
      // Race both fetches against a hard timeout so a hung request can't
      // leave the loading state stuck open.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      );
      try {
        const [longHtml, shortHtml] = await Promise.race([
          Promise.all([fetchWithProxy(videosUrl), fetchWithProxy(shortsUrl)]),
          timeout,
        ]);
        if (cancelled) return;
        const longVideos = parseLongFormHtml(longHtml);
        const shortVideos = parseShortsHtml(shortHtml);

        if (longVideos.length === 0 && shortVideos.length === 0) {
          setUsingFallback(true);
          setVideos(FALLBACK_VIDEOS.slice(0, maxResults));
        } else {
          setUsingFallback(false);
          // Interleave half long, half short. If one side runs out first,
          // the interleave fills in with whatever's left from the other.
          const interleaved = interleave(longVideos, shortVideos);
          setVideos(interleaved.slice(0, maxResults));
        }
      } catch {
        if (cancelled) return;
        setUsingFallback(true);
        setVideos(FALLBACK_VIDEOS.slice(0, maxResults));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [maxResults, enabled]);

  return { videos, loading, usingFallback };
}
