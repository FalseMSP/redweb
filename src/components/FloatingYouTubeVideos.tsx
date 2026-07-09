import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useYouTubeVideos, REDLIFE_CHANNEL_URL, type YouTubeVideo } from '@/hooks/useYouTubeVideos';
import { useDeviceTier, usePrefersReducedMotion } from '@/hooks/useDeviceTier';

/**
 * FloatingYouTubeVideos — small floating "video cards" that drift around the
 * screen as ambient flavor. Each card shows the thumbnail of one of the most
 * recent uploads from the RedLifeMC YouTube channel.
 *
 * Behavior:
 *   • Cards float across the screen on slow, randomized drift paths.
 *   • On hover (or focus), the card stops drifting, scales up slightly,
 *     and the actual YouTube iframe begins playing (muted, autoplay).
 *   • On mouse leave (or blur), the iframe is unmounted and the card
 *     resumes drifting.
 *   • Clicking anywhere on a card opens the video on YouTube in a new tab.
 *   • Respects prefers-reduced-motion (cards become stationary).
 *   • Renders nothing on low-tier devices (perf budget).
 *   • Renders nothing if the URL contains "recruiter" — gated by parent.
 *
 * Performance notes:
 *   • Only one iframe is mounted at a time (the hovered one). The rest are
 *     just <img> thumbnails — cheap.
 *   • Drift is driven by Framer Motion's `animate` (GPU-composited transforms
 *     only — translate + rotate). No per-frame React state.
 *   • Cards wrap in a pointer-events-none container; only the cards
 *     themselves get pointer-events-auto, so they never block the 3D scene
 *     underneath except on the actual card rect.
 */

interface FloatingYouTubeVideosProps {
  /** Number of floating cards to render. Defaults to 5. */
  count?: number;
}

interface CardPlacement {
  /** Initial position in vw/vh-style percentages. */
  startX: number;
  startY: number;
  /** Drift target offsets (relative to start, in %). */
  driftX: number;
  driftY: number;
  /** Rotation range in degrees. */
  rotate: number;
  /** Per-card scale, so the fleet reads as layered. */
  scale: number;
  /** Drift duration in seconds (one direction). */
  duration: number;
  /** Delay before drift begins (so cards don't move in lockstep). */
  delay: number;
  /** Z-index ordering — smaller cards behind larger ones. */
  z: number;
}

function randomizePlacements(count: number): CardPlacement[] {
  const cards: CardPlacement[] = [];
  // Distribute starting positions across a loose grid so cards don't bunch up.
  // 5 columns × 2 rows gives 10 cells; we sample count of them.
  const cols = 5;
  const rows = 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Jitter within each cell.
      const x = (c + 0.5) * (100 / cols) + (Math.random() - 0.5) * 8;
      // Keep cards in the middle 60% vertically — avoid the very top
      // (where the CornerHUD lives) and very bottom (where the legal
      // footer + scroll hint live).
      const y = 22 + r * 38 + (Math.random() - 0.5) * 12;
      cells.push({ x, y });
    }
  }
  // Shuffle the cells so we sample randomly.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  for (let i = 0; i < count; i++) {
    const cell = cells[i % cells.length];
    cards.push({
      startX: cell.x,
      startY: cell.y,
      driftX: (Math.random() - 0.5) * 16,
      driftY: (Math.random() - 0.5) * 12,
      rotate: (Math.random() - 0.5) * 8,
      scale: 0.7 + Math.random() * 0.55,
      duration: 14 + Math.random() * 10,
      delay: Math.random() * 6,
      z: Math.floor(Math.random() * 10),
    });
  }
  return cards;
}

/** Width of the card (px) at scale=1. Height = width × 9/16 + chrome. */
const BASE_CARD_WIDTH = 168;

export function FloatingYouTubeVideos({ count = 5 }: FloatingYouTubeVideosProps) {
  const reducedMotion = usePrefersReducedMotion();
  const tier = useDeviceTier();
  // Perf budget: skip on low-tier devices entirely.
  if (tier === 'low') return null;

  return (
    <FloatingYouTubeVideosInner
      count={count}
      reducedMotion={reducedMotion}
    />
  );
}

interface InnerProps {
  count: number;
  reducedMotion: boolean;
}

