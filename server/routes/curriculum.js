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

    let curriculum;
    let usageData = null;
    try {
      const { content, usage } = await chat(messages, userId, 'curriculum_generate', db);
      usageData = usage;
      curriculum = parseJSON(content);
    } catch (llmErr) {
      console.warn('Curriculum LLM parse failed, generating goal fallback curriculum:', llmErr.message);
      curriculum = createFallbackCurriculum(goal);
    }

    if (!curriculum || !Array.isArray(curriculum.modules)) {
      curriculum = createFallbackCurriculum(goal);
    }

    // Calculate total XP
    let totalXP = 0;
    curriculum.modules.forEach(m => { totalXP += m.xpReward || 100; });
    curriculum.totalXP = totalXP;

    // Save
    db.prepare(
      'INSERT OR REPLACE INTO curricula (user_id, modules_json, total_xp, skill_gap_json) VALUES (?, ?, ?, ?)'
    ).run(userId, JSON.stringify(curriculum), totalXP, JSON.stringify(assessment));

    res.json({ curriculum, usage: usageData });
  } catch (err) {
    console.error('Curriculum generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

function createFallbackCurriculum(goal) {
  const g = goal || 'Software Engineer';
  return {
    title: `${g} Core Learning Path`,
    description: `Comprehensive 8-module mastery curriculum targeted at becoming a proficient ${g}.`,
    modules: [
      { index: 0, title: `Foundations of ${g}`, description: 'Master fundamental language mechanics, syntax, and essential toolings.', skills: ['Core Syntax', 'Environment Setup'], xpReward: 100, estimatedMinutes: 30, difficulty: 'beginner', topics: ['Syntax', 'Tooling', 'CLI'] },
      { index: 1, title: 'Data Structures & Algorithmic Thinking', description: 'Understand arrays, maps, complexity analysis, and algorithmic patterns.', skills: ['Data Structures', 'Algorithms'], xpReward: 120, estimatedMinutes: 45, difficulty: 'beginner', topics: ['Arrays', 'Hash Maps', 'Big-O'] },
      { index: 2, title: 'System Architecture & Modular Design', description: 'Design modular, maintainable, and clean code structures.', skills: ['OOP', 'Design Patterns'], xpReward: 150, estimatedMinutes: 40, difficulty: 'intermediate', topics: ['Modularity', 'Abstractions', 'Design Patterns'] },
      { index: 3, title: 'Asynchronous Programming & Data Fetching', description: 'Master async flows, promises, network requests, and event loops.', skills: ['Async/Await', 'Networking'], xpReward: 150, estimatedMinutes: 50, difficulty: 'intermediate', topics: ['Promises', 'HTTP/REST', 'Event Loop'] },
      { index: 4, title: 'Database Design & Data Persistence', description: 'Learn relational and key-value database querying and optimization.', skills: ['Databases', 'SQL'], xpReward: 180, estimatedMinutes: 60, difficulty: 'intermediate', topics: ['Relational DBs', 'Indexing', 'ORMs'] },
      { index: 5, title: 'API Integration & Web Services', description: 'Build and consume RESTful APIs, auth headers, and web services.', skills: ['API Design', 'Security'], xpReward: 200, estimatedMinutes: 45, difficulty: 'intermediate', topics: ['REST', 'Auth', 'JSON'] },
      { index: 6, title: 'Automated Testing & Quality Assurance', description: 'Write unit tests, integration tests, and handle errors resiliently.', skills: ['Testing', 'Debugging'], xpReward: 200, estimatedMinutes: 40, difficulty: 'advanced', topics: ['Unit Tests', 'Mocking', 'Error Handling'] },
      { index: 7, title: `Production Deployment & ${g} Capstone`, description: 'Deploy applications, configure CI/CD pipelines, and monitor metrics.', skills: ['DevOps', 'Deployment'], xpReward: 250, estimatedMinutes: 60, difficulty: 'advanced', topics: ['CI/CD', 'Containers', 'Monitoring'] }
    ]
  };
}

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
