export function apiUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`apiUrl expected an absolute path, received "${path}"`);
  }

  if (typeof window !== 'undefined') {
    return path;
  }

  return `http://localhost:8000${path}`;
}

export function getWsUrl() {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/stream`;
  }

  return 'ws://localhost:8000/stream';
}
