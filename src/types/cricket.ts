export interface Player {
  id: string;
  name: string;
  shortName: string;
  role: 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
  imageUrl?: string;
  jerseyNumber?: number;
  countryCode?: string;
}

export interface BatsmanScore {
  playerId: string;
  name: string;
  shortName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOnStrike: boolean;
  outDesc?: string; // e.g. "c Maxwell b Starc" or "not out"
  imageUrl?: string;
  jerseyNumber?: number;
}

export interface BowlerScore {
  playerId: string;
  name: string;
  shortName: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  imageUrl?: string;
  jerseyNumber?: number;
}

export interface BallEvent {
  id: string;
  ballNumber: string; // e.g. "17.4"
  overNumber: number;
  ballInOver: number;
  runs: number;
  isWicket: boolean;
  wicketType?: 'bowled' | 'caught' | 'lbw' | 'run out' | 'stumped';
  isFour: boolean;
  isSix: boolean;
  isExtra: boolean;
  extraType?: 'wide' | 'no-ball' | 'leg-bye' | 'bye';
  batsmanName: string;
  bowlerName: string;
  commentary: string;
  timestamp: number;
  pitchLength?: 'full' | 'good' | 'bouncer';
  pitchX?: number; // 0..100 normalized distance from bowler crease (0) to batting stumps (100)
  pitchY?: number; // 0..100 normalized lateral line (0 = wide off, 50 = middle stump, 100 = wide leg)
}

export interface TeamScore {
  name: string;
  shortName: string;
  code: string; // e.g. "IND", "AUS"
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  score: {
    runs: number;
    wickets: number;
    overs: number;
    balls: number; // 0 to 5 balls completed in current over
  };
  declared?: boolean;
}

export interface BattingScorecardRow {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissal: string;
  bowlerName?: string;
  catcherName?: string;
  imageUrl?: string;
  isNotOut: boolean;
}

export interface BowlingScorecardRow {
  playerId: string;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  noBalls: number;
  wides: number;
  imageUrl?: string;
}

export interface FallOfWicket {
  score: number;
  wicketNumber: number;
  over: string;
  playerOut: string;
}

