// Comprehensive Team Flag and Crest Resolver for International and League Cricket

export interface TeamFlagInfo {
  code: string;
  name: string;
  isoCode?: string;
  flagUrl: string;
  primaryColor: string;
  secondaryColor: string;
  isFranchise?: boolean;
}

// ISO country codes mapped to FlagCDN
export const NATIONAL_TEAM_MAP: Record<string, { iso: string; name: string; primary: string; secondary: string }> = {
  // Full Members
  'IND': { iso: 'in', name: 'India', primary: '#0078FF', secondary: '#FF9933' },
  'INDIA': { iso: 'in', name: 'India', primary: '#0078FF', secondary: '#FF9933' },
  'AUS': { iso: 'au', name: 'Australia', primary: '#FFCD00', secondary: '#005522' },
  'AUSTRALIA': { iso: 'au', name: 'Australia', primary: '#FFCD00', secondary: '#005522' },
  'ENG': { iso: 'gb-eng', name: 'England', primary: '#00205B', secondary: '#C8102E' },
  'ENGLAND': { iso: 'gb-eng', name: 'England', primary: '#00205B', secondary: '#C8102E' },
  'PAK': { iso: 'pk', name: 'Pakistan', primary: '#006629', secondary: '#FFFFFF' },
  'PAKISTAN': { iso: 'pk', name: 'Pakistan', primary: '#006629', secondary: '#FFFFFF' },
  'SA': { iso: 'za', name: 'South Africa', primary: '#007A4D', secondary: '#FFB612' },
  'RSA': { iso: 'za', name: 'South Africa', primary: '#007A4D', secondary: '#FFB612' },
  'SOUTH AFRICA': { iso: 'za', name: 'South Africa', primary: '#007A4D', secondary: '#FFB612' },
  'NZ': { iso: 'nz', name: 'New Zealand', primary: '#000000', secondary: '#FFFFFF' },
  'NEW ZEALAND': { iso: 'nz', name: 'New Zealand', primary: '#000000', secondary: '#FFFFFF' },
  'BAN': { iso: 'bd', name: 'Bangladesh', primary: '#006A4E', secondary: '#F42A41' },
  'BANGLADESH': { iso: 'bd', name: 'Bangladesh', primary: '#006A4E', secondary: '#F42A41' },
  'BD': { iso: 'bd', name: 'Bangladesh', primary: '#006A4E', secondary: '#F42A41' },
  'SL': { iso: 'lk', name: 'Sri Lanka', primary: '#1A365D', secondary: '#F59E0B' },
  'SRI LANKA': { iso: 'lk', name: 'Sri Lanka', primary: '#1A365D', secondary: '#F59E0B' },
  'AFG': { iso: 'af', name: 'Afghanistan', primary: '#000000', secondary: '#D32011' },
  'AFGHANISTAN': { iso: 'af', name: 'Afghanistan', primary: '#000000', secondary: '#D32011' },
  'IRE': { iso: 'ie', name: 'Ireland', primary: '#169B62', secondary: '#FF883E' },
  'IRELAND': { iso: 'ie', name: 'Ireland', primary: '#169B62', secondary: '#FF883E' },
  'ZIM': { iso: 'zw', name: 'Zimbabwe', primary: '#006400', secondary: '#FFD700' },
  'ZIMBABWE': { iso: 'zw', name: 'Zimbabwe', primary: '#006400', secondary: '#FFD700' },

  // Associate & Emerging Members
  'SCO': { iso: 'gb-sct', name: 'Scotland', primary: '#005EB8', secondary: '#FFFFFF' },
  'SCOTLAND': { iso: 'gb-sct', name: 'Scotland', primary: '#005EB8', secondary: '#FFFFFF' },
  'NED': { iso: 'nl', name: 'Netherlands', primary: '#FF4F00', secondary: '#21468B' },
  'NETHERLANDS': { iso: 'nl', name: 'Netherlands', primary: '#FF4F00', secondary: '#21468B' },
  'USA': { iso: 'us', name: 'United States', primary: '#002868', secondary: '#BF0A30' },
  'UNITED STATES': { iso: 'us', name: 'United States', primary: '#002868', secondary: '#BF0A30' },
  'NEP': { iso: 'np', name: 'Nepal', primary: '#DC143C', secondary: '#003893' },
  'NEPAL': { iso: 'np', name: 'Nepal', primary: '#DC143C', secondary: '#003893' },
  'OMA': { iso: 'om', name: 'Oman', primary: '#C8102E', secondary: '#008000' },
  'OMAN': { iso: 'om', name: 'Oman', primary: '#C8102E', secondary: '#008000' },
  'CAN': { iso: 'ca', name: 'Canada', primary: '#FF0000', secondary: '#FFFFFF' },
  'CANADA': { iso: 'ca', name: 'Canada', primary: '#FF0000', secondary: '#FFFFFF' },
  'NAM': { iso: 'na', name: 'Namibia', primary: '#002F6C', secondary: '#C8102E' },
  'NAMIBIA': { iso: 'na', name: 'Namibia', primary: '#002F6C', secondary: '#C8102E' },
  'UAE': { iso: 'ae', name: 'United Arab Emirates', primary: '#00732F', secondary: '#C8102E' },
  'PNG': { iso: 'pg', name: 'Papua New Guinea', primary: '#CE1126', secondary: '#FCD116' },
  'UGA': { iso: 'ug', name: 'Uganda', primary: '#000000', secondary: '#FCDC04' }
};

