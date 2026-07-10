import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';

/**
 * LoadingScreen — displayed while 3D assets load.
 *
 * Driven by drei's useProgress via the store (Scene wires it up).
 * Shows the tagline "Turning imagination into interactive worlds." and a
 * progress bar. Disappears with a Framer Motion exit animation when loading
 * completes.
 *
 * Features:
 *   • Minimum display time (~600ms) so the screen doesn't flash-and-vanish
 *     on fast connections.
 *   • Failure timeout (~15s) — if loading hasn't completed, swaps the tagline
 *     for a "having trouble loading — you can still scroll" message and
 *     force-dismisses so the user isn't trapped.
 */
interface LoadingScreenProps {
  /** Forced visible — useful for testing the entry animation. */
  forceVisible?: boolean;
}

const MIN_DISPLAY_MS = 600;
const FAILURE_TIMEOUT_MS = 15_000;

export function LoadingScreen({ forceVisible }: LoadingScreenProps) {
  const isLoading = useStore((s) => s.isLoading);
  const progress = useStore((s) => s.loadProgress);
  const setLoading = useStore((s) => s.setLoading);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Minimum display time — prevent flash-and-vanish on fast connections.
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Failure timeout — if loading hasn't completed after 15s, swap message
  // and force-dismiss so the user isn't trapped behind a loading screen.
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      setTimedOut(true);
      // Force-dismiss after showing the message for 2s.
      setTimeout(() => setLoading(false), 2000);
    }, FAILURE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoading, setLoading]);

  // Only hide when: loading is done AND minimum display time has elapsed.
  // (forceVisible overrides everything for testing.)
  const visible = forceVisible ?? (isLoading || !minTimeElapsed);

  useEffect(() => {
    if (visible) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [visible]);

  const tagline = timedOut
    ? 'Having trouble loading — you can still scroll.'
    : 'Building the tools to bloom creativity.';

  return (
    <LoadingScreenInner
      visible={visible}
      progress={progress}
      tagline={tagline}
      timedOut={timedOut}
    />
  );
}

function LoadingScreenInner({
  visible,
  progress,
  tagline,
  timedOut,
}: {
  visible: boolean;
  progress: number;
  tagline: string;
  timedOut: boolean;
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress * 100)));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-redlife-bg"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading portfolio"
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 text-center"
          >
            <div className="font-display text-2xl sm:text-3xl font-bold tracking-[0.18em] text-redlife-ink">
              RED<span className="text-redlife-accent text-glow">LIFE</span>
            </div>
            <div className="mt-2 font-mono text-[10px] sm:tracking-[0.3em] tracking-[0.2em] text-redlife-muted uppercase">
              Entertainment
            </div>
          </motion.div>

          {/* Tagline — or failure message if timed out */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className={`relative z-10 mt-8 max-w-md px-6 text-center font-display text-base sm:text-lg leading-relaxed ${
              timedOut ? 'text-redlife-accent' : 'text-redlife-ink/90'
            }`}
          >
            {tagline}
          </motion.p>

          {/* Progress bar (hidden when timed out) */}
          {!timedOut && (
            <>
              <div className="relative z-10 mt-10 h-[2px] w-56 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-redlife-accent"
                  style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(255,0,60,0.7)' }}
                  transition={{ ease: 'linear', duration: 0.2 }}
                />
              </div>
              <div className="relative z-10 mt-3 font-mono text-[10px] tracking-[0.25em] text-redlife-muted">
                {pct.toString().padStart(3, '0')}%
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
