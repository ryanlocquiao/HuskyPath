/**
 * POST /api/parse-constraints
 *
 * Owner: Max
 * Status: IMPLEMENTED — Gemini API integration.
 *
 * Contract
 * --------
 * Request body:
 *   { "text": "no classes before 10am, light Friday, avoid back-to-back lectures" }
 *
 * Response (200):
 *   {
 *     "constraints": {
 *       "no_before":         "10:00",     // 24h "HH:MM" or null
 *       "no_after":          null,        // 24h "HH:MM" or null
 *       "light_days":        ["Friday"],  // subset of M/T/W/Th/F
 *       "preferred_times":   ["afternoon"], // ["morning","afternoon","evening"]
 *       "avoid_consecutive": true,        // bool
 *       "required_courses":  ["CSE 142"], // explicit course codes
 *       "excluded_courses":  []           // explicit course codes
 *     },
 *     "raw_text": "<original input>"
 *   }
 *
 * Error responses:
 *   400 { error: "Missing 'text' in request body" }
 *   502 { error: "Claude API call failed", detail: "<message>" }
 *
 * Implementation notes
 * --------------------
 * 1. Read ANTHROPIC_API_KEY from process.env (see server/.env.example).
 * 2. Use the official @anthropic-ai/sdk Node client.
 * 3. Use prompt-engineering: a system prompt that says "Extract a JSON
 *    constraint object from the user's preferences. Return ONLY JSON,
 *    no prose." Few-shot the schema above.
 * 4. Validate Claude's response parses as JSON before returning.
 * 5. Add unit tests in server/test/constraintParser.test.js — mock the
 *    Claude client so tests don't need a live API key.
 */

'use strict';

const express = require('express');
const { parseConstraints } = require('../services/constraintParser');
const router = express.Router();

router.post('/', async (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: "Missing 'text' in request body" });
  }

  try {
    const constraints = await parseConstraints({ text });
    return res.json({ constraints, raw_text: text });
  } catch (err) {
    return res.status(502).json({ error: 'Gemini API call failed', detail: err.message });
  }
});

module.exports = router;