// Franchise teams mapping with official team colors
export const FRANCHISE_TEAMS: Record<string, { name: string; primary: string; secondary: string }> = {
  // IPL
  'CSK': { name: 'Chennai Super Kings', primary: '#FFFF00', secondary: '#0081E9' },
  'RCB': { name: 'Royal Challengers Bengaluru', primary: '#EC1C24', secondary: '#2B2A29' },
  'MI': { name: 'Mumbai Indians', primary: '#004BA0', secondary: '#D1AB3E' },
  'KKR': { name: 'Kolkata Knight Riders', primary: '#3A225D', secondary: '#ECC542' },
  'DC': { name: 'Delhi Capitals', primary: '#004C93', secondary: '#DC2626' },
  'RR': { name: 'Rajasthan Royals', primary: '#EA1A85', secondary: '#254AA5' },
  'PK': { name: 'Punjab Kings', primary: '#DD1F2D', secondary: '#A7A9AC' },
  'PBKS': { name: 'Punjab Kings', primary: '#DD1F2D', secondary: '#A7A9AC' },
  'SRH': { name: 'Sunrisers Hyderabad', primary: '#F7A721', secondary: '#000000' },
  'GT': { name: 'Gujarat Titans', primary: '#1C1C1C', secondary: '#BE9B5E' },
  'LSG': { name: 'Lucknow Super Giants', primary: '#A2D5EC', secondary: '#F58220' },

  // PSL
  'LQ': { name: 'Lahore Qalandars', primary: '#00A651', secondary: '#EE1C25' },
  'KK': { name: 'Karachi Kings', primary: '#0047AB', secondary: '#EE1C25' },
  'IU': { name: 'Islamabad United', primary: '#D81B60', secondary: '#FF8F00' },
  'PZ': { name: 'Peshawar Zalmi', primary: '#FED100', secondary: '#002B49' },
  'MS': { name: 'Multan Sultans', primary: '#005934', secondary: '#0047AB' },
  'QG': { name: 'Quetta Gladiators', primary: '#3B1E54', secondary: '#ECC542' },

  // BBL
  'SIX': { name: 'Sydney Sixers', primary: '#E3007F', secondary: '#000000' },
  'SCO': { name: 'Perth Scorchers', primary: '#F15A24', secondary: '#000000' },
  'HEA': { name: 'Brisbane Heat', primary: '#00B2A9', secondary: '#000000' },
  'STA': { name: 'Melbourne Stars', primary: '#00A850', secondary: '#000000' },
  'REN': { name: 'Melbourne Renegades', primary: '#ED1B24', secondary: '#000000' },
  'STR': { name: 'Adelaide Strikers', primary: '#0072CE', secondary: '#000000' },
  'HUR': { name: 'Hobart Hurricanes', primary: '#602D89', secondary: '#000000' },
  'THU': { name: 'Sydney Thunder', primary: '#A5C43C', secondary: '#000000' }
};

/**
 * Normalizes a raw team string into a clean key
 */
export function normalizeTeamKey(team: string): string {
  if (!team) return 'CRX';
  return team
    .toUpperCase()
    .replace(/\s*(MEN|WOMEN|U19|A)\s*$/i, '')
    .trim();
}

/**
 * Returns a robust, responsive flag or crest image URL for any team
 */
export function getTeamFlagUrl(teamNameOrCode: string): string {
  if (!teamNameOrCode) {
    return '/api/team/flag/CRX';
  }

  const raw = teamNameOrCode.trim();
  const upper = raw.toUpperCase();

  // If already pointing to our backend flag API
  if (raw.startsWith('/api/team/flag/') || raw.includes('/api/team/flag/')) {
    return raw;
  }

  // Handle West Indies specifically (Federation with maroon & palm tree crest)
  if (upper === 'WI' || upper === 'WEST INDIES' || upper.includes('WEST INDIES')) {
    return '/api/team/flag/WI';
  }

  // Check national team dictionary
  const nationalMatch = NATIONAL_TEAM_MAP[upper];
  if (nationalMatch) {
    return `https://flagcdn.com/w320/${nationalMatch.iso}.png`;
  }

  // Check by partial match in national teams
  for (const [key, data] of Object.entries(NATIONAL_TEAM_MAP)) {
    if (upper.includes(key) || key.includes(upper)) {
      return `https://flagcdn.com/w320/${data.iso}.png`;
    }
  }

  // For franchise and all other teams, route through our reliable backend flag endpoint
  const cleanCode = upper.replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'CRX';
  return `/api/team/flag/${encodeURIComponent(cleanCode)}`;
}

/**
 * Fallback Flag CDN URL for direct browser fallback
 */
export function getDirectFlagFallback(teamNameOrCode: string): string {
  const upper = (teamNameOrCode || '').toUpperCase().trim();
  const national = NATIONAL_TEAM_MAP[upper];
  if (national) {
    return `https://flagcdn.com/w320/${national.iso}.png`;
  }
  return `/api/team/flag/${encodeURIComponent(upper.slice(0, 4) || 'CRX')}`;
}

/**
 * Generates an inline SVG data URL for a team crest badge with official colors
 */
export function getTeamBadgeSvg(teamNameOrCode: string, primaryColor?: string, secondaryColor?: string): string {
  const code = (teamNameOrCode || 'CRX').toUpperCase().slice(0, 4);
  const pColor = primaryColor || '#1e3a8a';
  const sColor = secondaryColor || '#3b82f6';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g_${code}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pColor}"/>
        <stop offset="100%" stop-color="${sColor}"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#g_${code})" stroke="#ffffff" stroke-width="3" stroke-opacity="0.3"/>
    <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3,2" stroke-opacity="0.5"/>
    <text x="50" y="58" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${code.length > 3 ? '24' : '28'}" letter-spacing="0.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))">${code}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
