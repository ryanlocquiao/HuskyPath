#!/usr/bin/env node
/**
 * CLI: scrape a UW department's Time Schedule into JSON on disk.
 *
 *   node scripts/scrape.js cse                      # AUT2026 by default
 *   node scripts/scrape.js cse --quarter=WIN2026
 *   node scripts/scrape.js cse --out=data/cse.json
 *
 * Prints a one-line summary, exits non-zero on failure.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchDept } = require('../services/uwScraper');

function parseArgs(argv) {
  const args = { dept: null, quarter: 'AUT2026', out: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--quarter=')) args.quarter = a.slice('--quarter='.length).toUpperCase();
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (!a.startsWith('--')) args.dept = a.toLowerCase();
  }
  return args;
}

async function main() {
  const { dept, quarter, out } = parseArgs(process.argv);
  if (!dept) {
    console.error('Usage: node scripts/scrape.js <dept> [--quarter=AUT2026] [--out=path.json]');
    process.exit(2);
  }

  const outPath = out
    ? path.resolve(process.cwd(), out)
    : path.join(__dirname, '..', 'data', `${dept}-${quarter.toLowerCase()}.json`);

  console.log(`[scrape] fetching ${quarter} ${dept}...`);
  const courses = await fetchDept({ quarter, dept });
  const payload = {
    quarter,
    dept,
    generatedAt: new Date().toISOString(),
    source: `https://www.washington.edu/students/timeschd/${quarter}/${dept}.html`,
    count: courses.length,
    courses,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  const totalSections = courses.reduce((n, c) => n + c.sections.length, 0);
  console.log(`[scrape] wrote ${outPath}`);
  console.log(`[scrape] ${courses.length} courses, ${totalSections} sections`);
}

main().catch((err) => {
  console.error('[scrape] failed:', err.message);
  process.exit(1);
});
