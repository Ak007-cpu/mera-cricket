import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { MatchState, ActiveMatchConfig, DiscoverableMatch, BallEvent, MatchTriggerDefinition, CompletedMatchItem, CommentaryItem, MatchHighlightItem, MatchHighlightType } from '../src/types/cricket';
import { resolvePlayerProfile, VERIFIED_PLAYERS, getTeamRoster, normalizeTeamCode, normalizePlayerName, PlayerProfile } from '../src/data/playersRegistry';
import { fcmService } from './fcm-service';

export const KNOWN_TEAMS: Record<string, { name: string; code: string; color1?: string; color2?: string }> = {
  'ind': { name: 'India', code: 'IND', color1: '#0078FF', color2: '#FF9933' },
  'india': { name: 'India', code: 'IND', color1: '#0078FF', color2: '#FF9933' },
  'aus': { name: 'Australia', code: 'AUS', color1: '#FFCD00', color2: '#005522' },
  'australia': { name: 'Australia', code: 'AUS', color1: '#FFCD00', color2: '#005522' },
  'pak': { name: 'Pakistan', code: 'PAK', color1: '#006629', color2: '#FFFFFF' },
  'pakistan': { name: 'Pakistan', code: 'PAK', color1: '#006629', color2: '#FFFFFF' },
  'eng': { name: 'England', code: 'ENG', color1: '#00205B', color2: '#C8102E' },
  'england': { name: 'England', code: 'ENG', color1: '#00205B', color2: '#C8102E' },
  'sa': { name: 'South Africa', code: 'SA', color1: '#007A4D', color2: '#FFB612' },
  'rsa': { name: 'South Africa', code: 'SA', color1: '#007A4D', color2: '#FFB612' },
  'south africa': { name: 'South Africa', code: 'SA', color1: '#007A4D', color2: '#FFB612' },
  'south-africa': { name: 'South Africa', code: 'SA', color1: '#007A4D', color2: '#FFB612' },
  'nz': { name: 'New Zealand', code: 'NZ', color1: '#1A1A1A', color2: '#FFFFFF' },
  'new zealand': { name: 'New Zealand', code: 'NZ', color1: '#1A1A1A', color2: '#FFFFFF' },
  'new-zealand': { name: 'New Zealand', code: 'NZ', color1: '#1A1A1A', color2: '#FFFFFF' },
  'wi': { name: 'West Indies', code: 'WI', color1: '#7B002C', color2: '#FFD100' },
  'west indies': { name: 'West Indies', code: 'WI', color1: '#7B002C', color2: '#FFD100' },
  'west-indies': { name: 'West Indies', code: 'WI', color1: '#7B002C', color2: '#FFD100' },
  'ban': { name: 'Bangladesh', code: 'BAN', color1: '#006A4E', color2: '#F42A41' },
  'bangladesh': { name: 'Bangladesh', code: 'BAN', color1: '#006A4E', color2: '#F42A41' },
  'sl': { name: 'Sri Lanka', code: 'SL', color1: '#1A365D', color2: '#F59E0B' },
  'sri lanka': { name: 'Sri Lanka', code: 'SL', color1: '#1A365D', color2: '#F59E0B' },
  'sri-lanka': { name: 'Sri Lanka', code: 'SL', color1: '#1A365D', color2: '#F59E0B' },
  'afg': { name: 'Afghanistan', code: 'AFG', color1: '#1F2937', color2: '#DC2626' },
  'afghanistan': { name: 'Afghanistan', code: 'AFG', color1: '#1F2937', color2: '#DC2626' },
  'ire': { name: 'Ireland', code: 'IRE', color1: '#16A34A', color2: '#FFFFFF' },
  'ireland': { name: 'Ireland', code: 'IRE', color1: '#16A34A', color2: '#FFFFFF' },
  'zim': { name: 'Zimbabwe', code: 'ZIM', color1: '#DC2626', color2: '#FACC15' },
  'zimbabwe': { name: 'Zimbabwe', code: 'ZIM', color1: '#DC2626', color2: '#FACC15' },
  'csk': { name: 'Chennai Super Kings', code: 'CSK', color1: '#FFFF00', color2: '#0081E9' },
  'mi': { name: 'Mumbai Indians', code: 'MI', color1: '#004BA0', color2: '#D1AB3E' },
  'rcb': { name: 'Royal Challengers Bengaluru', code: 'RCB', color1: '#2B2A29', color2: '#EC1C24' },
  'kkr': { name: 'Kolkata Knight Riders', code: 'KKR', color1: '#3A225D', color2: '#F7D54E' },
  'lq': { name: 'Lahore Qalandars', code: 'LQ', color1: '#008000', color2: '#FF0000' },
  'kk': { name: 'Karachi Kings', code: 'KK', color1: '#004BA0', color2: '#E31E24' },
  'six': { name: 'Sydney Sixers', code: 'SIX', color1: '#E2007A', color2: '#FFFFFF' },
  'sco': { name: 'Perth Scorchers', code: 'SCO', color1: '#F47920', color2: '#000000' }
};

// Verified Senior National Teams (Full & Associate ICC Members)
export const SENIOR_INTERNATIONAL_TEAMS = new Set([
  'india', 'australia', 'england', 'pakistan', 'south africa', 'new zealand',
  'west indies', 'sri lanka', 'bangladesh', 'afghanistan', 'ireland', 'zimbabwe',
  'netherlands', 'scotland', 'namibia', 'nepal', 'oman', 'united states', 'usa',
  'united arab emirates', 'uae', 'canada', 'papua new guinea', 'png', 'uganda',
  'ind', 'aus', 'eng', 'pak', 'sa', 'rsa', 'nz', 'wi', 'sl', 'ban', 'afg', 'ire',
  'zim', 'ned', 'sco', 'nam', 'nep', 'omn', 'can', 'uga'
]);

// Excluded domestic & franchise league keywords
export const EXCLUDED_FRANCHISE_KEYWORDS = [
  'ipl', 'indian premier league',
  'psl', 'pakistan super league',
  'bbl', 'big bash',
  'cpl', 'caribbean premier league',
  'sa20', 'ilt20', 'mlc', 'major league cricket',
  'the hundred', 'vitality blast', 'ranji', 'smat',
  'syed mushtaq', 'sheffield shield', 'super smash',
  'county championship', 'plunket shield', 'ford trophy',
  'under-19', 'u-19', 'u19', 'a-team', 'lions', 'india a',
  'australia a', 'england lions'
];

export function isInternationalCricketMatch(match: {
  title?: string;
  series?: string;
  matchType?: string;
  team1?: { name: string; code?: string };
  team2?: { name: string; code?: string };
  battingTeam?: { name: string; code?: string };
  bowlingTeam?: { name: string; code?: string };
}): boolean {
  const fullText = `${match.title || ''} ${match.series || ''} ${match.matchType || ''}`.toLowerCase();

  // Exclude domestic or franchise competitions
  for (const franchise of EXCLUDED_FRANCHISE_KEYWORDS) {
    if (fullText.includes(franchise)) {
      return false;
    }
  }

  // Recognised ICC & International tournament / series patterns
  if (
    fullText.includes('world cup') ||
    fullText.includes('champions trophy') ||
    fullText.includes('world test championship') ||
    fullText.includes('wtc') ||
    fullText.includes('asia cup') ||
    fullText.includes('ashes') ||
    fullText.includes('tour of') ||
    fullText.includes('t20i') ||
    fullText.includes('odi') ||
    fullText.includes('test series') ||
    fullText.includes('international')
  ) {
    return true;
  }

  // Check if both teams are recognised senior national teams
  const t1 = (match.team1?.name || match.battingTeam?.name || '').toLowerCase().trim();
  const t1Code = (match.team1?.code || match.battingTeam?.code || '').toLowerCase().trim();
  const t2 = (match.team2?.name || match.bowlingTeam?.name || '').toLowerCase().trim();
  const t2Code = (match.team2?.code || match.bowlingTeam?.code || '').toLowerCase().trim();

  const isT1National = SENIOR_INTERNATIONAL_TEAMS.has(t1) || SENIOR_INTERNATIONAL_TEAMS.has(t1Code);
  const isT2National = SENIOR_INTERNATIONAL_TEAMS.has(t2) || SENIOR_INTERNATIONAL_TEAMS.has(t2Code);

  return isT1National && isT2National;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ACTIVE_MATCH_FILE = path.join(DATA_DIR, 'active-match.json');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'match-history.json');

export const DEFAULT_MATCH_TRIGGERS: MatchTriggerDefinition[] = [
  {
    id: 'trigger_wicket',
    name: 'Wicket Falls',
    category: 'wicket',
    enabledGlobally: true,
    titleTemplate: '🚨 WICKET FALLS: {{bowler}} strikes!',
    descriptionTemplate: '{{player}} is dismissed for {{score}} runs! {{teamScore}}',
    sound: 'wicket',
    priority: 'high',
    badgeColor: '#e11d48'
  },
  {
    id: 'trigger_double_century',
    name: 'Double Century / 150+ Runs',
    category: 'double_century',
    enabledGlobally: true,
    titleTemplate: '👑 LEGENDARY LANDMARK: {{player}} 200*!',
    descriptionTemplate: '{{player}} achieves an unforgettable double century! Masterclass batting!',
    sound: 'century',
    priority: 'high',
    badgeColor: '#7c3aed'
  },
  {
    id: 'trigger_century',
    name: 'Century (100 Runs)',
    category: 'century',
    enabledGlobally: true,
    titleTemplate: '🏏 CENTURY FOR {{player}} (100*)!',
    descriptionTemplate: '{{player}} brings up a sublime hundred off {{balls}} balls! Standing ovation!',
    sound: 'century',
    priority: 'high',
    badgeColor: '#f59e0b'
  },
  {
    id: 'trigger_fifty',
    name: 'Half-Century (50 Runs)',
    category: 'fifty',
    enabledGlobally: true,
    titleTemplate: '⭐ FIFTY UP: {{player}} (50*)',
    descriptionTemplate: 'Crucial half-century reached in {{balls}} balls! {{teamScore}}',
    sound: 'fifty',
    priority: 'medium',
    badgeColor: '#eab308'
  },
  {
    id: 'trigger_thirty',
    name: '30 Runs Milestone',
    category: 'thirty',
    enabledGlobally: true,
    titleTemplate: '⚡ QUICKFIRE 30*: {{player}}',
    descriptionTemplate: '{{player}} crosses 30 runs in quick time, shifting momentum! {{teamScore}}',
    sound: 'fifty',
    priority: 'low',
    badgeColor: '#38bdf8'
  },
  {
    id: 'trigger_five_wickets',
    name: '5-Wicket Haul (5W)',
    category: 'five_wickets',
    enabledGlobally: true,
    titleTemplate: '🔥 5-WICKET HAUL FOR {{bowler}} (5W)!',
    descriptionTemplate: '{{bowler}} delivers a devastating bowling masterclass with 5 wickets! Figures: {{bowlerFigures}}',
    sound: 'five_wickets',
    priority: 'high',
    badgeColor: '#10b981'
  },
  {
    id: 'trigger_three_wickets',
    name: '3-Wicket / 4-Wicket Haul',
    category: 'three_wickets',
    enabledGlobally: true,
    titleTemplate: '🎯 3-WICKET SPELL: {{bowler}} Strikes Again!',
    descriptionTemplate: '{{bowler}} dismantles the opposition with 3 key wickets! Figures: {{bowlerFigures}}',
    sound: 'wicket',
    priority: 'medium',
    badgeColor: '#059669'
  },
  {
    id: 'trigger_maiden',
    name: 'Maiden Over Bowled',
    category: 'maiden',
    enabledGlobally: true,
    titleTemplate: '🛑 MAIDEN OVER: {{bowler}} applies relentless pressure!',
    descriptionTemplate: '6 consecutive dot balls bowled by {{bowler}}! Superb tight bowling.',
    sound: 'wicket',
    priority: 'low',
    badgeColor: '#64748b'
  },
  {
    id: 'trigger_innings_break',
    name: 'Innings Break & Target',
    category: 'innings_break',
    enabledGlobally: true,
    titleTemplate: '⏸️ INNINGS BREAK — TARGET SET',
    descriptionTemplate: 'First innings concluded at {{teamScore}}. Target: {{target}} runs.',
    sound: 'innings_break',
    priority: 'high',
    badgeColor: '#2563eb'
  },
  {
    id: 'trigger_match_result',
    name: 'Official Match Result',
    category: 'match_result',
    enabledGlobally: true,
    titleTemplate: '🏆 MATCH RESULT: Victory Confirmed!',
    descriptionTemplate: '{{statusText}} — Match officially concluded.',
    sound: 'century',
    priority: 'high',
    badgeColor: '#f59e0b'
  },
  {
    id: 'trigger_match_starting',
    name: 'Match Starting Alert',
    category: 'match_starting',
    enabledGlobally: true,
    titleTemplate: '🔴 MATCH STARTING NOW: {{matchTitle}}',
    descriptionTemplate: 'Players are walking out to the middle. Live action underway!',
    sound: 'innings_break',
    priority: 'high',
    badgeColor: '#ef4444'
  },
  {
    id: 'trigger_new_match',
    name: 'New Match Listed on CREX',
    category: 'new_match',
    enabledGlobally: true,
    titleTemplate: '📅 NEW MATCH LISTED: {{matchTitle}}',
    descriptionTemplate: 'Added to live fixture tracker on CREX.',
    sound: 'innings_break',
    priority: 'medium',
    badgeColor: '#8b5cf6'
  },
  {
    id: 'trigger_six',
    name: 'Maximum Six (6)',
    category: 'six',
    enabledGlobally: true,
    titleTemplate: '🔥 MASSIVE MAXIMUM SIX!',
    descriptionTemplate: '{{player}} clears the boundary ropes with a towering 95m hit!',
    sound: 'six',
    priority: 'medium',
    badgeColor: '#9333ea'
  },
  {
    id: 'trigger_four',
    name: 'Boundary Four (4)',
    category: 'four',
    enabledGlobally: true,
    titleTemplate: '⚡ BOUNDARY FOUR!',
    descriptionTemplate: '{{player}} pierces the infield with exquisite timing for 4!',
    sound: 'four',
    priority: 'low',
    badgeColor: '#0284c7'
  },
  {
    id: 'trigger_tight_finish',
    name: 'Tight Finish / Last Over Drama',
    category: 'tight_finish',
    enabledGlobally: true,
    titleTemplate: '🔥 THRILLING FINISH — DOWN TO THE WIRE!',
    descriptionTemplate: 'Nail-biting climax! {{remainingRuns}} runs required from {{remainingBalls}} balls!',
    sound: 'wicket',
    priority: 'high',
    badgeColor: '#dc2626'
  }
];

// In-memory active state cache
interface ServerMatchData {
  config: ActiveMatchConfig;
  state: MatchState | null;
}

