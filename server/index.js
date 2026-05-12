/**
 * HuskyPath API server
 * --------------------
 * Boots Express, mounts the courses router, and exposes a health check.
 *
 *   PORT       defaults to 3001
 *   NODE_ENV   "development" | "production"
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const coursesRouter = require('./routes/courses');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'huskypath-api', time: new Date().toISOString() });
});

app.use('/api/courses', coursesRouter);

// 404 fallback for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Unknown API route: ${req.method} ${req.originalUrl}` });
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[huskypath-api] listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
