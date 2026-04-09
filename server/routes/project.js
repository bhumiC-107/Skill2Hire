import { Router } from 'express';
import db from '../db.js';
import { chat, streamChat, parseJSON } from '../llm.js';

const router = Router();

// Generate project
router.post('/generate', async (req, res) => {
  try {
    const { userId, goal, skills } = req.body;

    // Check if user opted for project and has enough progress
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || !user.wants_project) {
      return res.status(403).json({ error: 'User did not opt for project' });
    }

    const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
    const curriculum = db.prepare('SELECT * FROM curricula WHERE user_id = ?').get(userId);
    if (curriculum) {
      const modules = JSON.parse(curriculum.modules_json || '{}');
      const completedModules = JSON.parse(progress?.completed_modules_json || '[]');
      const totalModules = modules.modules?.length || 10;
      const progressPct = (completedModules.length / totalModules) * 100;
      if (progressPct < 45) {
        return res.status(403).json({ error: `Need 45% progress. Current: ${progressPct.toFixed(0)}%` });
      }
    }

    const messages = [
      {
        role: 'system',
        content: `You are a project-based learning expert. Create a step-by-step project tutorial. Output ONLY valid JSON.`
      },
      {
        role: 'user',
        content: `Goal: "${goal}". Skills: ${JSON.stringify(skills)}.

Create a hands-on project with 8-10 steps. Return JSON:
{"title":"Project Title","description":"What they'll build","totalXP":500,"steps":[{"index":0,"title":"Step title","description":"What to do","instructions":"Detailed markdown instructions with code","codeTemplate":"starter code if any","expectedOutcome":"What they should see/have","xpReward":50}]}`
      }
    ];

    const { content, usage } = await chat(messages, userId, 'project_generate', db);
    const project = parseJSON(content);

    db.prepare(
      'INSERT OR REPLACE INTO projects (user_id, title, steps_json, current_step, completed) VALUES (?, ?, ?, 0, 0)'
    ).run(userId, project.title, JSON.stringify(project));

    res.json({ project, usage });
  } catch (err) {
    console.error('Project generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project
router.get('/:userId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE user_id = ?').get(req.params.userId);
    if (!row) return res.status(404).json({ error: 'No project found' });
    res.json({
      title: row.title,
      project: JSON.parse(row.steps_json || '{}'),
      currentStep: row.current_step,
      completed: !!row.completed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream detailed step instructions
router.post('/step-detail', async (req, res) => {
  try {
    const { userId, stepTitle, stepDescription, goal } = req.body;

    const messages = [
      {
        role: 'system',
        content: `You are a coding mentor. Provide detailed, step-by-step instructions. Use markdown with code blocks.`
      },
      {
        role: 'user',
        content: `Provide a detailed tutorial for this project step:
Step: "${stepTitle}"
Description: ${stepDescription}
Overall Goal: "${goal}"

Include clear code examples, explanations, and tips. Format in markdown.`
      }
    ];

    await streamChat(messages, res, userId, 'project_step', db);
  } catch (err) {
    console.error('Step detail error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Complete a step
router.post('/complete-step', (req, res) => {
  try {
    const { userId, stepIndex, xpReward } = req.body;

    const row = db.prepare('SELECT * FROM projects WHERE user_id = ?').get(userId);
    if (!row) return res.status(404).json({ error: 'No project found' });

    const project = JSON.parse(row.steps_json || '{}');
    const isLast = stepIndex >= (project.steps?.length || 0) - 1;

    db.prepare('UPDATE projects SET current_step = ?, completed = ? WHERE user_id = ?')
      .run(stepIndex + 1, isLast ? 1 : 0, userId);

    // Award XP
    const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
    if (progress) {
      const newXP = progress.xp + (xpReward || 50);
      const newLevel = Math.floor(newXP / 500) + 1;
      const badges = JSON.parse(progress.badges_json || '[]');
      if (isLast && !badges.includes('project_complete')) badges.push('project_complete');

      db.prepare('UPDATE progress SET xp = ?, level = ?, badges_json = ? WHERE user_id = ?')
        .run(newXP, newLevel, JSON.stringify(badges), userId);

      res.json({ xp: newXP, level: newLevel, completed: isLast, badges });
    } else {
      res.json({ completed: isLast });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
