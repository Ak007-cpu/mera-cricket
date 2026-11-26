import { MatchState, WinProbabilityOverride } from '../types/cricket';

export interface TargetChaseMetrics {
  target: number;
  neededRuns: number;
  remainingBalls: number;
  oversDisplay: string;
  requiredRunRate: number;
}

export interface WinProbabilityResult {
  battingPct: number;
  bowlingPct: number;
  battingCode: string;
  bowlingCode: string;
  battingName: string;
  bowlingName: string;
  battingColor: string;
  bowlingColor: string;
  isManualOverride: boolean;
}

export interface OverGraphPoint {
  overNumber: number;
  label: string;
  overRuns: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
  crr: number;
  rrr?: number;
  isWicket: boolean;
  wicketsInOver: number;
  wicketDetails?: string;
}

interface StoredOverSnapshot {
  overIndex: number; // 1-based over slot
  ballsCompleted: number;
  runs: number;
  wickets: number;
  crr: number;
  updatedAt: number;
}

const HISTORY_STORAGE_PREFIX = 'crex_over_history_v1_';

function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function getFormatMaxOvers(match: MatchState): number | null {
  if (match.dlsDetails?.applied && isValidNumber(match.dlsDetails.revisedOvers) && match.dlsDetails.revisedOvers > 0) {
    return match.dlsDetails.revisedOvers;
  }
  if (match.matchType === 'T10') return 10;
  if (match.matchType === 'T20') return 20;
  if (match.matchType === 'ODI') return 50;
  return null; // TEST has no fixed innings over cap
}

