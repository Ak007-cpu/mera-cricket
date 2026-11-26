import { normalizePlayerName, normalizeTeamCode } from '../data/playersRegistry';

const STORAGE_KEY = 'live_cricket_custom_media_v1';
export const MEDIA_UPDATED_EVENT = 'cricket-custom-media-updated';

interface StoredMediaStore {
  players: Record<string, string>;
  teams: Record<string, string>;
  sponsor: {
    logoUrl?: string;
    imageUrl?: string;
  };
}

const loadedImageUrls = new Set<string>();

export function markImageUrlLoaded(url?: string) {
  if (url && url.trim()) {
    loadedImageUrls.add(url.trim());
  }
}

export function isImageUrlLoaded(url?: string): boolean {
  return Boolean(url && loadedImageUrls.has(url.trim()));
}

function readStore(): StoredMediaStore {
  if (typeof window === 'undefined') {
    return { players: {}, teams: {}, sponsor: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { players: {}, teams: {}, sponsor: {} };
    const parsed = JSON.parse(raw);
    return {
      players: parsed?.players && typeof parsed.players === 'object' ? parsed.players : {},
      teams: parsed?.teams && typeof parsed.teams === 'object' ? parsed.teams : {},
      sponsor: parsed?.sponsor && typeof parsed.sponsor === 'object' ? parsed.sponsor : {}
    };
  } catch {
    return { players: {}, teams: {}, sponsor: {} };
  }
}

function writeStore(store: StoredMediaStore): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(MEDIA_UPDATED_EVENT));
    return true;
  } catch {
    // Prune heavy inline data: URIs while keeping compact Firebase/HTTP URLs intact
    try {
      const pruned: StoredMediaStore = {
        players: Object.fromEntries(
          Object.entries(store.players).filter(([, v]) => typeof v === 'string' && !v.startsWith('data:'))
        ),
        teams: Object.fromEntries(
          Object.entries(store.teams).filter(([, v]) => typeof v === 'string' && !v.startsWith('data:'))
        ),
        sponsor: {
          logoUrl:
            store.sponsor?.logoUrl && !store.sponsor.logoUrl.startsWith('data:')
              ? store.sponsor.logoUrl
              : undefined,
          imageUrl:
            store.sponsor?.imageUrl && !store.sponsor.imageUrl.startsWith('data:')
              ? store.sponsor.imageUrl
              : undefined
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      window.dispatchEvent(new CustomEvent(MEDIA_UPDATED_EVENT));
      return true;
    } catch (err) {
      console.warn('Browser localStorage media quota reached:', err);
      return false;
    }
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const body = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Resizes & compresses an uploaded image file cleanly inside browser canvas,
 * targeting a compact size so Firebase Storage uploads & browser caching are fast.
 */
export async function compressImageFile(
  file: File,
  maxDim = 280,
  maxBytes = 160_000
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (!rawDataUrl) {
    throw new Error('Empty image data');
  }

  // Keep small SVG as-is
  if (file.type === 'image/svg+xml' && rawDataUrl.length < 120_000) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || maxDim;
        const h = img.naturalHeight || img.height || maxDim;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const isAlphaCandidate =
          file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';

        let bestUrl = '';
        if (isAlphaCandidate) {
          // Try compact WebP first for transparent/alpha assets, then PNG
          const webpUrl = canvas.toDataURL('image/webp', 0.82);
          if (webpUrl.startsWith('data:image/webp') && webpUrl.length * 0.75 <= maxBytes) {
            bestUrl = webpUrl;
          } else {
            const pngUrl = canvas.toDataURL('image/png');
            bestUrl = pngUrl;
          }
        }

        if (!bestUrl || bestUrl.length * 0.75 > maxBytes) {
          const qualities = [0.82, 0.72, 0.6];
          for (const q of qualities) {
            const jpgUrl = canvas.toDataURL('image/jpeg', q);
            if (!bestUrl || jpgUrl.length < bestUrl.length) {
              bestUrl = jpgUrl;
            }
            if (jpgUrl.length * 0.75 <= maxBytes) {
              bestUrl = jpgUrl;
              break;
            }
          }
        }

        resolve(bestUrl && bestUrl.length < rawDataUrl.length ? bestUrl : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export function saveStoredPlayerPhoto(name: string, teamCode: string | undefined, url: string) {
  const clean = normalizePlayerName(name);
  if (!clean) return;
  const store = readStore();
  if (url && url.trim()) {
    const trimmed = url.trim();
    store.players[clean] = trimmed;
    if (teamCode) {
      const normTeam = normalizeTeamCode(teamCode);
      if (normTeam) store.players[`${normTeam}:${clean}`] = trimmed;
    }
  } else {
    delete store.players[clean];
    if (teamCode) {
      const normTeam = normalizeTeamCode(teamCode);
      if (normTeam) delete store.players[`${normTeam}:${clean}`];
    }
  }
  writeStore(store);
}

export function getStoredPlayerPhoto(name: string, teamCode?: string): string | undefined {
  const clean = normalizePlayerName(name);
  if (!clean) return undefined;
  const store = readStore();
  if (teamCode) {
    const normTeam = normalizeTeamCode(teamCode);
    if (normTeam && store.players[`${normTeam}:${clean}`]) {
      return store.players[`${normTeam}:${clean}`];
    }
  }
  return store.players[clean];
}

export function listStoredPlayerPhotos(): Record<string, string> {
  return readStore().players;
}

export function saveStoredTeamFlag(teamCode: string | undefined, teamName: string | undefined, url: string) {
  const store = readStore();
  const keys = [
    teamCode?.trim().toUpperCase(),
    teamCode ? normalizeTeamCode(teamCode) : '',
    teamName?.trim().toUpperCase()
  ].filter(Boolean) as string[];

  for (const k of keys) {
    if (url && url.trim()) {
      store.teams[k] = url.trim();
    } else {
      delete store.teams[k];
    }
  }
  writeStore(store);
}

export function getStoredTeamFlag(teamName?: string, teamCode?: string): string | undefined {
  const store = readStore();
  const keys = [
    teamCode?.trim().toUpperCase(),
    teamCode ? normalizeTeamCode(teamCode) : '',
    teamName?.trim().toUpperCase()
  ].filter(Boolean) as string[];
  for (const k of keys) {
    if (store.teams[k]) return store.teams[k];
  }
  return undefined;
}

export function listStoredTeamFlags(): Record<string, string> {
  return readStore().teams;
}

export function saveStoredSponsorMedia(patch: { logoUrl?: string; imageUrl?: string }) {
  const store = readStore();
  store.sponsor = {
    ...store.sponsor,
    ...patch
  };
  writeStore(store);
}

export function getStoredSponsorMedia(): { logoUrl?: string; imageUrl?: string } {
  return readStore().sponsor;
}
