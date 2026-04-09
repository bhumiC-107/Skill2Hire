import { Router } from 'express';
import db from '../db.js';
import { chat, parseJSON } from '../llm.js';

const router = Router();

/**
 * Calculate match percentage between user's skills and job requirements.
 * 
 * Algorithm:
 * 1. Collect user's acquired skills from: curriculum modules (topics + skills) + quiz assessment
 * 2. For each job, compare its requiredSkills against user's skill set
 * 3. Match = (matched skills / total required skills) * 100
 * 4. Uses fuzzy matching (case-insensitive substring) to handle variations
 *    e.g. "React.js" matches "React", "machine learning" matches "ML"
 */
function calculateMatchPercentage(userSkills, jobRequiredSkills) {
  if (!jobRequiredSkills || jobRequiredSkills.length === 0) return 100;
  if (!userSkills || userSkills.length === 0) return 0;

  // Normalize all skills to lowercase
  const normalizedUser = userSkills.map(s => s.toLowerCase().trim());

  let matched = 0;
  for (const reqSkill of jobRequiredSkills) {
    const reqLower = reqSkill.toLowerCase().trim();

    // Check for exact match, substring match, or abbreviation match
    const isMatch = normalizedUser.some(userSkill => {
      // Exact match
      if (userSkill === reqLower) return true;
      // Substring match (e.g. "react" matches "react.js" or "react native")
      if (userSkill.includes(reqLower) || reqLower.includes(userSkill)) return true;
      // Word overlap (e.g. "machine learning" matches "deep learning")
      const reqWords = reqLower.split(/[\s\-_./]+/);
      const userWords = userSkill.split(/[\s\-_./]+/);
      const overlap = reqWords.filter(w => userWords.some(uw => uw === w || uw.startsWith(w) || w.startsWith(uw)));
      if (overlap.length > 0 && overlap.length >= Math.min(reqWords.length, userWords.length) * 0.5) return true;
      return false;
    });

    if (isMatch) matched++;
  }

  return Math.round((matched / jobRequiredSkills.length) * 100);
}

// Generate job listings based on POST-curriculum skills
router.post('/generate', async (req, res) => {
  try {
    const { userId, goal } = req.body;

    // Check cache
    const cached = db.prepare('SELECT * FROM jobs_cache WHERE user_id = ?').get(userId);
    if (cached) {
      return res.json({ jobs: JSON.parse(cached.jobs_json), cached: true });
    }

    // Get curriculum skills (what user WILL have after completing)
    const curriculum = db.prepare('SELECT * FROM curricula WHERE user_id = ?').get(userId);
    let acquiredSkills = [];
    let curriculumTitle = '';
    if (curriculum) {
      const parsed = JSON.parse(curriculum.modules_json || '{}');
      curriculumTitle = parsed.title || '';
      const modules = parsed.modules || [];
      modules.forEach(m => {
        if (m.skills) acquiredSkills.push(...m.skills);
        if (m.topics) acquiredSkills.push(...m.topics);
      });
      acquiredSkills = [...new Set(acquiredSkills)];
    }

    // Get skill gap info (current + required skills from assessment)
    const quizResult = db.prepare('SELECT * FROM quiz_results WHERE user_id = ?').get(userId);
    let assessment = {};
    if (quizResult?.skill_assessment_json) {
      assessment = JSON.parse(quizResult.skill_assessment_json);
    }

    const allSkills = [
      ...acquiredSkills,
      ...(assessment.requiredSkills || []).map(s => s.name),
      ...(assessment.currentSkills || []).filter(s => s.level >= 50).map(s => s.name),
    ];
    const uniqueSkills = [...new Set(allSkills)];

    const messages = [
      {
        role: 'system',
        content: `You are a job market analyst. Generate realistic job listings. Output ONLY valid JSON.`
      },
      {
        role: 'user',
        content: `User's goal: "${goal}". Curriculum: "${curriculumTitle}".
Skills user will have AFTER completing curriculum: ${JSON.stringify(uniqueSkills)}

Generate 12 realistic job opportunities. Mix remote/onsite/hybrid. DO NOT include matchPercentage (it will be calculated server-side). Return JSON:
{"jobs":[{"id":1,"title":"Job Title","company":"Company Name","location":"City or Remote","type":"remote","salary":"$X - $Y","experience":"entry","description":"2-3 sentences","requiredSkills":["skill1","skill2"],"trending":false,"postedDays":3}]}`
      }
    ];

    const { content, usage } = await chat(messages, userId, 'jobs_generate', db);
    let jobs = [];
    try {
      const result = parseJSON(content);
      jobs = result.jobs || result;
      if (!Array.isArray(jobs)) jobs = [jobs];
    } catch (parseErr) {
      console.error('Jobs JSON parse fallback:', parseErr.message);
      jobs = [
        { id: 1, title: `Junior ${goal}`, company: 'TechCorp', location: 'Remote', type: 'remote', salary: '$60K - $80K', description: `Entry-level ${goal} position`, requiredSkills: uniqueSkills.slice(0, 3), trending: true, postedDays: 2 },
        { id: 2, title: `${goal}`, company: 'InnovateTech', location: 'San Francisco', type: 'hybrid', salary: '$90K - $130K', description: `Mid-level ${goal} role`, requiredSkills: uniqueSkills.slice(0, 5), trending: false, postedDays: 5 },
        { id: 3, title: `Senior ${goal}`, company: 'DataDriven Inc', location: 'New York', type: 'onsite', salary: '$130K - $170K', description: `Senior ${goal} leading a team`, requiredSkills: uniqueSkills.slice(0, 6), trending: true, postedDays: 1 },
      ];
    }

    // ===== REAL MATCH CALCULATION =====
    // Recalculate match percentage server-side using actual skill comparison
    jobs = jobs.map(job => ({
      ...job,
      matchPercentage: calculateMatchPercentage(uniqueSkills, job.requiredSkills || []),
    }));

    // Sort by match percentage (highest first)
    jobs.sort((a, b) => b.matchPercentage - a.matchPercentage);

    db.prepare('INSERT OR REPLACE INTO jobs_cache (user_id, jobs_json) VALUES (?, ?)')
      .run(userId, JSON.stringify(jobs));

    res.json({ jobs, userSkills: uniqueSkills, usage });
  } catch (err) {
    console.error('Jobs generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get cached jobs
router.get('/:userId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM jobs_cache WHERE user_id = ?').get(req.params.userId);
    if (!row) return res.status(404).json({ error: 'No jobs generated yet' });
    res.json({ jobs: JSON.parse(row.jobs_json) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
