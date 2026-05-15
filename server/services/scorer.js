/**
 * Schedule Scoring Model
 * -------------------------------------------------------------------
 * Scores a candidate schedule across four dimensions defined in the
 * HuskyPath proposal §2b, then collapses them into a single 0..1
 * value via a weighted sum.
 *
 *   1. workload_balance         credit distribution across the week
 *   2. time_gap_efficiency      penalty for excessive dead time between classes
 *   3. difficulty_curve         section difficulty proxy (placeholder until
 *                               RMP / grade-distribution data lands)
 *   4. constraint_satisfaction  fraction of SOFT preferences respected
 *
 * Each dimension is normalized to 0..1 (1 = ideal) so the weighted
 * sum is itself bounded to 0..1.
 *
 * Public API
 *   scoreSchedule(candidate, constraints) -> {
 *     score: number,             // 0..1
 *     breakdown: { ... },        // per-dimension 0..1
 *     explanation: string,       // short plain-language summary
 *   }
 */

'use strict';

const { timeToMinutes } = require('./scheduler');

// Weights: tune later via user-adjustable sliders per proposal §2b.
const WEIGHTS = {
  workload_balance: 0.2,
  time_gap_efficiency: 0.3,
  difficulty_curve: 0.2,
  constraint_satisfaction: 0.3,
};

const DAYS = ['M', 'T', 'W', 'Th', 'F'];

const DAY_NAMES = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  Th: 'Thursday',
  F: 'Friday',
};

const TIME_BUCKETS = {
  morning:   [timeToMinutes('06:00'), timeToMinutes('12:00')],
  afternoon: [timeToMinutes('12:00'), timeToMinutes('17:00')],
  evening:   [timeToMinutes('17:00'), timeToMinutes('22:00')],
};

/**
 * Group section minutes by day of the week.
 * @returns {Record<string, number>} minutes of class per day
 */
function minutesByDay(sections) {
  const totals = Object.fromEntries(DAYS.map((d) => [d, 0]));
  for (const s of sections) {
    const dur = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
    for (const d of s.days) {
      if (totals[d] != null) totals[d] += dur;
    }
  }
  return totals;
}

/**
 * Workload balance: 1 when each day has near-equal class minutes,
 * decreasing as the distribution becomes lopsided. Implemented as
 *   1 - (stddev / mean) clamped to [0, 1].
 */
function scoreWorkloadBalance(sections) {
  const totals = minutesByDay(sections);
  const values = Object.values(totals);
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return 1;
  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance =
    nonZero.reduce((a, b) => a + (b - mean) ** 2, 0) / nonZero.length;
  const stddev = Math.sqrt(variance);
  if (mean === 0) return 1;
  const cv = stddev / mean; // coefficient of variation
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Time-gap efficiency: penalizes long dead gaps between classes on
 * the same day. Score per day = 1 when gaps are 0–30 min, falling
 * linearly toward 0 as gap-time approaches 4 hours. Day-scores are
 * averaged across days that have at least 2 classes.
 */
function scoreTimeGapEfficiency(sections) {
  const byDay = {};
  for (const s of sections) {
    for (const d of s.days) {
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push({
        start: timeToMinutes(s.startTime),
        end: timeToMinutes(s.endTime),
      });
    }
  }
  const dayScores = [];
  for (const list of Object.values(byDay)) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.start - b.start);
    let totalGap = 0;
    for (let i = 1; i < list.length; i++) {
      const gap = Math.max(0, list[i].start - list[i - 1].end);
      totalGap += gap;
    }
    // 0 min gap → 1.0;  240 min total gaps → 0.0
    const score = Math.max(0, 1 - totalGap / 240);
    dayScores.push(score);
  }
  if (dayScores.length === 0) return 1; // no multi-class days, nothing to penalize
  return dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
}

/**
 * Difficulty curve: placeholder proxy until Rate My Professor /
 * grade-distribution data is wired in. We use enrollment fullness
 * as a rough signal — popular sections tend to be the easier or
 * better-reviewed ones — and total credit load as a sanity check
 * (15 credits ≈ 1.0, 20+ credits drops sharply).
 *
 * NOTE: replace with real RMP/GPA lookup once we have it.
 */
function scoreDifficultyCurve(sections) {
  if (sections.length === 0) return 1;
  const fullnesses = sections
    .map((s) =>
      s.capacity > 0 ? Math.min(1, (s.enrolled ?? 0) / s.capacity) : 0.5
    );
  const meanFullness =
    fullnesses.reduce((a, b) => a + b, 0) / fullnesses.length;

  const totalCredits = sections.reduce(
    (n, s) => n + (Number(s.credits) || 0),
    0
  );
  // Sweet spot around 12–16 credits.
  let loadScore = 1;
  if (totalCredits > 16) loadScore = Math.max(0, 1 - (totalCredits - 16) / 8);
  if (totalCredits < 10) loadScore = Math.max(0, totalCredits / 10);

  return 0.5 * meanFullness + 0.5 * loadScore;
}

