import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Register a new user
router.post('/register', (req, res) => {
  try {
    const { name, email, goal, wantsProject } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      // Return existing user
      const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(existing.id);
      return res.json({ user: existing, progress, existing: true });
    }

    const result = db.prepare(
      'INSERT INTO users (name, email, goal, wants_project) VALUES (?, ?, ?, ?)'
    ).run(name, email, goal || null, wantsProject ? 1 : 0);

    const userId = result.lastInsertRowid;

    // Create progress record
    db.prepare(
      'INSERT INTO progress (user_id) VALUES (?)'
    ).run(userId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ user, existing: false });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user goal
router.put('/user/:id/goal', (req, res) => {
  try {
    const { goal, wantsProject } = req.body;
    db.prepare('UPDATE users SET goal = ?, wants_project = ? WHERE id = ?')
      .run(goal, wantsProject ? 1 : 0, req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID
router.get('/user/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(user.id);
    res.json({ user, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
