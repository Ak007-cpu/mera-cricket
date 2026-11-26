import { Request, Response } from 'express';
import { crexService } from './crex-service';

// Cache for flag images in memory to eliminate latency and network hops
const flagCache = new Map<string, { buffer: Buffer; contentType: string }>();

const ISO_MAP: Record<string, string> = {
  'IND': 'in',
  'INDIA': 'in',
  'AUS': 'au',
  'AUSTRALIA': 'au',
  'ENG': 'gb-eng',
  'ENGLAND': 'gb-eng',
  'PAK': 'pk',
  'PAKISTAN': 'pk',
  'SA': 'za',
  'RSA': 'za',
  'SOUTH AFRICA': 'za',
  'NZ': 'nz',
  'NEW ZEALAND': 'nz',
  'BAN': 'bd',
  'BANGLADESH': 'bd',
  'BD': 'bd',
  'SL': 'lk',
  'SRI LANKA': 'lk',
  'AFG': 'af',
  'AFGHANISTAN': 'af',
  'IRE': 'ie',
  'IRELAND': 'ie',
  'ZIM': 'zw',
  'ZIMBABWE': 'zw',
  'SCO': 'gb-sct',
  'SCOTLAND': 'gb-sct',
  'NED': 'nl',
  'NETHERLANDS': 'nl',
  'USA': 'us',
  'UNITED STATES': 'us',
  'NEP': 'np',
  'NEPAL': 'np',
  'OMA': 'om',
  'OMAN': 'om',
  'CAN': 'ca',
  'CANADA': 'ca',
  'NAM': 'na',
  'NAMIBIA': 'na',
  'UAE': 'ae',
  'UNITED ARAB EMIRATES': 'ae',
  'PNG': 'pg',
  'PAPUA NEW GUINEA': 'pg',
  'UGA': 'ug',
  'UGANDA': 'ug'
};

const FRANCHISE_COLORS: Record<string, { primary: string; secondary: string; name: string }> = {
  'CSK': { primary: '#FDB913', secondary: '#0081E9', name: 'Chennai Super Kings' },
  'RCB': { primary: '#EC1C24', secondary: '#1A1A1A', name: 'Royal Challengers' },
  'MI': { primary: '#004BA0', secondary: '#D1AB3E', name: 'Mumbai Indians' },
  'KKR': { primary: '#3A225D', secondary: '#ECC542', name: 'Kolkata Knight Riders' },
  'DC': { primary: '#004C93', secondary: '#DC2626', name: 'Delhi Capitals' },
  'RR': { primary: '#EA1A85', secondary: '#254AA5', name: 'Rajasthan Royals' },
  'PK': { primary: '#DD1F2D', secondary: '#A7A9AC', name: 'Punjab Kings' },
  'PBKS': { primary: '#DD1F2D', secondary: '#A7A9AC', name: 'Punjab Kings' },
  'SRH': { primary: '#F7A721', secondary: '#000000', name: 'Sunrisers Hyderabad' },
  'GT': { primary: '#1C1C1C', secondary: '#BE9B5E', name: 'Gujarat Titans' },
  'LSG': { primary: '#A2D5EC', secondary: '#F58220', name: 'Lucknow Super Giants' },
  'LQ': { primary: '#00A651', secondary: '#EE1C25', name: 'Lahore Qalandars' },
  'KK': { primary: '#0047AB', secondary: '#EE1C25', name: 'Karachi Kings' },
  'IU': { primary: '#D81B60', secondary: '#FF8F00', name: 'Islamabad United' },
  'PZ': { primary: '#FED100', secondary: '#002B49', name: 'Peshawar Zalmi' },
  'MS': { primary: '#005934', secondary: '#0047AB', name: 'Multan Sultans' },
  'QG': { primary: '#3B1E54', secondary: '#ECC542', name: 'Quetta Gladiators' },
  'SIX': { primary: '#E3007F', secondary: '#000000', name: 'Sydney Sixers' },
  'SCO': { primary: '#F15A24', secondary: '#000000', name: 'Perth Scorchers' }
};

/**
 * Returns official West Indies Cricket Board Maroon & Gold Crest Flag SVG
 */
function getWestIndiesFlagSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
    <rect width="160" height="100" rx="6" fill="#7B002C"/>
    <!-- Yellow Island/Sun circle -->
    <ellipse cx="80" cy="50" rx="36" ry="36" fill="#FFD100"/>
    <ellipse cx="80" cy="65" rx="32" ry="12" fill="#D4AF37"/>
    <!-- Palm Tree trunk and fronds -->
    <path d="M78 68 Q82 52 80 34 Q78 52 76 68 Z" fill="#5C2C16"/>
    <path d="M80 34 Q66 26 56 32 Q68 36 80 36 Z" fill="#006A4E"/>
    <path d="M80 34 Q94 26 104 32 Q92 36 80 36 Z" fill="#006A4E"/>
    <path d="M80 34 Q80 20 86 16 Q84 26 80 36 Z" fill="#006A4E"/>
    <path d="M80 34 Q68 40 60 48 Q72 44 80 36 Z" fill="#006A4E"/>
    <path d="M80 34 Q92 40 100 48 Q88 44 80 36 Z" fill="#006A4E"/>
    <!-- Cricket Stumps and Bails -->
    <rect x="74" y="52" width="2.5" height="18" fill="#FFFFFF"/>
    <rect x="79" y="52" width="2.5" height="18" fill="#FFFFFF"/>
    <rect x="84" y="52" width="2.5" height="18" fill="#FFFFFF"/>
    <rect x="73" y="50" width="14" height="2" fill="#FFFFFF"/>
    <!-- Banner text -->
    <text x="80" y="88" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="900" font-size="11" letter-spacing="1">WEST INDIES</text>
  </svg>`;
}

/**
 * Returns a styled franchise crest SVG
 */
function getFranchiseCrestSvg(code: string, primary: string, secondary: string, name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="crest_${code}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}"/>
        <stop offset="100%" stop-color="${secondary}"/>
      </linearGradient>
    </defs>
    <path d="M60 6 L108 24 L108 72 C108 96 60 114 60 114 C60 114 12 96 12 72 L12 24 Z" fill="url(#crest_${code})" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.4"/>
    <path d="M60 14 L100 29 L100 68 C100 88 60 104 60 104 C60 104 20 88 20 68 L20 29 Z" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="3,2" stroke-opacity="0.6"/>
    <!-- Star Emblem -->
    <polygon points="60,26 63,33 70,33 64,38 66,45 60,40 54,45 56,38 50,33 57,33" fill="#FFD700"/>
    <text x="60" y="70" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="22" letter-spacing="1" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">${code}</text>
    <rect x="24" y="78" width="72" height="14" rx="4" fill="#000000" fill-opacity="0.4"/>
    <text x="60" y="88" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-weight="700" font-size="7" letter-spacing="0.5">${name.slice(0, 14).toUpperCase()}</text>
  </svg>`;
}

/**
 * Returns a universal SVG shield for any custom team
 */
function getGenericTeamCrestSvg(code: string): string {
  // Generate consistent color hash
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="gen_${code}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${h1}, 70%, 40%)"/>
        <stop offset="100%" stop-color="hsl(${h2}, 80%, 25%)"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="46" fill="url(#gen_${code})" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.4"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="3,2" stroke-opacity="0.6"/>
    <text x="50" y="58" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="22" letter-spacing="1">${code.slice(0, 4)}</text>
  </svg>`;
}

/**
 * Controller endpoint: GET /api/team/flag/:teamCode
 */
export async function handleTeamFlag(req: Request, res: Response) {
  const rawParam = (req.params.teamCode || '').trim();
  const upper = rawParam.toUpperCase();

  // 0. Check Admin Custom Team Flag / Logo first
  const customFlag = crexService.getCustomTeamFlag(rawParam);
  if (customFlag) {
    if (customFlag.startsWith('/api/player/uploaded/')) {
      return res.redirect(302, customFlag);
    }
    if (customFlag.startsWith('http://') || customFlag.startsWith('https://')) {
      try {
        const customRes = await fetch(customFlag, {
          headers: { 'User-Agent': 'LiveCricketHD/2.0 (broadcast@livecricket.app)' },
          signal: AbortSignal.timeout(4500)
        });
        if (customRes.ok) {
          const contentType = customRes.headers.get('content-type') || 'image/png';
          const buffer = Buffer.from(await customRes.arrayBuffer());
          if (buffer.length > 100) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(buffer);
          }
        }
      } catch {}
    }
  }

  // 1. West Indies check
  if (upper === 'WI' || upper === 'WEST INDIES' || upper.includes('WEST INDIES')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(getWestIndiesFlagSvg());
  }

  // 2. Franchise teams check
  const franchise = FRANCHISE_COLORS[upper];
  if (franchise) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(getFranchiseCrestSvg(upper, franchise.primary, franchise.secondary, franchise.name));
  }

  // 3. National teams check via FlagCDN
  let iso = ISO_MAP[upper];
  if (!iso) {
    // Check if substring matches any national team
    for (const [key, val] of Object.entries(ISO_MAP)) {
      if (upper.includes(key) || key.includes(upper)) {
        iso = val;
        break;
      }
    }
  }

  if (iso) {
    // Check in-memory cache
    const cacheKey = `iso_${iso}`;
    if (flagCache.has(cacheKey)) {
      const cached = flagCache.get(cacheKey)!;
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    try {
      const flagUrl = `https://flagcdn.com/w160/${iso}.png`;
      const response = await fetch(flagUrl, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      flagCache.set(cacheKey, { buffer, contentType: 'image/png' });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      // If network fails to reach flagcdn, redirect directly to FlagCDN
      return res.redirect(`https://flagcdn.com/w80/${iso}.png`);
    }
  }

  // 4. Fallback: generate custom SVG shield
  const code = upper.replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'CRX';
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(getGenericTeamCrestSvg(code));
}
