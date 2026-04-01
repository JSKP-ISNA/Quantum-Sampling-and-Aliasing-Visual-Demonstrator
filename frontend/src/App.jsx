import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';
import useAudio from './hooks/useAudio';
import useWebSocket from './hooks/useWebSocket';
import useQuantumState from './hooks/useQuantumState';
import useQuantumJobs from './hooks/useQuantumJobs';
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
              <LandingPage />
            </Suspense>
          </Motion.div>
        ) : (
          <WorkspaceShell key="workspace" location={location} />
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkspaceShell({ location }) {
  const { sendParams } = useWebSocket();
  useAudio();
  useQuantumState();
  const { submitJob } = useQuantumJobs();

  return (
    <Motion.div
      className="app-main"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Sidebar />

      <main className="app-content">
        <Suspense fallback={<RouteLoader variant="workspace" />}>
          <AnimatePresence mode="sync">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/dashboard"
                element={
                  <PageWrapper>
                    <DashboardPage sendParams={sendParams} submitQuantumJob={submitJob} />
                  </PageWrapper>
                }
              />
              <Route
                path="/signal-lab"
                element={
                  <PageWrapper>
                    <SignalLabPage sendParams={sendParams} />
                  </PageWrapper>
                }
              />
              <Route
                path="/quantum-lab"
                element={
                  <PageWrapper>
                    <QuantumLabPage submitQuantumJob={submitJob} />
                  </PageWrapper>
                }
              />
              <Route
                path="/nyquist"
                element={
                  <PageWrapper>
                    <NyquistPage />
                  </PageWrapper>
                }
              />
              <Route
                path="/status"
                element={
                  <PageWrapper>
                    <StatusPage />
                  </PageWrapper>
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
