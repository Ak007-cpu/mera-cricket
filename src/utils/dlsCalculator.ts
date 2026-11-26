/**
 * Duckworth-Lewis-Stern (DLS) Cricket Target & Par Score Calculator
 * Standard ICC Resource Percentage Model for Limited Overs Cricket (ODI & T20)
 */

export interface DlsResourceInput {
  format: 'T20' | 'ODI' | 'T10' | 'CUSTOM';
  originalOvers: number; // e.g. 50 or 20
  team1Runs: number; // Team 1 final total score
  team1OversFaced: number; // Overs completed by Team 1
  team1WicketsLost: number; // Wickets lost by Team 1
  team1AllOut?: boolean;

  // Interruption Scenario
  scenario: 'before_innings2' | 'during_innings2' | 'during_innings1';

  // Team 2 parameters
  team2RevisedOvers: number; // Total overs Team 2 will have to bat
  team2OversCompleted?: number; // Overs Team 2 has completed so far (if interrupted mid-innings)
  team2WicketsLost?: number; // Wickets Team 2 has lost so far
  team2CurrentRuns?: number; // Runs Team 2 has scored so far

  // Custom standard average score (G50)
  customG50?: number;
}

export interface DlsCalculationResult {
  revisedTarget: number; // Target runs Team 2 must score to win
  tieTarget: number; // Score for a tie
  parScore: number; // Par score at current interruption point
  team1ResourcePercentage: number;
  team2ResourcePercentage: number;
  resourceDifference: number; // R2 - R1
  g50Used: number;
  requiredRunRate: number;
  remainingBalls: number;
  statusSummary: string;
  calculationExplanation: string;
}

/**
 * Standard ICC Resource Table (Overs remaining vs Wickets lost).
 * Values represent % of total 50-over innings resources available.
 * Calibrated against official ICC DLS Standard Edition tables.
 */
const DLS_RESOURCE_TABLE_50: { [overs: number]: number[] } = {
  50: [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7],
  45: [95.0, 89.0, 81.3, 71.8, 60.5, 47.6, 34.2, 21.8, 11.9, 4.7],
  40: [89.3, 84.0, 77.0, 68.3, 58.0, 46.0, 33.5, 21.6, 11.8, 4.7],
  35: [82.7, 78.1, 72.0, 64.2, 54.9, 44.1, 32.5, 21.3, 11.8, 4.7],
  30: [75.1, 71.2, 66.0, 59.3, 51.3, 41.7, 31.2, 20.8, 11.7, 4.7],
  25: [66.5, 63.3, 59.0, 53.4, 46.7, 38.6, 29.5, 20.1, 11.6, 4.7],
  20: [56.6, 54.1, 50.8, 46.4, 41.1, 34.5, 27.0, 19.0, 11.3, 4.7],
  18: [52.4, 50.2, 47.3, 43.4, 38.6, 32.6, 25.7, 18.3, 11.1, 4.6],
  16: [48.0, 46.1, 43.5, 40.1, 35.8, 30.5, 24.3, 17.5, 10.8, 4.6],
  15: [45.7, 43.9, 41.5, 38.3, 34.3, 29.3, 23.5, 17.0, 10.6, 4.6],
  14: [43.4, 41.7, 39.5, 36.5, 32.8, 28.1, 22.6, 16.5, 10.4, 4.5],
  12: [38.4, 37.0, 35.2, 32.7, 29.5, 25.5, 20.7, 15.3, 9.9, 4.4],
  10: [33.2, 32.1, 30.6, 28.6, 26.0, 22.7, 18.6, 14.0, 9.2, 4.3],
  8:  [27.6, 26.8, 25.7, 24.2, 22.1, 19.5, 16.2, 12.3, 8.4, 4.1],
  6:  [21.6, 21.0, 20.2, 19.2, 17.7, 15.8, 13.4, 10.4, 7.3, 3.8],
  5:  [18.4, 17.9, 17.3, 16.5, 15.3, 13.8, 11.8, 9.3, 6.6, 3.5],
  4:  [15.1, 14.7, 14.2, 13.6, 12.7, 11.5, 9.9, 7.9, 5.7, 3.2],
  3:  [11.6, 11.3, 11.0, 10.5, 9.9, 9.0, 7.9, 6.4, 4.7, 2.7],
  2:  [7.9, 7.7, 7.5, 7.2, 6.8, 6.3, 5.6, 4.6, 3.5, 2.1],
  1:  [4.1, 4.0, 3.9, 3.8, 3.6, 3.4, 3.0, 2.6, 2.0, 1.3],
  0:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
};

