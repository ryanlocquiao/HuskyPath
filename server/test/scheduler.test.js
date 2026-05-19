'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateCandidates,
  sectionsConflict,
  timeToMinutes,
  normalizeDayList,
} = require('../services/scheduler');

const makeSection = (overrides = {}) => ({
  sln: '00000',
  sectionId: 'A',
  credits: '5',
  days: ['M', 'W', 'F'],
  startTime: '10:30',
  endTime: '11:20',
  building: 'KNE',
  room: '210',
  instructor: 'STAFF',
  status: 'Open',
  enrolled: 100,
  capacity: 150,
  ...overrides,
});

test('timeToMinutes converts HH:MM to minutes since midnight', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(timeToMinutes('14:20'), 14 * 60 + 20);
});

test('sectionsConflict detects same-day time overlap', () => {
  const a = makeSection({ days: ['M'], startTime: '10:00', endTime: '11:00' });
  const b = makeSection({ days: ['M'], startTime: '10:30', endTime: '11:30' });
  assert.equal(sectionsConflict(a, b), true);
});

test('sectionsConflict allows back-to-back times', () => {
  const a = makeSection({ days: ['M'], startTime: '10:00', endTime: '11:00' });
  const b = makeSection({ days: ['M'], startTime: '11:00', endTime: '12:00' });
  assert.equal(sectionsConflict(a, b), false);
});

test('sectionsConflict allows different days even with same time', () => {
  const a = makeSection({ days: ['M'], startTime: '10:00', endTime: '11:00' });
  const b = makeSection({ days: ['T'], startTime: '10:00', endTime: '11:00' });
  assert.equal(sectionsConflict(a, b), false);
});

test('generateCandidates produces one schedule per non-conflicting combo', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'CP I',
      sections: [
        makeSection({ sln: '111', startTime: '09:30', endTime: '10:20' }),
        makeSection({ sln: '112', startTime: '13:30', endTime: '14:20' }),
      ],
    },
    {
      code: 'MATH 124',
      title: 'Calc I',
      sections: [
        makeSection({ sln: '221', startTime: '09:30', endTime: '10:20' }), // conflicts w/ 111
        makeSection({ sln: '222', startTime: '11:30', endTime: '12:20' }), // OK w/ both
      ],
    },
  ];
  const candidates = generateCandidates(courses, {});
  // 111+222, 112+221, 112+222  => 3 combos; 111+221 conflicts
  assert.equal(candidates.length, 3);
  // Every candidate has exactly 2 sections
  for (const c of candidates) assert.equal(c.sections.length, 2);
});

test('generateCandidates respects no_before hard constraint', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'CP I',
      sections: [
        makeSection({ sln: '111', startTime: '08:30', endTime: '09:20' }),
        makeSection({ sln: '112', startTime: '13:30', endTime: '14:20' }),
      ],
    },
  ];
  const candidates = generateCandidates(courses, { no_before: '10:00' });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sections[0].sln, '112');
});

test('generateCandidates drops excluded_courses entirely', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'CP I',
      sections: [makeSection({ sln: '111' })],
    },
    {
      code: 'PSYCH 101',
      title: 'Intro Psych',
      sections: [makeSection({ sln: '221', days: ['T'] })],
    },
  ];
  const candidates = generateCandidates(courses, {
    excluded_courses: ['PSYCH 101'],
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sections.length, 1);
  assert.equal(candidates[0].sections[0].courseCode, 'CSE 142');
});

test('generateCandidates returns [] when a required course is unsatisfiable', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'CP I',
      sections: [makeSection({ sln: '111', startTime: '08:30', endTime: '09:20' })],
    },
  ];
  const candidates = generateCandidates(
    courses,
    { required_courses: ['CSE 142'], no_before: '10:00' }
  );
  assert.equal(candidates.length, 0);
});

test('normalizeDayList accepts codes and full names interchangeably', () => {
  assert.deepEqual([...normalizeDayList(['F', 'Th'])].sort(), ['F', 'Th']);
  assert.deepEqual(
    [...normalizeDayList(['Friday', 'thursday'])].sort(),
    ['F', 'Th']
  );
  assert.deepEqual([...normalizeDayList([])], []);
});

test('generateCandidates respects excluded_days as a hard constraint', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'CP I',
      sections: [
        makeSection({ sln: '111', days: ['M', 'W', 'F'] }),   // F excluded -> reject
        makeSection({ sln: '112', days: ['T', 'Th'] }),       // OK
      ],
    },
  ];
  const candidates = generateCandidates(courses, { excluded_days: ['Friday'] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sections[0].sln, '112');
});

test('generateCandidates attaches courseCode/courseTitle to sections', () => {
  const courses = [
    {
      code: 'CSE 142',
      title: 'Computer Programming I',
      sections: [makeSection({ sln: '111' })],
    },
  ];
  const [first] = generateCandidates(courses, {});
  assert.equal(first.sections[0].courseCode, 'CSE 142');
  assert.equal(first.sections[0].courseTitle, 'Computer Programming I');
});
