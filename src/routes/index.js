const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

// Serve the static index.html from the public folder
router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Lightweight liveness probe
router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe: ensure DB is reachable
router.get('/ready', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.status(200).json({ ready: true });
  } catch (err) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

module.exports = router;