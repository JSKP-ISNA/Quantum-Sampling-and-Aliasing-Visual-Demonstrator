import { createElement, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCpu,
  FiLayers,
  FiMenu,
  FiRadio,
  FiServer,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import heroVideo from '../assets/landing-preview.mp4';
import './LandingPage.css';



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
  { id: 'routes', label: 'Routes' },
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
