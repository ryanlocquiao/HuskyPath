/**
 * Smoke tests: route scaffolding wires up correctly.
 * Confirms each new endpoint is mounted and returns the expected stub
 * response. Replace these as the real implementations land.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../index');

function start() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('POST /api/parse-constraints stub returns 501 with contract', async () => {
  const server = await start();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/parse-constraints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'no classes before 10am' }),
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.endpoint, 'POST /api/parse-constraints');
    assert.equal(body.owner, 'Max');
  } finally {
    server.close();
  }
});


test('GET /api/courses still works (regression guard)', async () => {
  const server = await start();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/courses`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.courses), 'courses[] must be returned');
    assert.ok(body.courses.length > 0, 'sample data should be non-empty');
  } finally {
    server.close();
  }
});
