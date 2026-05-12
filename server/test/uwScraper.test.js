/**
 * Smoke tests for the UW Time Schedule parser.
 * Run with: node --test test/uwScraper.test.js
 *
 * We intentionally avoid pulling in Jest/Mocha — Node's built-in
 * test runner (>=18) keeps the server dependency-free for now.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTimeScheduleHTML,
  _internal: { splitDays, formatMilTime, parseEnrollment, htmlToText },
} = require('../services/uwScraper');

test('splitDays handles single-letter and Th composite', () => {
  assert.deepEqual(splitDays('MWF'), ['M', 'W', 'F']);
  assert.deepEqual(splitDays('TTh'), ['T', 'Th']);
  assert.deepEqual(splitDays('MTWThF'), ['M', 'T', 'W', 'Th', 'F']);
});

test('formatMilTime pads and inserts colon', () => {
  assert.equal(formatMilTime('830'), '08:30');
  assert.equal(formatMilTime('1130'), '11:30');
  assert.equal(formatMilTime('1420'), '14:20');
});

test('parseEnrollment extracts trailing enrolled/capacity', () => {
  assert.deepEqual(
    parseEnrollment('   12345 A 5 MWF 1130-1220 KNE 210 SMITH Open      120/  150'),
    { enrolled: 120, capacity: 150 }
  );
  assert.deepEqual(
    parseEnrollment('   12346 B 5 MWF 1130-1220 KNE 210 SMITH Closed     50E/  50'),
    { enrolled: 50, capacity: 50 }
  );
});

test('htmlToText strips tags and decodes &nbsp;', () => {
  const out = htmlToText('<pre>foo&nbsp;bar<br/>baz</pre>');
  assert.match(out, /foo bar/);
  assert.match(out, /baz/);
});

test('parseTimeScheduleHTML parses a minimal fixture', () => {
  const fixture = `
<pre>
CSE 142  Computer Programming I
  12345 A  4   MWF     0930-1020 KNE 210  REGES,S         Open      280/  300
  12346 B  4   MWF     1130-1220 KNE 210  STEPP,M         Open      260/  300
CSE 143  Computer Programming II
  12400 A  5   MWF     1330-1420 KNE 120  MARTIN,B        Open      220/  250
</pre>
`;
  const courses = parseTimeScheduleHTML(fixture);
  assert.equal(courses.length, 2);

  const cse142 = courses.find((c) => c.code === 'CSE 142');
  assert.ok(cse142, 'CSE 142 should be parsed');
  assert.equal(cse142.title, 'Computer Programming I');
  assert.equal(cse142.sections.length, 2);
  assert.deepEqual(cse142.sections[0].days, ['M', 'W', 'F']);
  assert.equal(cse142.sections[0].startTime, '09:30');
  assert.equal(cse142.sections[0].endTime, '10:20');
  assert.equal(cse142.sections[0].sln, '12345');
  assert.equal(cse142.sections[0].capacity, 300);
});
