import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  FiActivity,
  FiClock,
  FiCpu,
  FiDatabase,
  FiGrid,
  FiMonitor,
  FiRefreshCw,
  FiRadio,
  FiServer,
  FiShield,
} from 'react-icons/fi';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import GlassCard from '../components/ui/GlassCard';
import QuantumButton from '../components/ui/QuantumButton';
import StatusDot from '../components/ui/StatusDot';
import useSignalStore from '../store/useSignalStore';
import { apiUrl } from '../lib/network';
import './StatusPage.css';

function toneForHealth(healthData, healthError) {
  if (healthError) return 'critical';
  if (!healthData) return 'warning';
  return 'good';
}

function formatTime(dateValue) {
  if (!dateValue) return 'Not checked yet';
  return new Date(dateValue).toLocaleTimeString();
}

function formatDateTime(dateValue) {
  if (!dateValue) return 'Pending';
  return new Date(dateValue).toLocaleString();
}

function topStateFromExperiment(experiment) {
  return experiment?.result_summary?.top_state || 'n/a';
}

export default function StatusPage() {
  const connected = useSignalStore((state) => state.connected);
  const availableBackends = useSignalStore((state) => state.availableBackends);
  const jobStatus = useSignalStore((state) => state.quantumJobStatus);
  const metrics = useSignalStore((state) => state.quantumMetrics);
  const freq = useSignalStore((state) => state.freq);
  const fs = useSignalStore((state) => state.fs);
  const noiseLevel = useSignalStore((state) => state.noiseLevel);
  const waveType = useSignalStore((state) => state.waveType);

  const [healthData, setHealthData] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [experimentTotal, setExperimentTotal] = useState(0);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentsError, setExperimentsError] = useState(null);

  const desktopRuntime = typeof window !== 'undefined' ? window.desktopRuntime || null : null;

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);

    try {
      const response = await fetch(apiUrl('/health'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setHealthData(data);
      setLastChecked(Date.now());
    } catch (error) {
      setHealthError(error.message || 'Connection failed');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchExperiments = useCallback(async () => {
    setExperimentsLoading(true);
    setExperimentsError(null);

    try {
      const response = await fetch(apiUrl('/api/quantum/experiments?limit=10'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setExperiments(data.experiments || []);
      setExperimentTotal(data.total || 0);
    } catch (error) {
      setExperimentsError(error.message || 'Experiment history is unavailable.');
    } finally {
      setExperimentsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchExperiments();

    const interval = window.setInterval(() => {
      checkHealth();
      fetchExperiments();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [checkHealth, fetchExperiments]);

  useEffect(() => {
    if (jobStatus === 'completed') {
      fetchExperiments();
    }
  }, [fetchExperiments, jobStatus]);

  const topCountEntry = useMemo(() => {
    const entries = Object.entries(metrics.counts || {});
    entries.sort((left, right) => right[1] - left[1]);
    return entries[0] || ['', 0];
  }, [metrics.counts]);

  const platformCards = useMemo(() => {
    const healthTone = toneForHealth(healthData, healthError);

    return [
      {
        label: 'Runtime Mode',
        value: desktopRuntime?.mode === 'webview' ? 'Desktop Webview' : 'Browser',
        note: desktopRuntime?.platform || 'web',
        tone: desktopRuntime?.mode === 'webview' ? 'good' : 'warning',
        icon: <FiMonitor />,
      },
      {
        label: 'Backend Health',
        value: healthData?.status === 'ok' ? 'Healthy' : healthError ? 'Degraded' : 'Checking',
        note: healthError || healthData?.service || 'Waiting for response',
        tone: healthTone,
        icon: <FiShield />,
      },
      {
        label: 'Realtime Stream',
        value: connected ? 'Connected' : 'Offline',
        note: connected ? 'WebSocket feed is active' : 'Awaiting backend stream',
        tone: connected ? 'good' : 'critical',
        icon: <FiRadio />,
      },
      {
        label: 'Quantum Lane',
        value: jobStatus === 'idle' ? 'Ready' : jobStatus,
        note: healthData?.quantum_engine?.provider || 'Provider unavailable',
        tone: jobStatus === 'completed' || jobStatus === 'idle' ? 'good' : jobStatus === 'failed' ? 'critical' : 'warning',
        icon: <FiCpu />,
      },
      {
        label: 'Stored Runs',
        value: String(experimentTotal),
        note: experiments.length ? `Showing the latest ${experiments.length}` : 'No experiments recorded yet',
        tone: experimentTotal ? 'good' : 'warning',
        icon: <FiDatabase />,
      },
    ];
  }, [connected, desktopRuntime?.mode, desktopRuntime?.platform, experimentTotal, experiments.length, healthData, healthError, jobStatus]);

  const runbookChecks = useMemo(() => {
    return [
      {
        label: 'Health endpoint responding',
        status: healthData?.status === 'ok' ? 'online' : healthError ? 'offline' : 'loading',
        detail: healthData?.service || healthError || 'Waiting for response',
      },
      {
        label: 'Realtime stream link',
        status: connected ? 'online' : 'offline',
        detail: connected ? 'Signal updates are flowing' : 'WebSocket reconnect loop is active',
      },
      {
        label: 'Quantum backends discovered',
        status: availableBackends.length ? 'online' : 'warning',
        detail: availableBackends.length ? `${availableBackends.length} backends reported` : 'No backends returned yet',
      },
      {
        label: 'Experiment history available',
        status: experimentsError ? 'offline' : experiments.length ? 'online' : 'warning',
        detail: experimentsError || (experiments.length ? `${experimentTotal} runs persisted in SQLite` : 'No completed runs have been stored yet'),
      },
    ];
  }, [availableBackends.length, connected, experimentTotal, experiments.length, experimentsError, healthData?.service, healthData?.status, healthError]);

  const endpointCards = useMemo(() => {
    return [
      { label: '/health', summary: 'Backend heartbeat and engine config', tone: healthData?.status === 'ok' ? 'good' : 'warning' },
      { label: '/stream', summary: 'Realtime signal transport lane', tone: connected ? 'good' : 'critical' },
      { label: '/api/quantum/backends', summary: 'Backend capability inventory', tone: availableBackends.length ? 'good' : 'warning' },
      { label: '/api/quantum/experiments', summary: 'Persistent experiment history from SQLite', tone: experimentsError ? 'critical' : 'good' },
    ];
  }, [availableBackends.length, connected, experimentsError, healthData?.status]);

  const backendProvider = healthData?.quantum_engine?.provider || 'Unavailable';
  const backendNoiseModel = healthData?.quantum_engine?.noise_model || 'Unavailable';
  const backendShots = healthData?.quantum_engine?.shots || 0;

  return (
    <div className="status-page">
      <section className="status-page__header">
        <div>
          <div className="status-page__eyebrow">Operations and runtime posture</div>
          <h1 className="page-title">Status Center</h1>
          <p className="page-subtitle">
            Infrastructure view for runtime mode, transport health, backend capability, and persisted
            execution history across the product.
          </p>
        </div>

        <div className="status-page__actions">
          <QuantumButton
            variant="cyan"
            size="sm"
            onClick={() => {
              checkHealth();
              fetchExperiments();
            }}
            loading={healthLoading || experimentsLoading}
            icon={<FiRefreshCw />}
          >
            Refresh status
          </QuantumButton>
          <span className="status-page__last-checked">
            <FiClock />
            {formatTime(lastChecked)}
          </span>
        </div>
      </section>

      <section className="status-platform-grid">
        {platformCards.map((card, index) => (
          <Motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
          >
            <div className={`status-platform-card status-platform-card--${card.tone}`}>
              <div className="status-platform-card__icon">{card.icon}</div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </div>
          </Motion.div>
        ))}
      </section>

      <section className="status-layout">
        <div className="status-column">
          <GlassCard title="Runbook Checks" icon={<FiShield />} className="status-card">
            <div className="status-runbook">
              {runbookChecks.map((item) => (
                <div key={item.label} className="status-runbook__item">
                  <div className="status-runbook__head">
                    <StatusDot status={item.status} size={8} />
                    <strong>{item.label}</strong>
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Runtime Inventory" icon={<FiGrid />} variant="purple" className="status-card">
            <div className="status-detail-list">
              <div className="status-detail-row">
                <span>Origin</span>
                <strong>{typeof window !== 'undefined' ? window.location.origin : 'n/a'}</strong>
              </div>
              <div className="status-detail-row">
                <span>Current route</span>
                <strong>{typeof window !== 'undefined' ? window.location.pathname : 'n/a'}</strong>
              </div>
              <div className="status-detail-row">
                <span>Signal carrier</span>
                <strong>{freq} Hz</strong>
              </div>
              <div className="status-detail-row">
                <span>Sample rate</span>
                <strong>{fs} Hz</strong>
              </div>
              <div className="status-detail-row">
                <span>Noise level</span>
                <strong>{(noiseLevel * 100).toFixed(1)}%</strong>
              </div>
              <div className="status-detail-row">
                <span>Waveform</span>
                <strong>{waveType}</strong>
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Endpoints" icon={<FiServer />} className="status-card">
            <div className="status-endpoint-grid">
              {endpointCards.map((endpoint) => (
                <div key={endpoint.label} className={`status-endpoint status-endpoint--${endpoint.tone}`}>
                  <strong>{endpoint.label}</strong>
                  <span>{endpoint.summary}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="status-column">
          <GlassCard title="Quantum Engine Snapshot" icon={<FiCpu />} variant="purple" className="status-card">
            <div className="status-snapshot-grid">
              <div className="status-snapshot-card">
                <span>Provider</span>
                <strong>{backendProvider}</strong>
              </div>
              <div className="status-snapshot-card">
                <span>Noise Model</span>
                <strong>{backendNoiseModel}</strong>
              </div>
              <div className="status-snapshot-card">
                <span>Default Shots</span>
                <strong>{backendShots || 'n/a'}</strong>
              </div>
              <div className="status-snapshot-card">
                <span>Discovered Backends</span>
                <strong>{availableBackends.length}</strong>
              </div>
            </div>

            <div className="status-backend-list">
              {availableBackends.length ? (
                availableBackends.map((backend) => {
                  const name = typeof backend === 'string' ? backend : backend.name;
                  const description =
                    typeof backend === 'string'
                      ? 'Backend reported by the API'
                      : backend.display_name || backend.description || 'Backend reported by the API';
                  const status = typeof backend === 'string' || backend.available !== false ? 'online' : 'warning';

                  return (
                    <div key={name} className="status-backend-list__item">
                      <div>
                        <strong>{name}</strong>
                        <span>{description}</span>
                      </div>
                      <StatusDot status={status} size={8} />
                    </div>
                  );
                })
              ) : (
                <div className="status-empty">
                  <StatusDot status="warning" size={8} label="Awaiting backend inventory" />
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard title="Latest Quantum Execution" icon={<FiActivity />} className="status-card">
            <div className="status-execution-grid">
              <div className="status-execution-cell">
                <span>Job Status</span>
                <strong>{jobStatus}</strong>
              </div>
              <div className="status-execution-cell">
                <span>Backend</span>
                <strong>{metrics.backendName || 'No completed run'}</strong>
              </div>
              <div className="status-execution-cell">
                <span>Execution Time</span>
                <strong>
                  <AnimatedNumber value={metrics.executionTime || 0} decimals={1} suffix=" ms" />
                </strong>
              </div>
              <div className="status-execution-cell">
                <span>Workflow Time</span>
                <strong>
                  <AnimatedNumber value={metrics.totalWorkflowTime || 0} decimals={1} suffix=" ms" />
                </strong>
              </div>
              <div className="status-execution-cell">
                <span>Fidelity Estimate</span>
                <strong>
                  <AnimatedNumber value={(metrics.fidelityEstimate || 0) * 100} decimals={1} suffix="%" />
                </strong>
              </div>
              <div className="status-execution-cell">
                <span>Top State</span>
                <strong>{topCountEntry[0] ? `|${topCountEntry[0]}>` : 'n/a'}</strong>
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Recent Experiments" icon={<FiDatabase />} className="status-card">
            <div className="status-history__summary">
              <span>Persistent SQLite run history</span>
              <strong>{experimentTotal} total</strong>
            </div>

            {experimentsError ? (
              <div className="status-history__empty">{experimentsError}</div>
            ) : experiments.length ? (
              <div className="status-history">
                {experiments.map((experiment) => (
                  <div key={experiment.id} className="status-history__row">
                    <div>
                      <strong>{experiment.circuit_type}</strong>
                      <span>{formatDateTime(experiment.created_at)}</span>
                    </div>
                    <div>
                      <strong>{experiment.backend_name}</strong>
                      <span>{experiment.noise_model}</span>
                    </div>
                    <div>
                      <strong>{topStateFromExperiment(experiment)}</strong>
                      <span>top state</span>
                    </div>
                    <div>
                      <strong>{((experiment.fidelity || 0) * 100).toFixed(1)}%</strong>
                      <span>fidelity</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="status-history__empty">
                {experimentsLoading ? 'Loading experiment history...' : 'No completed quantum runs have been stored yet.'}
              </div>
            )}
          </GlassCard>

          <GlassCard title="Raw Health Response" icon={<FiServer />} variant="success" className="status-card">
            <pre className="status-health-json">
              {healthData
                ? JSON.stringify(healthData, null, 2)
                : JSON.stringify({ status: healthError ? 'error' : 'checking', detail: healthError || 'Waiting for /health' }, null, 2)}
            </pre>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
