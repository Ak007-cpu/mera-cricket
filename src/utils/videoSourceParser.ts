import { VideoSourceCategory, VideoSourceType } from '../types/cricket';
import {
  extractYouTubeVideoId,
  isYouTubeChannelLiveUrl
} from '../components/Common/HoldYouTubePlayer';

export const VIDEO_SOURCE_CATEGORIES: VideoSourceCategory[] = [
  'Main Feed',
  'Backup Feed',
  'Local Stream',
  'YouTube',
  'Highlights'
];

export function normalizeUrlForComparison(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  const ytId = extractYouTubeVideoId(trimmed);
  if (ytId) return `yt:${ytId}`;
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

export function inferDefaultSourceType(rawUrl: string): VideoSourceType {
  const trimmed = (rawUrl || '').trim();
  if (
    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed) ||
    /^[a-zA-Z0-9_-]{11}$/.test(trimmed)
  ) {
    return 'youtube';
  }
  const cleanPath = trimmed.split(/[?#]/)[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(cleanPath)) {
    return 'local_video';
  }
  return 'embed';
}

export function validateVideoSourceInput(
  rawUrl: string,
  requestedType: VideoSourceType
):
  | { ok: true; sourceType: VideoSourceType; url: string }
  | { ok: false; error: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      error: 'Stream ya Video URL khali hai — YouTube link, local video path, ya stream URL dalein.'
    };
  }

  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return {
      ok: false,
      error: 'Unsafe ya Base64 data URL allowed nahi hai. Valid https://, http://localhost, ya /path dalein.'
    };
  }

  const looksLikeYouTube =
    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed) ||
    /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

  if (requestedType === 'youtube' || looksLikeYouTube) {
    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      if (isYouTubeChannelLiveUrl(trimmed)) {
        return {
          ok: false,
          error:
            'YouTube channel /live URL embed nahi hota. Share button se https://youtu.be/... ya https://youtube.com/live/VIDEO_ID copy karke dalein.'
        };
      }
      return {
        ok: false,
        error:
          'Galat YouTube link! Sahih format: https://youtube.com/watch?v=... , https://youtu.be/... ya https://youtube.com/live/...'
      };
    }
    return {
      ok: true,
      sourceType: 'youtube',
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.length < 2 || /\s/.test(trimmed)) {
      return { ok: false, error: 'Galat local path format (e.g. /api/media/clip.mp4).' };
    }
    const cleanPath = trimmed.split(/[?#]/)[0].toLowerCase();
    const isDirectVideoFile = /\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(cleanPath);
    return {
      ok: true,
      sourceType: isDirectVideoFile ? 'local_video' : requestedType,
      url: trimmed.slice(0, 2000)
    };
  }

  if (/\s/.test(trimmed)) {
    return { ok: false, error: 'URL mein spaces allowed nahi hain.' };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalOrIp =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.includes('.');
    if (!isLocalOrIp) {
      return {
        ok: false,
        error:
          'Galat Stream URL! Poora URL dalein (e.g. https://..., http://localhost:8080/live, ya /api/media/...).'
      };
    }

    const resolvedUrl = parsed.toString().slice(0, 2000);
    const cleanPath = resolvedUrl.split(/[?#]/)[0].toLowerCase();
    if (requestedType === 'local_video' || /\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(cleanPath)) {
      return {
        ok: true,
        sourceType: 'local_video',
        url: resolvedUrl
      };
    }

    return {
      ok: true,
      sourceType: 'embed',
      url: resolvedUrl
    };
  } catch {
    return {
      ok: false,
      error: 'Galat URL format! Sahih http(s)://, local stream URL, ya YouTube link dalein.'
    };
  }
}

function splitCsvFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function looksLikeUrlCandidate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    /^https?:\/\//i.test(v) ||
    v.startsWith('/') ||
    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(v) ||
    /^(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$)/i.test(v) ||
    /^[a-zA-Z0-9_-]{11}$/.test(v)
  );
}