/**
 * Constraint satisfaction: fraction of SOFT preferences honored.
 * Hard constraints (no_before, no_after, excluded/required courses)
 * are already enforced by the scheduler, so we don't re-check them.
 */
function scoreConstraintSatisfaction(sections, constraints = {}) {
  const checks = [];

  // light_days: requested days should have <= 60 minutes of class.
  if (Array.isArray(constraints.light_days) && constraints.light_days.length) {
    const totals = minutesByDay(sections);
    for (const dayName of constraints.light_days) {
      const code = Object.entries(DAY_NAMES).find(([, n]) => n === dayName)?.[0];
      if (!code) continue;
      checks.push(totals[code] <= 60 ? 1 : 0);
    }
  }

  // preferred_times: at least 75% of class minutes should fall in the
  // preferred time bucket(s).
  if (
    Array.isArray(constraints.preferred_times) &&
    constraints.preferred_times.length
  ) {
    let total = 0;
    let inPreferred = 0;
    for (const s of sections) {
      const dur = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
      const start = timeToMinutes(s.startTime);
      total += dur * s.days.length;
      for (const bucket of constraints.preferred_times) {
        const range = TIME_BUCKETS[bucket];
        if (range && start >= range[0] && start < range[1]) {
          inPreferred += dur * s.days.length;
          break;
        }
      }
    }
    if (total > 0) {
      checks.push(inPreferred / total >= 0.75 ? 1 : inPreferred / total);
    }
  }

  // avoid_consecutive: no two classes touching end-to-start with < 10 min gap.
  if (constraints.avoid_consecutive) {
    const byDay = {};
    for (const s of sections) {
      for (const d of s.days) {
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push({
          start: timeToMinutes(s.startTime),
          end: timeToMinutes(s.endTime),
        });
      }
    }
    let consecutiveCount = 0;
    let pairs = 0;
    for (const list of Object.values(byDay)) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.start - b.start);
      for (let i = 1; i < list.length; i++) {
        pairs += 1;
        if (list[i].start - list[i - 1].end < 10) consecutiveCount += 1;
      }
    }
    checks.push(pairs === 0 ? 1 : 1 - consecutiveCount / pairs);
  }

  if (checks.length === 0) return 1; // no soft preferences -> nothing to violate
  return checks.reduce((a, b) => a + b, 0) / checks.length;
}

/**
 * Build a short plain-language explanation from a breakdown.
 * Picks the two highest-scoring dimensions and frames them as wins.
 */
function buildExplanation(breakdown, sections, constraints = {}) {
  const labels = {
    workload_balance: 'spreads your workload evenly across the week',
    time_gap_efficiency: 'minimizes dead time between classes',
    difficulty_curve: 'keeps your overall load manageable',
    constraint_satisfaction: 'respects the preferences you listed',
  };
  const ranked = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, v]) => v >= 0.6);

  if (ranked.length === 0) {
    return 'This schedule is conflict-free but only loosely matches your preferences.';
  }

  const phrases = ranked.map(([k]) => labels[k]).filter(Boolean);
  const dayMinutes = minutesByDay(sections);
  const lightestDay = Object.entries(dayMinutes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[1] - b[1])[0];

  let suffix = '';
  if (lightestDay && lightestDay[1] <= 60) {
    suffix = ` Your lightest day is ${DAY_NAMES[lightestDay[0]]}.`;
  }

  return `This schedule ${phrases.join(' and ')}.${suffix}`;
}

/**
 * Score a single candidate schedule.
 */
function scoreSchedule(candidate, constraints = {}) {
  const { sections } = candidate;
  const breakdown = {
    workload_balance: scoreWorkloadBalance(sections),
    time_gap_efficiency: scoreTimeGapEfficiency(sections),
    difficulty_curve: scoreDifficultyCurve(sections),
    constraint_satisfaction: scoreConstraintSatisfaction(sections, constraints),
  };
  const score =
    breakdown.workload_balance * WEIGHTS.workload_balance +
    breakdown.time_gap_efficiency * WEIGHTS.time_gap_efficiency +
    breakdown.difficulty_curve * WEIGHTS.difficulty_curve +
    breakdown.constraint_satisfaction * WEIGHTS.constraint_satisfaction;

  return {
    score: Number(score.toFixed(3)),
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, Number(v.toFixed(3))])
    ),
    explanation: buildExplanation(breakdown, sections, constraints),
  };
}

module.exports = {
  scoreSchedule,
  WEIGHTS,
  // exported for tests
  _internal: {
    scoreWorkloadBalance,
    scoreTimeGapEfficiency,
    scoreDifficultyCurve,
    scoreConstraintSatisfaction,
    buildExplanation,
    minutesByDay,
  },
};
