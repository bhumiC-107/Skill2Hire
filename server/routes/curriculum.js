import { Router } from 'express';
import db from '../db.js';
import { chat, streamChat, parseJSON } from '../llm.js';

const router = Router();

// Generate full curriculum from skill gap
router.post('/generate', async (req, res) => {
  try {
    const { userId, goal, assessment } = req.body;

    // Check cache — don't regenerate
    const cached = db.prepare('SELECT * FROM curricula WHERE user_id = ?').get(userId);
    if (cached) {
      return res.json({ curriculum: JSON.parse(cached.modules_json), totalXP: cached.total_xp, cached: true });
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert curriculum designer. Create a personalized learning curriculum. Output ONLY valid JSON.`
      },
      {
        role: 'user',
        content: `Goal: "${goal}"
Skill Assessment: ${JSON.stringify(assessment)}

Create a curriculum of 8-12 modules addressing skill gaps. Each module builds on the previous. Return JSON:
{"title":"Curriculum title","description":"1-line desc","modules":[{"index":0,"title":"Module Title","description":"What they'll learn","skills":["skill1"],"xpReward":100,"estimatedMinutes":30,"difficulty":"beginner"|"intermediate"|"advanced","topics":["topic1","topic2"]}],"totalXP":1000}`
      }
    ];

    const { content, usage } = await chat(messages, userId, 'curriculum_generate', db);
    const curriculum = parseJSON(content);

    // Calculate total XP
    let totalXP = 0;
    curriculum.modules.forEach(m => { totalXP += m.xpReward || 100; });
    curriculum.totalXP = totalXP;

    // Save
    db.prepare(
      'INSERT OR REPLACE INTO curricula (user_id, modules_json, total_xp, skill_gap_json) VALUES (?, ?, ?, ?)'
    ).run(userId, JSON.stringify(curriculum), totalXP, JSON.stringify(assessment));

    res.json({ curriculum, usage });
  } catch (err) {
    console.error('Curriculum generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get curriculum
router.get('/:userId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM curricula WHERE user_id = ?').get(req.params.userId);
    if (!row) return res.status(404).json({ error: 'No curriculum found' });
    res.json({
      curriculum: JSON.parse(row.modules_json),
      totalXP: row.total_xp,
      skillGap: JSON.parse(row.skill_gap_json || '{}')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream lesson content
router.post('/lesson', async (req, res) => {
  try {
    const { userId, moduleIndex, moduleTitle, moduleTopics, goal } = req.body;

    // Check cache
    const cached = db.prepare(
      'SELECT content FROM lesson_cache WHERE user_id = ? AND module_index = ?'
    ).get(userId, moduleIndex);

    if (cached) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      // Send cached content in chunks for smooth display
      const chunkSize = 50;
      for (let i = 0; i < cached.content.length; i += chunkSize) {
        res.write(`data: ${JSON.stringify({ content: cached.content.slice(i, i + chunkSize) })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true, fullContent: cached.content, cached: true })}\n\n`);
      res.end();
      return;
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert programming tutor. Create a clear, engaging lesson. Use markdown formatting with code examples. Be practical and concise.`
      },
      {
        role: 'user',
        content: `Create a comprehensive lesson for:
Module: "${moduleTitle}"
Topics: ${JSON.stringify(moduleTopics)}
Learning Goal: "${goal}"

Include:
1. Brief introduction (2-3 sentences)
2. Key concepts explained with code examples
3. Best practices and common pitfalls
4. A hands-on exercise at the end

Format in clean markdown. Use \`\`\`javascript or \`\`\`python for code blocks.`
      }
    ];

    const result = await streamChat(messages, res, userId, 'lesson_content', db);

    // Cache the lesson
    if (result.content) {
      db.prepare(
        'INSERT OR REPLACE INTO lesson_cache (user_id, module_index, content) VALUES (?, ?, ?)'
      ).run(userId, moduleIndex, result.content);
    }
  } catch (err) {
    console.error('Lesson stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Complete a module
router.post('/complete-module', (req, res) => {
  try {
    const { userId, moduleIndex, xpReward } = req.body;

    const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
    if (!progress) return res.status(404).json({ error: 'No progress record' });

    const completed = JSON.parse(progress.completed_modules_json || '[]');
    if (!completed.includes(moduleIndex)) {
      completed.push(moduleIndex);
    }

    const newXP = progress.xp + (xpReward || 100);
    const newLevel = Math.floor(newXP / 500) + 1;

    // Streak logic
    const lastActive = new Date(progress.last_active);
    const now = new Date();
    const hoursDiff = (now - lastActive) / (1000 * 60 * 60);
    let streak = progress.streak;
    if (hoursDiff >= 20 && hoursDiff <= 48) {
      streak += 1;
    } else if (hoursDiff > 48) {
      streak = 1;
    }

    // Badge logic
    const badges = JSON.parse(progress.badges_json || '[]');
    if (completed.length === 1 && !badges.includes('first_lesson')) badges.push('first_lesson');
    if (completed.length === 5 && !badges.includes('five_lessons')) badges.push('five_lessons');
    if (streak >= 3 && !badges.includes('streak_3')) badges.push('streak_3');
    if (streak >= 7 && !badges.includes('streak_7')) badges.push('streak_7');
    if (newLevel >= 5 && !badges.includes('level_5')) badges.push('level_5');

    db.prepare(`
      UPDATE progress SET completed_modules_json = ?, current_module = ?, xp = ?, level = ?, streak = ?, badges_json = ?, last_active = datetime('now')
      WHERE user_id = ?
    `).run(JSON.stringify(completed), moduleIndex + 1, newXP, newLevel, streak, JSON.stringify(badges), userId);

    res.json({
      completed,
      xp: newXP,
      level: newLevel,
      streak,
      badges,
      newBadges: badges.filter(b => !(JSON.parse(progress.badges_json || '[]')).includes(b))
    });
  } catch (err) {
    console.error('Complete module error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
