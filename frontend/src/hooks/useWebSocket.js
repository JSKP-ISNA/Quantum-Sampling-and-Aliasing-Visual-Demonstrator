import { useEffect, useRef, useCallback } from 'react';
import useSignalStore from '../store/useSignalStore';

// Use same-origin WebSocket URL so it works both in dev (via Vite proxy)
// and in production (via nginx reverse proxy). Falls back to localhost:8000
// only when window.location is unavailable (e.g. SSR).
function getWsUrl() {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/stream`;
  }
  return 'ws://localhost:8000/stream';
}

const WS_URL = getWsUrl();
const THROTTLE_MS = 50; // ~20 FPS max update rate

/**
 * Custom hook: connects to backend WebSocket, sends parameter
 * updates, and pushes received signal data into Zustand store.
 * Uses throttling to prevent React update depth overflows.
 */
export default function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const lastUpdateRef = useRef(0);
  const latestDataRef = useRef(null);
  const rafRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      useSignalStore.getState().setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        latestDataRef.current = data;

        // Throttle state updates using requestAnimationFrame
        const now = performance.now();
        if (now - lastUpdateRef.current >= THROTTLE_MS) {
          lastUpdateRef.current = now;
          // Use getState().setSignalData to avoid re-render cascades
          useSignalStore.getState().setSignalData(data);
        } else if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (latestDataRef.current) {
              lastUpdateRef.current = performance.now();
              useSignalStore.getState().setSignalData(latestDataRef.current);
            }
          });
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 2s...');
      useSignalStore.getState().setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  // Send parameter update to backend
  const sendParams = useCallback((params) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(params));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendParams };
}