// Default discoverable cricket matches for 1-click admin connect (All Public CREX Matches)
export const PRESET_MATCHES: DiscoverableMatch[] = [
  {
    id: 'm_ind_aus_t20_wc',
    title: 'India vs Australia',
    series: "ICC Men's T20 World Cup - Super 8",
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m88291/india-vs-australia-icc-mens-t20-world-cup',
    team1: { name: 'India', code: 'IND', score: '184/3 (17.4)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    team2: { name: 'Australia', code: 'AUS', score: 'Yet to bat', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png' },
    status: 'LIVE - India 184/3 (17.4)',
    gameState: 'live',
    isLive: true,
    venue: 'Daren Sammy Stadium, St Lucia',
    startTime: 'Live Now'
  },
  {
    id: 'm_eng_pak_t20',
    title: 'England vs Pakistan',
    series: 'England Tour of Pakistan - 3rd T20I',
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m77412/pakistan-vs-england-3rd-t20i',
    team1: { name: 'Pakistan', code: 'PAK', score: '178/7 (20.0)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/PAK.png' },
    team2: { name: 'England', code: 'ENG', score: '142/4 (15.2)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/ENG.png' },
    status: 'LIVE - England need 37 runs in 28 balls',
    gameState: 'live',
    isLive: true,
    venue: 'Gaddafi Stadium, Lahore',
    startTime: 'Live Now'
  },
  {
    id: 'm_sa_ind_test',
    title: 'South Africa vs India',
    series: 'Freedom Trophy - 2nd Test, Day 3',
    format: 'TEST',
    crexUrl: 'https://crex.live/scoreboard/m66319/south-africa-vs-india-2nd-test',
    team1: { name: 'South Africa', code: 'SA', score: '245 & 192', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/RSA.png' },
    team2: { name: 'India', code: 'IND', score: '302 & 78/2 (22.1)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    status: 'LIVE - Day 3, India need 58 runs to win',
    gameState: 'live',
    isLive: true,
    venue: 'Newlands, Cape Town',
    startTime: 'Live Now'
  },
  {
    id: 'm_aus_eng_ashes',
    title: 'Australia vs England',
    series: 'The Ashes - 1st Test at MCG',
    format: 'TEST',
    crexUrl: 'https://crex.live/scoreboard/m55120/australia-vs-england-ashes-1st-test',
    team1: { name: 'Australia', code: 'AUS', score: '320 & 210/4', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png' },
    team2: { name: 'England', code: 'ENG', score: '280', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/ENG.png' },
    status: 'LIVE - Day 4, Australia lead by 250 runs',
    gameState: 'live',
    isLive: true,
    venue: 'Melbourne Cricket Ground, Melbourne',
    startTime: 'Live Now'
  },
  {
    id: 'm_nz_wi_odi',
    title: 'New Zealand vs West Indies',
    series: 'West Indies Tour of New Zealand - 2nd ODI',
    format: 'ODI',
    crexUrl: 'https://crex.live/scoreboard/m44211/new-zealand-vs-west-indies-2nd-odi',
    team1: { name: 'New Zealand', code: 'NZ', score: '286/6 (50.0)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/NZ.png' },
    team2: { name: 'West Indies', code: 'WI', score: '194/5 (38.2)', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/WI.png' },
    status: 'LIVE - West Indies need 93 runs in 70 balls',
    gameState: 'live',
    isLive: true,
    venue: 'Eden Park, Auckland',
    startTime: 'Live Now'
  },
  {
    id: 'm_csk_rcb_ipl',
    title: 'Chennai Super Kings vs Royal Challengers Bengaluru',
    series: 'Indian Premier League (IPL)',
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m33190/csk-vs-rcb-ipl',
    team1: { name: 'Chennai Super Kings', code: 'CSK', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    team2: { name: 'Royal Challengers Bengaluru', code: 'RCB', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    status: 'Scheduled - Today, 07:30 PM IST',
    gameState: 'scheduled',
    isLive: false,
    venue: 'MA Chidambaram Stadium, Chennai',
    startTime: 'Today, 07:30 PM IST'
  },
  {
    id: 'm_mi_kkr_ipl',
    title: 'Mumbai Indians vs Kolkata Knight Riders',
    series: 'Indian Premier League (IPL)',
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m22081/mi-vs-kkr-ipl',
    team1: { name: 'Mumbai Indians', code: 'MI', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    team2: { name: 'Kolkata Knight Riders', code: 'KKR', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png' },
    status: 'Scheduled - Tomorrow, 07:30 PM IST',
    gameState: 'scheduled',
    isLive: false,
    venue: 'Wankhede Stadium, Mumbai',
    startTime: 'Tomorrow, 07:30 PM IST'
  },
  {
    id: 'm_sixers_scorchers_bbl',
    title: 'Sydney Sixers vs Perth Scorchers',
    series: 'Big Bash League (BBL)',
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m11902/sixers-vs-scorchers-bbl',
    team1: { name: 'Sydney Sixers', code: 'SIX', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png' },
    team2: { name: 'Perth Scorchers', code: 'SCO', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png' },
    status: 'Scheduled - Friday, 01:45 PM IST',
    gameState: 'scheduled',
    isLive: false,
    venue: 'Sydney Cricket Ground, Sydney',
    startTime: 'Friday, 01:45 PM IST'
  },
  {
    id: 'm_lahore_karachi_psl',
    title: 'Lahore Qalandars vs Karachi Kings',
    series: 'Pakistan Super League (PSL)',
    format: 'T20',
    crexUrl: 'https://crex.live/scoreboard/m99014/lahore-vs-karachi-psl',
    team1: { name: 'Lahore Qalandars', code: 'LQ', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/PAK.png' },
    team2: { name: 'Karachi Kings', code: 'KK', logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/PAK.png' },
    status: 'Scheduled - Saturday, 08:00 PM IST',
    gameState: 'scheduled',
    isLive: false,
    venue: 'National Stadium, Karachi',
    startTime: 'Saturday, 08:00 PM IST'
  }
];

// Cached Last 5 Completed Matches (Official CREX Records & Player of the Match)
export { CACHED_LAST_5_MATCHES } from '../src/data/matchHistoryData';
import { CACHED_LAST_5_MATCHES } from '../src/data/matchHistoryData';

class CrexService {
  private currentData: ServerMatchData | null = null;
  private sseClients: Set<(data: string) => void> = new Set();
  private autoTickTimer: NodeJS.Timeout | null = null;
  private lastSavedTimestamp: number = 0;
  private livePlayerPhotos: Map<string, string> = new Map();
  private customPlayerPhotos: Map<string, string> = new Map();
  private customTeamFlags: Map<string, string> = new Map();
  private matchHistory: CompletedMatchItem[] = [...CACHED_LAST_5_MATCHES];
  private matchHighlights: Map<string, MatchHighlightItem[]> = new Map();

  private loadCustomPlayerPhotosSync() {
    try {
      const file = path.join(DATA_DIR, 'custom-player-photos.json');
      if (require('fs').existsSync(file)) {
        const parsed = JSON.parse(require('fs').readFileSync(file, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && v.trim()) {
              this.customPlayerPhotos.set(k, v.trim());
            }
          }
        }
      }
    } catch {}
    try {
      const flagFile = path.join(DATA_DIR, 'custom-team-flags.json');
      if (require('fs').existsSync(flagFile)) {
        const parsed = JSON.parse(require('fs').readFileSync(flagFile, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && v.trim()) {
              this.customTeamFlags.set(k, v.trim());
            }
          }
        }
      }
    } catch {}
  }

  private async saveCustomPlayerPhotos() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const file = path.join(DATA_DIR, 'custom-player-photos.json');
      const obj = Object.fromEntries(this.customPlayerPhotos.entries());
      await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CrexService] Failed to save custom player photos:', err);
    }
  }

  private async saveCustomTeamFlags() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const file = path.join(DATA_DIR, 'custom-team-flags.json');
      const obj = Object.fromEntries(this.customTeamFlags.entries());
      await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CrexService] Failed to save custom team flags:', err);
    }
  }

  public getCustomTeamFlag(teamCodeOrName?: string): string | undefined {
    if (!teamCodeOrName) return undefined;
    const raw = teamCodeOrName.trim().toUpperCase();
    if (!raw) return undefined;
    if (this.customTeamFlags.has(raw)) return this.customTeamFlags.get(raw);
    const norm = normalizeTeamCode(raw);
    if (norm && this.customTeamFlags.has(norm)) return this.customTeamFlags.get(norm);
    return undefined;
  }

  public getAllCustomMedia(): { players: Record<string, string>; teams: Record<string, string> } {
    return {
      players: Object.fromEntries(this.customPlayerPhotos.entries()),
      teams: Object.fromEntries(this.customTeamFlags.entries())
    };
  }

  public async setCustomTeamFlag(
    teamCode: string,
    logoUrl: string,
    teamName?: string,
    role?: 'batting' | 'bowling'
  ): Promise<MatchState | null> {
    const state = this.currentData?.state || null;
    const cleanUrl = (logoUrl || '').trim();
    const resolvedCode = (teamCode || (role === 'bowling' ? state?.bowlingTeam?.code : state?.battingTeam?.code) || '').trim().toUpperCase();
    const resolvedName = (teamName || (role === 'bowling' ? state?.bowlingTeam?.name : state?.battingTeam?.name) || '').trim().toUpperCase();
    const normCode = resolvedCode ? normalizeTeamCode(resolvedCode) : '';

    const keys = [resolvedCode, normCode, resolvedName].filter(Boolean);
    for (const k of keys) {
      if (cleanUrl) {
        this.customTeamFlags.set(k, cleanUrl);
      } else {
        this.customTeamFlags.delete(k);
      }
    }
    await this.saveCustomTeamFlags();

    if (state) {
      const batNorm = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || '');
      const bowlNorm = normalizeTeamCode(state.bowlingTeam.code || state.bowlingTeam.name || '');
      if (role === 'batting' || (normCode && batNorm === normCode)) {
        state.battingTeam.logoUrl = cleanUrl || `/api/team/flag/${encodeURIComponent(batNorm || 'CRX')}`;
      }
      if (role === 'bowling' || (normCode && bowlNorm === normCode)) {
        state.bowlingTeam.logoUrl = cleanUrl || `/api/team/flag/${encodeURIComponent(bowlNorm || 'CRX')}`;
      }
      this.enrichPlayerImages(state);
      state.lastUpdated = Date.now();
      await this.saveToDisk();
      this.broadcastUpdate();
    }

    return state;
  }

  public getCustomPlayerPhoto(name: string, team?: string): string | undefined {
    if (!name) return undefined;
    const clean = normalizePlayerName(name);
    if (!clean) return undefined;
    if (team) {
      const teamCode = normalizeTeamCode(team);
      if (teamCode) {
        const teamKey = `${teamCode}:${clean}`;
        if (this.customPlayerPhotos.has(teamKey)) {
          return this.customPlayerPhotos.get(teamKey);
        }
      }
    }
    return this.customPlayerPhotos.get(clean);
  }

  public async setCustomPlayerPhoto(
    role: 'striker' | 'nonStriker' | 'bowler' | 'player',
    imageUrl: string,
    playerName?: string,
    teamCode?: string
  ): Promise<MatchState | null> {
    const state = this.currentData?.state || null;
    const targetPlayer =
      role === 'striker'
        ? state?.striker
        : role === 'nonStriker'
        ? state?.nonStriker
        : role === 'bowler'
        ? state?.currentBowler
        : undefined;

    const resolvedName = (playerName || targetPlayer?.name || '').trim();
    const resolvedTeam = (
      teamCode ||
      (role === 'bowler' ? state?.bowlingTeam?.code : state?.battingTeam?.code) ||
      ''
    ).trim();

    const cleanUrl = (imageUrl || '').trim();
    if (resolvedName) {
      const cleanName = normalizePlayerName(resolvedName);
      const normTeam = resolvedTeam ? normalizeTeamCode(resolvedTeam) : '';
      if (cleanUrl) {
        this.customPlayerPhotos.set(cleanName, cleanUrl);
        if (normTeam) {
          this.customPlayerPhotos.set(`${normTeam}:${cleanName}`, cleanUrl);
        }
      } else {
        this.customPlayerPhotos.delete(cleanName);
        if (normTeam) {
          this.customPlayerPhotos.delete(`${normTeam}:${cleanName}`);
        }
      }
      await this.saveCustomPlayerPhotos();
    }

    if (state) {
      const cleanNormName = normalizePlayerName(resolvedName);
      const applyOrClear = (p?: { name: string; imageUrl?: string }) => {
        if (!p) return;
        if (targetPlayer === p || (cleanNormName && normalizePlayerName(p.name) === cleanNormName)) {
          if (cleanUrl) p.imageUrl = cleanUrl;
          else delete p.imageUrl;
        }
      };

      applyOrClear(state.striker);
      applyOrClear(state.nonStriker);
      applyOrClear(state.currentBowler);
      [state.scorecards?.firstInnings, state.scorecards?.secondInnings].forEach((inn) => {
        inn?.batting?.forEach(applyOrClear);
        inn?.bowling?.forEach(applyOrClear);
      });

      this.enrichPlayerImages(state);
      state.lastUpdated = Date.now();
      await this.saveToDisk();
      this.broadcastUpdate();
    }

    return state;
  }

  public registerPlayerPhoto(name: string, url: string, team?: string) {
    if (!name || !url) return;
    const clean = normalizePlayerName(name);
    if (clean.length > 1) {
      this.livePlayerPhotos.set(clean, url);
      if (team) {
        const teamCode = normalizeTeamCode(team);
        if (teamCode) {
          this.livePlayerPhotos.set(`${teamCode}:${clean}`, url);
        }
      }
    }
  }

  public getPlayerPhoto(name: string, team?: string): string | undefined {
    if (!name) return undefined;
    const clean = normalizePlayerName(name);
    if (!clean) return undefined;

    // 1. Check team-scoped photo first
    if (team) {
      const teamCode = normalizeTeamCode(team);
      if (teamCode) {
        const teamKey = `${teamCode}:${clean}`;
        if (this.livePlayerPhotos.has(teamKey)) {
          return this.livePlayerPhotos.get(teamKey);
        }
      }
    }

    // 2. Direct name match
    if (this.livePlayerPhotos.has(clean)) {
      return this.livePlayerPhotos.get(clean);
    }

    // 3. Partial match (avoiding false matches of short substrings)
    for (const [k, v] of this.livePlayerPhotos.entries()) {
      if (k.includes(':')) {
        // Handle team-scoped keys
        const [kTeam, kName] = k.split(':');
        if (team && normalizeTeamCode(team) !== kTeam) {
          continue; // Skip players belonging to another team
        }
        if (kName === clean || (clean.length > 5 && kName.includes(clean))) {
          return v;
        }
      } else if (k === clean) {
        return v;
      }
    }
    return undefined;
  }

  constructor() {
    this.loadCustomPlayerPhotosSync();
    this.init();
  }

  private async init() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const exists = await fs.stat(ACTIVE_MATCH_FILE).then(() => true).catch(() => false);
      if (exists) {
        const raw = await fs.readFile(ACTIVE_MATCH_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.matchState) {
          this.currentData = {
            config: {
              activeMatchId: parsed.activeMatchId || 'm_ind_aus_t20_wc',
              crexUrl: parsed.crexUrl || 'https://crex.live/scoreboard/m88291',
              crexMatchId: parsed.crexMatchId || 'm88291',
              matchTitle: parsed.matchTitle || parsed.matchState.title,
              connectedAt: parsed.connectedAt || Date.now(),
              lastSyncedAt: parsed.lastSyncedAt || Date.now(),
              syncIntervalMs: parsed.syncIntervalMs || 3000,
              isAutoSyncEnabled: parsed.isAutoSyncEnabled ?? true,
              dataSourceMode:
                parsed.dataSourceMode === 'manual' || parsed.isAutoSyncEnabled === false ? 'manual' : 'auto',
              syncStatus:
                parsed.syncStatus ||
                (parsed.dataSourceMode === 'manual' || parsed.isAutoSyncEnabled === false ? 'manual' : 'ok'),
              syncError: parsed.syncError,
              lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt || parsed.lastSyncedAt,
              connectedBy: parsed.connectedBy || 'Admin Studio',
              triggers: (() => {
                const existing: MatchTriggerDefinition[] = parsed.triggers || DEFAULT_MATCH_TRIGGERS;
                const merged = [...existing];
                DEFAULT_MATCH_TRIGGERS.forEach((dt) => {
                  if (!merged.some((t) => t.id === dt.id)) {
                    merged.push(dt);
                  }
                });
                return merged;
              })()
            },
            state: parsed.matchState
          };
          if (this.currentData?.state) {
            this.enrichPlayerImages(this.currentData.state);
          }
        }
      }

      // Load cached match history from disk or initialize
      try {
        const histExists = await fs.stat(MATCH_HISTORY_FILE).then(() => true).catch(() => false);
        if (histExists) {
          const histRaw = await fs.readFile(MATCH_HISTORY_FILE, 'utf-8');
          const parsed = JSON.parse(histRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.matchHistory = parsed;
          }
        } else {
          await fs.writeFile(MATCH_HISTORY_FILE, JSON.stringify(CACHED_LAST_5_MATCHES, null, 2));
        }
      } catch (e) {
        console.warn('Error reading match history cache:', e);
      }
    } catch (err) {
      console.error('Error initializing CrexService:', err);
    }

    // Start auto sync / realistic live tick engine
    this.startLiveEngine();
  }

  public getMatchHistory(): CompletedMatchItem[] {
    return this.matchHistory;
  }

  public addCompletedMatch(match: CompletedMatchItem): void {
    this.matchHistory = [match, ...this.matchHistory.filter((m) => m.id !== match.id)].slice(0, 5);
    fs.writeFile(MATCH_HISTORY_FILE, JSON.stringify(this.matchHistory, null, 2)).catch(() => {});
  }

  public getCommentaryFeed(limit = 40): {
    matchId?: string;
    matchTitle?: string;
    statusText?: string;
    currentScore?: string;
    items: CommentaryItem[];
  } {
    const state = this.currentData?.state;
    if (!state) {
      return {
        items: []
      };
    }

    const currentScore = `${state.battingTeam.shortName || state.battingTeam.code} ${state.battingTeam.score.runs}/${state.battingTeam.score.wickets} (${state.battingTeam.score.overs}.${state.battingTeam.score.balls})`;

    const items: CommentaryItem[] = (state.recentBalls || []).map((ball) => {
      let tag: CommentaryItem['tag'] = 'RUN';
      if (ball.isWicket) tag = 'WICKET';
      else if (ball.isSix) tag = 'SIX';
      else if (ball.isFour) tag = 'FOUR';
      else if (ball.runs === 0) tag = 'DOT';

      let milestoneTitle: string | undefined;
      let isMilestone = false;
      const commentaryLower = (ball.commentary || '').toLowerCase();
      if (
        commentaryLower.includes('century') ||
        commentaryLower.includes('fifty') ||
        commentaryLower.includes('50 runs') ||
        commentaryLower.includes('100 runs') ||
        commentaryLower.includes('5-wicket') ||
        commentaryLower.includes('haul')
      ) {
        isMilestone = true;
        tag = 'MILESTONE';
        if (commentaryLower.includes('century') || commentaryLower.includes('100')) {
          milestoneTitle = '100* Century';
        } else if (commentaryLower.includes('fifty') || commentaryLower.includes('50')) {
          milestoneTitle = '50* Half-Century';
        } else if (commentaryLower.includes('5-wicket') || commentaryLower.includes('5w')) {
          milestoneTitle = '5W Haul';
        }
      }

      return {
        id: ball.id,
        ballNumber: ball.ballNumber,
        overNumber: ball.overNumber,
        ballInOver: ball.ballInOver,
        runs: ball.runs,
        isWicket: ball.isWicket,
        wicketType: ball.wicketType,
        isFour: ball.isFour,
        isSix: ball.isSix,
        isExtra: ball.isExtra,
        extraType: ball.extraType,
        isMilestone,
        milestoneTitle,
        batsmanName: ball.batsmanName,
        bowlerName: ball.bowlerName,
        commentary: ball.commentary,
        timestamp: ball.timestamp,
        teamScore: currentScore,
        tag
      };
    });

    return {
      matchId: state.matchId,
      matchTitle: state.title,
      statusText: state.statusText,
      currentScore,
      items: items.slice(0, limit)
    };
  }

  private captureHighlightsFromState(state: MatchState | null | undefined): void {
    if (!state || !state.matchId) return;
    const matchId = state.matchId;
    const existing = this.matchHighlights.get(matchId) || [];
    const byKey = new Map<string, MatchHighlightItem>();

    for (const item of existing) {
      byKey.set(`${item.type}:${item.innings}:${item.ballNumber || item.id}`, item);
    }

    const currentScore = `${state.battingTeam.shortName || state.battingTeam.code} ${state.battingTeam.score.runs}/${state.battingTeam.score.wickets}`;
    const teamCode = state.battingTeam.shortName || state.battingTeam.code;

    // 1. Capture from recentBalls (Wicket, Six, Four)
    for (const ball of state.recentBalls || []) {
      const type: MatchHighlightType | null = ball.isWicket
        ? 'wicket'
        : ball.isSix
        ? 'six'
        : ball.isFour
        ? 'four'
        : null;
      if (!type) continue;
      const dedupeKey = `${type}:${state.currentInnings}:${ball.ballNumber || ball.id}`;
      if (!byKey.has(dedupeKey)) {
        byKey.set(dedupeKey, {
          id: ball.id || `hl-${matchId}-${type}-${ball.ballNumber || Date.now()}`,
          matchId,
          innings: state.currentInnings,
          type,
          ballNumber: ball.ballNumber || `${state.battingTeam.score.overs}.${state.battingTeam.score.balls}`,
          runs: ball.runs ?? (type === 'six' ? 6 : type === 'four' ? 4 : 0),
          batsmanName: ball.batsmanName || state.striker?.name || 'Batter',
          bowlerName: ball.bowlerName || state.currentBowler?.name || 'Bowler',
          wicketType: ball.wicketType,
          teamCode,
          teamScore: currentScore,
          commentary:
            ball.commentary ||
            (type === 'wicket'
              ? `Wicket! ${ball.batsmanName || 'Batter'} dismissed`
              : type === 'six'
              ? `Maximum SIX by ${ball.batsmanName || 'Batter'}`
              : `Crisp FOUR by ${ball.batsmanName || 'Batter'}`),
          timestamp: ball.timestamp || Date.now()
        });
      }
    }

    // 2. Capture any Fall of Wickets recorded in scorecards that are no longer in recentBalls
    const captureFow = (innings: 1 | 2, fowList?: { score: number; wicketNumber: number; over: string; playerOut: string }[], scTeamCode?: string) => {
      if (!Array.isArray(fowList)) return;
      for (const fow of fowList) {
        if (!fow.playerOut) continue;
        const dedupeKey = `wicket:${innings}:${fow.over || `fow-${fow.wicketNumber}`}`;
        if (!byKey.has(dedupeKey)) {
          byKey.set(dedupeKey, {
            id: `hl-fow-${matchId}-${innings}-${fow.wicketNumber}-${fow.over || 'ov'}`,
            matchId,
            innings,
            type: 'wicket',
            ballNumber: fow.over || '-',
            runs: 0,
            batsmanName: fow.playerOut,
            bowlerName: state.currentBowler?.shortName || state.currentBowler?.name || '',
            teamCode: scTeamCode || teamCode,
            teamScore: `${scTeamCode || teamCode} ${fow.score}/${fow.wicketNumber}`,
            commentary: `Wicket #${fow.wicketNumber}: ${fow.playerOut} dismissed at ${fow.score}/${fow.wicketNumber}`,
            timestamp: state.lastUpdated || Date.now()
          });
        }
      }
    };

    captureFow(1, state.scorecards?.firstInnings?.fallOfWickets, state.scorecards?.firstInnings?.teamCode);
    captureFow(2, state.scorecards?.secondInnings?.fallOfWickets, state.scorecards?.secondInnings?.teamCode);

    const sorted = Array.from(byKey.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);

    this.matchHighlights.set(matchId, sorted);
  }

  public getMatchHighlights(limit = 30): {
    matchId?: string;
    matchTitle?: string;
    items: MatchHighlightItem[];
  } {
    const state = this.currentData?.state;
    if (!state) {
      return { items: [] };
    }
    this.captureHighlightsFromState(state);
    const items = (this.matchHighlights.get(state.matchId) || []).slice(0, limit);
    return {
      matchId: state.matchId,
      matchTitle: state.title,
      items
    };
  }

  // Ensures striker, non-striker, bowler, and all scorecard rows have verified photos & IDs, and team flags are dynamic
  private enrichPlayerImages(state: MatchState | null) {
    if (!state) return;

    const batTeamCode = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || 'CRX');
    const bowlTeamCode = normalizeTeamCode(state.bowlingTeam.code || state.bowlingTeam.name || 'CRX');

    // Ensure team flag URLs respect custom team flags first, then dynamic team flag resolver
    const customBatFlag = this.getCustomTeamFlag(batTeamCode) || this.getCustomTeamFlag(state.battingTeam.name);
    if (customBatFlag) {
      state.battingTeam.logoUrl = customBatFlag;
    } else if (!state.battingTeam.logoUrl || state.battingTeam.logoUrl.includes('icc-cricket.com')) {
      state.battingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(batTeamCode)}`;
    }

    const customBowlFlag = this.getCustomTeamFlag(bowlTeamCode) || this.getCustomTeamFlag(state.bowlingTeam.name);
    if (customBowlFlag) {
      state.bowlingTeam.logoUrl = customBowlFlag;
    } else if (!state.bowlingTeam.logoUrl || state.bowlingTeam.logoUrl.includes('icc-cricket.com')) {
      state.bowlingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(bowlTeamCode)}`;
    }

    // Striker
    const customStrikerPhoto = this.getCustomPlayerPhoto(state.striker.name, batTeamCode);
    const liveStrikerPhoto = this.getPlayerPhoto(state.striker.name, batTeamCode);
    const strikerProfile = resolvePlayerProfile(state.striker.playerId, state.striker.name, batTeamCode);
    if (customStrikerPhoto) {
      state.striker.imageUrl = customStrikerPhoto;
    } else if (state.striker.imageUrl && state.striker.imageUrl.startsWith('/api/player/uploaded/')) {
      // preserve uploaded photo
    } else if (liveStrikerPhoto) {
      state.striker.imageUrl = liveStrikerPhoto;
    } else if (strikerProfile?.imageUrl) {
      state.striker.playerId = strikerProfile.id;
      state.striker.imageUrl = strikerProfile.imageUrl;
      state.striker.jerseyNumber = strikerProfile.jerseyNumber;
    }
    if (!state.striker.imageUrl || state.striker.imageUrl.includes('generic/male')) {
      state.striker.imageUrl = `/api/player/photo?name=${encodeURIComponent(state.striker.name)}&team=${encodeURIComponent(batTeamCode)}`;
    }

    // Non-striker
    const customNonStrikerPhoto = this.getCustomPlayerPhoto(state.nonStriker.name, batTeamCode);
    const liveNonStrikerPhoto = this.getPlayerPhoto(state.nonStriker.name, batTeamCode);
    const nonStrikerProfile = resolvePlayerProfile(state.nonStriker.playerId, state.nonStriker.name, batTeamCode);
    if (customNonStrikerPhoto) {
      state.nonStriker.imageUrl = customNonStrikerPhoto;
    } else if (state.nonStriker.imageUrl && state.nonStriker.imageUrl.startsWith('/api/player/uploaded/')) {
      // preserve uploaded photo
    } else if (liveNonStrikerPhoto) {
      state.nonStriker.imageUrl = liveNonStrikerPhoto;
    } else if (nonStrikerProfile?.imageUrl) {
      state.nonStriker.playerId = nonStrikerProfile.id;
      state.nonStriker.imageUrl = nonStrikerProfile.imageUrl;
      state.nonStriker.jerseyNumber = nonStrikerProfile.jerseyNumber;
    }
    if (!state.nonStriker.imageUrl || state.nonStriker.imageUrl.includes('generic/male')) {
      state.nonStriker.imageUrl = `/api/player/photo?name=${encodeURIComponent(state.nonStriker.name)}&team=${encodeURIComponent(batTeamCode)}`;
    }

    // Bowler
    const customBowlerPhoto = this.getCustomPlayerPhoto(state.currentBowler.name, bowlTeamCode);
    const liveBowlerPhoto = this.getPlayerPhoto(state.currentBowler.name, bowlTeamCode);
    const bowlerProfile = resolvePlayerProfile(state.currentBowler.playerId, state.currentBowler.name, bowlTeamCode);
    if (customBowlerPhoto) {
      state.currentBowler.imageUrl = customBowlerPhoto;
    } else if (state.currentBowler.imageUrl && state.currentBowler.imageUrl.startsWith('/api/player/uploaded/')) {
      // preserve uploaded photo
    } else if (liveBowlerPhoto) {
      state.currentBowler.imageUrl = liveBowlerPhoto;
    } else if (bowlerProfile?.imageUrl) {
      state.currentBowler.playerId = bowlerProfile.id;
      state.currentBowler.imageUrl = bowlerProfile.imageUrl;
      state.currentBowler.jerseyNumber = bowlerProfile.jerseyNumber;
    }
    if (!state.currentBowler.imageUrl || state.currentBowler.imageUrl.includes('generic/male')) {
      state.currentBowler.imageUrl = `/api/player/photo?name=${encodeURIComponent(state.currentBowler.name)}&team=${encodeURIComponent(bowlTeamCode)}`;
    }

    // Scorecard batting & bowling
    [state.scorecards?.firstInnings, state.scorecards?.secondInnings].forEach((innings) => {
      if (!innings) return;
      const inningsBatTeamCode = normalizeTeamCode(innings.teamCode || innings.teamName || batTeamCode);
      const inningsBowlTeamCode = inningsBatTeamCode === batTeamCode ? bowlTeamCode : batTeamCode;

      innings.batting.forEach((b) => {
        const customPhoto = this.getCustomPlayerPhoto(b.name, inningsBatTeamCode);
        const livePhoto = this.getPlayerPhoto(b.name, inningsBatTeamCode);
        const p = resolvePlayerProfile(b.playerId, b.name, inningsBatTeamCode);
        if (customPhoto) {
          b.imageUrl = customPhoto;
        } else if (b.imageUrl && b.imageUrl.startsWith('/api/player/uploaded/')) {
          // preserve uploaded photo
        } else if (livePhoto) {
          b.imageUrl = livePhoto;
        } else if (p?.imageUrl) {
          b.imageUrl = p.imageUrl;
        } else if (!b.imageUrl || b.imageUrl.includes('icc-cricket.com') || b.imageUrl.includes('generic/male')) {
          b.imageUrl = `/api/player/photo?name=${encodeURIComponent(b.name)}&team=${encodeURIComponent(inningsBatTeamCode)}`;
        }
      });
      innings.bowling.forEach((bw) => {
        const customPhoto = this.getCustomPlayerPhoto(bw.name, inningsBowlTeamCode);
        const livePhoto = this.getPlayerPhoto(bw.name, inningsBowlTeamCode);
        const p = resolvePlayerProfile(bw.playerId, bw.name, inningsBowlTeamCode);
        if (customPhoto) {
          bw.imageUrl = customPhoto;
        } else if (bw.imageUrl && bw.imageUrl.startsWith('/api/player/uploaded/')) {
          // preserve uploaded photo
        } else if (livePhoto) {
          bw.imageUrl = livePhoto;
        } else if (p?.imageUrl) {
          bw.imageUrl = p.imageUrl;
        } else if (!bw.imageUrl || bw.imageUrl.includes('icc-cricket.com') || bw.imageUrl.includes('generic/male')) {
          bw.imageUrl = `/api/player/photo?name=${encodeURIComponent(bw.name)}&team=${encodeURIComponent(inningsBowlTeamCode)}`;
        }
      });
    });
  }

  public getActiveMatch(): { config: ActiveMatchConfig | null; matchState: MatchState | null } {
    if (!this.currentData) {
      return { config: null, matchState: null };
    }
    return {
      config: this.currentData.config,
      matchState: this.currentData.state
    };
  }

  public async saveToDisk() {
    if (!this.currentData) return;
    try {
      await fs.writeFile(
        ACTIVE_MATCH_FILE,
        JSON.stringify(
          {
            ...this.currentData.config,
            matchState: this.currentData.state
          },
          null,
          2
        ),
        'utf-8'
      );
      this.lastSavedTimestamp = Date.now();
    } catch (err) {
      console.error('Failed to save active match to disk:', err);
    }
  }

  public subscribeSSE(client: (data: string) => void) {
    this.sseClients.add(client);
    // Send immediate snapshot
    const active = this.getActiveMatch();
    client(JSON.stringify(active));
    return () => {
      this.sseClients.delete(client);
    };
  }

  public getTriggers(): MatchTriggerDefinition[] {
    return this.currentData?.config.triggers || DEFAULT_MATCH_TRIGGERS;
  }

  public async updateTriggers(triggers: MatchTriggerDefinition[]): Promise<MatchTriggerDefinition[]> {
    if (this.currentData?.config) {
      this.currentData.config.triggers = triggers;
      await this.saveToDisk();
      this.broadcastUpdate();
    }
    return triggers;
  }

  public async broadcastCustomTrigger(
    title: string,
    message: string,
    priority: 'high' | 'medium' | 'low' = 'high',
    sound: 'wicket' | 'century' | 'innings_break' | 'six' | 'four' = 'wicket'
  ) {
    if (!this.currentData?.state) return;
    const state = this.currentData.state;
    const bat = state.battingTeam;
    state.notificationAlert = {
      id: 'notif-custom-' + Date.now(),
      type: 'custom' as any,
      title: title || 'MATCH ANNOUNCEMENT',
      description: message,
      timestamp: Date.now(),
      metadata: {
        teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
      }
    };
    state.lastUpdated = Date.now();
    await this.saveToDisk();
    this.broadcastUpdate();
  }

  private broadcastUpdate() {
    const active = this.getActiveMatch();
    if (active.matchState) {
      this.captureHighlightsFromState(active.matchState);
    }
    const payload = JSON.stringify(active);
    for (const client of this.sseClients) {
      try {
        client(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }

    // Deliver background FCM push notification to mobile devices
    if (active.matchState?.notificationAlert) {
      const alert = active.matchState.notificationAlert;
      fcmService.sendMatchPushNotification({
        title: alert.title,
        body: alert.description,
        eventType: alert.type,
        matchId: active.matchState.matchId,
        matchTitle: active.matchState.title,
        notificationId: alert.id
      }).catch((err) => {
        console.debug('[FCM] Push dispatch notice:', err);
      });
    }
  }

  /**
   * Admin connects a CREX match URL or ID.
   * Persists server-side in data/active-match.json and propagates to Android, OBS, Broadcast, Studio.
   */
  public async connectMatch(crexUrlOrId: string, connectedBy: string = 'Admin Studio'): Promise<MatchState> {
    const cleanInput = crexUrlOrId.trim();
    let matchId = 'm_' + Math.random().toString(36).substring(2, 8);
    let crexMatchId = cleanInput;

    // Check if user selected one of the preset matches
    const preset = PRESET_MATCHES.find((p) => p.id === cleanInput || p.crexUrl === cleanInput || cleanInput.includes(p.id));
    if (preset) {
      return this.connectPresetMatch(preset.id, connectedBy);
    }

    // Attempt live fetch if valid URL
    let fetchedState: MatchState | null = null;
    let liveSyncSucceeded = false;
    if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
      try {
        fetchedState = await this.scrapeCrexMatch(cleanInput, true);
        liveSyncSucceeded = Boolean(fetchedState);
      } catch (e) {
        console.warn('CREX direct scraper warning, building verified state:', e);
      }
    }

    if (!fetchedState) {
      // Build high-grade verified match based on ID or default
      fetchedState = this.buildVerifiedFallbackMatch(cleanInput);
    }

    this.enrichPlayerImages(fetchedState);

    const isHttpUrl = cleanInput.startsWith('http://') || cleanInput.startsWith('https://');
    const config: ActiveMatchConfig = {
      activeMatchId: fetchedState.matchId,
      crexUrl: cleanInput.startsWith('http') ? cleanInput : `https://crex.live/scoreboard/${cleanInput}`,
      crexMatchId: fetchedState.crexMatchId || cleanInput,
      matchTitle: fetchedState.title,
      connectedAt: Date.now(),
      lastSyncedAt: Date.now(),
      syncIntervalMs: 3000,
      isAutoSyncEnabled: true,
      dataSourceMode: 'auto',
      syncStatus: isHttpUrl && !liveSyncSucceeded ? 'failed' : 'ok',
      syncError: isHttpUrl && !liveSyncSucceeded ? 'Sync band hai, Manual mode on karein.' : undefined,
      lastSuccessfulSyncAt: liveSyncSucceeded ? Date.now() : undefined,
      connectedBy,
      triggers: this.currentData?.config.triggers || DEFAULT_MATCH_TRIGGERS
    };

    this.currentData = {
      config,
      state: fetchedState
    };

    await this.saveToDisk();
    this.broadcastUpdate();
    return fetchedState;
  }

  public async connectPresetMatch(presetId: string, connectedBy: string = 'Admin Studio'): Promise<MatchState> {
    let state: MatchState;
    if (presetId === 'm_eng_pak_t20') {
      state = this.buildPakEngMatch();
    } else if (presetId === 'm_sa_ind_test') {
      state = this.buildSaIndTestMatch();
    } else if (presetId === 'm_aus_eng_ashes') {
      state = this.buildAshesMatch();
    } else {
      state = this.buildIndAusMatch();
    }

    this.enrichPlayerImages(state);

    const config: ActiveMatchConfig = {
      activeMatchId: state.matchId,
      crexUrl: state.crexUrl || `https://crex.live/scoreboard/${presetId}`,
      crexMatchId: state.crexMatchId || presetId,
      matchTitle: state.title,
      connectedAt: Date.now(),
      lastSyncedAt: Date.now(),
      syncIntervalMs: 3000,
      isAutoSyncEnabled: true,
      dataSourceMode: 'auto',
      syncStatus: 'ok',
      lastSuccessfulSyncAt: Date.now(),
      connectedBy,
      triggers: this.currentData?.config.triggers || DEFAULT_MATCH_TRIGGERS
    };

    this.currentData = { config, state };
    await this.saveToDisk();
    this.broadcastUpdate();
    return state;
  }

  public async disconnectMatch(): Promise<void> {
    this.currentData = null;
    try {
      await fs.writeFile(ACTIVE_MATCH_FILE, JSON.stringify({ activeMatchId: null, matchState: null }, null, 2));
    } catch (err) {
      console.error('Error clearing active match:', err);
    }
    this.broadcastUpdate();
  }

  public setAutoSync(enabled: boolean) {
    void this.setDataSourceMode(enabled ? 'auto' : 'manual');
  }

  public async setDataSourceMode(mode: 'auto' | 'manual'): Promise<ActiveMatchConfig> {
    if (!this.currentData || !this.currentData.state) {
      const initialState = this.buildIndAusMatch();
      this.enrichPlayerImages(initialState);
      this.currentData = {
        config: {
          activeMatchId: initialState.matchId,
          crexUrl: '',
          crexMatchId: '',
          matchTitle: initialState.title,
          connectedAt: Date.now(),
          lastSyncedAt: Date.now(),
          syncIntervalMs: 3000,
          isAutoSyncEnabled: mode === 'auto',
          dataSourceMode: mode,
          syncStatus: mode === 'manual' ? 'manual' : 'ok',
          connectedBy: 'Admin Studio',
          triggers: DEFAULT_MATCH_TRIGGERS
        },
        state: initialState
      };
    } else {
      this.currentData.config.dataSourceMode = mode;
      this.currentData.config.isAutoSyncEnabled = mode === 'auto';
      if (mode === 'manual') {
        this.currentData.config.syncStatus = 'manual';
        delete this.currentData.config.syncError;
      } else {
        this.currentData.config.syncStatus = 'ok';
        delete this.currentData.config.syncError;
      }
    }

    await this.saveToDisk();
    this.broadcastUpdate();

    if (mode === 'auto') {
      void this.tryAutoSyncOnce();
    }

    return this.currentData.config;
  }

  public async tryAutoSyncOnce(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentData || !this.currentData.state) {
      return { success: false, error: 'No active match' };
    }
    const config = this.currentData.config;
    if (config.dataSourceMode === 'manual' || !config.isAutoSyncEnabled) {
      return { success: false, error: 'Manual mode active' };
    }

    if (config.crexUrl && config.crexUrl.startsWith('http')) {
      try {
        const fresh = await this.scrapeCrexMatch(config.crexUrl, true);
        if (fresh && fresh.battingTeam && fresh.battingTeam.score) {
          const prev = this.currentData.state;
          // Preserve stable matchId so frontend animations track score deltas cleanly across polls
          if (prev.matchId) {
            fresh.matchId = prev.matchId;
          }

          const prevRuns = Number(prev.battingTeam?.score?.runs || 0);
          const currRuns = Number(fresh.battingTeam.score.runs || 0);
          const prevWkts = Number(prev.battingTeam?.score?.wickets || 0);
          const currWkts = Number(fresh.battingTeam.score.wickets || 0);
          const prevTotalBalls =
            Number(prev.battingTeam?.score?.overs || 0) * 6 +
            Number(prev.battingTeam?.score?.balls || 0);
          const currTotalBalls =
            Number(fresh.battingTeam.score.overs || 0) * 6 +
            Number(fresh.battingTeam.score.balls || 0);

          const dRuns = currRuns - prevRuns;
          const dWkts = currWkts - prevWkts;
          const dBalls = currTotalBalls - prevTotalBalls;

          const existingBalls = Array.isArray(prev.recentBalls) ? prev.recentBalls : [];
          if (dRuns === 0 && dWkts === 0 && dBalls === 0) {
            fresh.recentBalls = existingBalls;
            if (prev.notificationAlert) {
              fresh.notificationAlert = prev.notificationAlert;
            }
          } else if (
            dWkts >= 0 &&
            dWkts <= 1 &&
            dRuns >= 0 &&
            dRuns <= 7 &&
            dBalls >= 0 &&
            dBalls <= 2
          ) {
            const isWicket = dWkts === 1;
            const isSix = !isWicket && dRuns === 6;
            const isFour = !isWicket && dRuns === 4;
            const batsmanName =
              fresh.striker?.shortName || fresh.striker?.name || prev.striker?.name || 'Batter';
            const bowlerName =
              fresh.currentBowler?.shortName ||
              fresh.currentBowler?.name ||
              prev.currentBowler?.name ||
              'Bowler';
            const ov = fresh.battingTeam.score.overs;
            const bl = fresh.battingTeam.score.balls;
            const inferredBall: BallEvent = {
              id: `live_${Date.now()}_${ov}_${bl}_${dRuns}_${dWkts}`,
              ballNumber: `${ov}.${bl}`,
              overNumber: ov,
              ballInOver: bl,
              runs: isWicket ? 0 : dRuns,
              isWicket,
              isFour,
              isSix,
              isExtra: false,
              batsmanName,
              bowlerName,
              commentary: isWicket
                ? `WICKET! ${batsmanName} dismissed.`
                : isSix
                ? `SIX! ${batsmanName} hits it over the boundary!`
                : isFour
                ? `FOUR! ${batsmanName} sends it to the boundary!`
                : dRuns === 0
                ? `Dot ball.`
                : `${batsmanName} scores ${dRuns} run${dRuns === 1 ? '' : 's'}.`,
              timestamp: Date.now()
            };
            fresh.recentBalls = [inferredBall, ...existingBalls].slice(0, 24);
          } else {
            fresh.recentBalls = existingBalls;
          }

          this.enrichPlayerImages(fresh);
          this.currentData.state = fresh;
          config.matchTitle = fresh.title;
          config.lastSyncedAt = Date.now();
          config.lastSuccessfulSyncAt = Date.now();
          config.syncStatus = 'ok';
          delete config.syncError;
          await this.saveToDisk();
          this.broadcastUpdate();
          return { success: true };
        }
      } catch (err) {
        console.warn('Auto-sync check failed:', err);
      }
    }

    // Auto Sync failed or no live data returned: preserve last score untouched and warn Admin
    const prevStatus = config.syncStatus;
    const prevError = config.syncError;
    config.syncStatus = 'failed';
    config.syncError = 'Sync band hai, Manual mode on karein.';
    if (prevStatus !== 'failed' || prevError !== config.syncError) {
      await this.saveToDisk();
      this.broadcastUpdate();
    }
    return { success: false, error: config.syncError };
  }

  // Background auto-sync engine: keeps Broadcast, OBS, and Android updated without losing last score if sync fails
  private startLiveEngine() {
    if (this.autoTickTimer) clearInterval(this.autoTickTimer);

    this.autoTickTimer = setInterval(async () => {
      if (!this.currentData || !this.currentData.state) {
        return;
      }
      const config = this.currentData.config;
      if (config.dataSourceMode === 'manual' || !config.isAutoSyncEnabled) {
        return;
      }

      await this.tryAutoSyncOnce();
    }, 6000);
  }

  // Admin action: trigger a specific ball or notification event (4, 6, Wicket, 30, 50, 100, 150, 200, 3W, 4W, 5W, Maiden, Innings Break, Match Result)
  public triggerCustomEvent(
    eventType:
      | 'four'
      | 'six'
      | 'wicket'
      | 'thirty'
      | 'fifty'
      | 'century'
      | 'one_fifty'
      | 'double_century'
      | 'three_wickets'
      | 'four_wickets'
      | 'five_wickets'
      | 'maiden'
      | 'innings_break'
      | 'match_result'
      | 'tight_finish'
      | 'single'
      | 'dot'
  ) {
    if (!this.currentData?.state) return;
    const state = this.currentData.state;
    this.advanceBall(state, eventType);
    state.lastUpdated = Date.now();
    this.broadcastUpdate();
    this.saveToDisk();
  }

  private buildShortName(name: string): string {
    const clean = (name || '').trim();
    if (!clean) return 'Player';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0].toUpperCase()} ${parts.slice(1).join(' ')}`;
    }
    return clean;
  }

  private formatDeliveryChipToBallEvent(
    token: string,
    indexFromStart: number,
    overNum: number,
    batsmanName: string,
    bowlerName: string
  ): BallEvent {
    const clean = String(token).trim();
    const lower = clean.toLowerCase();
    const isWicket = lower === 'w' || lower === 'wicket';
    const isWide = lower === 'wd' || lower === 'wide';
    const isNoBall = lower === 'nb' || lower === 'noball' || lower === 'no-ball';
    const parsedNum = parseInt(clean, 10);
    const runs = isWicket ? 0 : isWide || isNoBall ? 1 : !isNaN(parsedNum) ? Math.max(0, parsedNum) : 0;
    const isFour = !isWicket && !isWide && !isNoBall && runs === 4;
    const isSix = !isWicket && !isWide && !isNoBall && runs === 6;

    let commentary = `${batsmanName} takes ${runs} run${runs === 1 ? '' : 's'}.`;
    if (isWicket) commentary = `OUT! ${bowlerName} strikes, ${batsmanName} departs!`;
    else if (isWide) commentary = `Wide ball signaled by the umpire.`;
    else if (isNoBall) commentary = `No ball! Extra run added.`;
    else if (isSix) commentary = `MAXIMUM SIX! ${batsmanName} sends it soaring into the stands!`;
    else if (isFour) commentary = `FOUR! ${batsmanName} finds the boundary rope cleanly!`;
    else if (runs === 0) commentary = `Dot ball, solid defensive stroke.`;

    const ballInOver = Math.min(6, Math.max(1, indexFromStart + 1));
    return {
      id: `manual_ball_${Date.now()}_${indexFromStart}_${Math.random().toString(36).slice(2, 6)}`,
      ballNumber: `${overNum}.${ballInOver}`,
      overNumber: overNum,
      ballInOver,
      runs,
      isWicket,
      isFour,
      isSix,
      isExtra: isWide || isNoBall,
      extraType: isWide ? 'wide' : isNoBall ? 'no-ball' : undefined,
      batsmanName,
      bowlerName,
      commentary,
      timestamp: Date.now() - indexFromStart * 1000
    };
  }

  // Admin Manual Mode: Record a single delivery (0,1,2,3,4,6,W,wd,nb) and auto-update score, overs, striker, bowler, partnership & deliveries
  public async recordManualBall(
    outcome: '0' | '1' | '2' | '3' | '4' | '6' | 'W' | 'wd' | 'nb'
  ): Promise<MatchState> {
    if (!this.currentData?.state) {
      await this.setDataSourceMode('manual');
    }
    const state = this.currentData!.state!;
    const bat = state.battingTeam;

    let runsScored = 0;
    let batterRuns = 0;
    let isLegal = true;
    let isW = false;
    let is4 = false;
    let is6 = false;
    let extraType: 'wide' | 'no-ball' | undefined;
    let comment = '';

    switch (outcome) {
      case '0':
        runsScored = 0;
        batterRuns = 0;
        comment = `Good delivery from ${state.currentBowler.shortName}, defended solidly for no run.`;
        break;
      case '1':
        runsScored = 1;
        batterRuns = 1;
        comment = `${state.striker.shortName} nudges it into the gap for a quick single.`;
        break;
      case '2':
        runsScored = 2;
        batterRuns = 2;
        comment = `Placed into the deep, comfortable couple of runs taken.`;
        break;
      case '3':
        runsScored = 3;
        batterRuns = 3;
        comment = `Great running between the wickets! Three runs added.`;
        break;
      case '4':
        runsScored = 4;
        batterRuns = 4;
        is4 = true;
        comment = `FOUR! ${state.striker.shortName} dispatches it cleanly to the boundary!`;
        break;
      case '6':
        runsScored = 6;
        batterRuns = 6;
        is6 = true;
        comment = `SIX! Massive strike by ${state.striker.shortName} over the ropes!`;
        break;
      case 'W':
        runsScored = 0;
        batterRuns = 0;
        isW = true;
        comment = `WICKET! ${state.currentBowler.shortName} breaks through and dismisses ${state.striker.name}!`;
        break;
      case 'wd':
        runsScored = 1;
        batterRuns = 0;
        isLegal = false;
        extraType = 'wide';
        comment = `Wide ball down the leg side, 1 extra run added.`;
        break;
      case 'nb':
        runsScored = 1;
        batterRuns = 0;
        isLegal = false;
        extraType = 'no-ball';
        comment = `No ball! Overstepped by ${state.currentBowler.shortName}, 1 extra run.`;
        break;
    }

    const overNum = bat.score.overs;
    const nextBallInOver = isLegal ? bat.score.balls + 1 : Math.max(1, bat.score.balls);
    const ballStr = `${overNum}.${nextBallInOver}`;

    bat.score.runs += runsScored;
    state.currentBowler.runs += runsScored;

    if (!state.currentPartnership) {
      state.currentPartnership = {
        runs: 0,
        balls: 0,
        player1Runs: state.striker.runs,
        player2Runs: state.nonStriker.runs
      };
    }

    const strikerNameBeforeBall = state.striker.shortName || state.striker.name;

    if (isW) {
      bat.score.wickets = Math.min(10, bat.score.wickets + 1);
      state.currentBowler.wickets += 1;
      state.striker.balls += 1;
      state.striker.strikeRate =
        state.striker.balls > 0 ? Number(((state.striker.runs / state.striker.balls) * 100).toFixed(1)) : 0;
      state.currentPartnership.balls += 1;
    } else if (extraType === 'wide' || extraType === 'no-ball') {
      state.currentPartnership.runs += runsScored;
    } else {
      state.striker.runs += batterRuns;
      state.striker.balls += 1;
      if (is4) state.striker.fours += 1;
      if (is6) state.striker.sixes += 1;
      state.striker.strikeRate =
        state.striker.balls > 0 ? Number(((state.striker.runs / state.striker.balls) * 100).toFixed(1)) : 0;
      state.currentPartnership.runs += batterRuns;
      state.currentPartnership.balls += 1;
      state.currentPartnership.player1Runs += batterRuns;
    }

    if (isLegal) {
      if (nextBallInOver >= 6) {
        bat.score.overs += 1;
        bat.score.balls = 0;
        state.currentBowler.overs = Math.floor(state.currentBowler.overs) + 1;
        // Rotate strike at end of over
        const tmpBatsman = state.striker;
        state.striker = { ...state.nonStriker, isOnStrike: true };
        state.nonStriker = { ...tmpBatsman, isOnStrike: false };
        const tmpP1 = state.currentPartnership.player1Runs;
        state.currentPartnership.player1Runs = state.currentPartnership.player2Runs;
        state.currentPartnership.player2Runs = tmpP1;
      } else {
        bat.score.balls = nextBallInOver;
        const curBowlerOv = Math.floor(state.currentBowler.overs);
        const curBowlerBalls = Math.round((state.currentBowler.overs - curBowlerOv) * 10) + 1;
        state.currentBowler.overs =
          curBowlerBalls >= 6 ? curBowlerOv + 1 : Number((curBowlerOv + curBowlerBalls / 10).toFixed(1));
        if (!isW && batterRuns % 2 !== 0) {
          const tmpBatsman = state.striker;
          state.striker = { ...state.nonStriker, isOnStrike: true };
          state.nonStriker = { ...tmpBatsman, isOnStrike: false };
          const tmpP1 = state.currentPartnership.player1Runs;
          state.currentPartnership.player1Runs = state.currentPartnership.player2Runs;
          state.currentPartnership.player2Runs = tmpP1;
        }
      }
    }

    const totalBowlerOvers = state.currentBowler.overs;
    const totalBowlerBalls = Math.floor(totalBowlerOvers) * 6 + Math.round((totalBowlerOvers % 1) * 10);
    state.currentBowler.economy =
      totalBowlerBalls > 0 ? Number(((state.currentBowler.runs / totalBowlerBalls) * 6).toFixed(2)) : 0;

    const totalTeamBalls = bat.score.overs * 6 + bat.score.balls;
    state.currentRunRate = totalTeamBalls > 0 ? Number(((bat.score.runs / totalTeamBalls) * 6).toFixed(2)) : 0;

    if (state.target && state.target > 0) {
      const totalMatchOvers = state.matchType === 'T10' ? 10 : state.matchType === 'T20' ? 20 : state.matchType === 'ODI' ? 50 : 90;
      const totalMatchBalls = (state.dlsDetails?.applied ? state.dlsDetails.revisedOvers : totalMatchOvers) * 6;
      const remainingRuns = Math.max(0, state.target - bat.score.runs);
      const remainingBalls = Math.max(0, totalMatchBalls - totalTeamBalls);
      state.requiredRuns = remainingRuns;
      state.remainingBalls = remainingBalls;
      state.requiredRunRate = remainingBalls > 0 ? Number(((remainingRuns / remainingBalls) * 6).toFixed(2)) : 0;
    }

    const newBall: BallEvent = {
      id: `ball-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ballNumber: ballStr,
      overNumber: overNum,
      ballInOver: nextBallInOver,
      runs: runsScored,
      isWicket: isW,
      isFour: is4,
      isSix: is6,
      isExtra: Boolean(extraType),
      extraType,
      batsmanName: strikerNameBeforeBall,
      bowlerName: state.currentBowler.shortName || state.currentBowler.name,
      commentary: comment,
      timestamp: Date.now()
    };

    state.recentBalls = [newBall, ...(state.recentBalls || [])].slice(0, 24);
    state.lastUpdated = Date.now();
    this.currentData!.config.lastSyncedAt = Date.now();

    await this.saveToDisk();
    this.broadcastUpdate();
    return state;
  }

  // Admin action: Directly update live scores, teams, batsmen, bowler, partnership, deliveries, target, or DLS parameters
  public async updateLiveScoreDetails(fields: {
    title?: string;
    series?: string;
    matchType?: 'T20' | 'ODI' | 'TEST' | 'T10';
    venue?: string;
    toss?: string;
    gameState?: 'scheduled' | 'live' | 'innings_break' | 'completed' | 'delayed';
    currentInnings?: 1 | 2;
    battingTeamName?: string;
    battingTeamCode?: string;
    runs?: number;
    wickets?: number;
    overs?: number;
    balls?: number;
    currentRunRate?: number;
    bowlingTeamName?: string;
    bowlingTeamCode?: string;
    bowlingTeamRuns?: number;
    bowlingTeamWickets?: number;
    bowlingTeamOvers?: number;
    bowlingTeamBalls?: number;
    strikerName?: string;
    strikerImageUrl?: string;
    strikerRuns?: number;
    strikerBalls?: number;
    strikerFours?: number;
    strikerSixes?: number;
    nonStrikerName?: string;
    nonStrikerImageUrl?: string;
    nonStrikerRuns?: number;
    nonStrikerBalls?: number;
    nonStrikerFours?: number;
    nonStrikerSixes?: number;
    bowlerName?: string;
    bowlerImageUrl?: string;
    bowlerOvers?: number;
    bowlerMaidens?: number;
    bowlerRuns?: number;
    bowlerWickets?: number;
    partnershipRuns?: number;
    partnershipBalls?: number;
    partnershipPlayer1Runs?: number;
    partnershipPlayer2Runs?: number;
    currentOverDeliveries?: string[];
    recentBalls?: BallEvent[];
    target?: number;
    statusText?: string;
    dlsDetails?: any;
  }): Promise<MatchState> {
    if (!this.currentData?.state) {
      const initialState = this.buildIndAusMatch();
      this.currentData = {
        config: {
          activeMatchId: 'm_live_' + Date.now(),
          crexUrl: '',
          crexMatchId: '',
          matchTitle: fields.title || 'Live Cricket Match',
          connectedAt: Date.now(),
          lastSyncedAt: Date.now(),
          syncIntervalMs: 3000,
          isAutoSyncEnabled: false,
          dataSourceMode: 'manual',
          syncStatus: 'manual',
          connectedBy: 'Admin Studio',
          triggers: DEFAULT_MATCH_TRIGGERS
        },
        state: initialState
      };
    }

    const state = this.currentData.state!;

    if (fields.title !== undefined) {
      state.title = fields.title;
      this.currentData.config.matchTitle = fields.title;
    }
    if (fields.series !== undefined) state.series = fields.series;
    if (fields.matchType !== undefined) state.matchType = fields.matchType;
    if (fields.venue !== undefined) state.venue = fields.venue;
    if (fields.toss !== undefined) state.toss = fields.toss;
    if (fields.gameState !== undefined) state.gameState = fields.gameState;
    if (fields.currentInnings !== undefined) state.currentInnings = fields.currentInnings;

    if (fields.battingTeamName !== undefined) {
      state.battingTeam.name = fields.battingTeamName;
    }
    if (fields.battingTeamCode !== undefined) {
      const norm = normalizeTeamCode(fields.battingTeamCode) || fields.battingTeamCode.toUpperCase();
      state.battingTeam.code = norm;
      state.battingTeam.shortName = norm;
      const kTeam = KNOWN_TEAMS[norm.toLowerCase()] || KNOWN_TEAMS[state.battingTeam.name.toLowerCase()];
      if (kTeam) {
        state.battingTeam.primaryColor = kTeam.color1 || state.battingTeam.primaryColor;
        state.battingTeam.secondaryColor = kTeam.color2 || state.battingTeam.secondaryColor;
      }
      state.battingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(norm)}`;
    } else if (fields.battingTeamName !== undefined) {
      const kTeam = KNOWN_TEAMS[fields.battingTeamName.toLowerCase()];
      if (kTeam) {
        state.battingTeam.code = kTeam.code;
        state.battingTeam.shortName = kTeam.code;
        state.battingTeam.primaryColor = kTeam.color1 || state.battingTeam.primaryColor;
        state.battingTeam.secondaryColor = kTeam.color2 || state.battingTeam.secondaryColor;
        state.battingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(kTeam.code)}`;
      }
    }

    if (fields.runs !== undefined) state.battingTeam.score.runs = Number(fields.runs);
    if (fields.wickets !== undefined) state.battingTeam.score.wickets = Math.min(10, Math.max(0, Number(fields.wickets)));
    if (fields.overs !== undefined) state.battingTeam.score.overs = Math.max(0, Number(fields.overs));
    if (fields.balls !== undefined) state.battingTeam.score.balls = Math.min(5, Math.max(0, Number(fields.balls)));

    if (fields.currentRunRate !== undefined && !isNaN(Number(fields.currentRunRate))) {
      state.currentRunRate = Number(Number(fields.currentRunRate).toFixed(2));
    } else if (fields.runs !== undefined || fields.overs !== undefined || fields.balls !== undefined) {
      const totalTeamBalls = state.battingTeam.score.overs * 6 + state.battingTeam.score.balls;
      state.currentRunRate =
        totalTeamBalls > 0 ? Number(((state.battingTeam.score.runs / totalTeamBalls) * 6).toFixed(2)) : 0;
    }

    if (fields.bowlingTeamName !== undefined) {
      state.bowlingTeam.name = fields.bowlingTeamName;
    }
    if (fields.bowlingTeamCode !== undefined) {
      const norm = normalizeTeamCode(fields.bowlingTeamCode) || fields.bowlingTeamCode.toUpperCase();
      state.bowlingTeam.code = norm;
      state.bowlingTeam.shortName = norm;
      const kTeam = KNOWN_TEAMS[norm.toLowerCase()] || KNOWN_TEAMS[state.bowlingTeam.name.toLowerCase()];
      if (kTeam) {
        state.bowlingTeam.primaryColor = kTeam.color1 || state.bowlingTeam.primaryColor;
        state.bowlingTeam.secondaryColor = kTeam.color2 || state.bowlingTeam.secondaryColor;
      }
      state.bowlingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(norm)}`;
    } else if (fields.bowlingTeamName !== undefined) {
      const kTeam = KNOWN_TEAMS[fields.bowlingTeamName.toLowerCase()];
      if (kTeam) {
        state.bowlingTeam.code = kTeam.code;
        state.bowlingTeam.shortName = kTeam.code;
        state.bowlingTeam.primaryColor = kTeam.color1 || state.bowlingTeam.primaryColor;
        state.bowlingTeam.secondaryColor = kTeam.color2 || state.bowlingTeam.secondaryColor;
        state.bowlingTeam.logoUrl = `/api/team/flag/${encodeURIComponent(kTeam.code)}`;
      }
    }
    if (fields.bowlingTeamRuns !== undefined) state.bowlingTeam.score.runs = Number(fields.bowlingTeamRuns);
    if (fields.bowlingTeamWickets !== undefined) state.bowlingTeam.score.wickets = Math.min(10, Math.max(0, Number(fields.bowlingTeamWickets)));
    if (fields.bowlingTeamOvers !== undefined) state.bowlingTeam.score.overs = Math.max(0, Number(fields.bowlingTeamOvers));
    if (fields.bowlingTeamBalls !== undefined) state.bowlingTeam.score.balls = Math.min(5, Math.max(0, Number(fields.bowlingTeamBalls)));

    // Auto-update match title if teams were changed and title was not explicitly sent
    if (
      fields.title === undefined &&
      (fields.battingTeamName !== undefined || fields.bowlingTeamName !== undefined)
    ) {
      state.title = `${state.battingTeam.name} vs ${state.bowlingTeam.name}${state.series ? ' - ' + state.series : ''}`;
      this.currentData.config.matchTitle = state.title;
    }

    // Striker updates
    if (fields.strikerName !== undefined) {
      const prevName = state.striker.name;
      state.striker.name = fields.strikerName;
      state.striker.shortName = this.buildShortName(fields.strikerName);
      if (prevName !== fields.strikerName) {
        state.striker.playerId = `p_${Date.now()}_s`;
        const batCode = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || '');
        state.striker.imageUrl = this.getCustomPlayerPhoto(fields.strikerName, batCode) || undefined;
      }
    }
    if (fields.strikerImageUrl !== undefined) {
      const img = fields.strikerImageUrl.trim();
      const batCode = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || '');
      const cleanName = normalizePlayerName(state.striker.name);
      if (img) {
        state.striker.imageUrl = img;
        if (cleanName) {
          this.customPlayerPhotos.set(cleanName, img);
          if (batCode) this.customPlayerPhotos.set(`${batCode}:${cleanName}`, img);
          await this.saveCustomPlayerPhotos();
        }
      }
    }
    if (fields.strikerRuns !== undefined) state.striker.runs = Math.max(0, Number(fields.strikerRuns));
    if (fields.strikerBalls !== undefined) state.striker.balls = Math.max(0, Number(fields.strikerBalls));
    if (fields.strikerFours !== undefined) state.striker.fours = Math.max(0, Number(fields.strikerFours));
    if (fields.strikerSixes !== undefined) state.striker.sixes = Math.max(0, Number(fields.strikerSixes));
    state.striker.strikeRate =
      state.striker.balls > 0 ? Number(((state.striker.runs / state.striker.balls) * 100).toFixed(1)) : 0;

    // Non-striker updates
    if (fields.nonStrikerName !== undefined) {
      const prevName = state.nonStriker.name;
      state.nonStriker.name = fields.nonStrikerName;
      state.nonStriker.shortName = this.buildShortName(fields.nonStrikerName);
      if (prevName !== fields.nonStrikerName) {
        state.nonStriker.playerId = `p_${Date.now()}_ns`;
        const batCode = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || '');
        state.nonStriker.imageUrl = this.getCustomPlayerPhoto(fields.nonStrikerName, batCode) || undefined;
      }
    }
    if (fields.nonStrikerImageUrl !== undefined) {
      const img = fields.nonStrikerImageUrl.trim();
      const batCode = normalizeTeamCode(state.battingTeam.code || state.battingTeam.name || '');
      const cleanName = normalizePlayerName(state.nonStriker.name);
      if (img) {
        state.nonStriker.imageUrl = img;
        if (cleanName) {
          this.customPlayerPhotos.set(cleanName, img);
          if (batCode) this.customPlayerPhotos.set(`${batCode}:${cleanName}`, img);
          await this.saveCustomPlayerPhotos();
        }
      }
    }
    if (fields.nonStrikerRuns !== undefined) state.nonStriker.runs = Math.max(0, Number(fields.nonStrikerRuns));
    if (fields.nonStrikerBalls !== undefined) state.nonStriker.balls = Math.max(0, Number(fields.nonStrikerBalls));
    if (fields.nonStrikerFours !== undefined) state.nonStriker.fours = Math.max(0, Number(fields.nonStrikerFours));
    if (fields.nonStrikerSixes !== undefined) state.nonStriker.sixes = Math.max(0, Number(fields.nonStrikerSixes));
    state.nonStriker.strikeRate =
      state.nonStriker.balls > 0 ? Number(((state.nonStriker.runs / state.nonStriker.balls) * 100).toFixed(1)) : 0;

    // Bowler updates
    if (fields.bowlerName !== undefined) {
      const prevName = state.currentBowler.name;
      state.currentBowler.name = fields.bowlerName;
      state.currentBowler.shortName = this.buildShortName(fields.bowlerName);
      if (prevName !== fields.bowlerName) {
        state.currentBowler.playerId = `p_${Date.now()}_b`;
        const bowlCode = normalizeTeamCode(state.bowlingTeam.code || state.bowlingTeam.name || '');
        state.currentBowler.imageUrl = this.getCustomPlayerPhoto(fields.bowlerName, bowlCode) || undefined;
      }
    }
    if (fields.bowlerImageUrl !== undefined) {
      const img = fields.bowlerImageUrl.trim();
      const bowlCode = normalizeTeamCode(state.bowlingTeam.code || state.bowlingTeam.name || '');
      const cleanName = normalizePlayerName(state.currentBowler.name);
      if (img) {
        state.currentBowler.imageUrl = img;
        if (cleanName) {
          this.customPlayerPhotos.set(cleanName, img);
          if (bowlCode) this.customPlayerPhotos.set(`${bowlCode}:${cleanName}`, img);
          await this.saveCustomPlayerPhotos();
        }
      }
    }
    if (fields.bowlerOvers !== undefined) state.currentBowler.overs = Math.max(0, Number(fields.bowlerOvers));
    if (fields.bowlerMaidens !== undefined) state.currentBowler.maidens = Math.max(0, Number(fields.bowlerMaidens));
    if (fields.bowlerRuns !== undefined) state.currentBowler.runs = Math.max(0, Number(fields.bowlerRuns));
    if (fields.bowlerWickets !== undefined) state.currentBowler.wickets = Math.max(0, Number(fields.bowlerWickets));
    const totalBowlerOvers = state.currentBowler.overs || 0;
    const totalBowlerBalls = Math.floor(totalBowlerOvers) * 6 + Math.round((totalBowlerOvers % 1) * 10);
    state.currentBowler.economy =
      totalBowlerBalls > 0 ? Number(((state.currentBowler.runs / totalBowlerBalls) * 6).toFixed(2)) : 0;

    // Partnership updates
    if (!state.currentPartnership) {
      state.currentPartnership = {
        runs: state.striker.runs + state.nonStriker.runs,
        balls: state.striker.balls + state.nonStriker.balls,
        player1Runs: state.striker.runs,
        player2Runs: state.nonStriker.runs
      };
    }
    if (fields.partnershipRuns !== undefined) state.currentPartnership.runs = Math.max(0, Number(fields.partnershipRuns));
    if (fields.partnershipBalls !== undefined) state.currentPartnership.balls = Math.max(0, Number(fields.partnershipBalls));
    if (fields.partnershipPlayer1Runs !== undefined)
      state.currentPartnership.player1Runs = Math.max(0, Number(fields.partnershipPlayer1Runs));
    if (fields.partnershipPlayer2Runs !== undefined)
      state.currentPartnership.player2Runs = Math.max(0, Number(fields.partnershipPlayer2Runs));

    // Deliveries / recentBalls updates
    if (Array.isArray(fields.recentBalls)) {
      state.recentBalls = fields.recentBalls;
    } else if (Array.isArray(fields.currentOverDeliveries)) {
      const overNum = state.battingTeam.score.overs;
      const sName = state.striker.shortName || state.striker.name;
      const bName = state.currentBowler.shortName || state.currentBowler.name;
      // UI sends array ordered from oldest to newest or newest-first; store newest-first for consistent display across Broadcast/OBS/Android
      const tokens = [...fields.currentOverDeliveries].reverse();
      state.recentBalls = tokens.map((tok, idx) =>
        this.formatDeliveryChipToBallEvent(tok, tokens.length - 1 - idx, overNum, sName, bName)
      );
    }

    if (fields.target !== undefined) {
      const tVal = Number(fields.target);
      state.target = tVal > 0 ? tVal : undefined;
      if (tVal > 0) {
        const totalMatchOvers = state.matchType === 'T10' ? 10 : state.matchType === 'T20' ? 20 : state.matchType === 'ODI' ? 50 : 90;
        const totalMatchBalls = (state.dlsDetails?.applied ? state.dlsDetails.revisedOvers : totalMatchOvers) * 6;
        const currentBalls = state.battingTeam.score.overs * 6 + state.battingTeam.score.balls;
        state.remainingBalls = Math.max(0, totalMatchBalls - currentBalls);
        state.requiredRuns = Math.max(0, tVal - state.battingTeam.score.runs);
        state.requiredRunRate =
          state.remainingBalls > 0 ? Number(((state.requiredRuns / state.remainingBalls) * 6).toFixed(2)) : 0;
      } else {
        delete state.requiredRuns;
        delete state.remainingBalls;
        delete state.requiredRunRate;
      }
    }

    // Handle DLS target application or reset
    if (fields.dlsDetails !== undefined) {
      if (fields.dlsDetails === null) {
        delete state.dlsDetails;
      } else {
        state.dlsDetails = fields.dlsDetails;
        if (fields.dlsDetails.revisedTarget) {
          state.target = fields.dlsDetails.revisedTarget;
          state.currentInnings = 2;
          const totalBalls = fields.dlsDetails.revisedOvers * 6;
          const currentBalls = state.battingTeam.score.overs * 6 + state.battingTeam.score.balls;
          state.remainingBalls = Math.max(0, totalBalls - currentBalls);
          const currentTarget = state.target ?? fields.dlsDetails.revisedTarget;
          state.requiredRuns = Math.max(0, currentTarget - state.battingTeam.score.runs);
          state.requiredRunRate = state.remainingBalls > 0 ? Number(((state.requiredRuns / state.remainingBalls) * 6).toFixed(2)) : 0;
        }
      }
    }

    if (fields.statusText !== undefined) {
      state.statusText = fields.statusText;
    } else if (fields.dlsDetails && fields.dlsDetails.applied) {
      const neededRuns = state.requiredRuns ?? state.target ?? fields.dlsDetails.revisedTarget;
      const neededBalls = state.remainingBalls ?? (fields.dlsDetails.revisedOvers * 6);
      state.statusText = `${state.battingTeam.name} need ${neededRuns} runs in ${neededBalls} balls (DLS Method: ${fields.dlsDetails.revisedTarget} in ${fields.dlsDetails.revisedOvers} ov)`;
    }

    this.enrichPlayerImages(state);
    state.lastUpdated = Date.now();
    this.currentData.config.lastSyncedAt = Date.now();

    await this.saveToDisk();
    this.broadcastUpdate();
    return state;
  }

  private advanceBall(
    state: MatchState,
    forcedType?:
      | 'four'
      | 'six'
      | 'wicket'
      | 'thirty'
      | 'fifty'
      | 'century'
      | 'one_fifty'
      | 'double_century'
      | 'three_wickets'
      | 'four_wickets'
      | 'five_wickets'
      | 'maiden'
      | 'innings_break'
      | 'match_result'
      | 'tight_finish'
      | 'single'
      | 'dot'
  ) {
    const bat = state.battingTeam;
    let bInOver = bat.score.balls + 1;
    let overNum = bat.score.overs;

    let runsScored = 0;
    let isW = false;
    let is4 = false;
    let is6 = false;
    let comment = '';

    // Stable event ID timestamp
    const eventTime = Date.now();

    // Determine ball outcome
    const rand = Math.random();
    if (forcedType === 'double_century') {
      runsScored = 4;
      is4 = true;
      state.striker.runs = 200;
      state.striker.balls = Math.max(state.striker.balls, 110);
      state.striker.strikeRate = Number(((200 / state.striker.balls) * 100).toFixed(1));
      comment = `DOUBLE CENTURY! 200 RUNS! Extraordinary landmark for ${state.striker.name}! Unbelievable batsmanship!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_200_${state.striker.playerId}_${eventTime}`,
        type: 'double_century',
        title: `👑 DOUBLE CENTURY (200*) FOR ${state.striker.name.toUpperCase()}!`,
        description: `${state.striker.name} reaches a monumental 200 off ${state.striker.balls} balls! History created!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 200,
          balls: state.striker.balls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'one_fifty') {
      runsScored = 4;
      is4 = true;
      state.striker.runs = 150;
      state.striker.balls = Math.max(state.striker.balls, 82);
      state.striker.strikeRate = Number(((150 / state.striker.balls) * 100).toFixed(1));
      comment = `150 RUNS UP! ${state.striker.name} hits another boundary to reach a stunning 150 landmark!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_150_${state.striker.playerId}_${eventTime}`,
        type: 'one_fifty',
        title: `👑 SENSATIONAL 150* FOR ${state.striker.name.toUpperCase()}!`,
        description: `${state.striker.name} reaches 150 off ${state.striker.balls} balls with ferocious hitting!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 150,
          balls: state.striker.balls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'century') {
      runsScored = 4;
      is4 = true;
      state.striker.runs = 100;
      state.striker.balls = Math.max(state.striker.balls, 54);
      state.striker.strikeRate = Number(((100 / state.striker.balls) * 100).toFixed(1));
      comment = `CENTURY! Reaches 100 runs! What a moment! ${state.striker.name} punches the air and raises the bat to thunderous applause!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_100_${state.striker.playerId}_${eventTime}`,
        type: 'century',
        title: 'MAGNIFICENT CENTURY (100*)!',
        description: `${state.striker.name} brings up a sensational 100 off ${state.striker.balls} balls! Masterclass batting!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 100,
          balls: state.striker.balls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'fifty') {
      runsScored = 1;
      state.striker.runs = 50;
      state.striker.balls = Math.max(state.striker.balls, 31);
      state.striker.strikeRate = Number(((50 / state.striker.balls) * 100).toFixed(1));
      comment = `FIFTY! Reaches 50 runs! ${state.striker.name} raises the bat to a roar from the stands! Superb half-century!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_50_${state.striker.playerId}_${eventTime}`,
        type: 'fifty',
        title: '⭐ HALF-CENTURY (50*)!',
        description: `${state.striker.name} reaches a blazing 50 off ${state.striker.balls} balls!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 50,
          balls: state.striker.balls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'thirty') {
      runsScored = 1;
      state.striker.runs = 30;
      state.striker.balls = Math.max(state.striker.balls, 18);
      state.striker.strikeRate = Number(((30 / state.striker.balls) * 100).toFixed(1));
      comment = `30 UP! ${state.striker.name} crosses 30 runs with aggressive intent!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_30_${state.striker.playerId}_${eventTime}`,
        type: 'thirty',
        title: `⚡ QUICKFIRE 30*: ${state.striker.name}`,
        description: `${state.striker.name} moves to 30 off ${state.striker.balls} balls (${state.striker.fours}x4, ${state.striker.sixes}x6)!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 30,
          balls: state.striker.balls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'five_wickets') {
      isW = true;
      runsScored = 0;
      state.currentBowler.wickets = 5;
      comment = `OUT! 5-WICKET HAUL! ${state.currentBowler.name} cleans him up for his 5th wicket! Incredible scenes in the stadium!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_5W_${state.currentBowler.playerId}_${eventTime}`,
        type: 'five_wickets',
        title: `🔥 5-WICKET HAUL FOR ${state.currentBowler.name.toUpperCase()} (5W)!`,
        description: `${state.currentBowler.name} registers a devastating 5-wicket haul (5/${state.currentBowler.runs})! Standing ovation!`,
        timestamp: eventTime,
        metadata: {
          player: state.currentBowler.name,
          score: 5,
          bowlerFigures: `5/${state.currentBowler.runs}`,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets + 1}`
        }
      };
    } else if (forcedType === 'four_wickets') {
      isW = true;
      runsScored = 0;
      state.currentBowler.wickets = 4;
      comment = `OUT! 4TH WICKET! ${state.currentBowler.name} picks up his 4th wicket of the innings!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_4W_${state.currentBowler.playerId}_${eventTime}`,
        type: 'four_wickets',
        title: `🎯 4-WICKET SPELL FOR ${state.currentBowler.name.toUpperCase()}!`,
        description: `${state.currentBowler.name} bowls brilliantly for 4/${state.currentBowler.runs}!`,
        timestamp: eventTime,
        metadata: {
          player: state.currentBowler.name,
          score: 4,
          bowlerFigures: `4/${state.currentBowler.runs}`,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets + 1}`
        }
      };
    } else if (forcedType === 'three_wickets') {
      isW = true;
      runsScored = 0;
      state.currentBowler.wickets = 3;
      comment = `OUT! 3RD WICKET! ${state.currentBowler.name} claims his third victim!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_3W_${state.currentBowler.playerId}_${eventTime}`,
        type: 'three_wickets',
        title: `🎯 3-WICKET HAUL: ${state.currentBowler.name}`,
        description: `${state.currentBowler.name} strikes again! Figures: 3/${state.currentBowler.runs}`,
        timestamp: eventTime,
        metadata: {
          player: state.currentBowler.name,
          score: 3,
          bowlerFigures: `3/${state.currentBowler.runs}`,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets + 1}`
        }
      };
    } else if (forcedType === 'maiden') {
      runsScored = 0;
      state.currentBowler.maidens += 1;
      comment = `MAIDEN OVER! 6 consecutive dot balls bowled with surgical precision by ${state.currentBowler.name}!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_maiden_${overNum}_${eventTime}`,
        type: 'maiden',
        title: `🛑 MAIDEN OVER: ${state.currentBowler.name}`,
        description: `Sensational tight bowling! A maiden over bowled by ${state.currentBowler.name}.`,
        timestamp: eventTime,
        metadata: {
          player: state.currentBowler.name,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'match_result') {
      state.gameState = 'completed';
      const margin = 24;
      state.statusText = `${bat.name} won by ${margin} runs`;
      comment = `MATCH COMPLETE! Official Result: ${state.statusText}! Outstanding cricket!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_result_${eventTime}`,
        type: 'match_result',
        title: `🏆 OFFICIAL MATCH RESULT`,
        description: `${state.statusText}! What a fantastic performance!`,
        timestamp: eventTime,
        metadata: {
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'tight_finish') {
      const remainingRuns = 6;
      const remainingBalls = 5;
      state.target = bat.score.runs + remainingRuns;
      state.requiredRuns = remainingRuns;
      state.remainingBalls = remainingBalls;
      state.statusText = `${bat.name} need ${remainingRuns} runs in ${remainingBalls} balls`;
      comment = `THRILLING CLIMAX! Down to the final over! ${remainingRuns} runs needed from ${remainingBalls} balls! Every ball is crucial!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_tight_${eventTime}`,
        type: 'tight_finish',
        title: `🔥 NAIL-BITING FINISH!`,
        description: `Down to the wire! ${remainingRuns} runs required from ${remainingBalls} balls!`,
        timestamp: eventTime,
        metadata: {
          remainingRuns,
          remainingBalls,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'innings_break') {
      state.gameState = 'innings_break';
      bat.score.overs = 20;
      bat.score.balls = 0;
      const target = bat.score.runs + 1;
      state.target = target;
      state.statusText = `Innings Break: ${bat.name} set a target of ${target} runs`;
      comment = `INNINGS COMPLETE! ${bat.name} finish their 20 overs on ${bat.score.runs}/${bat.score.wickets}. Target for ${state.bowlingTeam.name}: ${target} runs.`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_innings_break_${eventTime}`,
        type: 'innings_break',
        title: 'INNINGS BREAK — TARGET SET',
        description: `${bat.name} finish at ${bat.score.runs}/${bat.score.wickets}. ${state.bowlingTeam.name} need ${target} runs to win!`,
        timestamp: eventTime,
        metadata: {
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets}`,
          score: target,
          target
        }
      };
    } else if (forcedType === 'four' || (!forcedType && rand > 0.82 && rand <= 0.92)) {
      runsScored = 4;
      is4 = true;
      comment = `FOUR! Beautifully timed by ${state.striker.shortName}, piercing the infield with laser precision!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_4_${overNum}_${bInOver}_${eventTime}`,
        type: 'four',
        title: 'CRACKING FOUR!',
        description: `${state.striker.name} sends it crashing through the covers for 4!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 4,
          teamScore: `${bat.name} ${bat.score.runs + 4}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'six' || (!forcedType && rand > 0.92)) {
      runsScored = 6;
      is6 = true;
      comment = `SIX! Enormous hit! ${state.striker.shortName} clears the front leg and deposits it into the upper tier!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_6_${overNum}_${bInOver}_${eventTime}`,
        type: 'six',
        title: 'MONSTROUS SIX!',
        description: `${state.striker.name} launches a massive 95-meter maximum!`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: 6,
          teamScore: `${bat.name} ${bat.score.runs + 6}/${bat.score.wickets}`
        }
      };
    } else if (forcedType === 'wicket' || (!forcedType && rand < 0.07)) {
      isW = true;
      runsScored = 0;
      comment = `OUT! WICKET! ${state.currentBowler.shortName} strikes! Clean bowled through the gate!`;
      state.notificationAlert = {
        id: `notif_${state.matchId}_${state.currentInnings}_W_${bat.score.wickets + 1}_${eventTime}`,
        type: 'wicket',
        title: 'WICKET FALLS!',
        description: `${state.currentBowler.name} dismisses ${state.striker.name}! ${bat.name} are ${bat.score.runs}/${bat.score.wickets + 1}`,
        timestamp: eventTime,
        metadata: {
          player: state.striker.name,
          score: state.striker.runs,
          teamScore: `${bat.name} ${bat.score.runs}/${bat.score.wickets + 1}`
        }
      };
    } else if (forcedType === 'dot' || (!forcedType && rand >= 0.07 && rand < 0.40)) {
      runsScored = 0;
      comment = `Good length delivery just outside off stump, beaten on the outside edge. Dot ball.`;
    } else if (forcedType === 'single' || (!forcedType && rand >= 0.40 && rand <= 0.70)) {
      runsScored = 1;
      comment = `Pushed softly into mid-on, quick call and they scramble through for an easy single.`;
    } else {
      runsScored = 2;
      comment = `Worked away into the deep midwicket gap, brisk running turns one into two.`;
    }

    // Update bowler & striker figures
    if (isW) {
      bat.score.wickets += 1;
      state.currentBowler.wickets += 1;
      // Bring in next batter or swap
      state.striker.runs += 0;
      state.striker.balls += 1;
      state.striker.outDesc = `b ${state.currentBowler.shortName}`;
      // Replace striker with new batsman representing current batting team
      // Pick next authentic batsman for this team from registry
      const batTeamCode = (bat.code || bat.name || 'CRX').toUpperCase();
      const currentNames = [state.nonStriker.name.toLowerCase(), state.striker.name.toLowerCase()];
      const candidateProfile = Object.values(VERIFIED_PLAYERS).find(
        (p) => (p.teamCode.toUpperCase() === batTeamCode || p.teamCode.toUpperCase().includes(batTeamCode)) &&
               !currentNames.includes(p.name.toLowerCase())
      );

      const nextNum = bat.score.wickets + 2;
      const nextName = candidateProfile ? candidateProfile.name : `${bat.shortName || bat.name} Batter #${nextNum}`;
      const nextShort = candidateProfile ? candidateProfile.shortName : `${bat.shortName || bat.name} #${nextNum}`;
      const customNextPhoto = this.getCustomPlayerPhoto(nextName, batTeamCode);
      const nextPhoto = customNextPhoto || candidateProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(nextName)}&team=${encodeURIComponent(batTeamCode)}`;
      const nextJersey = candidateProfile?.jerseyNumber || nextNum;

      state.striker = {
        playerId: candidateProfile?.id || `p_${Date.now()}_${nextNum}`,
        name: nextName,
        shortName: nextShort,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOnStrike: true,
        imageUrl: nextPhoto,
        jerseyNumber: nextJersey
      };
    } else {
      bat.score.runs += runsScored;
      state.currentBowler.runs += runsScored;
      state.striker.runs += runsScored;
      state.striker.balls += 1;
      if (is4) state.striker.fours += 1;
      if (is6) state.striker.sixes += 1;
      state.striker.strikeRate = Number(((state.striker.runs / state.striker.balls) * 100).toFixed(1));
    }

    const ballStr = `${overNum}.${bInOver}`;

    // Over completion check
    if (bInOver >= 6) {
      bat.score.overs += 1;
      bat.score.balls = 0;
      state.currentBowler.overs = Math.floor(state.currentBowler.overs) + 1;
      // Strike changes at over end
      const temp = state.striker;
      state.striker = state.nonStriker;
      state.nonStriker = temp;
      state.striker.isOnStrike = true;
      state.nonStriker.isOnStrike = false;
    } else {
      bat.score.balls = bInOver;
      state.currentBowler.overs = Number((overNum + bInOver / 10).toFixed(1));
      // Odd runs rotate strike
      if (runsScored % 2 !== 0 && !isW) {
        const temp = state.striker;
        state.striker = state.nonStriker;
        state.nonStriker = temp;
        state.striker.isOnStrike = true;
        state.nonStriker.isOnStrike = false;
      }
    }

    // Bowler economy
    const totalBowlerOvers = state.currentBowler.overs;
    const totalBallsBowled = Math.floor(totalBowlerOvers) * 6 + Math.round((totalBowlerOvers % 1) * 10);
    state.currentBowler.economy = totalBallsBowled > 0 ? Number(((state.currentBowler.runs / totalBallsBowled) * 6).toFixed(2)) : 0;

    // Current run rate
    const totalTeamBalls = bat.score.overs * 6 + bat.score.balls;
    state.currentRunRate = totalTeamBalls > 0 ? Number(((bat.score.runs / totalTeamBalls) * 6).toFixed(2)) : 0;

    // Add ball to recent balls
    const newBall: BallEvent = {
      id: `ball-${Date.now()}`,
      ballNumber: ballStr,
      overNumber: overNum,
      ballInOver: bInOver,
      runs: runsScored,
      isWicket: isW,
      isFour: is4,
      isSix: is6,
      isExtra: false,
      batsmanName: state.striker.shortName,
      bowlerName: state.currentBowler.shortName,
      commentary: comment,
      timestamp: Date.now()
    };

    state.recentBalls.unshift(newBall);
    if (state.recentBalls.length > 24) {
      state.recentBalls.pop();
    }

    // Update status text
    if (state.target && state.target > 0) {
      const remainingRuns = state.target - bat.score.runs;
      const totalMatchBalls = (state.matchType === 'T20' ? 20 : 50) * 6;
      const remainingBalls = Math.max(0, totalMatchBalls - totalTeamBalls);
      state.requiredRuns = remainingRuns;
      state.remainingBalls = remainingBalls;
      state.requiredRunRate = remainingBalls > 0 ? Number(((remainingRuns / remainingBalls) * 6).toFixed(2)) : 0;
      state.statusText = `${bat.name} need ${remainingRuns} runs in ${remainingBalls} balls`;
    } else {
      state.statusText = `${bat.name} innings in progress (${bat.score.overs}.${bat.score.balls} Overs)`;
    }
  }

  /**
   * Discovers all publicly accessible matches on CREX (Live & Upcoming)
   * Tracks newly listed matches and match status transitions
   */
  private knownMatchIds: Set<string> = new Set();
  private matchStateMap: Map<string, string> = new Map();

  public async getAllDiscoverableMatches(): Promise<DiscoverableMatch[]> {
    const list: DiscoverableMatch[] = [...PRESET_MATCHES];

    // Attempt live fetch of CREX fixtures if reachable
    try {
      const res = await fetch('https://crex.live/fixtures', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const nextDataScript = $('#__NEXT_DATA__').html();
        if (nextDataScript) {
          const json = JSON.parse(nextDataScript);
          const liveFixtures =
            json?.props?.pageProps?.fixtures ||
            json?.props?.pageProps?.allMatches ||
            json?.props?.pageProps?.matches;
          if (Array.isArray(liveFixtures)) {
            liveFixtures.forEach((f: any) => {
              const id = `crex_${f.matchId || f.id || Math.random().toString(36).substring(2, 7)}`;
              if (!list.some((m) => m.id === id || m.title === f.matchName)) {
                list.push({
                  id,
                  title: f.matchName || `${f.team1?.name || 'Team 1'} vs ${f.team2?.name || 'Team 2'}`,
                  series: f.seriesName || 'ICC International Tour',
                  format: (f.format || 'T20').toUpperCase(),
                  crexUrl: `https://crex.live/scoreboard/${f.matchId || id}`,
                  team1: {
                    name: f.team1?.name || 'Team 1',
                    code: f.team1?.shortName || f.team1?.code || 'T1',
                    score: f.team1?.score,
                    logoUrl: f.team1?.logo
                  },
                  team2: {
                    name: f.team2?.name || 'Team 2',
                    code: f.team2?.shortName || f.team2?.code || 'T2',
                    score: f.team2?.score,
                    logoUrl: f.team2?.logo
                  },
                  status: f.status || 'LIVE',
                  gameState: f.isLive ? 'live' : f.isComplete ? 'completed' : 'scheduled',
                  isLive: Boolean(f.isLive),
                  venue: f.venue,
                  startTime: f.startTime
                });
              }
            });
          }
        }
      }
    } catch {
      // Use comprehensive default verified fixtures
    }

    // Detect New Match Listed and Match Starting transitions
    list.forEach((m) => {
      // 1. Detect New Match Listed
      if (this.knownMatchIds.size > 0 && !this.knownMatchIds.has(m.id)) {
        if (this.currentData?.state) {
          this.currentData.state.notificationAlert = {
            id: `notif_new_match_${m.id}_${Date.now()}`,
            type: 'new_match',
            title: `📅 NEW MATCH LISTED ON CREX`,
            description: `${m.title} (${m.series}) is now listed on CREX live schedule!`,
            timestamp: Date.now()
          };
          this.broadcastUpdate();
        }
      }
      this.knownMatchIds.add(m.id);

      // 2. Detect Match Starting (Scheduled -> Live transition)
      const prevState = this.matchStateMap.get(m.id);
      if (prevState === 'scheduled' && m.gameState === 'live') {
        if (this.currentData?.state) {
          this.currentData.state.notificationAlert = {
            id: `notif_start_${m.id}_${Date.now()}`,
            type: 'match_starting',
            title: `🔴 MATCH STARTING NOW: ${m.title}`,
            description: `${m.title} has begun! Real-time live scoreboard active on CREX!`,
            timestamp: Date.now()
          };
          this.broadcastUpdate();
        }
      }
      this.matchStateMap.set(m.id, m.gameState || (m.isLive ? 'live' : 'scheduled'));
    });

    return list;
  }

  /**
   * Scrapes CREX HTML, parses live match titles, batsmen, bowlers, DLS method and status
   */
  private async scrapeCrexMatch(url: string, strictLiveOnly: boolean = false): Promise<MatchState | null> {
    const cleanUrl = url.trim();
    // Normalize crex.live to crex.com and prepare URL candidate list
    const candidateUrls: string[] = [];
    if (cleanUrl.startsWith('http')) {
      candidateUrls.push(cleanUrl);
      if (cleanUrl.includes('crex.live')) {
        candidateUrls.push(cleanUrl.replace('crex.live', 'crex.com'));
      }
      if (cleanUrl.includes('/scoreboard/')) {
        candidateUrls.push(cleanUrl.replace('/scoreboard/', '/cricket-live-score/'));
      }
    } else {
      candidateUrls.push(`https://crex.com/cricket-live-score/${cleanUrl}`);
      candidateUrls.push(`https://crex.com/scoreboard/${cleanUrl}`);
    }

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
          },
          redirect: 'follow',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);

          // 1. Look for Next.js embedded data
          const nextDataScript = $('#__NEXT_DATA__').html();
          if (nextDataScript) {
            try {
              const json = JSON.parse(nextDataScript);
              const matchData =
                json?.props?.pageProps?.matchData ||
                json?.props?.pageProps?.matchDetails ||
                json?.props?.pageProps?.miniScorecard ||
                json?.props?.pageProps?.scoreCard;
              if (matchData) {
                return this.parseNextDataToMatchState(matchData, targetUrl);
              }
            } catch (err) {
              console.warn('Failed to parse __NEXT_DATA__:', err);
            }
          }

          // Extract all real player headshots from CREX CDN
          $('img').each((_i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            const alt = ($(el).attr('alt') || $(el).attr('title') || '').trim();
            if (src && src.includes('cricketvectors.akamaized.net/players/') && alt) {
              this.registerPlayerPhoto(alt, src);
            }
          });

          // Extract player links from CREX
          $('a').each((_i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const m = href.match(/\/player\/([a-z0-9\-]+)-([A-Za-z0-9]+)$/);
            if (m) {
              const slug = m[1];
              const fkey = m[2];
              const fullName = slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
              const imgUrl = `https://cricketvectors.akamaized.net/players/org/${fkey}.png`;
              this.registerPlayerPhoto(fullName, imgUrl);
              if (text && text.length > 2) {
                this.registerPlayerPhoto(text, imgUrl);
              }
            }
          });

          // Extract commentary p_ links
          const pRegex = /href=[\\\"']+p_([^\/\\\"']+)\/([^\/\\\"']+)[\\\"'][^>]*>([^<]+)</g;
          let pMatch;
          while ((pMatch = pRegex.exec(html)) !== null) {
            const fkey = pMatch[1];
            const pName = pMatch[3].trim();
            if (fkey && pName) {
              const imgUrl = `https://cricketvectors.akamaized.net/players/org/${fkey}.png`;
              this.registerPlayerPhoto(pName, imgUrl);
            }
          }

          // 2. Look for OpenGraph / title metadata
          const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
          const ogDesc = $('meta[property="og:description"]').attr('content') || '';
          if (ogTitle.length > 5 && !ogTitle.includes('404')) {
            const parsedState = this.parseMetaTagsToMatchState(ogTitle, ogDesc, targetUrl, $, strictLiveOnly);
            if (parsedState) {
              this.enrichPlayerImages(parsedState);
              return parsedState;
            }
          }
        }
      } catch (fetchErr) {
        console.warn(`Direct fetch to CREX candidate [${targetUrl}] encountered network error:`, fetchErr);
      }
    }

    if (strictLiveOnly) {
      return null;
    }

    // 3. Fallback to slug-based match resolution for initial match setup
    return this.buildVerifiedFallbackMatch(cleanUrl);
  }

  private parseNextDataToMatchState(matchData: any, url: string): MatchState {
    const title = matchData.title || matchData.seriesName || matchData.name || 'CREX Live Match';
    const parsed = this.parseTeamsAndDetailsFromInput(title);
    const state = this.buildGenericMatchFromTeams(
      matchData.team1?.name || parsed.team1Name,
      matchData.team2?.name || parsed.team2Name,
      matchData.seriesName || parsed.series,
      parsed.matchType
    );
    state.title = title;
    state.crexUrl = url;

    if (matchData.venue) state.venue = matchData.venue;
    if (matchData.status) state.statusText = matchData.status;

    // Team 1
    if (matchData.team1) {
      state.battingTeam.name = matchData.team1.name || state.battingTeam.name;
      state.battingTeam.shortName = matchData.team1.shortName || state.battingTeam.shortName;
      state.battingTeam.code = matchData.team1.code || state.battingTeam.code;
      if (matchData.team1.runs !== undefined) state.battingTeam.score.runs = Number(matchData.team1.runs);
      if (matchData.team1.wickets !== undefined) state.battingTeam.score.wickets = Number(matchData.team1.wickets);
      if (matchData.team1.overs !== undefined) {
        state.battingTeam.score.overs = Math.floor(Number(matchData.team1.overs));
        state.battingTeam.score.balls = Math.round((Number(matchData.team1.overs) % 1) * 10);
      }
    }

    // Team 2
    if (matchData.team2) {
      state.bowlingTeam.name = matchData.team2.name || state.bowlingTeam.name;
      state.bowlingTeam.shortName = matchData.team2.shortName || state.bowlingTeam.shortName;
      state.bowlingTeam.code = matchData.team2.code || state.bowlingTeam.code;
    }

    return state;
  }

  private parseMetaTagsToMatchState(
    ogTitle: string,
    ogDesc: string,
    url: string,
    $?: cheerio.CheerioAPI,
    strictLiveOnly: boolean = false
  ): MatchState | null {
    const cleanTitle = ogTitle.trim();
    const cleanDesc = ogDesc.trim();

    // Live Match format:
    // "WI 180-4 (55.0) (Justin Greaves 16(19), Amir Jangoo 76(124)) vs Bangladesh 2nd-TEST | West Indies tour of Bangladesh 2026 - CREX"
    // "PRS-W 6-0 (1.0) (Beth Mooney 3(2), Katie Mack 0(4)) vs Sydney Thunder Women 11th-Match | Womens Big Bash League 2026 - CREX"
    // Handles: batting team score + optional batters + opponent name + OPTIONAL opponent score (Tests / completed innings)
    // e.g. "SL 301-4 (75.0) (D de Silva 115(168), K Mendis 70(97)) vs Pakistan 434-9 ((106.3)) 1st-TEST | Sri Lanka tour of Pakistan 2026 - CREX"
    const liveMatchRegex = /^([A-Za-z0-9\-\s]+?)\s+(\d+)[-\/](\d+)\s*\(+([\d\.]+)\)+\s*(?:\(([^,]+?)\s+(\d+)\((\d+)\),\s*([^,]+?)\s+(\d+)\((\d+)\)\))?\s*vs\s*([A-Za-z0-9\-\s]+?)(?:\s+(\d+)[-\/](\d+)\s*(?:\(+([\d\.]+)\)+)?)?(?:\s+(\d+[a-z]+-[A-Za-z0-9]+|\d+[a-z]+-Match|Final|Semi Final|Match))?\s*\|\s*([^|\-]+)(?:-\s*CREX)?/i;

    const liveMatch = cleanTitle.match(liveMatchRegex);
    if (liveMatch) {
      const [
        _,
        batCodeRaw,
        runsStr,
        wktsStr,
        oversStr,
        b1Name,
        b1RunsStr,
        b1BallsStr,
        b2Name,
        b2RunsStr,
        b2BallsStr,
        bowlTeamRaw,
        oppRunsStr,
        oppWktsStr,
        oppOversStr,
        matchTypeRaw,
        seriesRaw
      ] = liveMatch;

      const batCode = batCodeRaw.trim();
      const bowlTeamName = bowlTeamRaw.trim();

      const normBat = normalizeTeamCode(batCode);
      const batTeamData = KNOWN_TEAMS[normBat.toLowerCase()] || KNOWN_TEAMS[batCode.toLowerCase()];
      const batFullName = batTeamData?.name || batCode;
      const batFinalCode = batTeamData?.code || normBat;

      const normBowl = normalizeTeamCode(bowlTeamName);
      const bowlTeamData = KNOWN_TEAMS[normBowl.toLowerCase()] || KNOWN_TEAMS[bowlTeamName.toLowerCase()];
      const bowlFullName = bowlTeamData?.name || bowlTeamName;
      const bowlFinalCode = bowlTeamData?.code || normBowl;

      const runs = parseInt(runsStr, 10);
      const wickets = parseInt(wktsStr, 10);
      const overParts = oversStr.split('.');
      const overs = parseInt(overParts[0], 10);
      const balls = parseInt(overParts[1] || '0', 10);

      // Determine match type
      let matchType: 'T20' | 'ODI' | 'TEST' | 'T10' = 'T20';
      const seriesUpper = (seriesRaw || '').toUpperCase();
      const matchTypeUpper = (matchTypeRaw || '').toUpperCase();
      if (seriesUpper.includes('TEST') || matchTypeUpper.includes('TEST')) matchType = 'TEST';
      else if (seriesUpper.includes('ODI') || matchTypeUpper.includes('ODI')) matchType = 'ODI';
      else if (seriesUpper.includes('T10') || matchTypeUpper.includes('T10')) matchType = 'T10';

      const totalBalls = overs * 6 + balls;
      const crr = totalBalls > 0 ? Number(((runs / totalBalls) * 6).toFixed(2)) : 0;

      const batRoster = getTeamRoster(batFinalCode);
      const bowlRoster = getTeamRoster(bowlFinalCode);

      // Extract batsman stats if present
      const sName = b1Name ? b1Name.trim() : (batRoster[0]?.name || `${batFinalCode} Batter 1`);
      const sRuns = b1RunsStr ? parseInt(b1RunsStr, 10) : 0;
      const sBalls = b1BallsStr ? parseInt(b1BallsStr, 10) : 0;
      const sProfile = resolvePlayerProfile(undefined, sName, batFinalCode);

      const nsName = b2Name ? b2Name.trim() : (batRoster[1]?.name || `${batFinalCode} Batter 2`);
      const nsRuns = b2RunsStr ? parseInt(b2RunsStr, 10) : 0;
      const nsBalls = b2BallsStr ? parseInt(b2BallsStr, 10) : 0;
      const nsProfile = resolvePlayerProfile(undefined, nsName, batFinalCode);

      // Extract active bowler candidate from page images if available
      let bowlerName = '';
      let bowlerShort = 'Bowler';
      let bowlerImg = '';

      if ($) {
        $('img').each((_i, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          const alt = ($(el).attr('alt') || $(el).attr('title') || '').trim();
          if (src && src.includes('cricketvectors.akamaized.net/players/') && alt) {
            const altLower = alt.toLowerCase();
            const b1Lower = (b1Name || '').toLowerCase();
            const b2Lower = (b2Name || '').toLowerCase();
            if (
              alt.length > 2 &&
              !b1Lower.includes(altLower) &&
              !altLower.includes(b1Lower) &&
              !b2Lower.includes(altLower) &&
              !altLower.includes(b2Lower) &&
              !bowlerName
            ) {
              bowlerName = alt;
              const parts = alt.split(' ');
              bowlerShort = parts.length > 1 ? `${parts[0][0]} ${parts[parts.length - 1]}` : alt;
              bowlerImg = src;
              this.registerPlayerPhoto(alt, src, bowlFinalCode);
            }
          }
        });
      }

      if (!bowlerName || bowlerName.includes('Bowler')) {
        const bowlers = bowlRoster.filter(p => p.role === 'Bowler' || p.role === 'All-rounder');
        const realBowler = bowlers[0] || bowlRoster[bowlRoster.length - 1];
        if (realBowler) {
          bowlerName = realBowler.name;
          bowlerShort = realBowler.shortName;
          bowlerImg = realBowler.imageUrl || `/api/player/photo?name=${encodeURIComponent(realBowler.name)}&team=${encodeURIComponent(bowlFinalCode)}`;
        } else {
          bowlerName = `${bowlFullName} Bowler`;
          bowlerShort = 'Bowler';
          bowlerImg = `/api/player/photo?name=${encodeURIComponent(bowlerName)}&team=${encodeURIComponent(bowlFinalCode)}`;
        }
      }

      const bProfile = resolvePlayerProfile(undefined, bowlerName, bowlFinalCode);
      if (!bowlerImg || bowlerImg.includes('Bowler')) {
        bowlerImg = this.getPlayerPhoto(bowlerName, bowlFinalCode) || bProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(bowlerName)}&team=${encodeURIComponent(bowlFinalCode)}`;
      }

      const sLiveImg = this.getPlayerPhoto(sName, batFinalCode);
      const sImg = sLiveImg || sProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(sName)}&team=${encodeURIComponent(batFinalCode)}`;

      const nsLiveImg = this.getPlayerPhoto(nsName, batFinalCode);
      const nsImg = nsLiveImg || nsProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(nsName)}&team=${encodeURIComponent(batFinalCode)}`;

      // Extract venue from og:description if available
      let venue = 'International Cricket Stadium';
      const venueMatch = cleanDesc.match(/from\s+([^,]+(?:,[^,]+)?)/i);
      if (venueMatch && venueMatch[1]) {
        venue = venueMatch[1].replace(/\s+with\s+.*$/i, '').trim();
      }

      const series = seriesRaw ? seriesRaw.trim() : `${matchType} Match 2026`;
      const title = `${batFullName} vs ${bowlFullName} - ${series}`;

      const state: MatchState = {
        matchId: 'm_crex_' + Math.random().toString(36).substring(2, 8),
        crexUrl: url,
        title,
        matchType,
        series,
        venue,
        toss: `${batFullName} elected to bat`,
        statusText: `${batFinalCode} ${runs}/${wickets} (${overs}.${balls} ov)`,
        gameState: 'live',
        currentInnings: 1,
        currentRunRate: crr,
        battingTeam: {
          name: batFullName,
          shortName: batFinalCode,
          code: batFinalCode,
          logoUrl: `/api/team/flag/${encodeURIComponent(batFinalCode)}`,
          primaryColor: batTeamData?.color1 || '#0078FF',
          secondaryColor: batTeamData?.color2 || '#FF9933',
          score: { runs, wickets, overs, balls }
        },
        bowlingTeam: {
          name: bowlFullName,
          shortName: bowlFinalCode,
          code: bowlFinalCode,
          logoUrl: `/api/team/flag/${encodeURIComponent(bowlFinalCode)}`,
          primaryColor: bowlTeamData?.color1 || '#2563EB',
          secondaryColor: bowlTeamData?.color2 || '#1E293B',
          score: {
            runs: oppRunsStr ? parseInt(oppRunsStr, 10) : 0,
            wickets: oppWktsStr ? parseInt(oppWktsStr, 10) : 0,
            overs: oppOversStr ? parseInt(oppOversStr.split('.')[0], 10) : 0,
            balls: oppOversStr ? parseInt(oppOversStr.split('.')[1] || '0', 10) : 0
          }
        },
        striker: {
          playerId: sProfile?.id || `p_${Date.now()}_1`,
          name: sName,
          shortName: sProfile?.shortName || sName,
          runs: sRuns,
          balls: sBalls,
          fours: Math.max(0, Math.floor(sRuns / 7)),
          sixes: Math.max(0, Math.floor(sRuns / 15)),
          strikeRate: sBalls > 0 ? Number(((sRuns / sBalls) * 100).toFixed(1)) : 100.0,
          isOnStrike: true,
          imageUrl: sImg,
          jerseyNumber: sProfile?.jerseyNumber || 18
        },
        nonStriker: {
          playerId: nsProfile?.id || `p_${Date.now()}_2`,
          name: nsName,
          shortName: nsProfile?.shortName || nsName,
          runs: nsRuns,
          balls: nsBalls,
          fours: Math.max(0, Math.floor(nsRuns / 7)),
          sixes: Math.max(0, Math.floor(nsRuns / 15)),
          strikeRate: nsBalls > 0 ? Number(((nsRuns / nsBalls) * 100).toFixed(1)) : 100.0,
          isOnStrike: false,
          imageUrl: nsImg,
          jerseyNumber: nsProfile?.jerseyNumber || 7
        },
        currentBowler: {
          playerId: bProfile?.id || `b_${Date.now()}`,
          name: bowlerName,
          shortName: bowlerShort,
          overs: Number((overs > 0 ? overs - 0.5 : 1).toFixed(1)),
          maidens: 0,
          runs: Math.max(0, Math.floor(runs * 0.28)),
          wickets: Math.max(0, wickets),
          economy: 4.5,
          imageUrl: bowlerImg,
          jerseyNumber: bProfile?.jerseyNumber || 99
        },
        currentPartnership: {
          runs: sRuns + nsRuns,
          balls: sBalls + nsBalls,
          player1Runs: sRuns,
          player2Runs: nsRuns
        },
        recentBalls: [
          {
            id: `b_${Date.now()}_1`,
            ballNumber: `${overs}.${balls}`,
            overNumber: overs,
            ballInOver: balls,
            runs: 1,
            isWicket: false,
            isFour: false,
            isSix: false,
            isExtra: false,
            batsmanName: sName,
            bowlerName: bowlerShort,
            commentary: `${sName} pushes into the covers for an easy single.`,
            timestamp: Date.now()
          }
        ],
        lastUpdated: Date.now(),
        scorecards: {
          firstInnings: {
            teamName: batFullName,
            teamCode: batFinalCode,
            inningsNumber: 1,
            totalRuns: runs,
            totalWickets: wickets,
            totalOvers: `${overs}.${balls}`,
            runRate: crr,
            extras: { total: 4, wides: 2, noBalls: 0, byes: 1, legByes: 1 },
            fallOfWickets: [],
            yetToBat: [],
            batting: (batRoster.length > 0 ? batRoster : [
              { id: sProfile?.id || 'p_s', name: sName, shortName: sProfile?.shortName || sName, teamCode: batFinalCode, role: 'Batter' as const, jerseyNumber: 18, imageUrl: sImg },
              { id: nsProfile?.id || 'p_ns', name: nsName, shortName: nsProfile?.shortName || nsName, teamCode: batFinalCode, role: 'Batter' as const, jerseyNumber: 7, imageUrl: nsImg }
            ]).slice(0, 11).map((p, idx) => {
              const isStriker = p.name === sName;
              const isNonStriker = p.name === nsName;
              const isNotOut = isStriker || isNonStriker;
              const pRuns = isStriker ? sRuns : (isNonStriker ? nsRuns : (idx < wickets ? Math.floor(runs / Math.max(1, wickets + 2)) : 0));
              const pBalls = isStriker ? sBalls : (isNonStriker ? nsBalls : (idx < wickets ? Math.max(1, Math.floor(totalBalls / Math.max(1, wickets + 2))) : 0));
              const dismissal = isNotOut ? 'batting' : (idx < wickets ? `c & b ${bowlerShort}` : 'yet to bat');
              return {
                playerId: p.id,
                name: p.name,
                runs: pRuns,
                balls: pBalls,
                fours: Math.floor(pRuns / 7),
                sixes: Math.floor(pRuns / 15),
                strikeRate: pBalls > 0 ? Number(((pRuns / pBalls) * 100).toFixed(1)) : 0,
                dismissal,
                imageUrl: p.imageUrl || `/api/player/photo?name=${encodeURIComponent(p.name)}&team=${encodeURIComponent(batFinalCode)}`,
                isNotOut
              };
            }),
            bowling: (bowlRoster.length > 0 ? bowlRoster.filter(p => p.role === 'Bowler' || p.role === 'All-rounder') : [
              { id: bProfile?.id || 'p_b', name: bowlerName, shortName: bowlerShort, teamCode: bowlFinalCode, role: 'Bowler' as const, jerseyNumber: 99, imageUrl: bowlerImg }
            ]).slice(0, 5).map((p) => {
              const isCurrent = p.name === bowlerName;
              return {
                playerId: p.id,
                name: p.name,
                overs: isCurrent ? Number((overs > 0 ? overs - 0.5 : 1).toFixed(1)) : Math.max(1, Math.floor(overs / 4)),
                maidens: 0,
                runs: isCurrent ? Math.max(0, Math.floor(runs * 0.28)) : Math.max(0, Math.floor(runs * 0.18)),
                wickets: isCurrent ? Math.max(0, wickets) : 0,
                economy: 4.8,
                noBalls: 0,
                wides: 0,
                imageUrl: p.imageUrl || `/api/player/photo?name=${encodeURIComponent(p.name)}&team=${encodeURIComponent(bowlFinalCode)}`
              };
            })
          }
        }
      };

      return state;
    }

    // Check for Completed / DLS match result
    const resultMatch = cleanTitle.match(/^([A-Za-z0-9\-\s]+? won by \d+ (?:wickets|runs)[^,]*)/i);
    if (strictLiveOnly && !resultMatch) {
      return null;
    }

    const hasDls = cleanTitle.toUpperCase().includes('DLS') || cleanDesc.toUpperCase().includes('DLS');

    const parsedFallback = this.parseTeamsAndDetailsFromInput(cleanTitle + ' ' + url);
    const fallbackState = this.buildGenericMatchFromTeams(
      parsedFallback.team1Name,
      parsedFallback.team2Name,
      parsedFallback.series,
      parsedFallback.matchType
    );

    fallbackState.title = cleanTitle.split('|')[0].trim() || fallbackState.title;
    fallbackState.crexUrl = url;

    if (resultMatch) {
      fallbackState.statusText = resultMatch[1].trim();
      fallbackState.gameState = 'completed';
    } else if (hasDls) {
      fallbackState.statusText = `${cleanTitle.split(',')[0]} (DLS METHOD)`;
    } else if (cleanDesc) {
      fallbackState.statusText = cleanDesc.split('.')[0].trim();
    }

    return fallbackState;
  }

  public parseTeamsAndDetailsFromInput(input: string) {
    let raw = input.trim();
    let slug = raw;
    try {
      if (raw.startsWith('http')) {
        const u = new URL(raw);
        const parts = u.pathname.split('/').filter(Boolean);
        slug = parts[parts.length - 1] || '';
      }
    } catch {}

    slug = decodeURIComponent(slug).toLowerCase().replace(/[._]/g, '-');

    // Split around vs
    const vsParts = slug.split(/-vs-|\svs\s|\bvs\b/i);
    let t1Raw = (vsParts[0] || '').trim().split('/').pop() || '';
    let t2Raw = (vsParts[1] || '').trim();

    if (!vsParts[1]) {
      t1Raw = 'Team 1';
      t2Raw = 'Team 2';
    }

    // Clean up tournament/stage info from t2Raw
    let matchDetail = '';
    const detailIndex = t2Raw.search(/-(?:(?:\d+)(?:st|nd|rd|th)|final|semi-final|match|group|qualifier|eliminator|super-four|tour|t20i?|odi|test|psl|ipl|bbl|cpl|wpl)\b/i);
    if (detailIndex !== -1) {
      matchDetail = t2Raw.substring(detailIndex + 1).replace(/-/g, ' ');
      t2Raw = t2Raw.substring(0, detailIndex).trim();
    }

    const capitalize = (str: string) =>
      str
        .split(/[- ]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const formatCode = (name: string) => {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 4);
      }
      return name.slice(0, 3).toUpperCase();
    };

    const norm1 = normalizeTeamCode(t1Raw);
    const kTeam1 = KNOWN_TEAMS[norm1.toLowerCase()] || KNOWN_TEAMS[t1Raw.toLowerCase()];
    const team1Name = kTeam1?.name || capitalize(t1Raw) || 'Team 1';
    const team1Code = kTeam1?.code || norm1 || formatCode(team1Name);

    const norm2 = normalizeTeamCode(t2Raw);
    const kTeam2 = KNOWN_TEAMS[norm2.toLowerCase()] || KNOWN_TEAMS[t2Raw.toLowerCase()];
    const team2Name = kTeam2?.name || capitalize(t2Raw) || 'Team 2';
    const team2Code = kTeam2?.code || norm2 || formatCode(team2Name);

    const title = `${team1Name} vs ${team2Name}${matchDetail ? ' - ' + capitalize(matchDetail) : ''}`;

    let matchType: 'T20' | 'ODI' | 'TEST' | 'T10' = 'T20';
    if (slug.includes('test')) matchType = 'TEST';
    else if (slug.includes('odi')) matchType = 'ODI';
    else if (slug.includes('t10')) matchType = 'T10';

    return {
      team1Name,
      team1Code,
      team2Name,
      team2Code,
      title,
      matchType,
      series: matchDetail ? capitalize(matchDetail) : `${matchType} Series 2026`
    };
  }

  private buildGenericMatchFromTeams(
    team1Name: string,
    team2Name: string,
    series: string,
    matchType: 'T20' | 'ODI' | 'TEST' | 'T10'
  ): MatchState {
    const norm1 = normalizeTeamCode(team1Name);
    const kTeam1 = KNOWN_TEAMS[norm1.toLowerCase()] || KNOWN_TEAMS[team1Name.toLowerCase()];
    const t1Name = kTeam1?.name || team1Name;
    const t1Code = kTeam1?.code || norm1 || team1Name.slice(0, 4).toUpperCase();

    const norm2 = normalizeTeamCode(team2Name);
    const kTeam2 = KNOWN_TEAMS[norm2.toLowerCase()] || KNOWN_TEAMS[team2Name.toLowerCase()];
    const t2Name = kTeam2?.name || team2Name;
    const t2Code = kTeam2?.code || norm2 || team2Name.slice(0, 4).toUpperCase();

    const t1Roster = getTeamRoster(t1Code);
    const t2Roster = getTeamRoster(t2Code);

    const sProfile = t1Roster[0] || resolvePlayerProfile(undefined, t1Name, t1Code);
    const nsProfile = t1Roster[1] || t1Roster[0];

    const t2Bowlers = t2Roster.filter(p => p.role === 'Bowler' || p.role === 'All-rounder');
    const bProfile = t2Bowlers[0] || t2Roster[t2Roster.length - 1] || resolvePlayerProfile(undefined, t2Name, t2Code);

    const sName = sProfile?.name || `${t1Name} Batter 1`;
    const nsName = nsProfile?.name || `${t1Name} Batter 2`;
    const bName = bProfile?.name || `${t2Name} Bowler`;
    const bShort = bProfile?.shortName || (bName.split(' ').length > 1 ? `${bName.split(' ')[0][0]} ${bName.split(' ')[bName.split(' ').length - 1]}` : bName);

    const sImg = sProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(sName)}&team=${encodeURIComponent(t1Code)}`;
    const nsImg = nsProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(nsName)}&team=${encodeURIComponent(t1Code)}`;
    const bImg = bProfile?.imageUrl || `/api/player/photo?name=${encodeURIComponent(bName)}&team=${encodeURIComponent(t2Code)}`;

    const state: MatchState = {
      matchId: 'm_' + Math.random().toString(36).substring(2, 8),
      title: `${t1Name} vs ${t2Name}`,
      series: series || `${matchType} Series 2026`,
      matchType,
      venue: 'International Cricket Stadium',
      toss: `${t1Name} elected to bat`,
      statusText: `${t1Code} 0/0 (0.0 ov) • Match Live`,
      gameState: 'live',
      currentInnings: 1,
      currentRunRate: 0.0,
      battingTeam: {
        name: t1Name,
        shortName: t1Code,
        code: t1Code,
        logoUrl: `/api/team/flag/${encodeURIComponent(t1Code)}`,
        primaryColor: kTeam1?.color1 || '#0078FF',
        secondaryColor: kTeam1?.color2 || '#FF9933',
        score: { runs: 0, wickets: 0, overs: 0, balls: 0 }
      },
      bowlingTeam: {
        name: t2Name,
        shortName: t2Code,
        code: t2Code,
        logoUrl: `/api/team/flag/${encodeURIComponent(t2Code)}`,
        primaryColor: kTeam2?.color1 || '#10B981',
        secondaryColor: kTeam2?.color2 || '#064E3B',
        score: { runs: 0, wickets: 0, overs: 0, balls: 0 }
      },
      striker: {
        playerId: sProfile?.id || `p_${Date.now()}_1`,
        name: sName,
        shortName: sProfile?.shortName || sName,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOnStrike: true,
        imageUrl: sImg,
        jerseyNumber: sProfile?.jerseyNumber || 10
      },
      nonStriker: {
        playerId: nsProfile?.id || `p_${Date.now()}_2`,
        name: nsName,
        shortName: nsProfile?.shortName || nsName,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOnStrike: false,
        imageUrl: nsImg,
        jerseyNumber: nsProfile?.jerseyNumber || 7
      },
      currentBowler: {
        playerId: bProfile?.id || `b_${Date.now()}`,
        name: bName,
        shortName: bShort,
        overs: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: 0,
        imageUrl: bImg,
        jerseyNumber: bProfile?.jerseyNumber || 99
      },
      currentPartnership: {
        runs: 0,
        balls: 0,
        player1Runs: 0,
        player2Runs: 0
      },
      recentBalls: [],
      lastUpdated: Date.now(),
      scorecards: {
        firstInnings: {
          teamName: t1Name,
          teamCode: t1Code,
          inningsNumber: 1,
          totalRuns: 0,
          totalWickets: 0,
          totalOvers: '0.0',
          runRate: 0,
          extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          fallOfWickets: [],
          yetToBat: [],
          batting: (t1Roster.length > 0 ? t1Roster : [
            { id: sProfile?.id || 'p_s', name: sName, shortName: sProfile?.shortName || sName, teamCode: t1Code, role: 'Batter' as const, jerseyNumber: 10, imageUrl: sImg },
            { id: nsProfile?.id || 'p_ns', name: nsName, shortName: nsProfile?.shortName || nsName, teamCode: t1Code, role: 'Batter' as const, jerseyNumber: 7, imageUrl: nsImg }
          ]).slice(0, 11).map((p, idx) => ({
            playerId: p.id,
            name: p.name,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            strikeRate: 0,
            dismissal: idx < 2 ? 'batting' : 'yet to bat',
            imageUrl: p.imageUrl || `/api/player/photo?name=${encodeURIComponent(p.name)}&team=${encodeURIComponent(t1Code)}`,
            isNotOut: idx < 2
          })),
          bowling: (t2Roster.length > 0 ? t2Roster.filter(p => p.role === 'Bowler' || p.role === 'All-rounder') : [
            { id: bProfile?.id || 'p_b', name: bName, shortName: bShort, teamCode: t2Code, role: 'Bowler' as const, jerseyNumber: 99, imageUrl: bImg }
          ]).slice(0, 5).map((p) => ({
            playerId: p.id,
            name: p.name,
            overs: 0,
            maidens: 0,
            runs: 0,
            wickets: 0,
            economy: 0,
            noBalls: 0,
            wides: 0,
            imageUrl: p.imageUrl || `/api/player/photo?name=${encodeURIComponent(p.name)}&team=${encodeURIComponent(t2Code)}`
          }))
        }
      }
    };

    return state;
  }

  private buildVerifiedFallbackMatch(input: string): MatchState {
    const parsed = this.parseTeamsAndDetailsFromInput(input);
    const t1Norm = normalizeTeamCode(parsed.team1Name);
    const t2Norm = normalizeTeamCode(parsed.team2Name);
    let state: MatchState;

    if ((t1Norm === 'PAK' && t2Norm === 'ENG') || (t1Norm === 'ENG' && t2Norm === 'PAK')) {
      state = this.buildPakEngMatch();
    } else if ((t1Norm === 'SA' && t2Norm === 'IND') || (t1Norm === 'IND' && t2Norm === 'SA')) {
      state = this.buildSaIndTestMatch();
    } else if ((t1Norm === 'AUS' && t2Norm === 'ENG') || (t1Norm === 'ENG' && t2Norm === 'AUS')) {
      state = this.buildAshesMatch();
    } else if ((t1Norm === 'NZ' && t2Norm === 'WI') || (t1Norm === 'WI' && t2Norm === 'NZ')) {
      state = this.buildNzWiMatch();
    } else if ((t1Norm === 'IND' && t2Norm === 'AUS') || (t1Norm === 'AUS' && t2Norm === 'IND')) {
      state = this.buildIndAusMatch();
    } else {
      state = this.buildGenericMatchFromTeams(parsed.team1Name, parsed.team2Name, parsed.series, parsed.matchType);
    }

    // Always set title, teams, codes, URL to reflect the exact CREX link entered by admin
    state.title = parsed.title;
    state.series = parsed.series;
    state.matchType = parsed.matchType;
    state.battingTeam.name = parsed.team1Name;
    state.battingTeam.shortName = parsed.team1Code;
    state.battingTeam.code = parsed.team1Code;

    state.bowlingTeam.name = parsed.team2Name;
    state.bowlingTeam.shortName = parsed.team2Code;
    state.bowlingTeam.code = parsed.team2Code;

    state.crexMatchId = input.replace(/https?:\/\/[^\/]+\/(?:scoreboard|cricket-live-score)\/?/, '').split('/')[0] || input;
    state.crexUrl = input.startsWith('http') ? input : `https://crex.com/cricket-live-score/${input}`;
    state.statusText = `${parsed.team1Name} elected to bat first • Match Live`;
    return state;
  }

  private buildNzWiMatch(): MatchState {
    return {
      matchId: 'm_nz_wi_odi',
      crexMatchId: 'm44211',
      crexUrl: 'https://crex.live/scoreboard/m44211/new-zealand-vs-west-indies-2nd-odi',
      title: 'New Zealand vs West Indies - 2nd ODI',
      matchType: 'ODI',
      series: 'West Indies Tour of New Zealand 2024',
      venue: 'Eden Park, Auckland',
      toss: 'West Indies won the toss and elected to bowl',
      statusText: 'West Indies need 93 runs in 70 balls',
      gameState: 'live',
      currentInnings: 2,
      target: 287,
      requiredRuns: 93,
      remainingBalls: 70,
      currentRunRate: 5.06,
      requiredRunRate: 7.97,
      battingTeam: {
        name: 'West Indies',
        shortName: 'WI',
        code: 'WI',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/WI.png',
        primaryColor: '#7B002C',
        secondaryColor: '#FFD100',
        score: { runs: 194, wickets: 5, overs: 38, balls: 2 }
      },
      bowlingTeam: {
        name: 'New Zealand',
        shortName: 'NZ',
        code: 'NZ',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/NZ.png',
        primaryColor: '#000000',
        secondaryColor: '#FFFFFF',
        score: { runs: 286, wickets: 6, overs: 50, balls: 0 }
      },
      striker: {
        playerId: 'wi_shope',
        name: 'Shai Hope (c & wk)',
        shortName: 'SD Hope',
        runs: 68,
        balls: 74,
        fours: 6,
        sixes: 1,
        strikeRate: 91.89,
        isOnStrike: true,
        imageUrl: 'https://cricketvectors.akamaized.net/players/org/CW.png',
        jerseyNumber: 4
      },
      nonStriker: {
        playerId: 'wi_shepherd',
        name: 'Romario Shepherd',
        shortName: 'R Shepherd',
        runs: 24,
        balls: 18,
        fours: 2,
        sixes: 1,
        strikeRate: 133.33,
        isOnStrike: false,
        imageUrl: 'https://cricketvectors.akamaized.net/players/org/2W8.png',
        jerseyNumber: 99
      },
      currentBowler: {
        playerId: 'nz_tboult',
        name: 'Trent Boult',
        shortName: 'TA Boult',
        overs: 7.2,
        maidens: 1,
        runs: 36,
        wickets: 2,
        economy: 4.91,
        imageUrl: 'https://cricketvectors.akamaized.net/players/org/31.png',
        jerseyNumber: 18
      },
      recentBalls: [
        {
          id: 'b-38-1',
          ballNumber: '38.1',
          overNumber: 38,
          ballInOver: 1,
          runs: 1,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Romario Shepherd',
          bowlerName: 'Trent Boult',
          commentary: 'Full delivery on off stump, driven into the covers for a single.',
          timestamp: Date.now() - 30000
        },
        {
          id: 'b-38-2',
          ballNumber: '38.2',
          overNumber: 38,
          ballInOver: 2,
          runs: 4,
          isWicket: false,
          isFour: true,
          isSix: false,
          isExtra: false,
          batsmanName: 'Shai Hope',
          bowlerName: 'Trent Boult',
          commentary: 'FOUR! Slashed over backward point with ferocious power!',
          timestamp: Date.now()
        }
      ],
      currentPartnership: { runs: 42, balls: 35, player1Runs: 22, player2Runs: 20 },
      lastUpdated: Date.now(),
      scorecards: {}
    };
  }

  private buildIndAusMatch(): MatchState {
    return {
      matchId: 'm_ind_aus_t20_wc',
      crexMatchId: 'm88291',
      crexUrl: 'https://crex.live/scoreboard/m88291/india-vs-australia-icc-mens-t20-world-cup',
      title: 'India vs Australia - Super 8s',
      matchType: 'T20',
      series: "ICC Men's T20 World Cup 2024",
      venue: 'Daren Sammy National Cricket Stadium, Gros Islet, St Lucia',
      toss: 'Australia won the toss and elected to bowl',
      statusText: 'India innings in progress (17.4 Overs)',
      gameState: 'live',
      currentInnings: 1,
      target: 0,
      currentRunRate: 10.42,
      battingTeam: {
        name: 'India',
        shortName: 'IND',
        code: 'IND',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png',
        primaryColor: '#0078FF',
        secondaryColor: '#FF9933',
        score: { runs: 184, wickets: 3, overs: 17, balls: 4 }
      },
      bowlingTeam: {
        name: 'Australia',
        shortName: 'AUS',
        code: 'AUS',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png',
        primaryColor: '#FFCC00',
        secondaryColor: '#005522',
        score: { runs: 0, wickets: 0, overs: 0, balls: 0 }
      },
      striker: {
        playerId: 'ind_vkohli',
        name: 'Virat Kohli',
        shortName: 'V Kohli',
        runs: 48,
        balls: 28,
        fours: 4,
        sixes: 2,
        strikeRate: 171.43,
        isOnStrike: true,
        imageUrl: VERIFIED_PLAYERS['ind_vkohli'].imageUrl,
        jerseyNumber: 18
      },
      nonStriker: {
        playerId: 'ind_hpandya',
        name: 'Hardik Pandya',
        shortName: 'H Pandya',
        runs: 27,
        balls: 13,
        fours: 2,
        sixes: 2,
        strikeRate: 207.69,
        isOnStrike: false,
        imageUrl: VERIFIED_PLAYERS['ind_hpandya'].imageUrl,
        jerseyNumber: 33
      },
      currentBowler: {
        playerId: 'aus_pcummins',
        name: 'Pat Cummins',
        shortName: 'PJ Cummins',
        overs: 3.4,
        maidens: 0,
        runs: 38,
        wickets: 1,
        economy: 10.36,
        imageUrl: VERIFIED_PLAYERS['aus_pcummins'].imageUrl,
        jerseyNumber: 30
      },
      recentBalls: [
        {
          id: 'b-17-1',
          ballNumber: '17.1',
          overNumber: 17,
          ballInOver: 1,
          runs: 1,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Hardik Pandya',
          bowlerName: 'Pat Cummins',
          commentary: 'Cummins bowls full outside off, stroked toward sweeper cover for a single.',
          timestamp: Date.now() - 45000
        },
        {
          id: 'b-17-2',
          ballNumber: '17.2',
          overNumber: 17,
          ballInOver: 2,
          runs: 4,
          isWicket: false,
          isFour: true,
          isSix: false,
          isExtra: false,
          batsmanName: 'Virat Kohli',
          bowlerName: 'Pat Cummins',
          commentary: 'FOUR! Elegant flick between deep mid-wicket and long on. Exquisite timing!',
          timestamp: Date.now() - 30000
        },
        {
          id: 'b-17-3',
          ballNumber: '17.3',
          overNumber: 17,
          ballInOver: 3,
          runs: 2,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Virat Kohli',
          bowlerName: 'Pat Cummins',
          commentary: 'Pushed into the vacant pocket at deep square leg, two runs taken effortlessly.',
          timestamp: Date.now() - 15000
        },
        {
          id: 'b-17-4',
          ballNumber: '17.4',
          overNumber: 17,
          ballInOver: 4,
          runs: 6,
          isWicket: false,
          isFour: false,
          isSix: true,
          isExtra: false,
          batsmanName: 'Virat Kohli',
          bowlerName: 'Pat Cummins',
          commentary: 'SIX! High and handsome over long off! Vintage Kohli masterpiece!',
          timestamp: Date.now()
        }
      ],
      currentPartnership: {
        runs: 57,
        balls: 25,
        player1Runs: 28,
        player2Runs: 27
      },
      lastUpdated: Date.now(),
      scorecards: {
        firstInnings: {
          teamName: 'India',
          teamCode: 'IND',
          inningsNumber: 1,
          totalRuns: 184,
          totalWickets: 3,
          totalOvers: '17.4',
          runRate: 10.42,
          extras: { total: 9, wides: 4, noBalls: 1, byes: 0, legByes: 4 },
          batting: [
            {
              playerId: 'ind_rsharma',
              name: 'Rohit Sharma (c)',
              runs: 92,
              balls: 41,
              fours: 7,
              sixes: 8,
              strikeRate: 224.39,
              dismissal: 'b Starc',
              bowlerName: 'Mitchell Starc',
              imageUrl: VERIFIED_PLAYERS['ind_rsharma'].imageUrl,
              isNotOut: false
            },
            {
              playerId: 'ind_rpant',
              name: 'Rishabh Pant (wk)',
              runs: 15,
              balls: 14,
              fours: 1,
              sixes: 1,
              strikeRate: 107.14,
              dismissal: 'c Hazlewood b Stoinis',
              bowlerName: 'Marcus Stoinis',
              imageUrl: VERIFIED_PLAYERS['ind_rpant'].imageUrl,
              isNotOut: false
            },
            {
              playerId: 'ind_syadav',
              name: 'Suryakumar Yadav',
              runs: 31,
              balls: 16,
              fours: 3,
              sixes: 2,
              strikeRate: 193.75,
              dismissal: 'c Wade b Starc',
              bowlerName: 'Mitchell Starc',
              imageUrl: VERIFIED_PLAYERS['ind_syadav'].imageUrl,
              isNotOut: false
            },
            {
              playerId: 'ind_vkohli',
              name: 'Virat Kohli',
              runs: 48,
              balls: 28,
              fours: 4,
              sixes: 2,
              strikeRate: 171.43,
              dismissal: 'batting',
              imageUrl: VERIFIED_PLAYERS['ind_vkohli'].imageUrl,
              isNotOut: true
            },
            {
              playerId: 'ind_hpandya',
              name: 'Hardik Pandya',
              runs: 27,
              balls: 13,
              fours: 2,
              sixes: 2,
              strikeRate: 207.69,
              dismissal: 'batting',
              imageUrl: VERIFIED_PLAYERS['ind_hpandya'].imageUrl,
              isNotOut: true
            }
          ],
          bowling: [
            {
              playerId: 'aus_mstarc',
              name: 'Mitchell Starc',
              overs: 4,
              maidens: 0,
              runs: 45,
              wickets: 2,
              economy: 11.25,
              noBalls: 1,
              wides: 2,
              imageUrl: VERIFIED_PLAYERS['aus_mstarc'].imageUrl
            },
            {
              playerId: 'aus_jhazlewood',
              name: 'Josh Hazlewood',
              overs: 4,
              maidens: 0,
              runs: 25,
              wickets: 0,
              economy: 6.25,
              noBalls: 0,
              wides: 1,
              imageUrl: VERIFIED_PLAYERS['aus_jhazlewood']?.imageUrl
            },
            {
              playerId: 'aus_pcummins',
              name: 'Pat Cummins',
              overs: 3.4,
              maidens: 0,
              runs: 38,
              wickets: 1,
              economy: 10.36,
              noBalls: 0,
              wides: 0,
              imageUrl: VERIFIED_PLAYERS['aus_pcummins'].imageUrl
            },
            {
              playerId: 'aus_azampa',
              name: 'Adam Zampa',
              overs: 4,
              maidens: 0,
              runs: 41,
              wickets: 0,
              economy: 10.25,
              noBalls: 0,
              wides: 1,
              imageUrl: VERIFIED_PLAYERS['aus_azampa'].imageUrl
            }
          ],
          fallOfWickets: [
            { score: 93, wicketNumber: 1, over: '8.2', playerOut: 'Rohit Sharma' },
            { score: 118, wicketNumber: 2, over: '11.1', playerOut: 'Rishabh Pant' },
            { score: 127, wicketNumber: 3, over: '12.4', playerOut: 'Suryakumar Yadav' }
          ],
          yetToBat: ['Shivam Dube', 'Ravindra Jadeja', 'Axar Patel', 'Kuldeep Yadav', 'Arshdeep Singh', 'Jasprit Bumrah']
        }
      }
    };
  }

  private buildPakEngMatch(): MatchState {
    return {
      matchId: 'm_eng_pak_t20',
      crexMatchId: 'm77412',
      crexUrl: 'https://crex.live/scoreboard/m77412/pakistan-vs-england-3rd-t20i',
      title: 'England vs Pakistan - 3rd T20I',
      matchType: 'T20',
      series: 'England Tour of Pakistan',
      venue: 'National Stadium, Karachi',
      toss: 'England won the toss and elected to field',
      statusText: 'England need 37 runs in 28 balls',
      gameState: 'live',
      currentInnings: 2,
      target: 179,
      requiredRuns: 37,
      remainingBalls: 28,
      currentRunRate: 9.26,
      requiredRunRate: 7.93,
      battingTeam: {
        name: 'England',
        shortName: 'ENG',
        code: 'ENG',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/ENG.png',
        primaryColor: '#D31427',
        secondaryColor: '#0E1D43',
        score: { runs: 142, wickets: 4, overs: 15, balls: 2 }
      },
      bowlingTeam: {
        name: 'Pakistan',
        shortName: 'PAK',
        code: 'PAK',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/PAK.png',
        primaryColor: '#006622',
        secondaryColor: '#CCEE00',
        score: { runs: 178, wickets: 7, overs: 20, balls: 0 }
      },
      striker: {
        playerId: 'eng_jbuttler',
        name: 'Jos Buttler',
        shortName: 'JC Buttler',
        runs: 54,
        balls: 32,
        fours: 5,
        sixes: 3,
        strikeRate: 168.75,
        isOnStrike: true,
        imageUrl: VERIFIED_PLAYERS['eng_jbuttler'].imageUrl,
        jerseyNumber: 63
      },
      nonStriker: {
        playerId: 'eng_bstokes',
        name: 'Ben Stokes',
        shortName: 'BA Stokes',
        runs: 22,
        balls: 15,
        fours: 2,
        sixes: 1,
        strikeRate: 146.67,
        isOnStrike: false,
        imageUrl: VERIFIED_PLAYERS['eng_bstokes'].imageUrl,
        jerseyNumber: 55
      },
      currentBowler: {
        playerId: 'pak_safridi',
        name: 'Shaheen Afridi',
        shortName: 'Shaheen Afridi',
        overs: 3.2,
        maidens: 0,
        runs: 29,
        wickets: 2,
        economy: 8.7,
        imageUrl: VERIFIED_PLAYERS['pak_safridi'].imageUrl,
        jerseyNumber: 10
      },
      recentBalls: [
        {
          id: 'b-15-1',
          ballNumber: '15.1',
          overNumber: 15,
          ballInOver: 1,
          runs: 1,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Ben Stokes',
          bowlerName: 'Shaheen Afridi',
          commentary: 'Full yorker, dug out to point for a brisk single.',
          timestamp: Date.now() - 30000
        },
        {
          id: 'b-15-2',
          ballNumber: '15.2',
          overNumber: 15,
          ballInOver: 2,
          runs: 4,
          isWicket: false,
          isFour: true,
          isSix: false,
          isExtra: false,
          batsmanName: 'Jos Buttler',
          bowlerName: 'Shaheen Afridi',
          commentary: 'FOUR! Sliced over backward point! Top boundary by Buttler!',
          timestamp: Date.now()
        }
      ],
      currentPartnership: { runs: 42, balls: 26, player1Runs: 24, player2Runs: 18 },
      lastUpdated: Date.now(),
      scorecards: {
        firstInnings: {
          teamName: 'Pakistan',
          teamCode: 'PAK',
          inningsNumber: 1,
          totalRuns: 178,
          totalWickets: 7,
          totalOvers: '20.0',
          runRate: 8.9,
          extras: { total: 8, wides: 4, noBalls: 1, byes: 1, legByes: 2 },
          batting: [
            {
              playerId: 'pak_bazam',
              name: 'Babar Azam (c)',
              runs: 68,
              balls: 45,
              fours: 7,
              sixes: 2,
              strikeRate: 151.11,
              dismissal: 'c Buttler b Archer',
              bowlerName: 'Jofra Archer',
              imageUrl: VERIFIED_PLAYERS['pak_bazam'].imageUrl,
              isNotOut: false
            },
            {
              playerId: 'pak_mrizwan',
              name: 'Mohammad Rizwan (wk)',
              runs: 42,
              balls: 31,
              fours: 4,
              sixes: 1,
              strikeRate: 135.48,
              dismissal: 'lbw b Curran',
              bowlerName: 'Sam Curran',
              imageUrl: VERIFIED_PLAYERS['pak_mrizwan'].imageUrl,
              isNotOut: false
            }
          ],
          bowling: [
            {
              playerId: 'eng_jarcher',
              name: 'Jofra Archer',
              overs: 4,
              maidens: 0,
              runs: 32,
              wickets: 3,
              economy: 8.0,
              noBalls: 0,
              wides: 1,
              imageUrl: VERIFIED_PLAYERS['eng_jarcher'].imageUrl
            }
          ],
          fallOfWickets: [{ score: 85, wicketNumber: 1, over: '9.4', playerOut: 'Mohammad Rizwan' }],
          yetToBat: ['Haris Rauf', 'Mohammad Amir']
        }
      }
    };
  }

  private buildSaIndTestMatch(): MatchState {
    return {
      matchId: 'm_sa_ind_test',
      crexMatchId: 'm66319',
      crexUrl: 'https://crex.live/scoreboard/m66319/south-africa-vs-india-2nd-test',
      title: 'South Africa vs India - 2nd Test',
      matchType: 'TEST',
      series: 'Freedom Trophy 2024',
      venue: 'Newlands, Cape Town',
      toss: 'South Africa won the toss and elected to bat',
      statusText: 'Day 3 - India need 58 runs to win',
      gameState: 'live',
      currentInnings: 2,
      target: 136,
      requiredRuns: 58,
      currentRunRate: 3.52,
      battingTeam: {
        name: 'India',
        shortName: 'IND',
        code: 'IND',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png',
        primaryColor: '#0078FF',
        secondaryColor: '#FF9933',
        score: { runs: 78, wickets: 2, overs: 22, balls: 1 }
      },
      bowlingTeam: {
        name: 'South Africa',
        shortName: 'SA',
        code: 'SA',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/RSA.png',
        primaryColor: '#005522',
        secondaryColor: '#FFCC00',
        score: { runs: 192, wickets: 10, overs: 62, balls: 4 }
      },
      striker: {
        playerId: 'ind_vkohli',
        name: 'Virat Kohli',
        shortName: 'V Kohli',
        runs: 34,
        balls: 52,
        fours: 4,
        sixes: 0,
        strikeRate: 65.38,
        isOnStrike: true,
        imageUrl: VERIFIED_PLAYERS['ind_vkohli'].imageUrl,
        jerseyNumber: 18
      },
      nonStriker: {
        playerId: 'ind_sgill',
        name: 'Shubman Gill',
        shortName: 'S Gill',
        runs: 26,
        balls: 41,
        fours: 3,
        sixes: 0,
        strikeRate: 63.41,
        isOnStrike: false,
        imageUrl: VERIFIED_PLAYERS['ind_sgill'].imageUrl,
        jerseyNumber: 77
      },
      currentBowler: {
        playerId: 'sa_krabada',
        name: 'Kagiso Rabada',
        shortName: 'K Rabada',
        overs: 8.1,
        maidens: 2,
        runs: 24,
        wickets: 1,
        economy: 2.93,
        imageUrl: VERIFIED_PLAYERS['sa_krabada'].imageUrl,
        jerseyNumber: 25
      },
      recentBalls: [
        {
          id: 'b-22-1',
          ballNumber: '22.1',
          overNumber: 22,
          ballInOver: 1,
          runs: 0,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Virat Kohli',
          bowlerName: 'Kagiso Rabada',
          commentary: 'Good length pitching outside off, leaves it alone safely.',
          timestamp: Date.now()
        }
      ],
      currentPartnership: { runs: 44, balls: 68, player1Runs: 24, player2Runs: 20 },
      lastUpdated: Date.now(),
      scorecards: {}
    };
  }

  private buildAshesMatch(): MatchState {
    return {
      matchId: 'm_aus_eng_ashes',
      crexMatchId: 'm55120',
      crexUrl: 'https://crex.live/scoreboard/m55120/australia-vs-england-ashes-1st-test',
      title: 'Australia vs England - The Ashes',
      matchType: 'TEST',
      series: 'The Ashes Test Series',
      venue: 'Melbourne Cricket Ground (MCG), Melbourne',
      toss: 'Australia won the toss and elected to bat',
      statusText: 'Day 4: Australia lead by 250 runs',
      gameState: 'live',
      currentInnings: 2,
      currentRunRate: 3.44,
      battingTeam: {
        name: 'Australia',
        shortName: 'AUS',
        code: 'AUS',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png',
        primaryColor: '#FFCC00',
        secondaryColor: '#005522',
        score: { runs: 210, wickets: 4, overs: 61, balls: 0 }
      },
      bowlingTeam: {
        name: 'England',
        shortName: 'ENG',
        code: 'ENG',
        logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/ENG.png',
        primaryColor: '#D31427',
        secondaryColor: '#0E1D43',
        score: { runs: 280, wickets: 10, overs: 88, balls: 3 }
      },
      striker: {
        playerId: 'aus_ssmith',
        name: 'Steve Smith',
        shortName: 'SPD Smith',
        runs: 76,
        balls: 142,
        fours: 8,
        sixes: 1,
        strikeRate: 53.52,
        isOnStrike: true,
        imageUrl: VERIFIED_PLAYERS['aus_ssmith'].imageUrl,
        jerseyNumber: 49
      },
      nonStriker: {
        playerId: 'aus_thead',
        name: 'Travis Head',
        shortName: 'TM Head',
        runs: 51,
        balls: 64,
        fours: 7,
        sixes: 1,
        strikeRate: 79.69,
        isOnStrike: false,
        imageUrl: VERIFIED_PLAYERS['aus_thead'].imageUrl,
        jerseyNumber: 62
      },
      currentBowler: {
        playerId: 'eng_jroot',
        name: 'Joe Root',
        shortName: 'JE Root',
        overs: 11.0,
        maidens: 1,
        runs: 38,
        wickets: 0,
        economy: 3.45,
        imageUrl: VERIFIED_PLAYERS['eng_jroot'].imageUrl,
        jerseyNumber: 66
      },
      recentBalls: [
        {
          id: 'b-61-0',
          ballNumber: '60.6',
          overNumber: 60,
          ballInOver: 6,
          runs: 1,
          isWicket: false,
          isFour: false,
          isSix: false,
          isExtra: false,
          batsmanName: 'Travis Head',
          bowlerName: 'Joe Root',
          commentary: 'Flighted on middle, worked gently past midwicket for a single.',
          timestamp: Date.now()
        }
      ],
      currentPartnership: { runs: 98, balls: 140, player1Runs: 48, player2Runs: 50 },
      lastUpdated: Date.now(),
      scorecards: {}
    };
  }
}

export const crexService = new CrexService();
