/**
 * CornerHUD — persistent corner UI.
 *
 * Top-left: wordmark only.
 *
 * The site is view-only — Edit, About, and Load GLB buttons have been removed.
 */
export function CornerHUD() {
  return (
    <>
      {/* Top-left wordmark */}
      <div className="pointer-events-none absolute left-5 top-5 z-40 select-none">
        <div className="font-display text-sm sm:text-base font-bold tracking-[0.18em] text-redlife-ink">
          RED<span className="text-redlife-accent text-glow">LIFE</span>
        </div>
        <div className="mt-0.5 font-mono text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] text-redlife-muted uppercase">
          Entertainment
        </div>
      </div>
    </>
  );
}
