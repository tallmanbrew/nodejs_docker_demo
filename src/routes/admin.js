const express = require('express');
const router = express.Router();

// Dummy admin endpoints
router.get('/status', (req, res) => {
  res.json({ admin: 'ok' });
});

router.get('/config', (req, res) => {
  res.json({ config: { mode: process.env.NODE_ENV || 'development' } });
});

router.post('/action', (req, res) => {
  res.json({ actionReceived: req.body || {} });
});

module.exports = router;
