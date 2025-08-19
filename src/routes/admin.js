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

// Run a load test from inside the app
// POST /admin/load
// body: { requests: number, concurrency: number, endpoints: ["/path"], timeout: ms }
router.post('/load', async (req, res) => {
  const body = req.body || {};
  const totalRequests = parseInt(body.requests) || 200;
  const concurrency = parseInt(body.concurrency) || 20;
  const timeout = parseInt(body.timeout) || 5000; // per-request timeout in ms
  const endpoints = Array.isArray(body.endpoints) && body.endpoints.length > 0
    ? body.endpoints
    : ['/','/healthz','/ready','/persons/all','/items'];

  // Build a list of urls to call (round-robin)
  const host = body.host || (req.protocol + '://' + req.get('host'));
  const urls = [];
  for (let i = 0; i < totalRequests; i++) {
    const ep = endpoints[i % endpoints.length];
    urls.push(new URL(ep, host).toString());
  }

  // concurrency-controlled runner
  const results = [];
  let idx = 0;

  async function worker() {
    while (true) {
      let i;
      // get next index atomically
      i = idx;
      idx++;
      if (i >= urls.length) break;
      const url = urls[i];
      const start = Date.now();
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        const duration = Date.now() - start;
        results.push({ url, status: resp.status, duration });
      } catch (err) {
        const duration = Date.now() - start;
        const status = err.name === 'AbortError' ? 'timeout' : 'error';
        results.push({ url, status, duration, message: err.message });
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.max(1, Math.min(concurrency, totalRequests)); w++) {
    workers.push(worker());
  }
  try {
    await Promise.all(workers);
  } catch (err) {
    // ignore
  }

  // summarize
  const counts = {};
  let sum = 0, min = null, max = 0;
  for (const r of results) {
    const k = String(r.status);
    counts[k] = (counts[k] || 0) + 1;
    if (typeof r.duration === 'number') {
      sum += r.duration;
      min = min === null ? r.duration : Math.min(min, r.duration);
      max = Math.max(max, r.duration);
    }
  }
  const avg = results.length ? sum / results.length : 0;

  res.json({
    requests: totalRequests,
    concurrency,
    endpoints,
    summary: {
      totalCompleted: results.length,
      counts,
      latency: { count: results.length, avg, min, max }
    }
  });
});

module.exports = router;
