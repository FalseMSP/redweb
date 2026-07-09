import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollStore } from '@/scrollStore';

/**
 * LegalFooter — compact bottom bar shown during the close phase (scroll
 * offset 0.88 → 1.00). Styled like a typical website footer: small text
 * links in a horizontal row. Clicking any link opens the full legal content
 * in a modal (LegalModal).
 *
 * The footer only appears when scrolled to the very end — it's invisible
 * during the rest of the scroll range so it doesn't clutter the gallery.
 */
export function LegalFooter() {
  const opacity = useScrollStore((s) => s.footerOpacity);
  const [modalSection, setModalSection] = useState<string | null>(null);

  return (
    <>
      <AnimatePresence>
        {opacity > 0.02 && (
          <motion.footer
            key="legal-footer"
            className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 border-t border-redlife-line bg-redlife-bg/85 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            style={{ pointerEvents: opacity > 0.5 ? 'auto' : 'none' }}
          >
            <div className="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:px-6">
              {/* Left: copyright */}
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-redlife-muted">
                © 2026 RedLife Entertainment
              </div>

              {/* Center/right: legal links */}
              <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <FooterLink onClick={() => setModalSection('privacy')}>Privacy</FooterLink>
                <FooterLink onClick={() => setModalSection('terms')}>Terms</FooterLink>
                <FooterLink onClick={() => setModalSection('dmca')}>DMCA</FooterLink>
                <FooterLink onClick={() => setModalSection('accessibility')}>Accessibility</FooterLink>
                <FooterLink onClick={() => setModalSection('cookies')}>Cookies</FooterLink>
                <FooterLink onClick={() => setModalSection('disclaimers')}>Disclaimers</FooterLink>
                <FooterLink onClick={() => setModalSection('contact')}>Contact</FooterLink>
              </nav>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      <LegalModal section={modalSection} onClose={() => setModalSection(null)} />
    </>
  );
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted transition hover:text-redlife-accent focus:outline-none"
    >
      {children}
    </button>
  );
}

// --- Modal ------------------------------------------------------------------

const SECTION_TITLES: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  dmca: 'DMCA / Copyright Notice',
  accessibility: 'Accessibility Statement',
  cookies: 'Cookie Policy',
  disclaimers: 'Disclaimers',
  contact: 'Legal Contact',
};