export function getTargetChaseMetrics(match: MatchState | null | undefined): TargetChaseMetrics | null {
  if (!match) return null;

  // Strictly show ONLY in 2nd innings
  if (match.currentInnings !== 2) return null;
  if (match.gameState === 'scheduled' || match.gameState === 'completed') return null;

  const target = Number(match.target);
  if (!Number.isFinite(target) || target <= 0) return null;

  const currentRuns = Number(match.battingTeam?.score?.runs);
  const currentOvers = Number(match.battingTeam?.score?.overs);
  const currentBalls = Number(match.battingTeam?.score?.balls);
  if (!Number.isFinite(currentRuns) || currentRuns < 0) return null;

  const neededRuns =
    isValidNumber(match.requiredRuns) && match.requiredRuns >= 0
      ? Math.round(match.requiredRuns)
      : Math.max(0, target - currentRuns);

  // If chase is already completed, hide the target chase panel
  if (neededRuns <= 0) return null;

  let remainingBalls: number | null = null;
  if (isValidNumber(match.remainingBalls) && match.remainingBalls >= 0) {
    remainingBalls = Math.round(match.remainingBalls);
  } else {
    const maxOvers = getFormatMaxOvers(match);
    if (maxOvers && Number.isFinite(currentOvers) && Number.isFinite(currentBalls)) {
      const bowledBalls = Math.max(0, currentOvers * 6 + currentBalls);
      remainingBalls = Math.max(0, maxOvers * 6 - bowledBalls);
    }
  }

  if (remainingBalls === null || remainingBalls <= 0) return null;

  const computedRRR = (neededRuns / remainingBalls) * 6;
  const requiredRunRate =
    isValidNumber(match.requiredRunRate) && match.requiredRunRate > 0
      ? match.requiredRunRate
      : computedRRR;

  if (!Number.isFinite(requiredRunRate) || requiredRunRate <= 0) return null;

  let oversDisplay: string;
  if (remainingBalls % 6 === 0) {
    const wholeOvers = remainingBalls / 6;
    oversDisplay = `${wholeOvers} ${wholeOvers === 1 ? 'over' : 'overs'}`;
  } else if (remainingBalls < 6) {
    oversDisplay = `${remainingBalls} ${remainingBalls === 1 ? 'ball' : 'balls'}`;
  } else {
    const whole = Math.floor(remainingBalls / 6);
    const remB = remainingBalls % 6;
    oversDisplay = `${whole}.${remB} overs`;
  }

  return {
    target,
    neededRuns,
    remainingBalls,
    oversDisplay,
    requiredRunRate
  };
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return trimmed;
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function areColorsTooClose(c1: string, c2: string): boolean {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  if (!rgb1 || !rgb2) return false;
  const dist = Math.hypot(rgb1[0] - rgb2[0], rgb1[1] - rgb2[1], rgb1[2] - rgb2[2]);
  return dist < 75;
}

function ensureDistinctColors(batRaw?: string, bowlRaw?: string): [string, string] {
  const bat = normalizeHexColor(batRaw, '#0ea5e9');
  let bowl = normalizeHexColor(bowlRaw, '#f59e0b');
  if (areColorsTooClose(bat, bowl)) {
    // Shift bowling color to amber or rose if too close to batting color
    const altAmber = '#f59e0b';
    const altRose = '#f43f5e';
    bowl = areColorsTooClose(bat, altAmber) ? altRose : altAmber;
  }
  return [bat, bowl];
}

export function calculateWinProbability(
  match: MatchState | null | undefined,
  override?: WinProbabilityOverride | null
): WinProbabilityResult | null {
  if (!match) return null;

  const batCode = (match.battingTeam?.code || match.battingTeam?.shortName || '').trim();
  const bowlCode = (match.bowlingTeam?.code || match.bowlingTeam?.shortName || '').trim();
  if (!batCode || !bowlCode) return null;

  const [battingColor, bowlingColor] = ensureDistinctColors(
    match.battingTeam?.primaryColor,
    match.bowlingTeam?.primaryColor
  );

  // Manual Admin Override takes immediate priority when explicitly enabled
  if (override?.enabled && Number.isFinite(Number(override.battingTeamPct))) {
    const batPct = Math.max(0, Math.min(100, Math.round(Number(override.battingTeamPct))));
    return {
      battingPct: batPct,
      bowlingPct: 100 - batPct,
      battingCode: batCode,
      bowlingCode: bowlCode,
      battingName: match.battingTeam.name || batCode,
      bowlingName: match.bowlingTeam.name || bowlCode,
      battingColor,
      bowlingColor,
      isManualOverride: true
    };
  }

  // Hide when match hasn't started or lacks valid live data
  if (match.gameState === 'scheduled') return null;

  const score = match.battingTeam?.score;
  if (!score || !isValidNumber(score.runs) || !isValidNumber(score.wickets) || !isValidNumber(score.overs)) {
    return null;
  }

  const ballsInOver = isValidNumber(score.balls) ? score.balls : 0;
  const completedBalls = Math.max(0, score.overs * 6 + ballsInOver);
  const completedOvers = completedBalls / 6;

  // In 1st innings with zero balls bowled and 0 runs, avoid displaying arbitrary guess
  if (match.currentInnings === 1 && completedBalls === 0 && score.runs === 0 && match.gameState !== 'completed') {
    return null;
  }

  // In 2nd innings, if no valid target exists, hide rather than showing wrong calculation
  if (match.currentInnings === 2 && (!isValidNumber(match.target) || match.target <= 0)) {
    return null;
  }

  const maxOvers = getFormatMaxOvers(match) || (match.matchType === 'TEST' ? Math.max(90, score.overs + 25) : 20);
  const parRR =
    match.matchType === 'T10'
      ? 9.5
      : match.matchType === 'ODI'
      ? 5.8
      : match.matchType === 'TEST'
      ? 3.4
      : 8.4;

  const wicketsLost = Math.max(0, Math.min(10, score.wickets));
  const wicketsInHand = 10 - wicketsLost;
  const crr = isValidNumber(match.currentRunRate) && match.currentRunRate >= 0
    ? match.currentRunRate
    : completedOvers > 0
    ? score.runs / completedOvers
    : 0;

  let rawBatPct = 50;

  // Check if match is already decided
  if (match.currentInnings === 2 && isValidNumber(match.target) && match.target > 0) {
    const target = match.target;
    const needed = Math.max(0, target - score.runs);
    const totalBalls = maxOvers * 6;
    const remBalls = isValidNumber(match.remainingBalls)
      ? Math.max(0, match.remainingBalls)
      : Math.max(0, totalBalls - completedBalls);

    if (needed === 0) {
      rawBatPct = 99;
    } else if (wicketsLost >= 10 || (match.matchType !== 'TEST' && remBalls <= 0)) {
      rawBatPct = 1;
    } else if (match.gameState === 'completed') {
      const statusLower = (match.statusText || '').toLowerCase();
      if (statusLower.includes(batCode.toLowerCase()) || statusLower.includes((match.battingTeam.name || '').toLowerCase())) {
        rawBatPct = 99;
      } else {
        rawBatPct = 1;
      }
    } else {
      const rrr =
        isValidNumber(match.requiredRunRate) && match.requiredRunRate > 0
          ? match.requiredRunRate
          : (needed / Math.max(1, remBalls)) * 6;

      // Wickets-in-hand adjusts chasing capacity
      const wicketCapacityFactor = 0.42 + (wicketsInHand / 10) * 0.72;
      const expectedScoringRate = Math.max(parRR * 0.85, crr * 0.4 + parRR * 0.6) * wicketCapacityFactor;
      const rateAdvantage = expectedScoringRate - rrr;

      // Progress weighting: late overs carry stronger certainty
      const progress = Math.min(1, completedBalls / Math.max(1, totalBalls));
      const certaintyScale = 0.34 + progress * 0.28;

      // Extreme impossible-chase damping (e.g. > 24 rpo needed)
      const impossibilityPenalty = rrr > 18 ? (rrr - 18) * 0.35 : 0;

      const z = rateAdvantage * certaintyScale + (wicketsInHand - 5) * 0.14 - impossibilityPenalty;
      rawBatPct = 100 / (1 + Math.exp(-z));
    }
  } else {
    // 1st innings: compare projected score & wickets in hand against format par
    if (match.gameState === 'completed') {
      const statusLower = (match.statusText || '').toLowerCase();
      if (statusLower.includes(batCode.toLowerCase()) || statusLower.includes((match.battingTeam.name || '').toLowerCase())) {
        rawBatPct = 95;
      } else if (statusLower.includes(bowlCode.toLowerCase()) || statusLower.includes((match.bowlingTeam.name || '').toLowerCase())) {
        rawBatPct = 5;
      }
    } else {
      const progress = Math.min(1, completedOvers / Math.max(1, maxOvers));
      const rateDiff = crr - parRR;
      // Early wickets hurt 1st innings more strongly than late wickets
      const expectedWicketsLost = progress * 6.5;
      const wicketBalance = expectedWicketsLost - wicketsLost;
      const z = rateDiff * 0.24 + wicketBalance * 0.22;
      rawBatPct = 100 / (1 + Math.exp(-z));
      // Keep 1st innings estimates bounded realistically (5..95)
      rawBatPct = Math.max(5, Math.min(95, rawBatPct));
    }
  }

  const battingPct = Math.max(1, Math.min(99, Math.round(rawBatPct)));
  return {
    battingPct,
    bowlingPct: 100 - battingPct,
    battingCode: batCode,
    bowlingCode: bowlCode,
    battingName: match.battingTeam.name || batCode,
    bowlingName: match.bowlingTeam.name || bowlCode,
    battingColor,
    bowlingColor,
    isManualOverride: false
  };
}

function loadStoredSnapshots(key: string): Map<number, StoredOverSnapshot> {
  const map = new Map<number, StoredOverSnapshot>();
  if (typeof window === 'undefined') return map;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (
          item &&
          typeof item.overIndex === 'number' &&
          typeof item.runs === 'number' &&
          typeof item.wickets === 'number'
        ) {
          map.set(item.overIndex, item);
        }
      }
    }
  } catch {}
  return map;
}

