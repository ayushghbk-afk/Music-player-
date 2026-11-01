import { Capacitor } from '@capacitor/core';

export function apiUrl(path: string) {
  const staticHost = import.meta.env?.VITE_STATIC_HOST;
  const configured = localStorage.getItem('aether.apiBase') || import.meta.env?.VITE_API_BASE_URL || '';
  if (!Capacitor.isNativePlatform() && !staticHost) return path;
  if (!configured) throw new Error('This static website has no API server. Configure an HTTPS companion server in Backup & Sync to use AI or snapshot sync. Local playback and backup files work without it.');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Companion server must be an HTTPS origin without credentials');
  return new URL(path, url.origin).href;
}
export async function requestApi(path: string, body?: unknown) {
  const response = await fetch(apiUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Companion server did not return JSON. Check its URL and CORS settings in Backup & Sync.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
