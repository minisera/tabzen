import type { NormalizeUrlOptions } from '@/shared/schema/settings';

export function normalizeUrl(raw: string, opts: NormalizeUrlOptions): string {
  try {
    const u = new URL(raw);
    if (opts.stripUtm) {
      const toDelete: string[] = [];
      u.searchParams.forEach((_, k) => {
        if (k.startsWith('utm_')) toDelete.push(k);
      });
      toDelete.forEach((k) => u.searchParams.delete(k));
    }
    if (opts.stripFragment) u.hash = '';
    let s = u.toString();
    if (opts.stripTrailingSlash) {
      s = s.replace(/\/(\?|#|$)/, '$1');
    }
    return s;
  } catch {
    return raw;
  }
}

export function matchDomain(host: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return host === base || host.endsWith('.' + base);
  }
  return host === pattern;
}

export function isAllowlisted(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  try {
    const host = new URL(url).hostname;
    return patterns.some((p) => matchDomain(host, p));
  } catch {
    return false;
  }
}
