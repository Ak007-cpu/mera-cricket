const KNOWN_BROKEN_APK_PATTERNS: RegExp[] = [
  /github\.com\/Ak007-cpu\/clode\.apk\.work\/releases\/download\/vi\.0\/app-release\.2\.apk/i
];

export function isKnownBrokenApkUrl(rawUrl?: string): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  return KNOWN_BROKEN_APK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function sanitizePublicApkUrl(
  rawUrl?: string,
  buildRelativeUrl?: (path: string) => string
): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|vbscript|data):/i.test(trimmed)) return '';
  if (isKnownBrokenApkUrl(trimmed)) return '';
  if (trimmed.startsWith('/')) {
    return buildRelativeUrl ? buildRelativeUrl(trimmed) : trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

export function extractApkFilename(url: string, fallback = 'live-cricket-app.apk'): string {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const base = clean.substring(clean.lastIndexOf('/') + 1);
    if (base && base.toLowerCase().endsWith('.apk')) {
      return base;
    }
  } catch {
    // Use fallback filename
  }
  return fallback;
}