function matchCategory(raw: string, fallback: VideoSourceCategory): VideoSourceCategory {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return fallback;
  const found = VIDEO_SOURCE_CATEGORIES.find((c) => c.toLowerCase() === trimmed);
  if (found) return found;
  if (trimmed.includes('main')) return 'Main Feed';
  if (trimmed.includes('backup')) return 'Backup Feed';
  if (trimmed.includes('local')) return 'Local Stream';
  if (trimmed.includes('yt') || trimmed.includes('youtube')) return 'YouTube';
  if (trimmed.includes('highlight')) return 'Highlights';
  return fallback;
}

export function inferDefaultFeedName(
  rawUrl: string,
  sourceType: VideoSourceType,
  indexHint: number
): string {
  const trimmed = (rawUrl || '').trim();
  if (sourceType === 'youtube') {
    const ytId = extractYouTubeVideoId(trimmed);
    return ytId ? `YouTube Feed (${ytId})` : `YouTube Feed #${indexHint}`;
  }
  if (trimmed.startsWith('/')) {
    const seg = trimmed.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
    const cleanFile = seg.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (cleanFile) return cleanFile.slice(0, 120);
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./i, '');
    const lastSeg = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const cleanSeg = lastSeg.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (cleanSeg && cleanSeg.length <= 40) {
      return `${host} - ${cleanSeg}`.slice(0, 120);
    }
    return `${host} Feed #${indexHint}`.slice(0, 120);
  } catch {
    return `Broadcast Feed #${indexHint}`;
  }
}

export interface ParsedBatchVideoLine {
  key: string;
  lineNumber: number;
  rawLine: string;
  status: 'ready' | 'duplicate' | 'invalid';
  reason?: string;
  name: string;
  sourceType: VideoSourceType;
  url: string;
  normalizedKey: string;
  category: VideoSourceCategory;
  durationSec: number;
  notes: string;
}

export interface ParseBatchOptions {
  defaultCategory: VideoSourceCategory;
  defaultDurationSec: number;
  defaultTypeMode: 'auto' | VideoSourceType;
  existingNormalizedUrls: Set<string>;
  skipDuplicates: boolean;
  maxEntries?: number;
}

