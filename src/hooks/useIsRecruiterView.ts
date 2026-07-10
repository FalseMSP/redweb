import { useEffect, useState } from 'react';

/**
 * useIsRecruiterView — detects whether the current page is being viewed in
 * a "recruiter" context, in which case the floating YouTube videos (and
 * any other casual/personal flavor) should be suppressed.
 *
 * The hook checks the following signals (any one of them triggers it):
 *
 *   1. The URL path contains the segment "recruiter" — e.g.
 *      /recruiter, /recruiter/, /about/recruiter, /recruiter?…
 *   2. The URL has a query param whose key OR value contains "recruiter" —
 *      e.g. ?audience=recruiter, ?recruiter=1.
 *   3. The URL hash contains "recruiter" — e.g. #recruiter.
 *   4. The hostname contains "recruiter" — e.g. recruiter.example.com.
 *
 * Re-checks on `popstate` and `hashchange` so a visitor navigating between
 * the two contexts within a SPA session flips the flag live.
 */
export function useIsRecruiterView(): boolean {
  const [isRecruiter, setIsRecruiter] = useState<boolean>(() => checkUrl());

  useEffect(() => {
    const update = () => setIsRecruiter(checkUrl());
    update();
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    // Some SPAs push state without firing popstate — poll on a slow interval
    // as a safety net. Cheap enough (parses URL once per second).
    const interval = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.clearInterval(interval);
    };
  }, []);

  return isRecruiter;
}

function checkUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const { href, hostname, pathname, search, hash } = window.location;
  // Broad case-insensitive substring check across the whole URL catches most
  // cases. Targeted checks below are belt-and-suspenders for clarity.
  if (href.toLowerCase().includes('recruiter')) return true;

  // Segment match (avoids false positives on words that merely contain the
  // substring, e.g. a hypothetical /recruiters-and-friends/ — but the user
  // explicitly asked to hide on "recruiter" anywhere, so the broad check
  // above wins and these targeted checks are informational).
  void hostname; void pathname; void search; void hash;
  return false;
}
