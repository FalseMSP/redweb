import { useEffect, Suspense, lazy } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CornerHUD } from '@/components/CornerHUD';
import { TaglineOverlay, FooterCue, ScrollHint } from '@/components/OverlayBits';
import { LegalFooter } from '@/components/LegalOverlay';
import { SocialLinksOverlay } from '@/components/SocialLinksOverlay';
import { AccessibleProjectList, SkipLink } from '@/components/AccessibleProjectList';

// Scene pulls in three.js + @react-three/fiber + @react-three/drei — by far
// the heaviest dependency in the app. Lazy-loading it means the initial JS
// payload is just React + the lightweight HTML shell (which includes
// <LoadingScreen />), and the 3D-engine chunk downloads in parallel while
// that shell is already visible. <LoadingScreen /> is already always
// rendered on top and defaults to visible, so there's no extra "blank
// screen" — it just covers the extra beat while the Scene chunk arrives.
const Scene = lazy(() => import('@/components/Scene').then((m) => ({ default: m.Scene })));

// The project modal is only ever needed once the user clicks a card — no
// reason to ship it in the initial bundle.
const HtmlOverlay = lazy(() =>
  import('@/components/HtmlOverlay').then((m) => ({ default: m.HtmlOverlay })),
);

/**
 * App — top-level shell.
 *
 * Layout:
 *   • <SkipLink />            — keyboard skip link (sr-only until focused)
 *   • <Scene />               — the WebGL canvas (absolute, full-bleed)
 *   • <TaglineOverlay />      — shown during first ~15% of scroll
 *   • <FooterCue />           — shown during close phase
 *   • <ScrollHint />          — intro-phase scroll cue
 *   • <LegalFooter />         — legal links at bottom of scroll
 *   • <SocialLinksOverlay />  — social links at rule-of-thirds right in close phase
 *   • <CornerHUD />           — persistent wordmark
 *   • <LoadingScreen />       — covers canvas while assets load
 *   • <HtmlOverlay />         — project modal
 *   • <AccessibleProjectList /> — sr-only HTML list for SEO + screen readers + keyboard
 */
export default function App() {
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <ErrorBoundary>
      {/* Skip link — first in DOM so it's the first Tab target */}
      <SkipLink />

      <div className="relative h-full w-full overflow-hidden bg-redlife-bg scanlines">
        {/* 3D scene — full-bleed canvas. Writes scroll state to useScrollStore.
            Lazy-loaded (see import above); Suspense fallback is null because
            <LoadingScreen /> below already covers this beat. The 3D YouTube
            orbit cards live inside <Scene /> (in the world group, orbiting
            the hero). They self-suppress in recruiter view. */}
        <Suspense fallback={null}>
          <Scene />
        </Suspense>

        {/* HTML overlays — read scroll state from the shared store. */}
        <TaglineOverlay />
        <FooterCue />
        <ScrollHint />

        {/* Legal footer — compact bar at the very bottom. */}
        <LegalFooter />

        {/* Social links — rule-of-thirds right in close phase. */}
        <SocialLinksOverlay />

        {/* Persistent corner UI: wordmark */}
        <CornerHUD />

        {/* Loading screen — covers everything while assets load */}
        <LoadingScreen />

        {/* Project modal — lazy-loaded, only needed once a card is clicked. */}
        <Suspense fallback={null}>
          <HtmlOverlay />
        </Suspense>
      </div>

      {/* Accessible project list — visually hidden but in the DOM for
          SEO indexing, screen readers, and keyboard navigation. Rendered
          outside the overflow-hidden container so it doesn't interfere
          with the 3D scene's layout. */}
      <AccessibleProjectList />
    </ErrorBoundary>
  );
}
