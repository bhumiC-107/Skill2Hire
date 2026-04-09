import { Router } from 'express';
import db from '../db.js';
import { chat, parseJSON } from '../llm.js';

const router = Router();

// Generate 10 quiz questions based on user's goal
router.post('/generate', async (req, res) => {
  try {
    const { userId, goal, hasProjectImage, projectImageBase64, githubUrl, codeSnippet } = req.body;

    // Check cache — don't regenerate if questions already exist
    const cached = db.prepare('SELECT questions_json FROM quiz_results WHERE user_id = ?').get(userId);
    if (cached?.questions_json) {
      const questions = JSON.parse(cached.questions_json);
      if (questions.length > 0) {
        return res.json({ questions, cached: true });
      }
    }

    // Build context about user's work
    let portfolioContext = '';
    if (githubUrl) {
      portfolioContext += `\nThe user shared their GitHub: ${githubUrl}. Include 1-2 questions that reference analyzing a GitHub portfolio or repo structure.`;
    }
    if (codeSnippet) {
      portfolioContext += `\nThe user shared this code snippet:\n\`\`\`\n${codeSnippet.slice(0, 800)}\n\`\`\`\nOne question MUST ask the user to analyze, improve, or explain this code.`;
    }
    if (hasProjectImage && projectImageBase64) {
      portfolioContext += `\nThe user uploaded a project screenshot. One question MUST reference the image and ask about the project's architecture, design, or implementation.`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are a technical skill assessor. Generate EXACTLY 10 in-depth assessment questions as a JSON array. Be precise. Output ONLY valid JSON array, no extra text.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `User's goal: "${goal}". This could be abstract — interpret it and assess relevant technical skills.
${portfolioContext}

Generate 10 questions. ALL must be multiple choice with exactly 4 options. Mix of:
- MCQ knowledge questions
- Code analysis questions (include a code block)
- Scenario/problem-solving questions

Return JSON array:
[{"id":1,"type":"mcq","question":"...","code":"optional code block or null","options":["A","B","C","D"],"correct":0,"difficulty":"beginner"|"intermediate"|"advanced","skill":"skill being tested"}]

IMPORTANT: Every question MUST have exactly 4 options and a correct answer index (0-3).`
          },
          ...(hasProjectImage && projectImageBase64 ? [{
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${projectImageBase64}` }
          }] : [])
        ]
      }
    ];

    const { content, usage } = await chat(messages, userId, 'quiz_generate', db);
    const questions = parseJSON(content);

    // Validate and fix questions
    const fixedQuestions = (Array.isArray(questions) ? questions : []).map((q, i) => ({
      id: q.id || i + 1,
      type: q.type || 'mcq',
      question: q.question || `Question ${i + 1}`,
      code: q.code || null,
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
      correct: typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3 ? q.correct : 0,
      difficulty: q.difficulty || 'intermediate',
      skill: q.skill || 'General',
    }));

    // Save to database
    db.prepare(
      'INSERT OR REPLACE INTO quiz_results (user_id, questions_json) VALUES (?, ?)'
    ).run(userId, JSON.stringify(fixedQuestions));

    res.json({ questions: fixedQuestions, usage });
  } catch (err) {
    console.error('Quiz generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit quiz answers and get skill assessment
router.post('/submit', async (req, res) => {
  try {
    const { userId, questions, answers, goal } = req.body;

    // Calculate basic score
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    const score = (correct / questions.length) * 100;

    const messages = [
      {
        role: 'system',
        content: `You are a skill gap analyst. Evaluate quiz results concisely. Output ONLY valid JSON object.`
      },
      {
        role: 'user',
        content: `Goal: "${goal}". Score: ${correct}/${questions.length} (${score.toFixed(0)}%).

Results summary:
${questions.map((q, i) => `Q${i + 1} [${q.skill}]: ${answers[i] === q.correct ? '✓' : '✗'}`).join('\n')}

Return JSON:
{"overallScore":${score.toFixed(0)},"readiness":0-100,"currentSkills":[{"name":"skill","level":0-100}],"requiredSkills":[{"name":"skill","level":0-100}],"gaps":[{"skill":"name","current":0-100,"required":0-100,"priority":"high"|"medium"|"low"}],"strengths":["..."],"weaknesses":["..."],"summary":"2 sentence assessment"}`
      }
    ];

    const { content, usage } = await chat(messages, userId, 'quiz_evaluate', db);
    const assessment = parseJSON(content);

    db.prepare(`
      UPDATE quiz_results SET answers_json = ?, score = ?, skill_assessment_json = ?
      WHERE user_id = ?
    `).run(JSON.stringify(answers), score, JSON.stringify(assessment), userId);

    res.json({ score, assessment, usage });
  } catch (err) {
    console.error('Quiz submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get quiz results
router.get('/results/:userId', (req, res) => {
  try {
    const result = db.prepare('SELECT * FROM quiz_results WHERE user_id = ?').get(req.params.userId);
    if (!result) return res.status(404).json({ error: 'No quiz results found' });
    res.json({
      questions: JSON.parse(result.questions_json || '[]'),
      answers: JSON.parse(result.answers_json || '[]'),
      score: result.score,
      assessment: JSON.parse(result.skill_assessment_json || '{}')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
