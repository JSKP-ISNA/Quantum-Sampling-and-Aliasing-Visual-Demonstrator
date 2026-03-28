import { useState, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';
import BootSequence from './components/BootSequence';
import DashboardPage from './pages/DashboardPage';
import SignalLabPage from './pages/SignalLabPage';
import QuantumLabPage from './pages/QuantumLabPage';
import NyquistPage from './pages/NyquistPage';
import StatusPage from './pages/StatusPage';
import useAudio from './hooks/useAudio';
import useWebSocket from './hooks/useWebSocket';
import useQuantumState from './hooks/useQuantumState';
import useQuantumJobs from './hooks/useQuantumJobs';
import './App.css';

/**
 * AliasingViz 3D – Root Application
 * Multi-page quantum signal processing showcase.
 */
export default function App() {
  const { sendParams } = useWebSocket();
  useAudio();
  useQuantumState();
  const { submitJob } = useQuantumJobs();
  const [booted, setBooted] = useState(false);
  const location = useLocation();

  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  return (
    <div className="app-container">
      {/* Boot Sequence */}
      <AnimatePresence>
        {!booted && <BootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {/* Main Application */}
      {booted && (
        <motion.div
          className="app-main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* Page Content */}
          <main className="app-content">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
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
              </Routes>
            </AnimatePresence>
          </main>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Page transition wrapper
 */
function PageWrapper({ children }) {
  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
