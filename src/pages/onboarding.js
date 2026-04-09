// ========== Onboarding Page ==========
import { registerUser, updateGoal, fileToBase64 } from '../api.js';
import { setSession, getSession, showToast } from '../main.js';

let selectedGoal = null;
let customGoal = '';
let wantsProject = false;
let projectImageBase64 = null;
let githubUrl = '';
let codeSnippet = '';

const TRENDING_ROLES = [
  { title: 'AI/ML Engineer', trend: '↑ 45% demand', desc: 'Build intelligent systems with ML, deep learning, and generative AI' },
  { title: 'Full-Stack Developer', trend: '↑ 32% demand', desc: 'Master frontend and backend for modern web apps' },
  { title: 'Cloud & DevOps Engineer', trend: '↑ 38% demand', desc: 'Scalable infrastructure with CI/CD, containers, cloud' },
  { title: 'Cybersecurity Specialist', trend: '↑ 40% demand', desc: 'Protect systems with penetration testing & security architecture' },
  { title: 'Data Engineer', trend: '↑ 35% demand', desc: 'Build data pipelines and architectures for analytics at scale' },
  { title: 'Mobile App Developer', trend: '↑ 28% demand', desc: 'Cross-platform mobile apps with React Native, Flutter' },
  { title: 'Blockchain Developer', trend: '↑ 22% demand', desc: 'Smart contracts, DApps, and Web3 development' },
  { title: 'Game Developer', trend: '↑ 18% demand', desc: 'Build games with Unity, Unreal, and modern engines' },
];

