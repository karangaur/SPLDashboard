export interface BadmintonScoringRules {
  pointTarget: number; // 21 (BWF standard), 15, 30, or custom
  setsToWin: number; // 1 (single game) or 2 (best of 3)
  deuceEnabled: boolean; // must win by 2 points
  maxPointCap: number; // golden point / cap (e.g. 30 in BWF)
  changeEndsAtInterval: boolean; // interval at 11 pts (or half point target)
}

export const DEFAULT_BADMINTON_RULES: BadmintonScoringRules = {
  pointTarget: 21,
  setsToWin: 1, // Default 1 set for rapid league matches, can be configured to 2 (best of 3)
  deuceEnabled: true,
  maxPointCap: 30,
  changeEndsAtInterval: true,
};

export interface SetScore {
  scoreA: number;
  scoreB: number;
  winner?: 'A' | 'B';
  isCompleted?: boolean;
}

export interface SetStatus {
  isFinished: boolean;
  winner?: 'A' | 'B';
  isGamePointA: boolean;
  isGamePointB: boolean;
  isMatchPointA: boolean;
  isMatchPointB: boolean;
  isDeuce: boolean;
  isInterval: boolean;
  leadText: string;
}

/**
 * Evaluates the status of an ongoing or completed set according to configured badminton rules
 */
export function evaluateSetStatus(
  scoreA: number,
  scoreB: number,
  rules: BadmintonScoringRules = DEFAULT_BADMINTON_RULES,
  setsWonA = 0,
  setsWonB = 0
): SetStatus {
  const target = rules.pointTarget || 21;
  const cap = rules.maxPointCap || (target + 9);
  const diff = Math.abs(scoreA - scoreB);

  let isFinished = false;
  let winner: 'A' | 'B' | undefined = undefined;

  if (rules.deuceEnabled) {
    if ((scoreA >= target && diff >= 2) || (scoreA >= cap && scoreA > scoreB)) {
      isFinished = true;
      winner = 'A';
    } else if ((scoreB >= target && diff >= 2) || (scoreB >= cap && scoreB > scoreA)) {
      isFinished = true;
      winner = 'B';
    }
  } else {
    if (scoreA >= target && scoreA > scoreB) {
      isFinished = true;
      winner = 'A';
    } else if (scoreB >= target && scoreB > scoreA) {
      isFinished = true;
      winner = 'B';
    }
  }

  // Deuce: Both teams reached at least target - 1 and scores are equal
  const isDeuce = rules.deuceEnabled && scoreA >= target - 1 && scoreB >= target - 1 && scoreA === scoreB && !isFinished;

  // Game Point detection
  const isOnePointAwayA = rules.deuceEnabled
    ? (scoreA >= target - 1 && scoreA > scoreB) || (scoreA === cap - 1 && scoreA === scoreB)
    : scoreA === target - 1;

  const isOnePointAwayB = rules.deuceEnabled
    ? (scoreB >= target - 1 && scoreB > scoreA) || (scoreB === cap - 1 && scoreA === scoreB)
    : scoreB === target - 1;

  const isGamePointA = isOnePointAwayA && !isFinished;
  const isGamePointB = isOnePointAwayB && !isFinished;

  // Match Point: Team is 1 point away from winning this set AND this set gives them setsToWin
  const isMatchPointA = isGamePointA && (setsWonA + 1 >= rules.setsToWin);
  const isMatchPointB = isGamePointB && (setsWonB + 1 >= rules.setsToWin);

  // Interval check (first to reach interval point, e.g. 11 in a 21-pt match)
  const intervalPoint = Math.ceil(target / 2);
  const isInterval =
    rules.changeEndsAtInterval &&
    ((scoreA === intervalPoint && scoreB < intervalPoint) ||
     (scoreB === intervalPoint && scoreA < intervalPoint));

  // Human-readable lead text
  let leadText = 'Scores level (0 - 0)';
  if (isFinished) {
    leadText = `Set won by ${winner === 'A' ? 'Team A' : 'Team B'} (${scoreA} - ${scoreB})`;
  } else if (isDeuce) {
    leadText = `⚡ DEUCE · ${scoreA}-ALL (Advantage: +2 pts needed)`;
  } else if (isMatchPointA) {
    leadText = `🔥 MATCH POINT — Team A`;
  } else if (isMatchPointB) {
    leadText = `🔥 MATCH POINT — Team B`;
  } else if (isGamePointA) {
    leadText = `🔥 GAME POINT — Team A`;
  } else if (isGamePointB) {
    leadText = `🔥 GAME POINT — Team B`;
  } else if (scoreA > scoreB) {
    leadText = `Team A leads by ${scoreA - scoreB} (${scoreA} - ${scoreB})`;
  } else if (scoreB > scoreA) {
    leadText = `Team B leads by ${scoreB - scoreA} (${scoreB} - ${scoreA})`;
  } else if (scoreA > 0 && scoreA === scoreB) {
    leadText = `Scores tied at ${scoreA} — All`;
  }

  return {
    isFinished,
    winner,
    isGamePointA,
    isGamePointB,
    isMatchPointA,
    isMatchPointB,
    isDeuce,
    isInterval,
    leadText,
  };
}

/**
 * Checks overall match completion across all played sets
 */
export function evaluateMatchOverall(
  sets: SetScore[],
  currentScoreA: number,
  currentScoreB: number,
  rules: BadmintonScoringRules = DEFAULT_BADMINTON_RULES
): {
  isMatchCompleted: boolean;
  matchWinner?: 'A' | 'B';
  setsWonA: number;
  setsWonB: number;
  currentSetIndex: number;
} {
  let setsWonA = 0;
  let setsWonB = 0;

  for (const s of sets) {
    if (s.isCompleted || s.winner) {
      if (s.winner === 'A' || s.scoreA > s.scoreB) setsWonA++;
      else if (s.winner === 'B' || s.scoreB > s.scoreA) setsWonB++;
    }
  }

  // Check current active set
  const currentStatus = evaluateSetStatus(currentScoreA, currentScoreB, rules, setsWonA, setsWonB);
  if (currentStatus.isFinished && currentStatus.winner) {
    if (currentStatus.winner === 'A') setsWonA++;
    else if (currentStatus.winner === 'B') setsWonB++;
  }

  const isMatchCompleted = setsWonA >= rules.setsToWin || setsWonB >= rules.setsToWin;
  const matchWinner = setsWonA >= rules.setsToWin ? 'A' : setsWonB >= rules.setsToWin ? 'B' : undefined;

  return {
    isMatchCompleted,
    matchWinner,
    setsWonA,
    setsWonB,
    currentSetIndex: sets.length + 1,
  };
}
