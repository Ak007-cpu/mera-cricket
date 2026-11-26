import { Request, Response } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { resolvePlayerProfile, normalizePlayerName, normalizeTeamCode } from '../src/data/playersRegistry';
import { crexService } from './crex-service';

// In-memory cache for player photos to ensure microsecond responses
const photoCache = new Map<string, { buffer: Buffer; contentType: string }>();

// Persistent disk cache directory for photos
const DISK_CACHE_DIR = path.resolve(process.cwd(), 'data', 'player-photos');
try {
  fsSync.mkdirSync(DISK_CACHE_DIR, { recursive: true });
} catch {}

// Team color mappings for clean, professional broadcast fallback badges
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  'WI': { primary: '#7B002C', secondary: '#FFD100' },
  'WEST INDIES': { primary: '#7B002C', secondary: '#FFD100' },
  'BAN': { primary: '#006A4E', secondary: '#F42A41' },
  'BANGLADESH': { primary: '#006A4E', secondary: '#F42A41' },
  'IND': { primary: '#0078FF', secondary: '#FF9933' },
  'INDIA': { primary: '#0078FF', secondary: '#FF9933' },
  'AUS': { primary: '#FFCD00', secondary: '#005522' },
  'AUSTRALIA': { primary: '#FFCD00', secondary: '#005522' },
  'PAK': { primary: '#006629', secondary: '#FFFFFF' },
  'PAKISTAN': { primary: '#006629', secondary: '#FFFFFF' },
  'ENG': { primary: '#00205B', secondary: '#C8102E' },
  'ENGLAND': { primary: '#00205B', secondary: '#C8102E' },
  'SA': { primary: '#007A4D', secondary: '#FFB612' },
  'RSA': { primary: '#007A4D', secondary: '#FFB612' },
  'SOUTH AFRICA': { primary: '#007A4D', secondary: '#FFB612' },
  'NZ': { primary: '#1A1A1A', secondary: '#FFFFFF' },
  'NEW ZEALAND': { primary: '#1A1A1A', secondary: '#FFFFFF' },
  'SL': { primary: '#1A365D', secondary: '#F59E0B' },
  'SRI LANKA': { primary: '#1A365D', secondary: '#F59E0B' },
  'AFG': { primary: '#1F2937', secondary: '#DC2626' },
  'AFGHANISTAN': { primary: '#1F2937', secondary: '#DC2626' },
  'CSK': { primary: '#FFFF00', secondary: '#0081E9' },
  'MI': { primary: '#004BA0', secondary: '#D1AB3E' },
  'RCB': { primary: '#2B2A29', secondary: '#EC1C24' },
  'KKR': { primary: '#3A225D', secondary: '#F7D54E' },
  'LQ': { primary: '#008000', secondary: '#FF0000' },
  'KK': { primary: '#004BA0', secondary: '#E31E24' },
  'SIX': { primary: '#E2007A', secondary: '#FFFFFF' },
  'SCO': { primary: '#F47920', secondary: '#000000' }
};

/**
 * Get player initials for fallback badge
 */
function getInitials(name: string): string {
  const cleaned = normalizePlayerName(name);
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || 'CR';
}

/**
 * Generates a clean, professional, broadcast-grade cricket player fallback badge SVG
 * Used strictly when no authentic photograph exists (Requirement 6)
 */
function generateCricketAvatarSvg(name: string, team: string, _jersey: number = 10): string {
  const upperTeam = (team || 'CRX').toUpperCase();
  const colors = TEAM_COLORS[upperTeam] || { primary: '#0f172a', secondary: '#38bdf8' };
  const initials = getInitials(name);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <radialGradient id="p_bg_${initials}" cx="35%" cy="25%" r="75%">
        <stop offset="0%" stop-color="${colors.primary}"/>
        <stop offset="65%" stop-color="#0a1226"/>
        <stop offset="100%" stop-color="#030712"/>
      </radialGradient>
      <linearGradient id="p_ring_${initials}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors.secondary}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.4"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#p_bg_${initials})"/>
    <circle cx="100" cy="100" r="92" stroke="url(#p_ring_${initials})" stroke-width="3" fill="none"/>
    <text x="100" y="118" text-anchor="middle" fill="#F8FAFC" font-family="'Orbitron', 'Rajdhani', system-ui, -apple-system, sans-serif" font-weight="800" font-size="64" letter-spacing="3">${initials}</text>
  </svg>`;
}

/**
 * Searches Wikidata for cricketer entity's authentic photograph (property P18)
 */
async function searchWikidataPhoto(name: string, team?: string): Promise<string | null> {
  try {
    const q = team ? `${name} ${team}` : name;
    const sUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json`;
    const sRes = await fetch(sUrl, {
      headers: { 'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)' },
      signal: AbortSignal.timeout(3500)
    });
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const item =
      sData?.search?.find((s: any) => {
        const desc = (s.description || '').toLowerCase();
        return desc.includes('crick') || (team && desc.includes(team.toLowerCase()));
      }) || sData?.search?.[0];
    if (!item?.id) return null;

    const cUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${item.id}&property=P18&format=json`;
    const cRes = await fetch(cUrl, {
      headers: { 'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)' },
      signal: AbortSignal.timeout(3500)
    });
    if (!cRes.ok) return null;
    const cData = await cRes.json();
    const fileName = cData?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!fileName) return null;

    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=400`;
  } catch {
    return null;
  }
}

/**
 * Searches Wikipedia PageImages API for cricketer photograph thumbnail
 */
