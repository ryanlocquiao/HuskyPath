/**
 * /api/courses
 * ------------
 * GET  /api/courses                       -> returns cached sample courses
 * GET  /api/courses/:dept?quarter=AUT2026 -> live-scrapes a single department
 *
 * Live scraping is gated behind an explicit query param so we don't
 * hammer the UW server during development.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { fetchDept } = require('../services/uwScraper');

const router = express.Router();
const SAMPLE_PATH = path.join(__dirname, '..', 'data', 'sample-courses.json');

router.get('/', (_req, res) => {
  try {
    const raw = fs.readFileSync(SAMPLE_PATH, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sample courses', detail: err.message });
  }
});

router.get('/:dept', async (req, res) => {
  const dept = String(req.params.dept || '').toLowerCase();
  const quarter = String(req.query.quarter || 'AUT2026').toUpperCase();

  if (!/^[a-z&]{1,7}$/.test(dept)) {
    return res.status(400).json({ error: `Invalid dept: ${dept}` });
  }

  try {
    const courses = await fetchDept({ quarter, dept });
    res.json({ quarter, dept, count: courses.length, courses });
  } catch (err) {
    res.status(502).json({
      error: 'Upstream UW Time Schedule fetch failed',
      detail: err.message,
      quarter,
      dept,
    });
  }
});

module.exports = router;
