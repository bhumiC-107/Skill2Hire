// ========== Quiz Page ==========
import { generateQuiz, submitQuiz } from '../api.js';
import { getSession, setSession, showToast } from '../main.js';

let questions = [];
let answers = {};
let textAnswers = {};
let currentQ = 0;

export async function renderQuiz(container) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }

  questions = [];
  answers = {};
  textAnswers = {};
  currentQ = 0;

  container.innerHTML = `
    <div class="quiz">
      <div id="quiz-content">
        <div class="loading-screen">
          <div class="neural-loader">
            <div class="node"></div><div class="node"></div><div class="node"></div>
            <div class="node"></div><div class="node"></div><div class="node"></div>
          </div>
          <h3>AI is crafting your personalized assessment...</h3>
          <p style="color:var(--text-muted);font-size:0.9rem;">Analyzing ${session.goal || 'your goal'} requirements</p>
        </div>
      </div>
    </div>
  `;

  try {
    const result = await generateQuiz({
      userId: session.userId,
      goal: session.goal,
      hasProjectImage: !!session.projectImageBase64,
      projectImageBase64: session.projectImageBase64 || null,
      githubUrl: session.githubUrl || '',
      codeSnippet: session.codeSnippet || '',
    });

    questions = result.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Failed to generate questions');
    }

    // Normalize questions — ensure all have options for MCQ or fallback
    questions = questions.map((q, i) => {
      q.id = q.id || i + 1;
      if (q.type === 'mcq' && (!q.options || q.options.length === 0)) {
        q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
        q.correct = q.correct ?? 0;
      }
      if ((q.type === 'code' || q.type === 'scenario' || q.type === 'project') && (!q.options || q.options.length === 0)) {
        // Convert to MCQ-style with generated options if missing
        q.options = q.options && q.options.length > 0 ? q.options : null;
        q.correct = q.correct ?? null;
      }
      return q;
    });

    renderQuestion(container);
  } catch (err) {
    document.getElementById('quiz-content').innerHTML = `
      <div class="loading-screen">
        <h3 style="color:var(--accent-rose);">Failed to generate quiz</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function renderQuestion(container) {
  const q = questions[currentQ];
  if (!q) return;

  const letters = ['A', 'B', 'C', 'D'];
  const hasMCQ = q.options && q.options.length > 0;

  document.getElementById('quiz-content').innerHTML = `
    <div class="quiz-header">
      <span class="quiz-counter">Question ${currentQ + 1} / ${questions.length}</span>
      <div class="quiz-progress">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${((currentQ + 1) / questions.length) * 100}%"></div>
        </div>
      </div>
      <span class="badge badge-${q.difficulty === 'advanced' ? 'rose' : q.difficulty === 'intermediate' ? 'amber' : 'emerald'}">
        ${q.difficulty}
      </span>
    </div>

    <div class="quiz-question">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <span class="badge badge-violet">${q.skill || q.type}</span>
        <span class="badge badge-cyan">${q.type}</span>
      </div>
      <h3>${q.question}</h3>
      
      ${q.code ? `<pre class="quiz-code"><code>${escapeHtml(q.code)}</code></pre>` : ''}
      
      ${hasMCQ ? `
        <div class="quiz-options">
          ${q.options.map((opt, i) => `
            <div class="quiz-option ${answers[currentQ] === i ? 'selected' : ''}" data-index="${i}">
              <span class="option-letter">${letters[i]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="margin:20px 0;">
          <textarea class="input" id="text-answer" rows="5" placeholder="Type your answer here..." style="width:100%;resize:vertical;font-family:var(--font-body);">${textAnswers[currentQ] || ''}</textarea>
        </div>
      `}

      <div class="quiz-nav">
        <button class="btn btn-ghost" id="prev-btn" ${currentQ === 0 ? 'disabled' : ''}>← Previous</button>
        ${currentQ < questions.length - 1
          ? `<button class="btn btn-primary" id="next-btn">Next →</button>`
          : `<button class="btn btn-success" id="submit-btn">Submit Quiz ✓</button>`
        }
      </div>
    </div>
  `;

  // Bind MCQ options
  if (hasMCQ) {
    document.querySelectorAll('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => {
        answers[currentQ] = parseInt(opt.dataset.index);
        document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
  }

  // Bind text answer
  const textArea = document.getElementById('text-answer');
  if (textArea) {
    textArea.addEventListener('input', () => {
      textAnswers[currentQ] = textArea.value;
      answers[currentQ] = 0; // Mark as answered
    });
  }

  // Navigation
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentQ > 0) { currentQ--; renderQuestion(container); }
  });

  document.getElementById('next-btn')?.addEventListener('click', () => {
    if (!isAnswered(currentQ)) {
      showToast('Please answer the question', 'info');
      return;
    }
    currentQ++;
    renderQuestion(container);
  });

  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    if (!isAnswered(currentQ)) {
      showToast('Please answer the question', 'info');
      return;
    }

    // Check all answers
    let allAnswered = true;
    for (let i = 0; i < questions.length; i++) {
      if (!isAnswered(i)) { allAnswered = false; break; }
    }
    if (!allAnswered) {
      showToast('Please answer all questions before submitting', 'info');
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Analyzing your skills...';

    try {
      const session = getSession();
      const answersArray = [];
      for (let i = 0; i < questions.length; i++) {
        answersArray.push(answers[i] ?? 0);
      }

      const result = await submitQuiz({
        userId: session.userId,
        questions,
        answers: answersArray,
        goal: session.goal,
      });

      setSession({ ...session, quizDone: true, score: result.score, assessment: result.assessment });
      window.location.hash = '#/analysis';
    } catch (err) {
      showToast('Failed to submit: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Quiz ✓';
    }
  });
}

function isAnswered(idx) {
  const q = questions[idx];
  const hasMCQ = q?.options && q.options.length > 0;
  if (hasMCQ) return answers[idx] !== undefined;
  return textAnswers[idx]?.trim()?.length > 0 || answers[idx] !== undefined;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