async function searchWikipediaPageImages(name: string, team?: string): Promise<string | null> {
  const queries: string[] = [];
  if (team) {
    queries.push(`${name} ${team} cricket`);
  }
  queries.push(`${name} cricket`, `${name} (cricketer)`, name);

  for (const q of queries) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=pageimages&pithumbsize=400&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)' },
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) continue;
      const json = await res.json();
      const pages = json?.query?.pages;
      if (pages) {
        const firstPage = Object.values(pages)[0] as any;
        if (firstPage?.thumbnail?.source) {
          return firstPage.thumbnail.source;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Controller endpoint: GET /api/player/photo
 * Query parameters: name (required), team (optional), playerId (optional), fkey (optional), url (optional)
 */
export async function handlePlayerPhoto(req: Request, res: Response) {
  const rawName = ((req.query.name as string) || '').trim();
  const rawTeam = ((req.query.team as string) || 'CRX').trim();
  const rawPlayerId = ((req.query.playerId as string) || '').trim();
  const rawFkey = ((req.query.fkey as string) || '').trim();
  const directUrl = ((req.query.url as string) || '').trim();

  if (!rawName && !rawPlayerId && !rawFkey && !directUrl) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(generateCricketAvatarSvg('Player', 'CRX'));
  }

  const cleanName = normalizePlayerName(rawName);
  const cacheKey = `p_${cleanName.replace(/[^a-z0-9]/g, '_')}_${rawTeam.toLowerCase()}`;
  const diskPath = path.join(DISK_CACHE_DIR, `${cacheKey}.bin`);
  const metaPath = path.join(DISK_CACHE_DIR, `${cacheKey}.json`);

  // 0. Check Admin Custom Uploaded / URL Override Photo first
  if (cleanName) {
    const customPhoto = crexService.getCustomPlayerPhoto(cleanName, rawTeam);
    if (customPhoto) {
      if (customPhoto.startsWith('/api/player/uploaded/')) {
        return res.redirect(302, customPhoto);
      }
      if (customPhoto.startsWith('http://') || customPhoto.startsWith('https://')) {
        try {
          const customRes = await fetch(customPhoto, {
            headers: { 'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)' },
            signal: AbortSignal.timeout(4500)
          });
          if (customRes.ok) {
            const contentType = customRes.headers.get('content-type') || 'image/jpeg';
            const buffer = Buffer.from(await customRes.arrayBuffer());
            if (buffer.length > 200) {
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'no-cache');
              return res.send(buffer);
            }
          }
        } catch {}
      }
    }
  }

  // 1. Check in-memory cache
  if (photoCache.has(cacheKey)) {
    const cached = photoCache.get(cacheKey)!;
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached.buffer);
  }

  // 2. Check disk cache
  try {
    if (fsSync.existsSync(diskPath) && fsSync.existsSync(metaPath)) {
      const buffer = await fs.readFile(diskPath);
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      if (buffer.length > 500) {
        photoCache.set(cacheKey, { buffer, contentType: meta.contentType || 'image/jpeg' });
        res.setHeader('Content-Type', meta.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }
  } catch {}

  let photoUrl: string | undefined = undefined;

  // 3. Direct URL or fkey parameter
  if (directUrl && directUrl.startsWith('http')) {
    photoUrl = directUrl;
  } else if (rawFkey) {
    photoUrl = `https://cricketvectors.akamaized.net/players/org/${rawFkey}.png`;
  }

  // 4. Check dynamic live match player photo discovered from CREX
  if (!photoUrl && cleanName) {
    const livePhoto = crexService.getPlayerPhoto(cleanName, rawTeam);
    if (livePhoto) {
      photoUrl = livePhoto;
    }
  }

  // 5. Check verified player registry with strict team scoping
  if (!photoUrl) {
    const profile = resolvePlayerProfile(rawPlayerId, cleanName, rawTeam);
    if (profile?.imageUrl && !profile.imageUrl.includes('generic/male')) {
      photoUrl = profile.imageUrl;
    }
  }

  // 6. Search Wikidata for cricketer headshot photo with team hint
  if (!photoUrl && cleanName) {
    const wdPhoto = await searchWikidataPhoto(cleanName, rawTeam);
    if (wdPhoto) {
      photoUrl = wdPhoto;
    }
  }

  // 7. Search Wikipedia PageImages API with team hint
  if (!photoUrl && cleanName) {
    const wikiPhoto = await searchWikipediaPageImages(cleanName, rawTeam);
    if (wikiPhoto) {
      photoUrl = wikiPhoto;
    }
  }

  // 8. If photoUrl found, fetch authentic image buffer, cache in memory and on disk
  if (photoUrl) {
    try {
      const imgRes = await fetch(photoUrl, {
        headers: {
          'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (buffer.length > 800) {
          photoCache.set(cacheKey, { buffer, contentType });
          // Asynchronously persist to disk
          fs.writeFile(diskPath, buffer).catch(() => {});
          fs.writeFile(metaPath, JSON.stringify({ contentType, url: photoUrl })).catch(() => {});

          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buffer);
        }
      }
    } catch (fetchErr) {
      console.warn(`Failed fetching real player photo from ${photoUrl}:`, fetchErr);
    }
  }

  // 9. Clean professional vector cricket profile badge fallback (Requirement 6)
  const profile = resolvePlayerProfile(rawPlayerId, cleanName, rawTeam);
  const jerseyNum = profile?.jerseyNumber || 10;
  const svg = generateCricketAvatarSvg(cleanName || 'Player', rawTeam, jerseyNum);
  const buffer = Buffer.from(svg, 'utf-8');
  photoCache.set(cacheKey, { buffer, contentType: 'image/svg+xml' });

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(buffer);
}
