import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useSignalStore from '../store/useSignalStore';
import { getWsUrl } from '../lib/network';

const WS_URL = getWsUrl();
const OUTGOING_DEBOUNCE_MS = 75;

export default function useWebSocket() {
  const location = useLocation();
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const lastUpdateRef = useRef(0);
  const latestDataRef = useRef(null);
  const rafRef = useRef(null);
  const sendTimerRef = useRef(null);
  const pendingParamsRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const throttleMsRef = useRef(90);

  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/signal-lab') {
      throttleMsRef.current = 90;
    } else if (location.pathname === '/quantum-lab') {
      throttleMsRef.current = 150;
    } else {
      throttleMsRef.current = 300;
    }
  }, [location.pathname]);

  const flushPendingParams = useCallback(() => {
    sendTimerRef.current = null;

    if (wsRef.current?.readyState !== WebSocket.OPEN || !pendingParamsRef.current) {
      return;
    }

    wsRef.current.send(JSON.stringify(pendingParamsRef.current));
    pendingParamsRef.current = null;
  }, []);

  const sendParams = useCallback((params) => {
    pendingParamsRef.current = {
      ...(pendingParamsRef.current || {}),
      ...params,
    };

    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
    }

    sendTimerRef.current = setTimeout(flushPendingParams, OUTGOING_DEBOUNCE_MS);
  }, [flushPendingParams]);

  useEffect(() => {
    isUnmountingRef.current = false;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected');
        useSignalStore.getState().setConnected(true);
        pendingParamsRef.current ??= {
          freq: useSignalStore.getState().freq,
          fs: useSignalStore.getState().fs,
          noise_level: useSignalStore.getState().noiseLevel,
          wave_type: useSignalStore.getState().waveType,
        };
        flushPendingParams();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          latestDataRef.current = data;

          const now = performance.now();
          if (now - lastUpdateRef.current >= throttleMsRef.current) {
            lastUpdateRef.current = now;
            useSignalStore.getState().setSignalData(data);
            return;
          }

          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              if (latestDataRef.current) {
                lastUpdateRef.current = performance.now();
                useSignalStore.getState().setSignalData(latestDataRef.current);
              }
            });
          }
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 2s...');
        useSignalStore.getState().setConnected(false);
        if (!isUnmountingRef.current) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      isUnmountingRef.current = true;
      clearTimeout(reconnectTimer.current);
      clearTimeout(sendTimerRef.current);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      wsRef.current?.close();
    };
  }, [flushPendingParams]);

  return { sendParams };
}
