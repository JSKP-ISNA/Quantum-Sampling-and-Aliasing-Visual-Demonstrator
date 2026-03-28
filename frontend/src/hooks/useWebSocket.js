import { useCallback, useEffect, useRef } from 'react';
import useSignalStore from '../store/useSignalStore';
import { getWsUrl } from '../lib/network';

const WS_URL = getWsUrl();
const THROTTLE_MS = 50;

export default function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const lastUpdateRef = useRef(0);
  const latestDataRef = useRef(null);
  const rafRef = useRef(null);

  const sendParams = useCallback((params) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(params));
    }
  }, []);

  useEffect(() => {
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected');
        useSignalStore.getState().setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          latestDataRef.current = data;

          const now = performance.now();
          if (now - lastUpdateRef.current >= THROTTLE_MS) {
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
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  return { sendParams };
}
