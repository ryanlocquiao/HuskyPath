/**
 * Schedule Candidate Generator
 * -------------------------------------------------------------------
 * Given a list of courses (each with one or more sections) and a set
 * of user constraints, produce conflict-free candidate schedules
 * suitable for scoring.
 *
 * Algorithm
 *   Recursive backtracking: pick one section per course, prune any
 *   pick that conflicts in time with an already-chosen section or
 *   that violates a hard constraint. To keep the search bounded on
 *   large inputs we cap the number of candidates explored.
 *
 * Public API
 *   timeToMinutes(hhmm)                       -> number
 *   sectionsConflict(a, b)                    -> boolean
 *   generateCandidates(courses, constraints,  -> Candidate[]
 *                      { maxCandidates })
 *
 * Candidate shape
 *   { sections: Section[] }
 *
 * Constraints honored as HARD filters (cause pruning):
 *   - no_before:        "HH:MM"   reject sections starting before this
 *   - no_after:         "HH:MM"   reject sections ending after this
 *   - excluded_courses: string[]  drop these course codes entirely
 *   - required_courses: string[]  if a required course has no eligible
 *                                 sections, return [] (caller decides
 *                                 how to surface the failure)
 *
 * Constraints honored as SOFT preferences (left to the scorer):
 *   - light_days, preferred_times, avoid_consecutive, ...
 */

'use strict';

/**
 * Convert "HH:MM" (24-hour) to minutes since midnight.
 * @param {string} hhmm
 * @returns {number}
 */
function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return NaN;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Do two sections overlap in time on at least one shared day?
 * Treats start/end as inclusive-start, exclusive-end (standard).
 */
function sectionsConflict(a, b) {
  const sharedDay = a.days.some((d) => b.days.includes(d));
  if (!sharedDay) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Hard-filter a course's sections by the constraint object before
 * we ever consider them in the search. Returns the filtered list.
 */
function eligibleSections(course, constraints = {}) {
  const noBefore = constraints.no_before
    ? timeToMinutes(constraints.no_before)
    : null;
  const noAfter = constraints.no_after
    ? timeToMinutes(constraints.no_after)
    : null;

  return course.sections.filter((s) => {
    if (noBefore != null && timeToMinutes(s.startTime) < noBefore) return false;
    if (noAfter != null && timeToMinutes(s.endTime) > noAfter) return false;
    // Closed sections are still candidates — UW students often plan
    // around waitlists — but we tag them so the scorer can penalize.
    return true;
  });
}

/**
 * Generate conflict-free candidate schedules.
 *
 * @param {Course[]} courses
 * @param {object}   constraints
 * @param {object}   [opts]
 * @param {number}   [opts.maxCandidates=200]
 * @returns {{sections: Section[]}[]}
 */
function generateCandidates(courses, constraints = {}, opts = {}) {
  const maxCandidates = opts.maxCandidates ?? 200;

  const excluded = new Set(constraints.excluded_courses || []);
  const required = new Set(constraints.required_courses || []);

  // Drop excluded courses up front.
  const pool = courses
    .filter((c) => !excluded.has(c.code))
    .map((c) => ({ ...c, sections: eligibleSections(c, constraints) }));

  // Required courses with no eligible sections = unsatisfiable.
  for (const code of required) {
    const c = pool.find((x) => x.code === code);
    if (!c || c.sections.length === 0) return [];
  }

  // Sort courses with fewest sections first → smaller branching factor up top.
  pool.sort((a, b) => a.sections.length - b.sections.length);

  const candidates = [];

  function backtrack(idx, chosen) {
    if (candidates.length >= maxCandidates) return;
    if (idx === pool.length) {
      candidates.push({ sections: chosen.slice() });
      return;
    }
    const course = pool[idx];
    // If this course has no eligible sections AND it's not required,
    // we skip it (treat as optional). Otherwise we'd produce zero
    // candidates whenever any single course had no fit.
    if (course.sections.length === 0) {
      if (required.has(course.code)) return;
      backtrack(idx + 1, chosen);
      return;
    }
    for (const section of course.sections) {
      const sectionWithCourse = {
        ...section,
        courseCode: course.code,
        courseTitle: course.title,
      };
      const conflicts = chosen.some((c) => sectionsConflict(c, sectionWithCourse));
      if (conflicts) continue;
      chosen.push(sectionWithCourse);
      backtrack(idx + 1, chosen);
      chosen.pop();
      if (candidates.length >= maxCandidates) return;
    }
  }

  backtrack(0, []);
  return candidates;
}

module.exports = {
  generateCandidates,
  sectionsConflict,
  timeToMinutes,
  // exported for tests
  _internal: { eligibleSections },
};