/**
 * Returns available resource percentage for a given number of overs remaining and wickets lost.
 * Linearly interpolates for fractional overs.
 */
export function getDlsResourcePercentage(oversRemaining: number, wicketsLost: number): number {
  const safeWickets = Math.min(10, Math.max(0, Math.floor(wicketsLost)));
  if (safeWickets >= 10 || oversRemaining <= 0) {
    return 0.0;
  }

  const roundedOvers = Math.min(50, Math.max(0, oversRemaining));
  const tableOvers = Object.keys(DLS_RESOURCE_TABLE_50)
    .map(Number)
    .sort((a, b) => a - b);

  // Exact match
  if (DLS_RESOURCE_TABLE_50[roundedOvers]) {
    return DLS_RESOURCE_TABLE_50[roundedOvers][safeWickets];
  }

  // Find bounding over keys for linear interpolation
  let lowerKey = 0;
  let upperKey = 50;

  for (let i = 0; i < tableOvers.length; i++) {
    if (tableOvers[i] <= roundedOvers) {
      lowerKey = tableOvers[i];
    }
    if (tableOvers[i] >= roundedOvers) {
      upperKey = tableOvers[i];
      break;
    }
  }

  if (lowerKey === upperKey) {
    return DLS_RESOURCE_TABLE_50[lowerKey][safeWickets];
  }

  const lowerVal = DLS_RESOURCE_TABLE_50[lowerKey][safeWickets];
  const upperVal = DLS_RESOURCE_TABLE_50[upperKey][safeWickets];
  const ratio = (roundedOvers - lowerKey) / (upperKey - lowerKey);
  const interpolated = lowerVal + ratio * (upperVal - lowerVal);

  return Number(interpolated.toFixed(2));
}

/**
 * Core Duckworth-Lewis-Stern target calculator
 */