function LegalModal({ section, onClose }: { section: string | null; onClose: () => void }) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!section) return;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50);
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [section, onClose]);

  return (
    <AnimatePresence>
      {section && (
        <motion.div
          key="legal-modal"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
            className="dvh-modal relative z-10 w-full max-w-2xl overflow-y-auto rounded-2xl border border-redlife-line bg-redlife-panel/90 p-6 sm:p-8 shadow-panel backdrop-blur-xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-redlife-line bg-black/40 text-redlife-ink/80 transition hover:border-redlife-accent hover:text-redlife-accent"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-redlife-muted">
              Legal & Compliance
            </div>
            <h2 id="legal-modal-title" className="mt-2 font-display text-xl sm:text-2xl font-bold text-redlife-ink">
              {SECTION_TITLES[section] ?? 'Legal'}
            </h2>
            <div className="mt-1 font-mono text-[9px] text-redlife-muted">Last updated: July 2026</div>

            <div className="mt-6 text-xs leading-relaxed text-redlife-ink/80">
              {section === 'privacy' && <PrivacyPolicy />}
              {section === 'terms' && <TermsOfUse />}
              {section === 'dmca' && <DMCA />}
              {section === 'accessibility' && <Accessibility />}
              {section === 'cookies' && <Cookies />}
              {section === 'disclaimers' && <Disclaimers />}
              {section === 'contact' && <LegalContact />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Section content (same legal text as before) ---------------------------

function PrivacyPolicy() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">Information We Collect.</strong>{' '}
        This website does not require account creation and does not actively
        collect personally identifiable information (PII) from visitors. We may
        collect limited technical data — IP address, browser type, device
        characteristics, and pages visited — for the sole purpose of maintaining
        site security and aggregating anonymous traffic statistics. We do not
        sell, rent, or share this data with third parties for marketing purposes.
      </p>
      <p>
        <strong className="text-redlife-ink">Local Storage.</strong>{' '}
        Card position and content edits made via the in-site Edit Mode are
        stored in your browser's <code>localStorage</code> and never transmitted
        to our servers. Clearing your browser data removes these preferences.
      </p>
      <p>
        <strong className="text-redlife-ink">California Consumer Privacy Act (CCPA / CPRA).</strong>{' '}
        If you are a California resident, you have the right under the CCPA and
        its 2023 amendment (CPRA) to: (a) know what personal information is
        collected about you, (b) know whether your personal information is sold
        or shared and to whom, (c) opt out of the sale or sharing of your
        personal information, (d) request deletion of your personal
        information, and (e) not be discriminated against for exercising these
        rights. Because this site does not sell personal information and
        collects only minimal technical data, exercising these rights is
        straightforward — contact us at the email below and we will respond
        within 45 days as required by California Civil Code §1798.130.
      </p>
      <p>
        <strong className="text-redlife-ink">Children's Online Privacy Protection Act (COPPA).</strong>{' '}
        This website is not directed at children under 13 and we do not
        knowingly collect personal information from children under 13. If you
        believe a child has provided us with personal information, please
        contact us and we will promptly delete it. COPPA compliance is governed
        by 15 U.S.C. §§ 6501–6506.
      </p>
      <p>
        <strong className="text-redlife-ink">Third-Party Links.</strong>{' '}
        This site links to external services including YouTube, GitHub, and
        Google. These services have their own privacy policies and we are not
        responsible for their data practices.
      </p>
      <p>
        <strong className="text-redlife-ink">Changes to This Policy.</strong>{' '}
        We may update this Privacy Policy from time to time. Continued use of
        the site after changes constitutes acceptance of the updated policy.
      </p>
    </div>
  );
}

function TermsOfUse() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">Acceptance of Terms.</strong>{' '}
        By accessing this website, you agree to be bound by these Terms of Use
        and all applicable laws and regulations. If you do not agree with any
        part of these terms, you may not access the site.
      </p>
      <p>
        <strong className="text-redlife-ink">License to Use Content.</strong>{' '}
        All content on this site — including text, 3D models, code, graphics,
        and the site design itself — is the property of RedLife Entertainment
        unless otherwise noted, and is protected by United States and
        international copyright law. You may view the site for personal,
        non-commercial use. You may not reproduce, distribute, modify, or
        publicly display any portion of the site without prior written consent,
        except as permitted by fair use under 17 U.S.C. § 107.
      </p>
      <p>
        <strong className="text-redlife-ink">Open Source Code.</strong>{' '}
        Source code for certain projects linked from this site is available
        under their respective open-source licenses (e.g., MIT, GPL, Apache
        2.0). Those licenses govern the code; these Terms govern the website
        presentation.
      </p>
      <p>
        <strong className="text-redlife-ink">User Conduct.</strong>{' '}
        You agree not to: (a) attempt to gain unauthorized access to any part
        of the site or its systems, (b) interfere with the proper functioning
        of the site, (c) use the site to transmit any malicious code or
        unauthorized data, or (d) scrape or harvest content at scale without
        permission.
      </p>
      <p>
        <strong className="text-redlife-ink">Termination.</strong>{' '}
        We reserve the right to restrict or terminate access to the site at any
        time, without notice, for any reason including violation of these Terms.
      </p>
      <p>
        <strong className="text-redlife-ink">Governing Law.</strong>{' '}
        These Terms shall be governed by and construed in accordance with the
        laws of the United States and the state in which RedLife Entertainment
        operates. Any disputes arising under these Terms shall be resolved in
        the appropriate courts of that jurisdiction.
      </p>
    </div>
  );
}

