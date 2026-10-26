import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAttackWebSocketUrl } from './wsUtils';

describe('WebSocket URL Resolution (getAttackWebSocketUrl)', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset env
    for (const key of Object.keys(import.meta.env)) {
      if (key.startsWith('VITE_')) {
        delete import.meta.env[key];
      }
    }
    globalThis.window = {
      location: new URL('http://localhost:3000')
    };
  });

  afterEach(() => {
    for (const key of Object.keys(import.meta.env)) {
      if (key.startsWith('VITE_')) {
        delete import.meta.env[key];
      }
    }
    Object.assign(import.meta.env, originalEnv);
    delete globalThis.window;
  });

  it('uses explicit VITE_WS_BASE_URL when provided with full path', () => {
    import.meta.env.VITE_WS_BASE_URL = 'wss://backend.railway.app/api/attacks/ws';
    expect(getAttackWebSocketUrl()).toBe('wss://backend.railway.app/api/attacks/ws');
  });

  it('appends /api/attacks/ws to explicit VITE_WS_BASE_URL without duplicating path or slashes', () => {
    import.meta.env.VITE_WS_BASE_URL = 'wss://backend.railway.app/';
    expect(getAttackWebSocketUrl()).toBe('wss://backend.railway.app/api/attacks/ws');
  });

  it('auto-upgrades explicit ws:// to wss:// when frontend is running on HTTPS', () => {
    globalThis.window.location = new URL('https://sentinel.vercel.app');
    import.meta.env.VITE_WS_BASE_URL = 'ws://backend.railway.app/api/attacks/ws';
    expect(getAttackWebSocketUrl()).toBe('wss://backend.railway.app/api/attacks/ws');
  });

  it('derives WebSocket URL from VITE_API_BASE_URL with /api suffix without duplicate segments', () => {
    import.meta.env.VITE_API_BASE_URL = 'https://sentinel-api.up.railway.app/api';
    expect(getAttackWebSocketUrl()).toBe('wss://sentinel-api.up.railway.app/api/attacks/ws');
  });

  it('derives WebSocket URL from VITE_API_BASE_URL without /api suffix', () => {
    import.meta.env.VITE_API_BASE_URL = 'https://sentinel-api.up.railway.app';
    expect(getAttackWebSocketUrl()).toBe('wss://sentinel-api.up.railway.app/api/attacks/ws');
  });

  it('prioritizes explicit VITE_WS_BASE_URL over VITE_API_BASE_URL', () => {
    import.meta.env.VITE_WS_BASE_URL = 'wss://custom-ws.example.com/api/attacks/ws';
    import.meta.env.VITE_API_BASE_URL = 'https://api.example.com/api';
    expect(getAttackWebSocketUrl()).toBe('wss://custom-ws.example.com/api/attacks/ws');
  });

  it('handles malformed VITE_API_BASE_URL by falling back safely', () => {
    globalThis.window.location = new URL('http://localhost:5173');
    import.meta.env.VITE_API_BASE_URL = 'invalid-not-a-url';
    expect(getAttackWebSocketUrl()).toBe('ws://127.0.0.1:8000/api/attacks/ws');
  });

  it('falls back to local port 8000 when running on dev port 5173 without env vars', () => {
    globalThis.window.location = new URL('http://localhost:5173');
    expect(getAttackWebSocketUrl()).toBe('ws://127.0.0.1:8000/api/attacks/ws');
  });

  it('falls back to same-origin wss when running on production HTTPS without env vars', () => {
    globalThis.window.location = new URL('https://sentinel-single-origin.com/dashboard');
    expect(getAttackWebSocketUrl()).toBe('wss://sentinel-single-origin.com/api/attacks/ws');
  });

  it('falls back to default localhost ws when window is undefined (SSR environment)', () => {
    delete globalThis.window;
    expect(getAttackWebSocketUrl()).toBe('ws://127.0.0.1:8000/api/attacks/ws');
  });
});
