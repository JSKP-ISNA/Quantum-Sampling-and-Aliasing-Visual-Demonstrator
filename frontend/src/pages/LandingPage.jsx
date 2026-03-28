import { createElement } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiArrowRight,
  FiCheckCircle,
  FiCpu,
  FiLayers,
  FiRadio,
  FiServer,
  FiShield,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import './LandingPage.css';

const HERO_TRACE = [34, 58, 49, 72, 44, 80, 61, 88, 54, 76, 47, 69, 52, 64];

const PLATFORM_STATS = [
  { value: '5', label: 'Product surfaces', note: 'Dashboard, labs, theorem explorer, and status' },
  { value: '4', label: 'Waveform families', note: 'Sine, square, sawtooth, and triangle inputs' },
  { value: '3', label: 'Execution backends', note: 'Local, simulator, and hardware-ready pathways' },
  { value: '20 FPS', label: 'Realtime lane', note: 'Throttled WebSocket telemetry for steady operator review' },
];

const CAPABILITIES = [
  {
    icon: FiActivity,
    title: 'Realtime signal telemetry',
    description:
      'Observe continuous source traces, sampled reconstructions, FFT posture, and alias conditions in one operating view.',
  },
  {
    icon: FiCpu,
    title: 'Quantum execution workflow',
    description:
      'Submit jobs, compare circuit outcomes against classical references, and inspect backend-specific execution metrics.',
  },
  {
    icon: FiShield,
    title: 'Operator-grade surface design',
    description:
      'Move from quick mission overview to deeper labs and infrastructure status without losing narrative continuity.',
  },
];

const MODULES = [
  {
    icon: FiLayers,
    title: 'Operations overview',
    path: '/dashboard',
    label: 'Dashboard',
    description:
      'Mission control for live sampling posture, reconstruction confidence, spectral occupancy, and quantum lane readiness.',
  },
  {
    icon: FiTrendingUp,
    title: 'Signal lab',
    path: '/signal-lab',
    label: 'Analysis',
    description:
      'Inspect time-domain and frequency-domain behavior with focused visuals for waveform tuning and alias detection.',
  },
  {
    icon: FiCpu,
    title: 'Quantum lab',
    path: '/quantum-lab',
    label: 'Execution',
    description:
      'Work directly with circuit configuration, shot distributions, and backend execution controls for the quantum workflow.',
  },
  {
    icon: FiRadio,
    title: 'Nyquist explorer',
    path: '/nyquist',
    label: 'Theory',
    description:
      'Translate the theorem into an interactive, visual explanation that makes headroom and foldback behavior immediately legible.',
  },
  {
    icon: FiServer,
    title: 'Runtime status',
    path: '/status',
    label: 'Observability',
    description:
      'Check backend availability, stream health, transport details, and the latest execution posture from a single screen.',
  },
];

const WORKFLOW = [
  {
    step: '01',
    title: 'Frame the operating point',
    description: 'Choose waveform, carrier, sample rate, and noise so the system starts from a clear signal posture.',
  },
  {
    step: '02',
    title: 'Watch the reconstruction behave',
    description: 'Stream source, samples, and recovered traces in realtime while the spectral view updates beside them.',
  },
  {
    step: '03',
    title: 'Run the quantum lane',
    description: 'Submit phase-estimation or sampling jobs and compare measured output against the classical reference path.',
  },
  {
    step: '04',
    title: 'Validate system health',
    description: 'Review backend availability, execution timing, and link posture before you leave the workspace.',
  },
];

const STACK = [
  'React 19',
  'Framer Motion',
  'Recharts',
  'Three.js',
  'FastAPI',
  'WebSocket transport',
  'NumPy + SciPy',
  'Docker Compose',
  'Quantum backend abstraction',
];

const REVEAL_TRANSITION = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