export function parseBatchVideoSourcesText(
  text: string,
  options: ParseBatchOptions
): ParsedBatchVideoLine[] {
  const maxEntries = options.maxEntries ?? 250;
  const lines = (text || '').split(/\r?\n/);
  const results: ParsedBatchVideoLine[] = [];
  const seenInBatch = new Set<string>();
  let pendingExtInfTitle = '';
  let validOrdinal = 1;

  for (let i = 0; i < lines.length; i += 1) {
    if (results.length >= maxEntries) break;
    const rawLine = lines[i].trim();
    const lineNumber = i + 1;
    if (!rawLine) continue;

    // Support M3U #EXTINF:-1, Channel Name metadata line
    if (/^#EXTINF:/i.test(rawLine)) {
      const commaIdx = rawLine.indexOf(',');
      if (commaIdx >= 0) {
        pendingExtInfTitle = rawLine.slice(commaIdx + 1).trim().slice(0, 120);
      }
      continue;
    }

    // Ignore other comments (#EXTM3U, # comment, // comment)
    if (rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    // Determine delimiter: pipe, tab, or comma (CSV)
    let cols: string[];
    if (rawLine.includes('|')) {
      cols = rawLine.split('|').map((c) => c.trim());
    } else if (rawLine.includes('\t')) {
      cols = rawLine.split('\t').map((c) => c.trim());
    } else if (rawLine.includes(',')) {
      cols = splitCsvFields(rawLine);
    } else {
      cols = [rawLine];
    }

    // Skip CSV/table header line if encountered
    if (
      cols.length >= 2 &&
      /^(name|title|feed|channel)$/i.test(cols[0]) &&
      /^(url|stream|link|stream_url)$/i.test(cols[1])
    ) {
      pendingExtInfTitle = '';
      continue;
    }

    let rawName = '';
    let rawUrl = '';
    let rawCat = '';
    let rawDur = '';
    let rawNotes = '';

    if (cols.length === 1) {
      rawUrl = cols[0];
    } else if (looksLikeUrlCandidate(cols[0]) && !looksLikeUrlCandidate(cols[1])) {
      // Allow "URL | Name | Category | Duration | Notes" order too
      rawUrl = cols[0];
      rawName = cols[1] || '';
      rawCat = cols[2] || '';
      rawDur = cols[3] || '';
      rawNotes = cols[4] || '';
    } else {
      rawName = cols[0] || '';
      rawUrl = cols[1] || '';
      rawCat = cols[2] || '';
      rawDur = cols[3] || '';
      rawNotes = cols[4] || '';
    }

    if (!rawName && pendingExtInfTitle) {
      rawName = pendingExtInfTitle;
    }
    pendingExtInfTitle = '';

    const requestedType: VideoSourceType =
      options.defaultTypeMode === 'auto'
        ? inferDefaultSourceType(rawUrl)
        : options.defaultTypeMode;

    const validated = validateVideoSourceInput(rawUrl, requestedType);
    if (!validated.ok) {
      results.push({
        key: `line_${lineNumber}_${results.length}`,
        lineNumber,
        rawLine,
        status: 'invalid',
        reason: validated.error,
        name: rawName || `Line ${lineNumber}`,
        sourceType: requestedType,
        url: rawUrl,
        normalizedKey: '',
        category: matchCategory(rawCat, options.defaultCategory),
        durationSec: options.defaultDurationSec,
        notes: rawNotes.slice(0, 300)
      });
      continue;
    }

    const normalizedKey = normalizeUrlForComparison(validated.url);
    const isDuplicate =
      options.skipDuplicates &&
      Boolean(normalizedKey) &&
      (options.existingNormalizedUrls.has(normalizedKey) || seenInBatch.has(normalizedKey));

    if (normalizedKey) {
      seenInBatch.add(normalizedKey);
    }

    const parsedDur = Number(rawDur);
    const durationSec =
      Number.isFinite(parsedDur) && parsedDur >= 3
        ? Math.max(3, Math.min(600, Math.round(parsedDur)))
        : Math.max(3, Math.min(600, Math.round(Number(options.defaultDurationSec) || 300)));

    const resolvedName = (
      rawName.trim() || inferDefaultFeedName(validated.url, validated.sourceType, validOrdinal)
    ).slice(0, 120);

    const inferredCat =
      rawCat.trim()
        ? matchCategory(rawCat, options.defaultCategory)
        : validated.sourceType === 'youtube' && options.defaultCategory === 'Main Feed'
        ? 'YouTube'
        : validated.sourceType === 'local_video' && options.defaultCategory === 'Main Feed'
        ? 'Local Stream'
        : options.defaultCategory;

    validOrdinal += 1;

    results.push({
      key: `line_${lineNumber}_${results.length}`,
      lineNumber,
      rawLine,
      status: isDuplicate ? 'duplicate' : 'ready',
      reason: isDuplicate ? 'Already saved or duplicated in this batch' : undefined,
      name: resolvedName,
      sourceType: validated.sourceType,
      url: validated.url,
      normalizedKey,
      category: inferredCat,
      durationSec,
      notes: rawNotes.trim().slice(0, 300)
    });
  }

  return results;
}

export const SAMPLE_BATCH_TEMPLATE = `# DATA VAULT SPORTS HD - Broadcast Schedule Batch Template
# Supported formats per line:
#   1) Plain URL: https://www.youtube.com/watch?v=VIDEO_ID
#   2) Name | URL
#   3) Name | URL | Category | DurationSec | Notes
#   4) CSV (Name, URL, Category) or M3U (#EXTINF:-1, Name)

PAK vs SL Main HD | https://www.youtube.com/watch?v=dQw4w9WgXcQ | Main Feed | 300 | Primary 1080p stream
Local OBS Backup | http://localhost:8080/live.html | Backup Feed | 300 | Local studio fallback
Match Highlights Clip | /api/media/highlights.mp4 | Highlights | 180 | Post-innings reel
`;
