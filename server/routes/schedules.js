/**
 * POST /api/schedules
 *
 * Owner: Kieran
 *
 * Generates conflict-free candidate schedules from a list of courses
 * + user constraints, scores each across four dimensions, and returns
 * the top-N ranked schedules with plain-language explanations.
 *
 * Request body
 *   {
 *     "courses":     [ <Course>, ... ],   // shape from /api/courses
 *     "constraints": <Constraints>,       // shape from /api/parse-constraints
 *     "topN":        3                    // optional, default 3
 *   }
 *
 * Response (200)
 *   {
 *     "candidatesEvaluated": 47,
 *     "schedules": [
 *       {
 *         "sections":   [ <Section>, ... ],
 *         "score":      0.87,
 *         "breakdown":  { workload_balance, time_gap_efficiency,
 *                         difficulty_curve, constraint_satisfaction },
 *         "explanation": "This schedule ..."
 *       }, ...
 *     ]
 *   }
 *
 * Errors
 *   400  invalid body / missing courses
 *   200  with empty schedules[] when no conflict-free combination exists
 */

'use strict';

const express = require('express');
const { generateCandidates } = require('../services/scheduler');
const { scoreSchedule } = require('../services/scorer');

const router = express.Router();

router.post('/', (req, res) => {
  const body = req.body || {};
  const { courses, constraints = {} } = body;
  const topN = Number.isInteger(body.topN) && body.topN > 0 ? body.topN : 3;

  if (!Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({
      error: 'Missing or empty "courses" array in request body',
      expected: { courses: '[Course, ...]', constraints: '{...}', topN: 'number' },
    });
  }

  let candidates;
  try {
    candidates = generateCandidates(courses, constraints);
  } catch (err) {
    return res.status(500).json({
      error: 'Candidate generation failed',
      detail: err.message,
    });
  }

  const ranked = candidates
    .map((c) => ({ ...c, ...scoreSchedule(c, constraints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  res.json({
    candidatesEvaluated: candidates.length,
    schedules: ranked,
  });
});

module.exports = router;
