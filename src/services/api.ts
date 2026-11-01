import { Capacitor } from '@capacitor/core';
export function apiUrl(path: string) {
  if (!Capacitor.isNativePlatform()) return path;
  const base = localStorage.getItem('aether.apiBase') || '';
  if (!base) throw new Error('Configure an HTTPS companion server in Backup & Sync first. Local playback works without it.');
  const url = new URL(base);
  if (url.protocol !== 'https:') throw new Error('Companion server must use HTTPS');
  return new URL(path, url).href;
}
export async function requestApi(path: string, body?: unknown) {
  const response = await fetch(apiUrl(path), { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
