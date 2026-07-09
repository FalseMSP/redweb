import { useEffect, useRef } from 'react';
import { projects } from '@/data/projects';
import { useStore } from '@/store';

/**
 * AccessibleProjectList — a visually-hidden HTML list of all portfolio
 * projects, rendered from the same `projects` array used by the 3D scene.
 *
 * This solves three problems:
 *   1. SEO — search engines can index project titles, descriptions, and links
 *      (the 3D canvas content is invisible to crawlers).
 *   2. Screen readers — assistive tech gets real semantic HTML to read.
 *   3. Keyboard access — each project title is a real `<button>` that opens
 *      the same project modal the 3D cards open, so keyboard-only users can
 *      browse the portfolio without the 3D interaction layer.
 *
 * The list is visually hidden using Tailwind's `sr-only` class (clip-based,
 * not `display:none`) so it's still in the accessibility tree and rendered
 * in the DOM for crawlers.
 *
 * A "Skip to project list" link (in App.tsx) targets this section so keyboard
 * users can jump straight here.
 */
export function AccessibleProjectList() {
  const setActiveProject = useStore((s) => s.setActiveProject);
  const sectionRef = useRef<HTMLElement>(null);

  // Expose a focus target for the skip link — scroll into view when focused.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const handleFocus = () => section.scrollIntoView({ block: 'center' });
    section.addEventListener('focus', handleFocus);
    return () => section.removeEventListener('focus', handleFocus);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="project-list"
      tabIndex={-1}
      className="sr-only"
      aria-labelledby="project-list-heading"
    >
      <h2 id="project-list-heading">Portfolio Projects</h2>
      <p>
        Interactive 3D gallery of {projects.length} portfolio projects. Each
        project title below is a button that opens a detailed view.
      </p>
      <ol>
        {projects.map((project) => (
          <li key={project.id}>
            <article>
              <h3>
                <button
                  type="button"
                  onClick={() => setActiveProject(project)}
                  aria-label={`Open project: ${project.title} (${project.year})`}
                >
                  {project.title}
                </button>
              </h3>
              <p>
                <span className="font-mono">{project.year}</span> — {project.description}
              </p>
              {project.tags.length > 0 && (
                <p>
                  <span className="font-mono">Tags:</span>{' '}
                  {project.tags.join(', ')}
                </p>
              )}
              {project.links && project.links.length > 0 && (
                <ul>
                  {project.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.label}: {link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * SkipLink — visually-hidden-until-focused link at the very top of the page.
 * Keyboard users can Tab to it immediately and jump past the HUD/overlay
 * stack straight to the accessible project list.
 */
export function SkipLink() {
  return (
    <a
      href="#project-list"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-redlife-accent focus:bg-redlife-bg focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-redlife-ink"
    >
      Skip to project list
    </a>
  );
}
