const express = require('express');
const router = express.Router();

let items = [
  { id: 1, name: 'Widget' },
  { id: 2, name: 'Gizmo' }
];

router.get('/', (req, res) => {
  res.json(items);
});

router.get('/:id', (req, res) => {
  const it = items.find(i => String(i.id) === String(req.params.id));
  if (!it) return res.status(404).json({ error: 'not found' });
  res.json(it);
});

router.post('/', (req, res) => {
  const id = items.length + 1;
  const newIt = { id, name: req.body.name || 'Unnamed' };
  items.push(newIt);
  res.status(201).json(newIt);
});

module.exports = router;