function saveStoredSnapshots(key: string, map: Map<number, StoredOverSnapshot>) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(map.values()).sort((a, b) => a.overIndex - b.overIndex).slice(-120);
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

export function recordOverSnapshot(match: MatchState | null | undefined): Map<number, StoredOverSnapshot> {
  if (!match || !match.matchId) return new Map();
  const score = match.battingTeam?.score;
  if (!score || !isValidNumber(score.runs) || !isValidNumber(score.overs)) return new Map();

  const balls = isValidNumber(score.balls) ? score.balls : 0;
  const totalBalls = score.overs * 6 + balls;
  if (totalBalls <= 0) return new Map();

  const key = `${HISTORY_STORAGE_PREFIX}${match.matchId}_inn${match.currentInnings || 1}`;
  const map = loadStoredSnapshots(key);

  const overIndex = balls > 0 ? score.overs + 1 : score.overs;
  if (overIndex <= 0) return map;

  const crr =
    isValidNumber(match.currentRunRate) && match.currentRunRate >= 0
      ? match.currentRunRate
      : Number((score.runs / (totalBalls / 6)).toFixed(2));

  const existing = map.get(overIndex);
  if (
    !existing ||
    totalBalls >= existing.ballsCompleted ||
    score.runs !== existing.runs ||
    score.wickets !== existing.wickets
  ) {
    map.set(overIndex, {
      overIndex,
      ballsCompleted: totalBalls,
      runs: score.runs,
      wickets: score.wickets,
      crr,
      updatedAt: Date.now()
    });
    saveStoredSnapshots(key, map);
  }

  return map;
}