function DMCA() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">Copyright Notice.</strong>{' '}
        All content on this site is © RedLife Entertainment unless otherwise
        stated. The Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512,
        provides a mechanism for copyright owners to request removal of
        infringing material from online services.
      </p>
      <p>
        <strong className="text-redlife-ink">Filing a DMCA Takedown Notice.</strong>{' '}
        If you believe that material on this site infringes a copyright you own
        or control, you may submit a takedown notice to our designated copyright
        agent. Under 17 U.S.C. § 512(c)(3), a valid notice must include:
      </p>
      <ol className="ml-4 list-decimal space-y-1">
        <li>A physical or electronic signature of the copyright owner or an authorized agent.</li>
        <li>Identification of the copyrighted work claimed to have been infringed.</li>
        <li>Identification of the material that is claimed to be infringing, including its location on this site (URL).</li>
        <li>Your contact information, including full name, address, telephone number, and email.</li>
        <li>A statement that you have a good-faith belief that the use is not authorized by the copyright owner.</li>
        <li>A statement, under penalty of perjury, that the information in the notice is accurate and that you are authorized to act on behalf of the copyright owner.</li>
      </ol>
      <p>
        <strong className="text-redlife-ink">Designated Copyright Agent.</strong>{' '}
        Send DMCA notices to:{' '}
        <a href="mailto:legal@redlife.studio" className="text-redlife-accent underline">
          legal@redlife.studio
        </a>{' '}
        with the subject line "DMCA Takedown Notice." We will respond to valid
        notices within 10 business days, consistent with 17 U.S.C. § 512.
      </p>
      <p>
        <strong className="text-redlife-ink">Counter-Notification.</strong>{' '}
        If you believe your material was removed in error, you may file a
        counter-notification under 17 U.S.C. § 512(g)(3).
      </p>
      <p>
        <strong className="text-redlife-ink">Repeat Infringer Policy.</strong>{' '}
        We will terminate, in appropriate circumstances, the accounts of users
        who are determined to be repeat infringers.
      </p>
    </div>
  );
}

function Accessibility() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">Commitment to Accessibility.</strong>{' '}
        RedLife Entertainment is committed to making this website accessible to
        all users, including those with disabilities. We aim to conform to the
        Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, which is the
        standard referenced by the Americans with Disabilities Act (ADA) for
        web accessibility.
      </p>
      <p>
        <strong className="text-redlife-ink">Features Implemented.</strong>{' '}
        This site includes: keyboard-navigable interface elements, ARIA roles
        and labels for screen readers, focus-visible outlines, reduced-motion
        support via <code>prefers-reduced-motion</code>, sufficient color
        contrast for text content, and modal dialogs with focus trapping.
      </p>
      <p>
        <strong className="text-redlife-ink">Known Limitations.</strong>{' '}
        The 3D canvas is inherently visual and may present challenges for users
        relying on screen readers. We provide HTML-based project descriptions
        in the modal overlay as an alternative to the 3D card interaction.
        Some interactive 3D elements (card dragging) require a pointing device
        and may not be fully operable via keyboard alone.
      </p>
      <p>
        <strong className="text-redlife-ink">Feedback.</strong>{' '}
        If you encounter an accessibility barrier on this site, please contact
        us at{' '}
        <a href="mailto:accessibility@redlife.studio" className="text-redlife-accent underline">
          accessibility@redlife.studio
        </a>{' '}
        with a description of the issue. We take accessibility feedback
        seriously and will work to address valid concerns promptly.
      </p>
      <p>
        <strong className="text-redlife-ink">ADA Compliance Statement.</strong>{' '}
        We strive to comply with the Americans with Disabilities Act (ADA) and
        Section 508 of the Rehabilitation Act. Compliance with WCAG 2.1 AA is
        our target; full conformance is an ongoing effort.
      </p>
    </div>
  );
}