export function calculateDlsTarget(input: DlsResourceInput): DlsCalculationResult {
  const originalOvers = input.originalOvers || (input.format === 'T20' ? 20 : 50);
  const g50 = input.customG50 || (originalOvers <= 20 ? 160 : 245);

  // 1. Calculate Team 1 Resources (R1)
  let r1 = 0;
  if (input.team1AllOut || input.team1WicketsLost >= 10) {
    // If all out, Team 1 consumed 100% of their allocated resources
    r1 = getDlsResourcePercentage(originalOvers, 0);
  } else if (input.team1OversFaced >= originalOvers) {
    r1 = getDlsResourcePercentage(originalOvers, 0);
  } else {
    // If Team 1 innings was interrupted early
    const totalAllocated = getDlsResourcePercentage(originalOvers, 0);
    const lostRemaining = getDlsResourcePercentage(
      originalOvers - input.team1OversFaced,
      input.team1WicketsLost
    );
    r1 = totalAllocated - lostRemaining;
  }

  // 2. Calculate Team 2 Resources (R2)
  let r2 = 0;
  const team2RevisedOvers = Math.min(originalOvers, Math.max(1, input.team2RevisedOvers));

  if (input.scenario === 'during_innings2') {
    // Interrupted during chase: Team 2 started with revisedOvers resources,
    // and lost overs from the interruption point
    const oversBowled = input.team2OversCompleted || 0;
    const wicketsDown = input.team2WicketsLost || 0;
    const initialAllocation = getDlsResourcePercentage(originalOvers, 0);
    const lostAtStart = getDlsResourcePercentage(originalOvers - team2RevisedOvers, 0);
    const oversRemainingBeforeSuspension = Math.max(0, team2RevisedOvers - oversBowled);
    const lostDuringInterruption = getDlsResourcePercentage(oversRemainingBeforeSuspension, wicketsDown);

    r2 = (initialAllocation - lostAtStart) - lostDuringInterruption;
  } else {
    // Interruption happened before or at the start of Team 2 innings
    r2 = getDlsResourcePercentage(team2RevisedOvers, 0);
  }

  // Standardize percentages relative to format full allotment
  const fullFormatAllotment = getDlsResourcePercentage(originalOvers, 0);
  const r1Normalized = Number(((r1 / fullFormatAllotment) * 100).toFixed(1));
  const r2Normalized = Number(((r2 / fullFormatAllotment) * 100).toFixed(1));

  // 3. Target Calculation Rule:
  // If R2 < R1: Target = floor(S * R2 / R1) + 1
  // If R2 >= R1: Target = floor(S + (R2 - R1) / 100 * G50) + 1
  let target = 0;
  let explanation = '';

  if (r2 <= r1) {
    target = Math.floor((input.team1Runs * r2) / r1) + 1;
    explanation = `R2 (${r2.toFixed(1)}%) < R1 (${r1.toFixed(1)}%): Target = floor(S × R2 / R1) + 1 = floor(${input.team1Runs} × ${r2.toFixed(1)} / ${r1.toFixed(1)}) + 1 = ${target}`;
  } else {
    const diff = (r2 - r1) / 100;
    target = Math.floor(input.team1Runs + diff * g50) + 1;
    explanation = `R2 (${r2.toFixed(1)}%) > R1 (${r1.toFixed(1)}%): Target = floor(S + (R2 - R1) × G50) + 1 = floor(${input.team1Runs} + ${diff.toFixed(3)} × ${g50}) + 1 = ${target}`;
  }

  // Tie target is target - 1
  const tieTarget = Math.max(0, target - 1);

  // 4. Par Score Calculation (For immediate rain stoppage in 2nd innings)
  const currentOvers = input.team2OversCompleted || 0;
  const currentWickets = input.team2WicketsLost || 0;
  const resourcesConsumedByT2 = getDlsResourcePercentage(team2RevisedOvers, 0) -
    getDlsResourcePercentage(team2RevisedOvers - currentOvers, currentWickets);

  let parScore = 0;
  if (r1 > 0) {
    parScore = Math.floor((input.team1Runs * resourcesConsumedByT2) / r1);
  }

  // 5. Required Run Rate Calculation
  const ballsCompleted = Math.floor(currentOvers) * 6 + Math.round((currentOvers % 1) * 10);
  const totalRevisedBalls = team2RevisedOvers * 6;
  const remainingBalls = Math.max(0, totalRevisedBalls - ballsCompleted);
  const currentRuns = input.team2CurrentRuns || 0;
  const neededRuns = Math.max(0, target - currentRuns);
  const rrr = remainingBalls > 0 ? Number(((neededRuns / remainingBalls) * 6).toFixed(2)) : 0;

  const statusSummary = `DLS Revised Target: ${target} runs in ${team2RevisedOvers} overs (Par: ${parScore})`;

  return {
    revisedTarget: target,
    tieTarget,
    parScore,
    team1ResourcePercentage: r1Normalized,
    team2ResourcePercentage: r2Normalized,
    resourceDifference: Number((r2Normalized - r1Normalized).toFixed(1)),
    g50Used: g50,
    requiredRunRate: rrr,
    remainingBalls,
    statusSummary,
    calculationExplanation: explanation
  };
}