export async function renderOnboarding(container) {
  const session = getSession();

  container.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-step" id="step-content">
        ${session?.userId ? renderGoalStep() : renderUserStep()}
      </div>
    </div>
  `;

  if (session?.userId) {
    bindGoalStep(container);
  } else {
    bindUserStep(container);
  }
}

function renderUserStep() {
  return `
    <h2 class="gradient-text" style="margin-bottom:8px;">Welcome to Skill2Hire</h2>
    <p style="color:var(--text-secondary);margin-bottom:32px;">Let's set up your learning profile</p>
    <div style="display:flex;flex-direction:column;gap:20px;max-width:450px;">
      <div class="input-group">
        <label>Your Name</label>
        <input type="text" class="input" id="user-name" placeholder="Enter your name" />
      </div>
      <div class="input-group">
        <label>Email Address</label>
        <input type="email" class="input" id="user-email" placeholder="you@example.com" />
      </div>
      <button class="btn btn-primary" id="next-btn">Continue →</button>
    </div>
  `;
}

function bindUserStep(container) {
  container.querySelector('#next-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    if (!name || !email) { showToast('Please fill in all fields', 'error'); return; }
    try {
      const btn = container.querySelector('#next-btn');
      btn.disabled = true;
      btn.textContent = 'Setting up...';
      const { user, existing } = await registerUser({ name, email });
      setSession({ userId: user.id, name: user.name, email: user.email });
      if (existing && user.goal) { window.location.hash = '#/dashboard'; return; }
      document.getElementById('step-content').innerHTML = renderGoalStep();
      bindGoalStep(container);
    } catch (err) {
      showToast(err.message, 'error');
      container.querySelector('#next-btn').disabled = false;
      container.querySelector('#next-btn').textContent = 'Continue →';
    }
  });
}

function renderGoalStep() {
  return `
    <h2 class="gradient-text" style="margin-bottom:4px;">What do you want to become?</h2>
    <p style="color:var(--text-secondary);margin-bottom:24px;">Type your own goal or pick from trending roles below. Your goal can be as specific or abstract as you want!</p>

    <!-- Custom Goal Input -->
    <div class="input-group" style="margin-bottom:24px;">
      <label>🎯 Your Career Goal</label>
      <input type="text" class="input" id="custom-goal" placeholder="e.g. 'I want to build AI apps', 'become a hacker', 'learn to make games'..." style="font-size:1.05rem;padding:14px 18px;" />
    </div>

    <!-- Trending roles as reference -->
    <div style="margin-bottom:24px;">
      <h4 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:12px;">📈 Trending Job Market Roles (click to use)</h4>
      <div class="goals-grid" id="goals-grid">
        ${TRENDING_ROLES.map((g, i) => `
          <div class="goal-card" data-index="${i}">
            <h4>${g.title}</h4>
            <p>${g.desc}</p>
            <div class="trend-badge">${g.trend}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <hr style="border:none;border-top:1px solid var(--border-subtle);margin:24px 0;" />

    <!-- Project toggle -->
    <div class="toggle-container" id="project-toggle">
      <div class="toggle ${wantsProject ? 'active' : ''}" id="toggle-switch"></div>
      <div>
        <div style="font-weight:600;font-size:0.95rem;">I want to build a hands-on project</div>
        <div style="font-size:0.82rem;color:var(--text-muted);">Required after 45% curriculum completion</div>
      </div>
    </div>

    <hr style="border:none;border-top:1px solid var(--border-subtle);margin:24px 0;" />

    <!-- Portfolio / Project Analysis Section -->
    <h4 style="margin-bottom:12px;">📂 Share Your Existing Work (Optional)</h4>
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">Help the AI assess where you are by sharing projects you've built</p>

    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- GitHub URL -->
      <div class="input-group">
        <label>🔗 GitHub Profile or Repo URL</label>
        <input type="url" class="input" id="github-url" placeholder="https://github.com/yourusername or repo link" />
      </div>

      <!-- Code Snippet -->
      <div class="input-group">
        <label>💻 Paste a Code Snippet</label>
        <textarea class="input" id="code-snippet" rows="6" placeholder="Paste a sample of your best code here..." style="font-family:var(--font-mono);font-size:0.85rem;resize:vertical;"></textarea>
      </div>

      <!-- Screenshot Upload -->
      <div class="upload-zone" id="upload-zone">
        <div id="upload-content">
          <div style="font-size:2rem;margin-bottom:8px;">📸</div>
          <div style="font-weight:600;margin-bottom:4px;">Upload Project Screenshot</div>
          <div style="font-size:0.82rem;color:var(--text-muted);">Drop a screenshot of your project for AI analysis</div>
        </div>
        <input type="file" id="file-input" accept="image/*" style="display:none;" />
      </div>
    </div>

    <button class="btn btn-primary btn-lg" id="start-quiz-btn" style="margin-top:24px;width:100%;">
      Enter a goal to continue
    </button>
  `;
}

function bindGoalStep(container) {
  const session = getSession();
  const goalInput = document.getElementById('custom-goal');
  const startBtn = document.getElementById('start-quiz-btn');

  function updateButton() {
    const goal = goalInput.value.trim() || selectedGoal;
    if (goal) {
      startBtn.disabled = false;
      startBtn.textContent = `Continue with "${goal.length > 30 ? goal.slice(0, 30) + '...' : goal}" →`;
    } else {
      startBtn.disabled = true;
      startBtn.textContent = 'Enter a goal to continue';
    }
  }

  // Custom goal typing
  goalInput.addEventListener('input', () => {
    customGoal = goalInput.value.trim();
    if (customGoal) {
      document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
      selectedGoal = null;
    }
    updateButton();
  });

  // Click trending role cards
  document.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const role = TRENDING_ROLES[parseInt(card.dataset.index)];
      selectedGoal = role.title;
      goalInput.value = role.title;
      customGoal = '';
      updateButton();
    });
  });

  // Project toggle
  document.getElementById('project-toggle').addEventListener('click', () => {
    wantsProject = !wantsProject;
    document.getElementById('toggle-switch').classList.toggle('active', wantsProject);
  });

  // File upload
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      projectImageBase64 = await fileToBase64(file);
      uploadZone.classList.add('has-file');
      document.getElementById('upload-content').innerHTML = `
        <img src="${URL.createObjectURL(file)}" class="upload-preview" alt="Project screenshot" />
        <div style="font-weight:600;color:var(--accent-emerald);">✓ ${file.name}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);">Click to change</div>
      `;
    }
  });

  // Start quiz
  startBtn.addEventListener('click', async () => {
    const finalGoal = customGoal || selectedGoal;
    if (!finalGoal) { showToast('Please enter or select a goal', 'error'); return; }

    githubUrl = document.getElementById('github-url')?.value.trim() || '';
    codeSnippet = document.getElementById('code-snippet')?.value.trim() || '';

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Preparing your quiz...';

    try {
      await updateGoal(session.userId, { goal: finalGoal, wantsProject });

      setSession({
        ...getSession(),
        goal: finalGoal,
        wantsProject,
        projectImageBase64,
        githubUrl,
        codeSnippet,
      });

      window.location.hash = '#/quiz';
    } catch (err) {
      showToast(err.message, 'error');
      startBtn.disabled = false;
      updateButton();
    }
  });

  updateButton();
}
