import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiInfo,
  FiX,
} from 'react-icons/fi';
import Sidebar from './components/layout/Sidebar';
import BootSequence from './components/BootSequence';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import useAudio from './hooks/useAudio';
import useWebSocket from './hooks/useWebSocket';
import useQuantumState from './hooks/useQuantumState';
import useQuantumJobs from './hooks/useQuantumJobs';
import useSignalStore from './store/useSignalStore';
import './App.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SignalLabPage = lazy(() => import('./pages/SignalLabPage'));
const QuantumLabPage = lazy(() => import('./pages/QuantumLabPage'));
const NyquistPage = lazy(() => import('./pages/NyquistPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));

export default function App() {
  const location = useLocation();
  const isMarketingRoute = location.pathname === '/';
  const toasts = useSignalStore((state) => state.toasts);
  const dismissToast = useSignalStore((state) => state.dismissToast);

  return (
    <div className={`app-container ${isMarketingRoute ? 'app-container--marketing' : 'app-container--workspace'}`}>
      <AnimatePresence mode="wait">
        {isMarketingRoute ? (
          <Motion.div
            key="marketing"
            className="page-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<RouteLoader />}>
              <RouteErrorBoundary routeName="Front Page" resetKey={location.pathname}>
                <LandingPage />
              </RouteErrorBoundary>
            </Suspense>
          </Motion.div>
        ) : (
          <WorkspaceShell key="workspace" location={location} />
        )}
      </AnimatePresence>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function WorkspaceShell({ location }) {
  const { sendParams } = useWebSocket();
  const { submitJob } = useQuantumJobs();
  const booted = useSignalStore((state) => state.booted);
  const setBooted = useSignalStore((state) => state.setBooted);

  useAudio();
  useQuantumState();

  const shouldShowBoot =
    !booted &&
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem('quantum-workspace-booted') !== 'true';

  useEffect(() => {
    if (!booted && !shouldShowBoot) {
      setBooted(true);
    }
  }, [booted, setBooted, shouldShowBoot]);

  const completeBoot = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('quantum-workspace-booted', 'true');
    }
    setBooted(true);
  };

  return (
    <Motion.div
      className="app-main"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {shouldShowBoot ? <BootSequence onComplete={completeBoot} /> : null}
      <Sidebar />

      <main className="app-content">
        <Suspense fallback={<RouteLoader variant="workspace" />}>
          <AnimatePresence mode="sync">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/dashboard"
                element={
                  <RouteFrame routeName="Dashboard" resetKey={location.pathname}>
                    <DashboardPage sendParams={sendParams} submitQuantumJob={submitJob} />
                  </RouteFrame>
                }
              />
              <Route
                path="/signal-lab"
                element={
                  <RouteFrame routeName="Signal Lab" resetKey={location.pathname}>
                    <SignalLabPage sendParams={sendParams} />
                  </RouteFrame>
                }
              />
              <Route
                path="/quantum-lab"
                element={
                  <RouteFrame routeName="Quantum Lab" resetKey={location.pathname}>
                    <QuantumLabPage submitQuantumJob={submitJob} />
                  </RouteFrame>
                }
              />
              <Route
                path="/nyquist"
                element={
                  <RouteFrame routeName="Nyquist Explorer" resetKey={location.pathname}>
                    <NyquistPage />
                  </RouteFrame>
                }
              />
              <Route
                path="/status"
                element={
                  <RouteFrame routeName="Status Center" resetKey={location.pathname}>
                    <StatusPage />
                  </RouteFrame>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </Motion.div>
  );
}

function RouteFrame({ routeName, resetKey, children }) {
  return (
    <RouteErrorBoundary routeName={routeName} resetKey={resetKey}>
      <PageWrapper>{children}</PageWrapper>
    </RouteErrorBoundary>
  );
}

function PageWrapper({ children }) {
  return (
    <Motion.div
      className="page-wrapper"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Motion.div>
  );
}

function RouteLoader({ variant = 'marketing' }) {
  return (
    <div className={`app-route-loader app-route-loader--${variant}`}>
      <div className="app-route-loader__pulse" />
      <span className="app-route-loader__label">
        {variant === 'workspace' ? 'Preparing workspace' : 'Preparing front page'}
      </span>
    </div>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <Motion.div
      className={`app-toast app-toast--${toast.tone || 'info'}`}
      initial={{ opacity: 0, x: 24, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 24, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      <div className="app-toast__icon">{iconForToast(toast.tone)}</div>
      <div className="app-toast__copy">
        <strong>{toast.title || 'Notice'}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" className="app-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <FiX />
      </button>
    </Motion.div>
  );
}

function iconForToast(tone) {
  if (tone === 'success') return <FiCheckCircle />;
  if (tone === 'warning') return <FiAlertTriangle />;
  if (tone === 'danger') return <FiBell />;
  return <FiInfo />;
}
