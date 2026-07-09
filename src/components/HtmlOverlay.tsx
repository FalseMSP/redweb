import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';

/**
 * HtmlOverlay — glassmorphism modal for project details (view-only).
 *
 * Accessibility:
 *   • role="dialog" aria-modal="true", labelled by the project title.
 *   • Focus trap: focus moves to the close button on open, returns on close.
 *   • `inert` set on the canvas host while open.
 *   • Body scroll lock while open.
 *   • Close on backdrop click, Escape, or close button.
 *   • Mobile: 100dvh-aware sizing.
 */
export function HtmlOverlay() {
  const activeProject = useStore((s) => s.activeProject);
  const setActiveProject = useStore((s) => s.setActiveProject);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = activeProject !== null;

  // Open: lock scroll, trap focus, mark canvas inert.
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    document.body.classList.add('modal-open');

    const canvasHost = document.querySelector('.canvas-host');
    if (canvasHost && 'inert' in canvasHost) {
      (canvasHost as HTMLElement).inert = true;
    }

    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(t);
      document.body.classList.remove('modal-open');
      if (canvasHost && 'inert' in canvasHost) {
        (canvasHost as HTMLElement).inert = false;
      }
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Escape + focus trap.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveProject(null);
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, setActiveProject]);

  return (
    <AnimatePresence>
      {activeProject && (
        <motion.div
          key="overlay-root"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setActiveProject(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            className="dvh-modal relative z-10 w-full max-w-2xl overflow-y-auto rounded-2xl border border-redlife-line bg-redlife-panel/80 p-6 sm:p-8 shadow-panel backdrop-blur-xl"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              ref={closeBtnRef}
              onClick={() => setActiveProject(null)}
              aria-label="Close project details"
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-redlife-line bg-black/40 text-redlife-ink/80 transition hover:border-redlife-action hover:text-redlife-action focus:outline-none"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {/* Header */}
            <div className="pr-12">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-redlife-muted">
                <span>{activeProject.year}</span>
                <span className="h-px w-6 bg-redlife-line" />
                <span>Case Study</span>
              </div>
              <h2
                id="project-modal-title"
                className="mt-3 font-display text-2xl sm:text-4xl font-bold text-redlife-ink leading-tight"
              >
                {activeProject.title}
              </h2>
            </div>

            {/* Thumbnail */}
            {activeProject.thumbnail && !activeProject.thumbnail.startsWith('data:image/svg+xml') && (
              <div className="mt-6 overflow-hidden rounded-xl border border-redlife-line">
                <img
                  src={activeProject.thumbnail}
                  alt={`${activeProject.title} preview`}
                  className="block w-full max-h-[40vh] object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Body */}
            <p className="mt-6 text-sm sm:text-base leading-relaxed text-redlife-ink/85">
              {activeProject.description}
            </p>

            {/* Stat strip */}
            {activeProject.stats && activeProject.stats.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {activeProject.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-redlife-line bg-black/30 p-3 text-center"
                  >
                    <div className="font-display text-lg sm:text-xl font-bold text-redlife-accent">
                      {stat.value}
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            {activeProject.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {activeProject.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-redlife-line bg-black/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-redlife-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Links */}
            {activeProject.links && activeProject.links.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3">
                {activeProject.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 rounded-lg border border-redlife-action/40 bg-redlife-action/10 px-4 py-2 text-sm font-medium text-redlife-ink transition hover:border-redlife-action hover:bg-redlife-action/20 hover:shadow-glowAction focus:outline-none"
                  >
                    <span>{link.label}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-70 group-hover:translate-x-0.5 transition">
                      <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
