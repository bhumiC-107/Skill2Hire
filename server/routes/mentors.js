import { Router } from 'express';
import db from '../db.js';
import { chat, parseJSON } from '../llm.js';

const router = Router();

// Generate mentors matched to user's learning path
router.post('/generate', async (req, res) => {
  try {
    const { userId, goal, skills } = req.body;

    const messages = [
      {
        role: 'system',
        content: `You are a mentorship matchmaker. Generate realistic mentor profiles. Output ONLY valid JSON.`
      },
      {
        role: 'user',
        content: `User learning: "${goal}". Skills: ${JSON.stringify(skills || [])}.

Generate 6 mentor profiles who could help this learner. Mix of industry professionals and senior developers. Return JSON:
{"mentors":[{"id":1,"name":"Full Name","title":"Senior ML Engineer","company":"Google","avatar":"initials like JD","expertise":["skill1","skill2"],"experience":"8 years","bio":"2 sentence bio","rating":4.9,"sessions":120,"available":true,"matchScore":95}]}`
      }
    ];

    const { content, usage } = await chat(messages, userId, 'mentors_generate', db);
    const result = parseJSON(content);

    res.json({ mentors: result.mentors, usage });
  } catch (err) {
    console.error('Mentors generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
