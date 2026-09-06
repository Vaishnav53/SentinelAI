/**
 * SentinelAI WebSocket Utility
 *
 * Resolves the real-time attack stream WebSocket URL cleanly across
 * development, reverse-proxy container, and cross-origin production (e.g. Vercel -> backend) environments.
 */

export function getAttackWebSocketUrl() {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  
  // 1. Explicit VITE_WS_BASE_URL environment variable
  let wsUrl = import.meta.env.VITE_WS_BASE_URL;
  if (wsUrl) {
    wsUrl = wsUrl.trim();
    // Auto-upgrade to wss: if frontend is served over HTTPS to avoid mixed-content blocking
    if (isHttps && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace(/^ws:\/\//, 'wss://');
    }
    if (!wsUrl.endsWith('/api/attacks/ws')) {
      wsUrl = wsUrl.replace(/\/+$/, '') + '/api/attacks/ws';
    }
    return wsUrl;
  }

  // 2. Derived from explicit VITE_API_BASE_URL (if configured as absolute URL)
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
    try {
      const parsed = new URL(apiBase);
      const derivedProto = (isHttps || parsed.protocol === 'https:') ? 'wss:' : 'ws:';
      return `${derivedProto}//${parsed.host}/api/attacks/ws`;
    } catch {
      // Fall through if URL parsing fails
    }
  }

  // 3. Local Vite dev server fallback (port 5173 -> backend 8000)
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `${wsProtocol}//127.0.0.1:8000/api/attacks/ws`;
  }

  // 4. Same-origin fallback (e.g. Nginx reverse proxy on port 80/443)
  if (typeof window !== 'undefined' && window.location.host) {
    return `${wsProtocol}//${window.location.host}/api/attacks/ws`;
  }

  return 'ws://127.0.0.1:8000/api/attacks/ws';
}
