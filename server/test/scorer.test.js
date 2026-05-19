'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { scoreSchedule, WEIGHTS } = require('../services/scorer');

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

test('scoreSchedule returns a 0..1 score plus 4-dim breakdown + explanation', () => {
  const candidate = {
    sections: [
      makeSection({ days: ['M', 'W', 'F'], startTime: '10:30', endTime: '11:20' }),
      makeSection({ days: ['T', 'Th'], startTime: '13:00', endTime: '14:20' }),
    ],
  };
  const result = scoreSchedule(candidate, {});
  assert.ok(result.score >= 0 && result.score <= 1, 'score in [0,1]');
  assert.ok(typeof result.explanation === 'string' && result.explanation.length);
  for (const k of [
    'workload_balance',
    'time_gap_efficiency',
    'difficulty_curve',
    'constraint_satisfaction',
  ]) {
    assert.ok(k in result.breakdown, `breakdown missing ${k}`);
    assert.ok(
      result.breakdown[k] >= 0 && result.breakdown[k] <= 1,
      `${k} in [0,1]`
    );
  }
});

test('time_gap_efficiency penalizes a 4hr gap between classes', () => {
  const tight = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M'], startTime: '09:00', endTime: '10:00' }),
        makeSection({ days: ['M'], startTime: '10:30', endTime: '11:30' }),
      ],
    },
    {}
  );
  const sparse = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M'], startTime: '09:00', endTime: '10:00' }),
        makeSection({ days: ['M'], startTime: '15:00', endTime: '16:00' }),
      ],
    },
    {}
  );
  assert.ok(
    tight.breakdown.time_gap_efficiency > sparse.breakdown.time_gap_efficiency,
    `expected tight schedule (${tight.breakdown.time_gap_efficiency}) > sparse (${sparse.breakdown.time_gap_efficiency})`
  );
});

test('constraint_satisfaction rewards a light Friday when requested', () => {
  const lightFri = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M', 'W'], startTime: '10:30', endTime: '11:20' }),
      ],
    },
    { light_days: ['Friday'] }
  );
  const heavyFri = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M', 'W', 'F'], startTime: '10:30', endTime: '13:20' }),
      ],
    },
    { light_days: ['Friday'] }
  );
  assert.equal(lightFri.breakdown.constraint_satisfaction, 1);
  assert.equal(heavyFri.breakdown.constraint_satisfaction, 0);
});

test('constraint_satisfaction credits preferred afternoon times', () => {
  const afternoon = scoreSchedule(
    {
      sections: [
        makeSection({ startTime: '13:30', endTime: '14:20' }),
        makeSection({ startTime: '15:00', endTime: '16:00' }),
      ],
    },
    { preferred_times: ['afternoon'] }
  );
  const morning = scoreSchedule(
    {
      sections: [
        makeSection({ startTime: '08:00', endTime: '09:00' }),
        makeSection({ startTime: '09:30', endTime: '10:30' }),
      ],
    },
    { preferred_times: ['afternoon'] }
  );
  assert.ok(
    afternoon.breakdown.constraint_satisfaction >
      morning.breakdown.constraint_satisfaction
  );
});

test('avoid_consecutive flags back-to-back classes', () => {
  const consecutive = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M'], startTime: '10:00', endTime: '11:00' }),
        makeSection({ days: ['M'], startTime: '11:00', endTime: '12:00' }),
      ],
    },
    { avoid_consecutive: true }
  );
  const spaced = scoreSchedule(
    {
      sections: [
        makeSection({ days: ['M'], startTime: '10:00', endTime: '11:00' }),
        makeSection({ days: ['M'], startTime: '11:30', endTime: '12:30' }),
      ],
    },
    { avoid_consecutive: true }
  );
  assert.ok(
    spaced.breakdown.constraint_satisfaction >
      consecutive.breakdown.constraint_satisfaction
  );
});

test('weighted sum matches the weights constant', () => {
  const candidate = { sections: [makeSection()] };
  const r = scoreSchedule(candidate, {});
  const expected =
    r.breakdown.workload_balance * WEIGHTS.workload_balance +
    r.breakdown.time_gap_efficiency * WEIGHTS.time_gap_efficiency +
    r.breakdown.difficulty_curve * WEIGHTS.difficulty_curve +
    r.breakdown.constraint_satisfaction * WEIGHTS.constraint_satisfaction;
  assert.ok(Math.abs(r.score - expected) < 0.01);
});