export interface InningsScorecard {
  teamName: string;
  teamCode: string;
  inningsNumber: 1 | 2;
  totalRuns: number;
  totalWickets: number;
  totalOvers: string;
  runRate: number;
  extras: {
    total: number;
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  batting: BattingScorecardRow[];
  bowling: BowlingScorecardRow[];
  fallOfWickets: FallOfWicket[];
  yetToBat: string[];
}

export interface Partnership {
  runs: number;
  balls: number;
  player1Runs: number;
  player2Runs: number;
}

export interface DLSDetails {
  applied: boolean;
  originalOvers: number;
  revisedOvers: number;
  wicketsLostAtInterruption?: number;
  oversAtInterruption?: number;
  firstInningsTotal: number;
  firstInningsOvers: number;
  revisedTarget: number;
  parScore?: number;
  resourceRemainingPercent?: number;
  interruptionInnings?: 1 | 2;
  notes?: string;
}

export interface MatchState {
  matchId: string;
  crexMatchId?: string;
  crexUrl?: string;
  title: string;
  matchType: 'T20' | 'ODI' | 'TEST' | 'T10';
  series: string;
  venue: string;
  toss: string;
  statusText: string; // e.g. "India need 23 runs in 15 balls", "Match in Progress", "Innings Break"
  gameState: 'scheduled' | 'live' | 'innings_break' | 'completed' | 'delayed';
  currentInnings: 1 | 2;
  target?: number;
  requiredRuns?: number;
  remainingBalls?: number;
  currentRunRate: number;
  requiredRunRate?: number;
  dlsDetails?: DLSDetails;
  battingTeam: TeamScore;
  bowlingTeam: TeamScore;
  striker: BatsmanScore;
  nonStriker: BatsmanScore;
  currentBowler: BowlerScore;
  recentBalls: BallEvent[];
  currentPartnership: Partnership;
  lastUpdated: number;
  scorecards: {
    firstInnings?: InningsScorecard;
    secondInnings?: InningsScorecard;
  };
  notificationAlert?: {
    id: string;
    type:
      | 'wicket'
      | 'four'
      | 'six'
      | 'milestone'
      | 'innings_break'
      | 'century'
      | 'fifty'
      | 'thirty'
      | 'one_fifty'
      | 'double_century'
      | 'five_wickets'
      | 'four_wickets'
      | 'three_wickets'
      | 'maiden'
      | 'over_complete'
      | 'tight_finish'
      | 'match_result'
      | 'match_starting'
      | 'new_match'
      | 'custom';
    title: string;
    description: string;
    timestamp: number;
    metadata?: {
      player?: string;
      score?: number;
      balls?: number;
      bowlerFigures?: string;
      teamScore?: string;
      target?: number;
      remainingRuns?: number;
      remainingBalls?: number;
    };
  };
}

export interface PushNotificationSettings {
  enabled: boolean;
  matchEvents?: boolean; // Dedicated Match Events Notification API toggle
  matchAlert?: boolean; // Dedicated Match Alert native push notification toggle for wickets & boundaries
  // Live Match Milestones
  wickets: boolean;
  centuries: boolean; // 100*
  fifties: boolean; // 50*
  thirties: boolean; // 30*
  doubleCenturies: boolean; // 150*, 200*
  fiveWickets: boolean; // 5W Haul
  threeWickets: boolean; // 3W / 4W Hauls
  boundaries: boolean; // 4s & 6s
  boundariesFour: boolean;
  boundariesSix: boolean;
  maidenOvers: boolean;
  maidens?: boolean;
  inningsBreak: boolean;
  matchResult: boolean;
  tightFinish: boolean;
  // Match Discovery & Schedule Alerts
  newMatchListed: boolean;
  matchStarting: boolean;
  matchStatusUpdates: boolean;
  // Delivery
  sound: boolean;
  vibration: boolean;
  browserNotifications: boolean;
}

export type TriggerCategory =
  | 'wicket'
  | 'century'
  | 'fifty'
  | 'thirty'
  | 'one_fifty'
  | 'double_century'
  | 'five_wickets'
  | 'four_wickets'
  | 'three_wickets'
  | 'innings_break'
  | 'six'
  | 'four'
  | 'boundary'
  | 'maiden'
  | 'over_complete'
  | 'tight_finish'
  | 'match_result'
  | 'match_starting'
  | 'new_match'
  | 'custom';

export interface MatchTriggerDefinition {
  id: string;
  name: string;
  category: TriggerCategory;
  enabledGlobally: boolean;
  titleTemplate: string;
  descriptionTemplate: string;
  sound: 'wicket' | 'century' | 'fifty' | 'five_wickets' | 'innings_break' | 'six' | 'four' | 'boundary';
  priority: 'high' | 'medium' | 'low';
  badgeColor: string;
}

export interface MatchPushNotification {
  id: string;
  type:
    | 'wicket'
    | 'century'
    | 'fifty'
    | 'thirty'
    | 'one_fifty'
    | 'double_century'
    | 'five_wickets'
    | 'four_wickets'
    | 'three_wickets'
    | 'milestone'
    | 'innings_break'
    | 'four'
    | 'six'
    | 'boundary'
    | 'maiden'
    | 'over_complete'
    | 'tight_finish'
    | 'match_result'
    | 'match_starting'
    | 'new_match'
    | 'custom';
  title: string;
  body: string;
  timestamp: number;
  matchScore?: string;
  read: boolean;
  playerImageUrl?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface UserAlertPreferences {
  masterEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  browserNotifications: boolean;
  subscribedTriggers: Record<string, boolean>;
}

export interface ActiveMatchConfig {
  activeMatchId: string;
  crexUrl: string;
  crexMatchId: string;
  matchTitle: string;
  connectedAt: number;
  lastSyncedAt: number;
  syncIntervalMs: number;
  isAutoSyncEnabled: boolean;
  dataSourceMode?: 'auto' | 'manual';
  syncStatus?: 'ok' | 'failed' | 'manual';
  syncError?: string;
  lastSuccessfulSyncAt?: number;
  connectedBy: string;
  triggers?: MatchTriggerDefinition[];
}

export interface DiscoverableMatch {
  id: string;
  title: string;
  series: string;
  format: string;
  crexUrl: string;
  team1: { name: string; code: string; score?: string; logoUrl?: string };
  team2: { name: string; code: string; score?: string; logoUrl?: string };
  status: string;
  gameState?: 'scheduled' | 'live' | 'innings_break' | 'completed' | 'delayed';
  isLive: boolean;
  venue?: string;
  startTime?: string;
  discoveredAt?: number;
}

export interface PlayerCareerStats {
  matches: number;
  innings: number;
  runs: number;
  highestScore: string;
  battingAverage: number;
  strikeRate: number;
  centuries: number;
  fifties: number;
  thirties?: number;
  fours: number;
  sixes: number;
  notOuts: number;
  // Bowling fields
  oversBowled?: number;
  wickets?: number;
  bowlingAverage?: number;
  economyRate?: number;
  bestBowlingInnings?: string;
  fourWicketHauls?: number;
  fiveWicketHauls?: number;
}

export interface PlayerRecentMatchLog {
  id: string;
  match: string;
  date: string;
  format: 'TEST' | 'ODI' | 'T20I' | 'T20';
  opponent: string;
  opponentCode?: string;
  runsScored?: number;
  ballsFaced?: number;
  strikeRate?: number;
  fours?: number;
  sixes?: number;
  dismissal?: string;
  oversBowled?: number;
  maidensBowled?: number;
  runsConceded?: number;
  wicketsTaken?: number;
  economy?: number;
  venue?: string;
  result?: string;
}

export interface PlayerDetailedStats {
  player: {
    id: string;
    name: string;
    shortName: string;
    team: string;
    teamCode: string;
    role: 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
    battingStyle?: string;
    bowlingStyle?: string;
    jerseyNumber?: number;
    born?: string;
    age?: number;
    imageUrl?: string;
  };
  formats: {
    test?: PlayerCareerStats;
    odi?: PlayerCareerStats;
    t20i?: PlayerCareerStats;
    ipl?: PlayerCareerStats;
  };
  recentMatches: PlayerRecentMatchLog[];
  currentMatchPerformance?: {
    isCurrentlyBatting?: boolean;
    isCurrentlyBowling?: boolean;
    runs?: number;
    balls?: number;
    strikeRate?: number;
    fours?: number;
    sixes?: number;
    overs?: number;
    maidens?: number;
    runsConceded?: number;
    wickets?: number;
    economy?: number;
  };
}

export interface CompletedMatchItem {
  id: string;
  series: string;
  matchTitle?: string;
  format: 'T20' | 'ODI' | 'TEST';
  dateStr: string;
  venue: string;
  crexMatchId?: string;
  team1: {
    name: string;
    code: string;
    logoUrl?: string;
    scoreStr: string;
    oversStr: string;
    isWinner: boolean;
  };
  team2: {
    name: string;
    code: string;
    logoUrl?: string;
    scoreStr: string;
    oversStr: string;
    isWinner: boolean;
  };
  resultSummary: string;
  playerOfMatch: {
    id: string;
    name: string;
    stats: string;
    teamCode: string;
    role?: string;
    imageUrl?: string;
    impactSummary?: string;
  };
  highlights?: string[];
}

export interface CommentaryItem {
  id: string;
  ballNumber: string; // e.g. "17.4"
  overNumber: number;
  ballInOver: number;
  runs: number;
  isWicket: boolean;
  wicketType?: string;
  isFour: boolean;
  isSix: boolean;
  isExtra?: boolean;
  extraType?: string;
  isMilestone?: boolean;
  milestoneTitle?: string;
  batsmanName: string;
  bowlerName: string;
  commentary: string;
  timestamp: number;
  teamScore?: string;
  tag: 'WICKET' | 'SIX' | 'FOUR' | 'MILESTONE' | 'DOT' | 'RUN';
}

export interface CommentaryFeedResponse {
  success: boolean;
  matchId?: string;
  matchTitle?: string;
  statusText?: string;
  currentScore?: string;
  items: CommentaryItem[];
  serverTime: number;
}

export type AdSlotFormat = 'auto' | 'horizontal' | 'rectangle' | 'vertical';
export type AdSlotSource = 'auto' | 'adsense' | 'custom';

export interface AdSlotConfig {
  enabled: boolean;
  slotId: string;
  adFormat?: AdSlotFormat;
  adSource?: AdSlotSource;
  imageUrl?: string;
  linkUrl?: string;
  title?: string;
}

export interface SponsorBannerConfig {
  enabled: boolean;
  name: string;
  tagline: string;
  logoUrl: string;
  imageUrl: string;
  linkUrl: string;
}

export interface MonetizationConfig {
  adsEnabled: boolean;
  adsensePublisherId: string;
  adsenseAutoAds?: boolean;
  adsenseTestMode?: boolean;
  adsenseHidePlaceholders?: boolean;
  adsTxtCustomLines?: string;
  slots: {
    topBanner: AdSlotConfig;
    inContent: AdSlotConfig;
    footerBanner: AdSlotConfig;
    mobileBanner?: AdSlotConfig;
  };
  sponsor: SponsorBannerConfig;
  siteName: string;
  contactEmail: string;
  broadcastSettings?: BroadcastSettingsConfig;
  updatedAt: number;
}

export type BreakScreenType = 'drinks' | 'rain' | 'innings' | 'starting_soon';

export interface BreakScreenConfig {
  active: boolean;
  type: BreakScreenType;
  subtitle?: string;
  startedAt?: number;
}

export interface WinProbabilityOverride {
  enabled: boolean;
  battingTeamPct: number;
}

export interface ObsPanelsConfig {
  targetPanel: boolean;
  winProbabilityBar: boolean;
  runRateGraph: boolean;
}

export interface AppDownloadConfig {
  enabled: boolean;
  apkUrl: string;
  version: string;
}

export interface SixProCricketConfig {
  enabled: boolean;
  apkUrl: string;
  sizeLabel: string;
}

export interface NextMatchNoticeConfig {
  matchName: string;
  matchTime: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  linkUrl?: string;
}

export interface MobileAppConfig {
  adsEnabled: boolean;
  sponsorEnabled: boolean;
  newsTickerEnabled: boolean;
  pollEnabled: boolean;
  scorecardEnabled: boolean;
  newsPageEnabled: boolean;
  blogPageEnabled: boolean;
  brandBadge: string;
}

export type HoldReason =
  | 'Break'
  | 'Rain'
  | 'Drinks'
  | 'Innings Break'
  | 'Match Starting Soon'
  | 'Technical Issue';

export type HoldSponsorMode = 'with_content' | 'replace_video';

export interface HoldScreenConfig {
  active: boolean;
  reason: HoldReason;
  obsEnabled: boolean;
  videoEnabled: boolean;
  videoUrls: string[];
  videoLoop: boolean;
  sponsorEnabled: boolean;
  sponsorMode: HoldSponsorMode;
  sponsorImageUrl: string;
  sponsorLinkUrl: string;
}

export interface MatchTimerConfig {
  active: boolean;
  startedAt: number;
  accumulatedMs: number;
}

export type TvPlaylistMediaType = 'image' | 'video' | 'youtube' | 'news_feed' | 'embed';

export interface TvPlaylistItem {
  id: string;
  mediaType: TvPlaylistMediaType;
  url: string;
  title: string;
  durationSec: number;
}

export interface TvScreenConfig {
  enabled: boolean;
  obsEnabled: boolean;
  fullScreenTakeover?: boolean;
  loop: boolean;
  batBallBetweenAds: boolean;
  batBallGapSec: number;
  playNowItemId: string;
  playNowNonce: number;
  playbackStopped: boolean;
  sponsorName: string;
  sponsorLink: string;
  playlist: TvPlaylistItem[];
}

export interface SoundCustomUrls {
  fourUrl?: string;
  sixUrl?: string;
  wicketUrl?: string;
  crowdUrl?: string;
}

export interface SoundSettingsConfig {
  enabled: boolean;
  obsEnabled: boolean;
  effectsVolume: number;
  crowdVolume: number;
  voiceRate?: number;
  voiceVolume?: number;
  customSounds?: SoundCustomUrls;
}

export interface BroadcastSettingsConfig {
  animationsEnabled: boolean;
  newsMarqueeEnabled?: boolean;
  breakScreen: BreakScreenConfig;
  winProbabilityEnabled?: boolean;
  winProbabilityOverride?: WinProbabilityOverride;
  obsPanels?: ObsPanelsConfig;
  appDownload?: AppDownloadConfig;
  sixProCricket?: SixProCricketConfig;
  nextMatch?: NextMatchNoticeConfig;
  announcement?: AnnouncementConfig;
  mobileApp?: MobileAppConfig;
  holdScreen?: HoldScreenConfig;
  matchTimer?: MatchTimerConfig;
  tvScreen?: TvScreenConfig;
  soundSettings?: SoundSettingsConfig;
}

export type NewsCategory =
  | 'Domestic'
  | 'International'
  | 'ICC'
  | 'Match Update'
  | 'Breaking'
  | 'Transfer'
  | 'General';

export const NEWS_CATEGORIES: NewsCategory[] = [
  'International',
  'Domestic',
  'ICC',
  'Match Update',
  'Breaking',
  'Transfer',
  'General'
];

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  body?: string;
  imageUrl?: string;
  featuredImageUrl?: string;
  date: string;
  category: NewsCategory;
  pinned: boolean;
  isBreaking: boolean;
  createdAt?: number;
  updatedAt?: number;
  authorUid?: string;
}

export type CricketNewsSource = 'all' | 'espncricinfo' | 'bbc' | 'googlenews';

export interface CricketNewsSettings {
  autoSyncEnabled: boolean;
  source: CricketNewsSource;
  query: string;
  maxItems: number;
  preferPlayerImage: boolean;
  updatedAt: number;
}

export interface FetchedCricketNewsItem {
  id: string;
  title: string;
  description: string;
  date: string;
  sourceName: string;
  articleUrl: string;
  articleImageUrl?: string;
  playerImageUrl?: string;
  matchedPlayerName?: string;
  matchedTeamCode?: string;
  recommendedImageUrl: string;
  suggestedCategory: NewsCategory;
}

export type BlogPostStatus = 'published' | 'draft';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  content: string;
  status: BlogPostStatus;
  publishedAt?: string;
  createdAt?: number;
  updatedAt?: number;
  authorUid?: string;
}