function RevealSection({ children, className, ...props }) {
  return (
    <Motion.section
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={REVEAL_TRANSITION}
      {...props}
    >
      {children}
    </Motion.section>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-page__backdrop" />

      <div className="landing-shell">
        <header className="landing-topbar">
          <Link className="landing-brand" to="/">
            <span className="landing-brand__mark">QS</span>
            <span className="landing-brand__copy">
              <strong>Quantum Signal Studio</strong>
              <small>Hybrid signal intelligence platform</small>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="Landing sections">
            <a href="#capabilities">Capabilities</a>
            <a href="#platform">Platform</a>
            <a href="#stack">Stack</a>
          </nav>

          <Link className="landing-btn landing-btn--ghost landing-btn--sm" to="/dashboard">
            Enter workspace
          </Link>
        </header>

        <RevealSection className="landing-hero">
          <div className="landing-hero__copy">
            <span className="landing-kicker">Industrial signal intelligence</span>
            <h1 className="landing-hero__title">
              The control surface for sampling risk, spectral behavior, and quantum execution.
            </h1>
            <p className="landing-hero__body">
              Quantum Signal Studio turns this project into a fuller product experience: a polished front page,
              a clearer route into the workspace, and a more credible platform story for realtime DSP,
              Nyquist analysis, and backend-aware quantum workflows.
            </p>

            <div className="landing-hero__actions">
              <Link className="landing-btn landing-btn--primary" to="/dashboard">
                Launch overview
                <FiArrowRight />
              </Link>
              <Link className="landing-btn landing-btn--secondary" to="/quantum-lab">
                Open quantum lab
              </Link>
            </div>

            <div className="landing-proof-list" aria-label="Platform strengths">
              <div className="landing-proof-list__item">
                <FiCheckCircle />
                Same-origin API and WebSocket routing for cleaner deploys
              </div>
              <div className="landing-proof-list__item">
                <FiCheckCircle />
                Distinct marketing entry and workspace shell instead of dropping straight into the dashboard
              </div>
              <div className="landing-proof-list__item">
                <FiCheckCircle />
                Refined visual system with restrained color, better hierarchy, and mobile-aware navigation
              </div>
            </div>
          </div>

          <div className="landing-preview">
            <Motion.div
              className="landing-preview__panel"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ ...REVEAL_TRANSITION, delay: 0.08 }}
            >
              <div className="landing-preview__header">
                <div>
                  <span className="landing-panel-label">Workspace preview</span>
                  <h2>Unified mission posture</h2>
                </div>
                <span className="landing-status-pill">
                  <FiZap />
                  Realtime ready
                </span>
              </div>

              <div className="landing-preview__trace">
                {HERO_TRACE.map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} />
                ))}
              </div>

              <div className="landing-preview__grid">
                <div className="landing-metric-card">
                  <span>Sampling margin</span>
                  <strong>1.76x</strong>
                  <small>Healthy Nyquist headroom under current operating point</small>
                </div>
                <div className="landing-metric-card">
                  <span>Execution lane</span>
                  <strong>Ready</strong>
                  <small>Backend-aware quantum runs without leaving the shell</small>
                </div>
                <div className="landing-metric-card">
                  <span>FFT coverage</span>
                  <strong>18 bands</strong>
                  <small>Dominant spectrum view kept alongside time-domain behavior</small>
                </div>
                <div className="landing-metric-card">
                  <span>Transport</span>
                  <strong>WebSocket</strong>
                  <small>Realtime updates with throttled UI refresh for stability</small>
                </div>
              </div>
            </Motion.div>

            <Motion.div
              className="landing-floating-card landing-floating-card--upper"
              initial={{ opacity: 0, x: 18, y: 18 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ ...REVEAL_TRANSITION, delay: 0.18 }}
            >
              <span className="landing-panel-label">Execution flow</span>
              <strong>Observe, compare, execute</strong>
              <div className="landing-floating-card__rail">
                <span />
                <span />
                <span />
                <span />
              </div>
              <small>Signal inputs, spectral posture, quantum result, and health review are all part of one loop.</small>
            </Motion.div>

            <Motion.div
              className="landing-floating-card landing-floating-card--lower"
              initial={{ opacity: 0, x: -18, y: 18 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ ...REVEAL_TRANSITION, delay: 0.26 }}
            >
              <span className="landing-panel-label">Core stack</span>
              <div className="landing-stack-list">
                {STACK.slice(0, 5).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </Motion.div>
          </div>
        </RevealSection>

        <RevealSection className="landing-stat-band">
          {PLATFORM_STATS.map((item, index) => (
            <Motion.div
              key={item.label}
              className="landing-stat"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ ...REVEAL_TRANSITION, delay: index * 0.06 }}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.note}</small>
            </Motion.div>
          ))}
        </RevealSection>

        <RevealSection className="landing-section" id="capabilities">
          <div className="landing-section__heading">
            <span className="landing-kicker">Why this feels more product-grade now</span>
            <h2>Better entry experience, cleaner deployment posture, stronger narrative.</h2>
            <p>
              Instead of presenting a dashboard immediately, the app now opens with context, hierarchy, and a clear
              way into each part of the platform. The shell is also cleaner under the hood, with same-origin network
              paths and route-aware runtime behavior.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--three">
            {CAPABILITIES.map((capability, index) => (
              <Motion.article
                key={capability.title}
                className="landing-feature-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...REVEAL_TRANSITION, delay: index * 0.08 }}
              >
                <div className="landing-feature-card__icon">{createElement(capability.icon)}</div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </Motion.article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-section" id="platform">
          <div className="landing-section__heading">
            <span className="landing-kicker">Platform surfaces</span>
            <h2>Every route now feels like part of the same product.</h2>
            <p>
              The front page introduces the system, while each lab remains one click away for deeper technical work.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--modules">
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

        <RevealSection className="landing-section">
          <div className="landing-section__heading">
            <span className="landing-kicker">Operational flow</span>
            <h2>A clearer product journey from signal setup to backend validation.</h2>
          </div>

          <div className="landing-workflow">
            {WORKFLOW.map((item, index) => (
              <Motion.article
                key={item.step}
                className="landing-workflow__step"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...REVEAL_TRANSITION, delay: index * 0.05 }}
              >
                <span className="landing-workflow__number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Motion.article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-section" id="stack">
          <div className="landing-section__heading">
            <span className="landing-kicker">Technology stack</span>
            <h2>Strong enough without adding tech for tech&apos;s sake.</h2>
            <p>
              The project already had a capable stack. The upgrade here is using it more intentionally: a better shell,
              more credible product framing, and cleaner platform integration.
            </p>
          </div>

          <div className="landing-stack-band">
            {STACK.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="landing-cta">
          <div className="landing-cta__copy">
            <span className="landing-kicker">Enter the workspace</span>
            <h2>Start at the overview, then drill into the exact lab you need.</h2>
            <p>
              The project now opens like a product, not a raw demo. From here you can move directly into the dashboard,
              quantum lab, or runtime status view.
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
