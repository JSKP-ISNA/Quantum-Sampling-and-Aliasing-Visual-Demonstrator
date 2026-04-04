import { createElement, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCheckCircle,
  FiCpu,
  FiLayers,
  FiMenu,
  FiRadio,
  FiServer,
  FiShield,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import heroVideo from '../assets/landing-preview.mp4';
import './LandingPage.css';

const HERO_POINTS = [
  'Signal Processing 8.5/10: the most trustworthy part of the system',
  'Classical Infrastructure 7.5/10: WebSocket, job lifecycle, Docker, and persistence are solid',
  'Quantum Authenticity 3/10 and Production Readiness 3/10: this is still a strong prototype, not a finished platform',
];

const PROJECT_SCORES = [
  {
    dimension: 'Signal Processing',
    score: '8.5/10',
    note: 'Genuinely good. This is the part of the project that feels closest to production quality.',
    tone: 'strong',
  },
  {
    dimension: 'Classical Infrastructure',
    score: '7.5/10',
    note: 'WebSocket streaming, job lifecycle, Docker, and persistence are all competent foundations.',
    tone: 'strong',
  },
  {
    dimension: 'Quantum Authenticity',
    score: '3/10',
    note: 'Results still mix analytical shortcuts and incompatible simulation stories, so this layer should be framed as experimental.',
    tone: 'risk',
  },
  {
    dimension: 'Frontend Architecture',
    score: '5/10',
    note: 'The interface is visually rich, but route composition, component size, and test coverage need real cleanup.',
    tone: 'mixed',
  },
  {
    dimension: 'UI/UX Polish',
    score: '7/10',
    note: 'The visual language is strong, but mobile responsiveness and accessibility are still missing.',
    tone: 'strong',
  },
  {
    dimension: 'Code Hygiene',
    score: '5/10',
    note: 'Repository cleanup, tracked artifacts, and naming consistency still need attention.',
    tone: 'mixed',
  },
  {
    dimension: 'Test Coverage',
    score: '6.5/10',
    note: 'Backend coverage is respectable, but the frontend still has no meaningful test safety net or CI.',
    tone: 'mixed',
  },
  {
    dimension: 'Production Readiness',
    score: '3/10',
    note: 'Auth, rate limiting, monitoring, mobile, accessibility, and recovery flows are not there yet.',
    tone: 'risk',
  },
];

const PRIORITIES = [
  {
    icon: FiCpu,
    title: 'Fix Quantum Authenticity',
    description:
      'Stop presenting analytically derived or mismatched simulator outputs as if they are one coherent quantum runtime.',
  },
  {
    icon: FiLayers,
    title: 'Refactor The Frontend',
    description:
      'Break up oversized route components, clarify ownership between UI surfaces, and add real frontend tests.',
  },
  {
    icon: FiShield,
    title: 'Earn Production Claims',
    description:
      'Add auth, rate limiting, monitoring, mobile support, accessibility, and better error recovery before calling this production-ready.',
  },
  {
    icon: FiServer,
    title: 'Improve Delivery Discipline',
    description:
      'Clean up tracked artifacts, add CI, and expand docs so the stack is easier to trust and maintain.',
  },
];

const MODULES = [
  {
    icon: FiLayers,
    title: 'Operations overview',
    path: '/dashboard',
    label: 'Dashboard',
    description:
      'A polished mission summary, but still part of a frontend that needs decomposition, accessibility work, and stronger testing.',
  },
  {
    icon: FiTrendingUp,
    title: 'Signal lab',
    path: '/signal-lab',
    label: 'Analysis',
    description:
      'The strongest route today: convincing DSP controls, scenarios, and charting for waveform and alias analysis.',
  },
  {
    icon: FiCpu,
    title: 'Quantum lab',
    path: '/quantum-lab',
    label: 'Execution',
    description:
      'Feature-rich and educational, but still not a faithful or unified representation of authentic quantum execution.',
  },
  {
    icon: FiRadio,
    title: 'Nyquist explorer',
    path: '/nyquist',
    label: 'Theory',
    description:
      'One of the clearest educational surfaces in the project, even though it remains firmly demo-oriented.',
  },
  {
    icon: FiServer,
    title: 'Runtime status',
    path: '/status',
    label: 'Observability',
    description:
      'Useful demo observability for health and transport state, but not yet the same thing as production monitoring.',
  },
];

const NAV_SECTIONS = [
  { id: 'scores', label: 'Scores' },
  { id: 'routes', label: 'Routes' },
  { id: 'gaps', label: 'Gaps' },
];

const REVEAL_TRANSITION = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

function RevealSection({ children, className, ...props }) {
  return (
    <Motion.section
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={REVEAL_TRANSITION}
      {...props}
    >
      {children}
    </Motion.section>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-page__video-wrap" aria-hidden="true">
        <video className="landing-page__video" autoPlay loop muted playsInline preload="metadata">
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="landing-page__scrim" />
        <div className="landing-page__vignette" />
        <div className="landing-page__grid" />
      </div>

      <div className="landing-shell">
        <header className="landing-topbar">
          <Link className="landing-brand" to="/">
            <span className="landing-brand__mark">QS</span>
            <span className="landing-brand__copy">
              <strong>Quantum Signal Studio</strong>
              <small>Strong V1 prototype, not production-ready</small>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="Landing sections">
            {NAV_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className="landing-nav__link"
                onClick={() => scrollToSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="landing-topbar__actions">
            <button
              type="button"
              className="landing-menu-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              {mobileMenuOpen ? <FiX /> : <FiMenu />}
            </button>
            <Link className="landing-btn landing-btn--ghost landing-btn--sm" to="/dashboard">
              Enter workspace
            </Link>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="landing-mobile-menu">
            {NAV_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className="landing-mobile-menu__link"
                onClick={() => scrollToSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        ) : null}

        <RevealSection className="landing-hero">
          <div className="landing-hero__copy">
            <span className="landing-kicker">Reviewed honestly</span>
            <h1 className="landing-hero__title">A strong DSP prototype with real infrastructure and unfinished production work.</h1>
            <p className="landing-hero__body">
              This project scores well in signal processing and classical infrastructure, middling in frontend
              architecture and code hygiene, and poorly in quantum authenticity, documentation, and production
              readiness. The landing page now frames it that way: credible V1, not finished platform.
            </p>

            <div className="landing-hero__actions">
              <Link className="landing-btn landing-btn--primary" to="/dashboard">
                Explore overview
                <FiArrowRight />
              </Link>
              <Link className="landing-btn landing-btn--secondary" to="/quantum-lab">
                Inspect quantum lab
              </Link>
            </div>

            <div className="landing-hero__points" aria-label="Landing highlights">
              {HERO_POINTS.map((item) => (
                <div key={item} className="landing-hero__point">
                  <FiCheckCircle />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-hero__footnote">
            <button type="button" className="landing-inline-link" onClick={() => scrollToSection('scores')}>
              Review scores
            </button>
            <span>8.5 DSP / 7.5 infra / 3.0 quantum authenticity / 3.0 production readiness</span>
          </div>
        </RevealSection>

        <RevealSection className="landing-section" id="scores">
          <div className="landing-section__heading">
            <span className="landing-kicker">Scorecard</span>
            <h2>The project is strongest in DSP and infrastructure, weakest in quantum authenticity and production hardening.</h2>
            <p>
              These scores should shape how the app is presented. It deserves credit for the real work in the stack,
              but it should not be marketed like a production platform or a fully authentic quantum system yet.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--scores">
            {PROJECT_SCORES.map((item, index) => (
              <Motion.div
                key={item.dimension}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...REVEAL_TRANSITION, delay: index * 0.05 }}
              >
                <article className={`landing-score-card landing-score-card--${item.tone}`}>
                  <span className="landing-score-card__dimension">{item.dimension}</span>
                  <strong className="landing-score-card__score">{item.score}</strong>
                  <p>{item.note}</p>
                </article>
              </Motion.div>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-section" id="routes">
          <div className="landing-section__heading">
            <span className="landing-kicker">Routes</span>
            <h2>Explore the strongest surfaces first, and treat the weaker ones with the right expectations.</h2>
            <p>
              The routes are still useful, but they are not all equally mature. Signal work is the most trustworthy
              lane; the quantum lane is still more experimental than authoritative.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--three">
            {MODULES.map((module, index) => (
              <Motion.div
                key={module.path}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...REVEAL_TRANSITION, delay: index * 0.05 }}
              >
                <Link className="landing-module-card" to={module.path}>
                  <div className="landing-module-card__header">
                    <span className="landing-module-card__label">{module.label}</span>
                    {createElement(module.icon)}
                  </div>
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                  <span className="landing-module-card__action">
                    Open route
                    <FiArrowRight />
                  </span>
                </Link>
              </Motion.div>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-section" id="gaps">
          <div className="landing-section__heading">
            <span className="landing-kicker">Gaps</span>
            <h2>The next version should fix authenticity, architecture, and production fundamentals before chasing more shine.</h2>
            <p>
              The scorecard points to a clear roadmap: tighten the quantum story, refactor the frontend, clean up the
              repo and delivery process, and add the missing fundamentals needed for a serious production claim.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--priorities">
            {PRIORITIES.map((item, index) => (
              <Motion.article
                key={item.title}
                className="landing-feature-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...REVEAL_TRANSITION, delay: index * 0.08 }}
              >
                <div className="landing-feature-card__icon">{createElement(item.icon)}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Motion.article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-cta">
          <div className="landing-cta__copy">
            <span className="landing-kicker">Explore The Prototype</span>
            <h2>Use the strongest parts confidently, and treat the weaker parts as active work in progress.</h2>
            <p>
              Start with Signal Lab or the overview if you want the most credible experience today. Use Quantum Lab as
              an ambitious experimental surface, not as proof of production-grade quantum authenticity.
            </p>
          </div>

          <div className="landing-cta__actions">
            <Link className="landing-btn landing-btn--primary" to="/dashboard">
              Go to overview
              <FiArrowRight />
            </Link>
            <Link className="landing-btn landing-btn--ghost" to="/status">
              Check system status
            </Link>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
