import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get full dashboard stats
router.get('/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
    if (!progress) return res.status(404).json({ error: 'No progress found' });

    // Token usage
    const tokenRow = db.prepare(
      'SELECT SUM(prompt_tokens) as totalPrompt, SUM(completion_tokens) as totalCompletion, SUM(total_tokens) as totalTokens FROM token_usage WHERE user_id = ?'
    ).get(userId);

    // Token breakdown by feature
    const tokenBreakdown = db.prepare(
      'SELECT feature, SUM(total_tokens) as tokens, COUNT(*) as calls FROM token_usage WHERE user_id = ? GROUP BY feature ORDER BY tokens DESC'
    ).all(userId);

    // Curriculum info
    const curriculum = db.prepare('SELECT * FROM curricula WHERE user_id = ?').get(userId);
    let totalModules = 0;
    if (curriculum) {
      const parsed = JSON.parse(curriculum.modules_json || '{}');
      totalModules = parsed.modules?.length || 0;
    }

    const completedModules = JSON.parse(progress.completed_modules_json || '[]');
    const progressPct = totalModules > 0 ? (completedModules.length / totalModules) * 100 : 0;

    res.json({
      xp: progress.xp,
      level: progress.level,
      streak: progress.streak,
      badges: JSON.parse(progress.badges_json || '[]'),
      completedModules,
      currentModule: progress.current_module,
      totalModules,
      progressPercent: Math.round(progressPct),
      tokens: {
        total: tokenRow?.totalTokens || 0,
        prompt: tokenRow?.totalPrompt || 0,
        completion: tokenRow?.totalCompletion || 0,
        breakdown: tokenBreakdown,
        estimatedCost: `$${((tokenRow?.totalTokens || 0) * 0.0000004).toFixed(4)}`,
        callCount: tokenBreakdown.reduce((sum, t) => sum + (t.calls || 0), 0),
      },
      lastActive: progress.last_active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get token usage details
router.get('/tokens/:userId', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM token_usage WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50'
    ).all(req.params.userId);

    const total = db.prepare(
      'SELECT SUM(total_tokens) as total FROM token_usage WHERE user_id = ?'
    ).get(req.params.userId);

    res.json({ history: rows, total: total?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
