import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import QuantumButton from '../components/ui/QuantumButton';
import StatusDot from '../components/ui/StatusDot';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import useSignalStore from '../store/useSignalStore';
import './StatusPage.css';

/**
 * System Status — Backend health, connection status, backend info, and performance.
 */
export default function StatusPage() {
  const connected = useSignalStore((s) => s.connected);
  const availableBackends = useSignalStore((s) => s.availableBackends);
  const jobStatus = useSignalStore((s) => s.quantumJobStatus);
  const metrics = useSignalStore((s) => s.quantumMetrics);
  const freq = useSignalStore((s) => s.freq);
  const fs = useSignalStore((s) => s.fs);

  const [healthData, setHealthData] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setHealthError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setHealthError(err.message || 'Connection failed');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // System info
  const systemInfo = [
    { label: 'Frontend', value: 'React 19 + Three.js', status: 'online' },
    { label: 'WebSocket', value: connected ? 'Connected' : 'Disconnected', status: connected ? 'online' : 'offline' },
    { label: 'Backend API', value: healthData ? 'Healthy' : healthError ? 'Error' : 'Checking...', status: healthData ? 'online' : healthError ? 'offline' : 'loading' },
    { label: 'Quantum Engine', value: healthData?.quantum_engine || 'Unknown', status: healthData?.quantum_engine === 'available' ? 'online' : 'warning' },
  ];

  return (
    <div className="status-page">
      {/* Header */}
      <div className="status-page__header">
        <div>
          <h1 className="page-title">System Status</h1>
          <p className="page-subtitle">Infrastructure & Performance Monitoring</p>
        </div>
        <div className="status-page__actions">
          <QuantumButton
            variant="cyan"
            size="sm"
            onClick={checkHealth}
            loading={healthLoading}
            icon="↻"
          >
            Refresh
          </QuantumButton>
          {lastChecked && (
            <span className="last-checked">Last: {lastChecked}</span>
          )}
        </div>
      </div>

      <div className="status-grid">
        {/* System Services */}
        <GlassCard title="SYSTEM SERVICES" icon="◈" className="status-services-card">
          <div className="services-list">
            {systemInfo.map((service) => (
              <motion.div
                className="service-row"
                key={service.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <StatusDot status={service.status} size={8} />
                <div className="service-info">
                  <span className="service-name">{service.label}</span>
                  <span className={`service-value service-value--${service.status}`}>{service.value}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>

        {/* Available Backends */}
        <GlassCard title="QUANTUM BACKENDS" icon="⚛" variant="purple">
          {availableBackends.length > 0 ? (
            <div className="backends-list">
              {availableBackends.map((b, i) => (
                <motion.div
                  key={typeof b === 'string' ? b : b.name}
                  className="backend-item"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <StatusDot status="online" size={6} />
                  <span className="backend-name">{typeof b === 'string' ? b : b.name}</span>
                  {typeof b !== 'string' && b.description && (
                    <span className="backend-desc">{b.description}</span>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="no-backends">
              <StatusDot status="warning" size={8} label="No backends reported" />
              <p>Backend may not be running or API is unreachable.</p>
            </div>
          )}
        </GlassCard>

        {/* Connection Details */}
        <GlassCard title="CONNECTION DETAILS" icon="📡">
          <div className="connection-details">
            <div className="cd-row">
              <span className="cd-label">Protocol</span>
              <span className="cd-value">WebSocket (WS)</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Endpoint</span>
              <span className="cd-value cd-value--mono">/stream</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Update Rate</span>
              <span className="cd-value cd-value--mono">~20 FPS</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Throttle</span>
              <span className="cd-value cd-value--mono">50ms</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Status</span>
              <span className={`cd-value ${connected ? 'cd-value--good' : 'cd-value--bad'}`}>
                {connected ? 'ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Current Signal Configuration */}
        <GlassCard title="ACTIVE CONFIGURATION" icon="🎛️" variant="default">
          <div className="connection-details">
            <div className="cd-row">
              <span className="cd-label">Signal Freq</span>
              <span className="cd-value cd-value--mono">{freq} Hz</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Sample Rate</span>
              <span className="cd-value cd-value--mono">{fs} Hz</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Nyquist</span>
              <span className="cd-value cd-value--mono">{fs / 2} Hz</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Quantum Job</span>
              <span className={`cd-value ${jobStatus === 'completed' ? 'cd-value--good' : jobStatus === 'failed' ? 'cd-value--bad' : ''}`}>
                {jobStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Last Quantum Execution */}
        {metrics.backendName && (
          <GlassCard title="LAST QUANTUM EXECUTION" icon="⏱" variant="purple" className="status-wide-card">
            <div className="last-execution-grid">
              <div className="le-item">
                <span className="le-label">Backend</span>
                <span className="le-value">{metrics.backendName}</span>
              </div>
              <div className="le-item">
                <span className="le-label">Circuit Type</span>
                <span className="le-value">{metrics.circuitType}</span>
              </div>
              <div className="le-item">
                <span className="le-label">Execution Time</span>
                <span className="le-value">
                  <AnimatedNumber value={metrics.executionTime} decimals={1} suffix=" ms" />
                </span>
              </div>
              <div className="le-item">
                <span className="le-label">Total Workflow</span>
                <span className="le-value">
                  <AnimatedNumber value={metrics.totalWorkflowTime} decimals={1} suffix=" ms" />
                </span>
              </div>
              <div className="le-item">
                <span className="le-label">Fidelity</span>
                <span className="le-value">
                  <AnimatedNumber value={metrics.fidelityEstimate * 100} decimals={1} suffix="%" />
                </span>
              </div>
              <div className="le-item">
                <span className="le-label">Noise Model</span>
                <span className="le-value">{metrics.noiseModel}</span>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Health Response */}
        {healthData && (
          <GlassCard title="BACKEND HEALTH RESPONSE" icon="❤" variant="success" className="status-wide-card">
            <pre className="health-json">{JSON.stringify(healthData, null, 2)}</pre>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
