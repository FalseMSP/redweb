import { motion, AnimatePresence } from 'framer-motion';
import { useScrollStore } from '@/scrollStore';

/**
 * SocialLinksOverlay — shown during the close phase (scroll offset 0.85 → 1.0).
 *
 * When the user scrolls to the bottom, the camera slides right so the hero
 * model sits at rule-of-thirds LEFT. This overlay appears at rule-of-thirds
 * RIGHT, showing the relevant social/profile links: YouTube channel, Twitch,
 * and GitHub.
 *
 * The overlay fades in synchronized with the camera slide so the visual
 * composition resolves into a clean two-column layout at the end of scroll.
 */
const SOCIAL_LINKS = [
  {
    label: 'YouTube',
    handle: '@redlifemc',
    url: 'https://www.youtube.com/@redlifemc',
    color: '#FF0000',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
      </svg>
    ),
  },
  {
    label: 'Twitch',
    handle: 'redlifemc',
    url: 'https://www.twitch.tv/redlifemc',
    color: '#9146FF',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.1 0L.5 4.3v17.2h6V24h3.3l3.1-2.5h4.8L23.5 17V0H2.1zm18.6 16l-3.1 3.1h-4.8l-3.1 2.5v-2.5H4.5V2h16.2v14zM17.7 6.7h-2v6h2v-6zm-5.5 0h-2v6h2v-6z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    handle: 'FalseMSP',
    url: 'https://github.com/FalseMSP/',
    color: '#E8EAF0',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
      </svg>
    ),
  },
];

export function SocialLinksOverlay() {
  const opacity = useScrollStore((s) => s.footerOpacity);

  return (
    <AnimatePresence>
      {opacity > 0.02 && (
        <motion.div
          key="social-links"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-end"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          // The wrapper stays pointer-events-none so it doesn't block the
          // legal footer buttons below. Only the link cards themselves get
          // pointer-events-auto (set on the inner container).
        >
          {/* Container centered exactly on the RIGHT rule-of-thirds line.
              The right 1/3 line is at 2/3 of the screen width. We position
              the link panel so its horizontal center sits on that line.
              The link cards are ~280px wide, so we offset by -140px from
              the 2/3 mark to center them on it. */}
          <div
            className={`flex flex-col items-start gap-4 ${opacity > 0.5 ? 'pointer-events-auto' : ''}`}
            style={{ marginRight: 'calc(33.3333% - 140px)' }}
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-2"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-redlife-muted">
                Connect
              </div>
              <div className="mt-1 font-display text-xl sm:text-2xl font-bold text-redlife-ink">
                Find me here
              </div>
              <div className="mt-1 h-px w-12 bg-gradient-to-r from-redlife-accent to-transparent" />
            </motion.div>

            {/* Link cards */}
            {SOCIAL_LINKS.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-redlife-line bg-redlife-panel/70 px-4 py-3 backdrop-blur-md transition hover:border-redlife-action hover:bg-redlife-panel/90 hover:shadow-glowAction"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                  style={{ color: link.color }}
                >
                  {link.icon}
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-sm font-semibold text-redlife-ink group-hover:text-redlife-accent transition-colors">
                    {link.label}
                  </span>
                  <span className="font-mono text-[10px] text-redlife-muted">
                    {link.handle}
                  </span>
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="ml-2 text-redlife-muted opacity-50 transition group-hover:translate-x-0.5 group-hover:text-redlife-accent group-hover:opacity-100"
                >
                  <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.a>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
