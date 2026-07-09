import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollStore } from '@/scrollStore';
import { usePrefersReducedMotion } from '@/hooks/useDeviceTier';

/**
 * OverlayBits — HTML overlays that read scroll state (spec §2).
 *
 * These are HTML (Framer Motion) overlays, never 3D transforms (spec §1).
 * They live OUTSIDE the <Canvas> and subscribe to the shared useScrollStore
 * (which Scene.tsx writes to from inside its useFrame loop). This avoids the
 * R3F context issues that arise when calling useScroll/useFrame from inside
 * drei's <Html> portal.
 *
 * Each overlay uses Zustand selectors with shallow-equal semantics so React
 * only re-renders when the relevant slice actually changes.
 */

/**
 * TaglineOverlay — "Building the tools to enhance creativity." shown as a
 * subtitle beneath the hero object during the first ~15% of scroll, then
 * faded out so it doesn't clutter later sections.
 */
export function TaglineOverlay() {
  // Selector returns the rounded opacity — only re-renders when it changes.
  const opacity = useScrollStore((s) => s.taglineOpacity);

  return (
    <AnimatePresence>
      {opacity > 0.02 && (
        <motion.div
          key="tagline"
          className="pointer-events-none absolute left-1/2 top-[68%] z-30 -translate-x-1/2 px-6 text-center"
          initial={false}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="font-display text-base sm:text-xl text-redlife-ink/90 tracking-wide">
            Building the tools to enhance creativity.
          </p>
          <div className="mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-redlife-accent to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * FooterCue — small "end of scroll" prompt. The full legal content lives in
 * <LegalOverlay /> (rendered separately in App.tsx). This cue just provides
 * a visual anchor at the bottom of the scroll range.
 */
export function FooterCue() {
  const opacity = useScrollStore((s) => s.footerOpacity);

  return (
    <AnimatePresence>
      {opacity > 0.02 && opacity < 0.5 && (
        <motion.div
          key="footer-cue"
          className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 px-6 text-center"
          initial={false}
          animate={{ opacity: opacity * 2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-redlife-muted">
            End of scroll — Legal & Compliance below
          </p>
          <motion.div
            className="mx-auto mt-2 h-6 w-px bg-gradient-to-b from-redlife-accent to-transparent"
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: 'top' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * ScrollHint — small "scroll" indicator shown only during the intro phase
 * to give first-time visitors a clear cue.
 */
export function ScrollHint() {
  const inHintZone = useScrollStore((s) => s.inHintZone);
  const reducedMotion = usePrefersReducedMotion();
  const visible = inHintZone && !reducedMotion;

  // Local "has been hidden" latch so the hint doesn't reappear if the user
  // scrolls back to the top — once they've started scrolling, it's gone.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!visible) setHidden(true);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && !hidden && (
        <motion.div
          key="scroll-hint"
          className="pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-redlife-muted">
            Scroll
          </div>
          <motion.div
            className="mx-auto mt-2 h-6 w-px bg-gradient-to-b from-redlife-accent to-transparent"
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: 'top' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
