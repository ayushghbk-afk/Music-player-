/** Public files must follow Vite's base on project Pages, but stay root-based in Capacitor. */
export function assetUrl(path: string, base = import.meta.env?.BASE_URL || '/') {
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}