export type PlayerRole = 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';

export interface ManagedPlayerProfile {
  id: string;
  name: string;
  originalName?: string;
  role: PlayerRole;
  teamCode?: string;
  imageUrl?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface ManagedTeamProfile {
  id: string;
  code: string;
  name: string;
  logoUrl?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export type MatchHighlightType = 'wicket' | 'six' | 'four';

export interface MatchHighlightItem {
  id: string;
  matchId: string;
  innings: 1 | 2;
  type: MatchHighlightType;
  ballNumber: string;
  runs: number;
  batsmanName: string;
  bowlerName: string;
  wicketType?: string;
  teamCode?: string;
  teamScore?: string;
  commentary: string;
  timestamp: number;
}

export interface MatchHighlightsResponse {
  success?: boolean;
  matchId?: string;
  matchTitle?: string;
  items: MatchHighlightItem[];
  serverTime?: number;
}

export type MediaLibraryMediaType = 'video' | 'youtube';
export type MediaLibrarySource = 'upload' | 'url' | 'recording';
export type MediaLibraryCategory = 'Standby' | 'Promo' | 'Highlight' | 'Sponsor' | 'General';

export interface MediaLibraryItem {
  id: string;
  title: string;
  mediaType: MediaLibraryMediaType;
  url: string;
  durationSec: number;
  source: MediaLibrarySource;
  category?: string;
  description?: string;
  storedInFirebase: boolean;
  createdAt?: number;
  updatedAt?: number;
  authorUid?: string;
}

export type MatchPollChoice = 'team1' | 'team2' | 'draw';

export interface MatchPollData {
  id: string;
  matchId: string;
  team1Code: string;
  team1Name: string;
  team2Code: string;
  team2Name: string;
  team1Votes: number;
  team2Votes: number;
  drawVotes: number;
  updatedAt?: number;
}

export interface LiveViewerStats {
  total: number;
  web: number;
  mobile: number;
  obs: number;
  admin: number;
  peak: number;
  updatedAt: number;
}

export type VideoSourceType = 'youtube' | 'local_video' | 'embed';
export type VideoSourceCategory =
  | 'Main Feed'
  | 'Backup Feed'
  | 'Local Stream'
  | 'YouTube'
  | 'Highlights';

export interface VideoSourceConfig {
  id: string;
  name: string;
  sourceType: VideoSourceType;
  url: string;
  category?: string;
  notes?: string;
  durationSec: number;
  createdAt?: number;
  updatedAt?: number;
  authorUid?: string;
}

export type AiNewsCategory =
  | 'pakistan_cricket'
  | 'international_cricket'
  | 'leagues'
  | 'players'
  | 'match_schedules'
  | 'transfers'
  | 'injuries'
  | 'major_sports';

export const AI_NEWS_CATEGORIES: Array<{
  id: AiNewsCategory;
  label: string;
  urduLabel: string;
}> = [
  { id: 'pakistan_cricket', label: 'Pakistan Cricket', urduLabel: 'پاکستان کرکٹ' },
  { id: 'international_cricket', label: 'International Cricket', urduLabel: 'انٹرنیشنل کرکٹ' },
  { id: 'leagues', label: 'T20 & Cricket Leagues', urduLabel: 'کرکٹ لیگز' },
  { id: 'players', label: 'Players & Performances', urduLabel: 'کھلاڑی اور کارکردگی' },
  { id: 'match_schedules', label: 'Match Schedules & Series', urduLabel: 'میچ شیڈول' },
  { id: 'transfers', label: 'Squads & Transfers', urduLabel: 'اسکواڈ اور تبادلے' },
  { id: 'injuries', label: 'Injuries & Fitness', urduLabel: 'انجریز اور فٹنس' },
  { id: 'major_sports', label: 'Major Sports Headlines', urduLabel: 'اہم اسپورٹس خبریں' }
];

export type AiNewsVoiceName = 'Charon' | 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr';

export const AI_NEWS_VOICES: Array<{
  id: AiNewsVoiceName;
  label: string;
  tone: string;
}> = [
  { id: 'Charon', label: 'Charon (Deep Studio Male)', tone: 'Authoritative Pakistani TV Male Anchor' },
  { id: 'Kore', label: 'Kore (Crisp Studio Female)', tone: 'Poised Pakistani TV Female Anchor' },
  { id: 'Fenrir', label: 'Fenrir (Bold Breaking Desk)', tone: 'Energetic Breaking Sports Anchor' },
  { id: 'Puck', label: 'Puck (Dynamic Match Host)', tone: 'Upbeat Cricket Magazine Host' },
  { id: 'Zephyr', label: 'Zephyr (Warm Evening Bulletin)', tone: 'Smooth Prime-Time Presenter' }
];

export type AiNewsAnchorId = 'male_pk' | 'female_pk' | 'custom';

export type BroadcastTickerMode = 'auto' | 'manual' | 'combined';

export type AiNewsEditorialCategory =
  | 'Domestic'
  | 'International'
  | 'Transfers'
  | 'ICC'
  | 'Match Update'
  | 'Injuries'
  | 'Breaking'
  | 'General';

export const AI_NEWS_EDITORIAL_CATEGORIES: Array<{
  id: AiNewsEditorialCategory;
  label: string;
  urduLabel: string;
}> = [
  { id: 'International', label: 'International', urduLabel: 'انٹرنیشنل' },
  { id: 'Domestic', label: 'Domestic', urduLabel: 'ڈومیسٹک' },
  { id: 'Transfers', label: 'Transfers', urduLabel: 'تبادلے و اسکواڈ' },
  { id: 'ICC', label: 'ICC', urduLabel: 'آئی سی سی' },
  { id: 'Match Update', label: 'Match Update', urduLabel: 'میچ اپڈیٹ' },
  { id: 'Injuries', label: 'Injuries', urduLabel: 'انجریز و فٹنس' },
  { id: 'Breaking', label: 'Breaking', urduLabel: 'بریکنگ نیوز' },
  { id: 'General', label: 'General', urduLabel: 'جنرل اسپورٹس' }
];

export interface AiNewsSourceAttribution {
  name: string;
  url: string;
}

export interface AiNewsStudioConfig {
  enabled: boolean;
  autoSwitchOnNoMatch: boolean;
  companyName: string;
  logoUrl: string;
  anchorId: AiNewsAnchorId;
  anchorName: string;
  anchorTitle: string;
  customAnchorImageUrl: string;
  voiceName: AiNewsVoiceName;
  voiceStyle: string;
  speechRate: number;
  autoSpeak: boolean;
  tickerSpeed: 'slow' | 'normal' | 'fast';
  broadcastTickerEnabled: boolean;
  broadcastTickerMode: BroadcastTickerMode;
  broadcastTickerBreakingOnly: boolean;
  broadcastTickerManualText: string;
  broadcastCategoryFilter: 'All' | AiNewsEditorialCategory;
  refreshIntervalMinutes: number;
  bulletinDurationSec: number;
  categories: AiNewsCategory[];
  showSourcesOnScreen: boolean;
  updatedAt: number;
}

export interface AiNewsBulletin {
  id: string;
  category: AiNewsCategory;
  editorialCategory: AiNewsEditorialCategory;
  categoryLabel: string;
  categoryUrdu: string;
  isBreaking: boolean;
  englishHeadline: string;
  urduHeadline: string;
  urduScript: string;
  urduSummaryPoints: string[];
  tickerUrdu: string;
  tickerEnglish: string;
  matchedPlayerName?: string;
  matchedTeamCode?: string;
  imageUrl?: string;
  sources: AiNewsSourceAttribution[];
  publishedAt: string;
  createdAt: number;
}

export interface AiNewsStudioState {
  config: AiNewsStudioConfig;
  bulletins: AiNewsBulletin[];
  coveredHistoryCount: number;
  isFetching: boolean;
  lastFetchedAt: number;
  lastError: string | null;
  nextScheduledFetchAt: number;
}