function FloatingYouTubeVideosInner({ count, reducedMotion }: InnerProps) {
  const { videos } = useYouTubeVideos(count, true);
  const placements = useMemo(() => randomizePlacements(count), [count]);

  if (videos.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
    >
      <AnimatePresence>
        {videos.map((video, i) => (
          <FloatingCard
            key={video.videoId}
            video={video}
            placement={placements[i % placements.length]}
            reducedMotion={reducedMotion}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface FloatingCardProps {
  video: YouTubeVideo;
  placement: CardPlacement;
  reducedMotion: boolean;
}

function FloatingCard({ video, placement, reducedMotion }: FloatingCardProps) {
  const [hovered, setHovered] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // Re-mount the iframe when hovered flips to true (cheap to mount, and
  // unmounting on mouse leave stops audio + releases the player).
  const [iframeActive, setIframeActive] = useState(false);
  useEffect(() => {
    if (!hovered) {
      setIframeActive(false);
      return;
    }
    // Small delay so quick mouse-transit doesn't spin up a player.
    const t = window.setTimeout(() => setIframeActive(true), 220);
    return () => window.clearTimeout(t);
  }, [hovered]);

  // Build the YouTube embed URL. Mute+autoplay are required for autoplay to
  // actually fire in modern browsers. `loop=1&playlist=<id>` makes it loop.
  // `controls=0` keeps the chrome minimal; `modestbranding=1` reduces the
  // YouTube logo. `playsinline=1` is required for iOS Safari.
  const embedSrc = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: video.videoId,
      controls: '0',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
      iv_load_policy: '3',
    });
    return `https://www.youtube.com/embed/${video.videoId}?${params.toString()}`;
  }, [video.videoId]);

  const showThumbnail = !iframeActive || !thumbnailLoaded;
  const showIframe = iframeActive && (thumbnailLoaded || thumbnailFailed);

  // Drift animation targets. When hovered, we cancel the drift so the user
  // can read / click the card without it moving.
  const animate = hovered
    ? { x: 0, y: 0, rotate: 0, scale: placement.scale * 1.18 }
    : reducedMotion
      ? { x: 0, y: 0, rotate: placement.rotate * 0.4, scale: placement.scale }
      : {
          x: [0, placement.driftX, 0],
          y: [0, placement.driftY, 0],
          rotate: [placement.rotate * 0.4, placement.rotate, placement.rotate * 0.4],
          scale: placement.scale,
        };

  const transition = hovered
    ? { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }
    : reducedMotion
      ? { duration: 0.6, ease: 'easeOut' as const }
      : {
          duration: placement.duration,
          delay: placement.delay,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        };

  return (
    <motion.div
      className="pointer-events-auto absolute"
      style={{
        left: `${placement.startX}%`,
        top: `${placement.startY}%`,
        width: BASE_CARD_WIDTH,
        // 16:9 + room for the 22px title strip.
        height: BASE_CARD_WIDTH * 9 / 16 + 26,
        zIndex: hovered ? 50 : 20 + placement.z,
      }}
      // Framer Motion manages x/y/rotate/scale (composed into a single
      // `transform` string), so we cannot also use `transform: translate(-50%,-50%)`
      // for centering — it would be overwritten. Use negative margins instead
      // so the card's center sits on (startX%, startY%) regardless of where
      // the drift animation moves it.
      initial={{
        marginLeft: -BASE_CARD_WIDTH / 2,
        marginTop: -(BASE_CARD_WIDTH * 9 / 16 + 26) / 2,
        opacity: 0,
        scale: placement.scale * 0.6,
      }}
      animate={{
        marginLeft: -BASE_CARD_WIDTH / 2,
        marginTop: -(BASE_CARD_WIDTH * 9 / 16 + 26) / 2,
        opacity: 1,
        ...animate,
      }}
      transition={transition}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`Play "${video.title}" on YouTube`}
    >
      <a
        href={video.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full w-full cursor-pointer overflow-hidden rounded-lg border border-redlife-line bg-redlife-panel/80 shadow-panel backdrop-blur-sm transition-colors hover:border-redlife-accent hover:shadow-glow"
      >
        {/* Thumbnail layer */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {showThumbnail && !thumbnailFailed && (
            <img
              src={video.thumbnail}
              alt=""
              className="h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: thumbnailLoaded ? 1 : 0 }}
              onLoad={() => setThumbnailLoaded(true)}
              onError={() => setThumbnailFailed(true)}
              loading="lazy"
              draggable={false}
            />
          )}
          {/* Iframe layer — only mounts on hover, after the small delay */}
          {showIframe && (
            <iframe
              src={embedSrc}
              title={video.title}
              className="pointer-events-none absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen={false}
              // Sandbox: allow scripts so the YT player works, allow-same-origin
              // so it can read its own cookies. Don't allow popups or top-nav
              // — the iframe is purely ambient playback.
              sandbox="allow-scripts allow-same-origin"
              tabIndex={-1}
            />
          )}
          {/* Play affordance — only visible when not actively playing */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{
              opacity: hovered && !iframeActive ? 1 : 0,
              background: 'rgba(5,6,10,0.35)',
            }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-redlife-accent/90 shadow-glow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
          {/* Channel chip — tiny "@RedLifeMC" badge bottom-right of thumbnail */}
          <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-redlife-ink/80 backdrop-blur-sm">
            @RedLifeMC
          </div>
        </div>

        {/* Title strip */}
        <div className="flex h-[26px] items-center gap-1 px-2">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="#FF0000"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
          </svg>
          <span className="truncate font-mono text-[10px] text-redlife-ink/90">
            {video.title}
          </span>
        </div>
      </a>
    </motion.div>
  );
}

/**
 * FloatingYouTubeHint — a small fixed caption that appears briefly to explain
 * what the floating things are. Optional; rendered by the parent if desired.
 */
export function FloatingYouTubeHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 6500);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={REDLIFE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-redlife-line bg-redlife-panel/80 px-3 py-1.5 backdrop-blur-md"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, delay: 1.2 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-wider text-redlife-ink/80">
            Latest from @RedLifeMC
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