export function buildOverProgression(
  match: MatchState | null | undefined,
  observedSnapshots?: Map<number, StoredOverSnapshot>
): OverGraphPoint[] {
  if (!match) return [];
  if (match.gameState === 'scheduled') return [];

  const score = match.battingTeam?.score;
  if (!score || !isValidNumber(score.runs) || score.runs < 0 || !isValidNumber(score.overs) || score.overs < 0) {
    return [];
  }

  const ballsInOver = isValidNumber(score.balls) ? Math.max(0, Math.min(5, score.balls)) : 0;
  const totalCompletedBalls = score.overs * 6 + ballsInOver;
  if (totalCompletedBalls <= 0) {
    // No deliveries bowled yet -> hide graph rather than plotting empty/fake point
    return [];
  }

  const maxPointOver = ballsInOver > 0 ? score.overs + 1 : score.overs;
  if (maxPointOver <= 0) return [];

  // Collect real wicket counts & player details per 1-based over
  const wicketsByOver = new Map<number, { count: number; players: string[] }>();
  const runsByOverFromBalls = new Map<number, number>();
  const ballCountInOver = new Map<number, number>();

  const addWicket = (ov1Based: number, player?: string) => {
    const ov = Math.max(1, Math.min(maxPointOver, ov1Based));
    const entry = wicketsByOver.get(ov) || { count: 0, players: [] };
    entry.count += 1;
    if (player && !entry.players.includes(player)) {
      entry.players.push(player);
    }
    wicketsByOver.set(ov, entry);
  };

  // 1. Fall of wickets from CREX scorecard (highest accuracy for cumulative score + wicket over)
  const inningsKey = match.currentInnings === 2 ? 'secondInnings' : 'firstInnings';
  const scorecard = match.scorecards?.[inningsKey];
  const anchorRuns = new Map<number, number>(); // overIndex -> cumulative runs anchor
  anchorRuns.set(0, 0);
  anchorRuns.set(maxPointOver, score.runs);

  if (scorecard?.fallOfWickets && scorecard.fallOfWickets.length > 0) {
    scorecard.fallOfWickets.forEach((fow) => {
      const parsed = parseFloat(String(fow.over || '0'));
      if (Number.isFinite(parsed) && parsed >= 0) {
        const whole = Math.floor(parsed);
        const fracBalls = Math.round((parsed - whole) * 10);
        // e.g. "4.2" happened during Over 5; "4.0" / "4.6" happened in Over 4
        const ov1Based = fracBalls > 0 ? whole + 1 : Math.max(1, whole);
        addWicket(ov1Based, fow.playerOut);
        if (isValidNumber(fow.score) && fow.score >= 0 && fow.score <= score.runs) {
          anchorRuns.set(ov1Based, Math.max(anchorRuns.get(ov1Based) || 0, fow.score));
        }
      }
    });
  }

  // 2. Recent balls (exact ball-by-ball runs and wickets for recent overs)
  if (match.recentBalls && match.recentBalls.length > 0) {
    match.recentBalls.forEach((ball) => {
      const rawOv = Number(ball.overNumber);
      if (!Number.isFinite(rawOv) || rawOv < 0) return;
      // CREX ballNumber like "17.4" -> overNumber is often 17 (0-indexed over) -> 1-based over 18,
      // OR if ballInOver === 6, some feeds use 17.6 or 18.0. Normalize cleanly:
      const ov1Based = ball.ballInOver > 0 ? Math.floor(rawOv) + 1 : Math.max(1, Math.floor(rawOv));
      if (ov1Based >= 1 && ov1Based <= maxPointOver) {
        runsByOverFromBalls.set(ov1Based, (runsByOverFromBalls.get(ov1Based) || 0) + (Number(ball.runs) || 0));
        if (!ball.isExtra) {
          ballCountInOver.set(ov1Based, (ballCountInOver.get(ov1Based) || 0) + 1);
        }
        if (ball.isWicket) {
          // Avoid double-counting if FOW already recorded this wicket in this over
          const existing = wicketsByOver.get(ov1Based);
          if (!existing || existing.count === 0) {
            addWicket(ov1Based, ball.batsmanName);
          }
        }
      }
    });
  }

  // 3. Observed snapshots recorded over live session
  const snapMap =
    observedSnapshots ||
    loadStoredSnapshots(`${HISTORY_STORAGE_PREFIX}${match.matchId}_inn${match.currentInnings || 1}`);

  let prevSnapWickets = 0;
  Array.from(snapMap.values())
    .sort((a, b) => a.overIndex - b.overIndex)
    .forEach((snap) => {
      if (snap.overIndex >= 1 && snap.overIndex < maxPointOver && snap.runs <= score.runs) {
        anchorRuns.set(snap.overIndex, snap.runs);
      }
      if (snap.wickets > prevSnapWickets) {
        const diff = snap.wickets - prevSnapWickets;
        const existing = wicketsByOver.get(snap.overIndex);
        if (!existing || existing.count < diff) {
          for (let i = existing?.count || 0; i < diff; i++) {
            addWicket(snap.overIndex);
          }
        }
      }
      prevSnapWickets = Math.max(prevSnapWickets, snap.wickets);
    });

  // Backfill anchor cumulative runs from recent complete overs if we have full 6-ball data
  let backwardCumulative = score.runs;
  for (let ov = maxPointOver; ov >= 2; ov--) {
    const bCount = ballCountInOver.get(ov) || 0;
    const isCurrentPartial = ov === maxPointOver && ballsInOver > 0;
    const isFullRecentOver = (isCurrentPartial && bCount >= ballsInOver) || (!isCurrentPartial && bCount >= 6);
    if (isFullRecentOver && runsByOverFromBalls.has(ov)) {
      backwardCumulative = Math.max(0, backwardCumulative - runsByOverFromBalls.get(ov)!);
      if (!anchorRuns.has(ov - 1)) {
        anchorRuns.set(ov - 1, backwardCumulative);
      }
    } else {
      break;
    }
  }

  // Build monotonic cumulative runs array across 1..maxPointOver using sorted known anchors
  const sortedAnchors = Array.from(anchorRuns.entries()).sort((a, b) => a[0] - b[0]);
  const cumulativeAtOver = new Array<number>(maxPointOver + 1).fill(0);

  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const [ovStart, runsStart] = sortedAnchors[i];
    const [ovEnd, runsEnd] = sortedAnchors[i + 1];
    const span = Math.max(1, ovEnd - ovStart);
    const safeEnd = Math.max(runsStart, runsEnd);
    for (let ov = ovStart; ov <= ovEnd; ov++) {
      if (ov === ovStart) cumulativeAtOver[ov] = runsStart;
      else if (ov === ovEnd) cumulativeAtOver[ov] = safeEnd;
      else {
        const t = (ov - ovStart) / span;
        cumulativeAtOver[ov] = Math.round(runsStart + (safeEnd - runsStart) * t);
      }
    }
  }
  cumulativeAtOver[maxPointOver] = score.runs;

  // Ensure monotonic non-decreasing cumulative runs
  for (let ov = 1; ov <= maxPointOver; ov++) {
    if (cumulativeAtOver[ov] < cumulativeAtOver[ov - 1]) {
      cumulativeAtOver[ov] = cumulativeAtOver[ov - 1];
    }
  }

  // If wickets happened in the current match total but none were matched to an over (e.g., mid-session start without FOW),
  // attach unmatched wicket indicator ONLY if FOW was empty and score.wickets > 0 and maxPointOver === 1
  let totalMappedWickets = 0;
  wicketsByOver.forEach((w) => {
    totalMappedWickets += w.count;
  });
  if (totalMappedWickets === 0 && score.wickets > 0 && maxPointOver <= 2) {
    addWicket(maxPointOver);
  }

  const maxOvers = getFormatMaxOvers(match);
  const isChasing = match.currentInnings === 2 && isValidNumber(match.target) && match.target > 0;
  const targetScore = isChasing ? Number(match.target) : 0;

  const points: OverGraphPoint[] = [];
  let runningWickets = 0;

  for (let ov = 1; ov <= maxPointOver; ov++) {
    const isCurrentPartial = ov === maxPointOver && ballsInOver > 0;
    const effectiveOvers = isCurrentPartial ? (ov - 1) + ballsInOver / 6 : ov;
    const cumRuns = cumulativeAtOver[ov];
    const prevCumRuns = cumulativeAtOver[ov - 1];
    const overRuns = Math.max(0, cumRuns - prevCumRuns);

    const wicketEntry = wicketsByOver.get(ov);
    const wicketsInOver = wicketEntry?.count || 0;
    runningWickets = Math.min(score.wickets, runningWickets + wicketsInOver);
    if (ov === maxPointOver) {
      runningWickets = score.wickets;
    }

    const crr =
      ov === maxPointOver && isValidNumber(match.currentRunRate) && match.currentRunRate >= 0
        ? Number(match.currentRunRate.toFixed(2))
        : effectiveOvers > 0
        ? Number((cumRuns / effectiveOvers).toFixed(2))
        : 0;

    let rrr: number | undefined;
    if (isChasing && maxOvers) {
      const remBalls = Math.max(1, maxOvers * 6 - Math.round(effectiveOvers * 6));
      const remRuns = Math.max(0, targetScore - cumRuns);
      rrr = Number(((remRuns / remBalls) * 6).toFixed(2));
    }

    const wicketDetails =
      wicketsInOver > 0
        ? wicketEntry?.players && wicketEntry.players.length > 0
          ? `Wicket: ${wicketEntry.players.join(', ')}`
          : `${wicketsInOver} Wicket${wicketsInOver > 1 ? 's' : ''}`
        : undefined;

    points.push({
      overNumber: ov,
      label: isCurrentPartial ? `${ov - 1}.${ballsInOver}` : `${ov}`,
      overRuns,
      cumulativeRuns: cumRuns,
      cumulativeWickets: runningWickets,
      crr,
      rrr,
      isWicket: wicketsInOver > 0,
      wicketsInOver,
      wicketDetails
    });
  }

  return points;
}