function Cookies() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">Use of Cookies and Local Storage.</strong>{' '}
        This site uses minimal client-side storage. We do not use third-party
        advertising cookies or cross-site tracking cookies.
      </p>
      <p>
        <strong className="text-redlife-ink">What We Use.</strong>{' '}
        The site uses <code>localStorage</code> (not cookies) to remember your
        card position and content edits made in Edit Mode. This data never
        leaves your browser. No cookie banner is shown because we do not use
        cookies that require consent under the EU ePrivacy Directive or
        California's CPRA.
      </p>
      <p>
        <strong className="text-redlife-ink">Third-Party Resources.</strong>{' '}
        YouTube thumbnail images are loaded from <code>img.youtube.com</code>
        and may set cookies under YouTube's own privacy policy. Google Fonts
        are loaded from Google's CDN. These third parties may set cookies or
        collect technical data per their own policies, which we do not control.
      </p>
      <p>
        <strong className="text-redlife-ink">Managing Storage.</strong>{' '}
        You can clear all site data at any time through your browser's settings
        (usually under "Clear browsing data" → "Cookies and site data"). This
        will reset any Edit Mode customizations.
      </p>
    </div>
  );
}

function Disclaimers() {
  return (
    <div className="space-y-3">
      <p>
        <strong className="text-redlife-ink">No Warranty.</strong>{' '}
        This website and its content are provided "as is" without warranty of
        any kind, express or implied, including but not limited to the implied
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that the site will be
        uninterrupted, error-free, or free of harmful components.
      </p>
      <p>
        <strong className="text-redlife-ink">Limitation of Liability.</strong>{' '}
        To the maximum extent permitted by law, RedLife Entertainment shall not
        be liable for any direct, indirect, incidental, consequential, special,
        or exemplary damages arising out of or in connection with your use of,
        or inability to use, this website.
      </p>
      <p>
        <strong className="text-redlife-ink">Accuracy of Content.</strong>{' '}
        Project descriptions, technical claims, and statistics on this site
        represent the author's best understanding at the time of writing. We do
        not guarantee the accuracy, completeness, or timeliness of any content.
      </p>
      <p>
        <strong className="text-redlife-ink">External Links.</strong>{' '}
        This site contains links to external websites (GitHub, YouTube, Google,
        etc.) that are not operated by us. We have no control over and assume
        no responsibility for the content, privacy policies, or practices of
        these third-party sites.
      </p>
      <p>
        <strong className="text-redlife-ink">No Professional Advice.</strong>{' '}
        Content on this site is for portfolio demonstration purposes only and
        does not constitute legal, engineering, or professional advice. Any
        reliance you place on such content is strictly at your own risk.
      </p>
      <p>
        <strong className="text-redlife-ink">State-Specific Rights.</strong>{' '}
        Some states do not allow the exclusion of implied warranties or the
        limitation of certain damages, so the above limitations may not apply
        to you. This disclaimer is subject to applicable state consumer
        protection laws.
      </p>
    </div>
  );
}

function LegalContact() {
  return (
    <div className="space-y-3">
      <p>
        For legal inquiries, DMCA notices, privacy requests, or accessibility
        feedback, please contact us at the appropriate address below. We aim to
        respond within 10 business days.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-redlife-line bg-black/30 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted">
            General / Legal
          </div>
          <a href="mailto:legal@redlife.studio" className="mt-1 block text-sm text-redlife-accent underline">
            legal@redlife.studio
          </a>
        </div>
        <div className="rounded-lg border border-redlife-line bg-black/30 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted">
            DMCA Agent
          </div>
          <a href="mailto:legal@redlife.studio" className="mt-1 block text-sm text-redlife-accent underline">
            legal@redlife.studio
          </a>
        </div>
        <div className="rounded-lg border border-redlife-line bg-black/30 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted">
            Privacy (CCPA / COPPA)
          </div>
          <a href="mailto:privacy@redlife.studio" className="mt-1 block text-sm text-redlife-accent underline">
            privacy@redlife.studio
          </a>
        </div>
        <div className="rounded-lg border border-redlife-line bg-black/30 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-redlife-muted">
            Accessibility
          </div>
          <a href="mailto:accessibility@redlife.studio" className="mt-1 block text-sm text-redlife-accent underline">
            accessibility@redlife.studio
          </a>
        </div>
      </div>
      <p className="mt-4 text-redlife-muted">
        All legal notices sent by email are considered received on the date
        transmitted.
      </p>
    </div>
  );
}
