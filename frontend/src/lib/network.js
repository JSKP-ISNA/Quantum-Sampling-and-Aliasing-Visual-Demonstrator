const DEV_HTTP_BACKEND = import.meta.env?.VITE_BACKEND_HTTP_URL || 'http://127.0.0.1:8000';
const DEV_WS_BACKEND = import.meta.env?.VITE_BACKEND_WS_URL || 'ws://127.0.0.1:8000';

function shouldUseDirectDevBackend() {
  return (
    typeof window !== 'undefined' &&
    import.meta.env?.DEV &&
    (window.location.port === '5173' || window.location.port === '4173')
  );
}

export function apiUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`apiUrl expected an absolute path, received "${path}"`);
  }

  if (typeof window !== 'undefined') {
    if (shouldUseDirectDevBackend()) {
      return `${DEV_HTTP_BACKEND}${path}`;
    }

    return path;
  }

  return `${DEV_HTTP_BACKEND}${path}`;
}

export function getWsUrl() {
  if (typeof window !== 'undefined') {
    if (shouldUseDirectDevBackend()) {
      return `${DEV_WS_BACKEND}/stream`;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/stream`;
  }

  return `${DEV_WS_BACKEND}/stream`;
}
