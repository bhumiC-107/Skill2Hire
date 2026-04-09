// ========== Dashboard Page ==========
import { getCurriculum, getStats, getUser } from '../api.js';
import { getSession, clearSession, showToast, navigate } from '../main.js';
import { BADGES, getLevelProgress } from '../utils/gamification.js';
import { drawProgressRing } from '../utils/charts.js';

export async function renderDashboard(container) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }

  // Validate user exists in DB
  try {
    await getUser(session.userId);
  } catch {
    clearSession();
    window.location.hash = '#/';
    return;
  }

  container.innerHTML = `
    <div class="dashboard">
      <div class="loading-screen" id="dash-loading">
        <div class="spinner"></div>
        <h3>Loading your dashboard...</h3>
      </div>
    </div>
  `;

  try {
    const [currData, statsData] = await Promise.all([
      getCurriculum(session.userId).catch(() => null),
      getStats(session.userId).catch(() => null),
    ]);

    if (!currData) {
      // No curriculum — redirect to onboarding to start fresh
      clearSession();
      window.location.hash = '#/';
      return;
    }

    const curriculum = currData.curriculum;
    const modules = curriculum.modules || [];
    const stats = statsData || { xp: 0, level: 1, streak: 0, badges: [], completedModules: [], tokens: { total: 0, breakdown: [] } };
    const completedSet = new Set(stats.completedModules || []);
    const lp = getLevelProgress(stats.xp);

    const progressPct = modules.length > 0 ? (completedSet.size / modules.length * 100) : 0;
    const canAccessProject = progressPct >= 45 && session.wantsProject;
    const allDone = completedSet.size >= modules.length;

    container.querySelector('.dashboard').innerHTML = `
      <!-- Header -->
      <div class="dash-header">
        <div class="dash-user">
          <div class="dash-avatar">${(session.name || 'U')[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:700;font-size:1.05rem;">${session.name || 'Learner'}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">${session.goal || 'Learning Path'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="logout-btn" style="margin-left:12px;font-size:0.8rem;">Logout</button>
        </div>
        <div class="dash-stats-bar">
          <div class="dash-stat">
            <span class="stat-icon">⚡</span>
            <div>
              <div class="stat-value">Lv.${stats.level}</div>
              <div class="stat-label">Level</div>
            </div>
          </div>
          <div class="dash-stat">
            <span class="stat-icon">✨</span>
            <div>
              <div class="stat-value">${stats.xp.toLocaleString()}</div>
              <div class="stat-label">XP</div>
            </div>
          </div>
          <div class="dash-stat">
            <span class="stat-icon">🔥</span>
            <div>
              <div class="stat-value">${stats.streak}</div>
              <div class="stat-label">Streak</div>
            </div>
          </div>
          <div class="dash-stat">
            <span class="stat-icon">🪙</span>
            <div>
              <div class="stat-value">${(stats.tokens?.total || 0).toLocaleString()}</div>
              <div class="stat-label">Tokens</div>
            </div>
          </div>
        </div>
      </div>

      <!-- XP Progress -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:0.85rem;color:var(--text-secondary);">Level ${lp.level} → ${lp.level + 1}</span>
          <span style="font-size:0.85rem;color:var(--text-muted);">${lp.currentXP} / ${lp.needed} XP</span>
        </div>
        <div class="progress-bar progress-bar-lg">
          <div class="progress-bar-fill" style="width:${lp.progress}%"></div>
        </div>
      </div>

      <div class="dash-grid">
        <!-- Main content -->
        <div class="modules-section">
          <h3 style="margin-bottom:4px;">${curriculum.title || 'Your Curriculum'}</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">${curriculum.description || ''}</p>
          
          <div class="modules-list">
            ${modules.map((m, i) => {
              const isCompleted = completedSet.has(i);
              const isCurrent = !isCompleted && (i === 0 || completedSet.has(i - 1));
              const isLocked = !isCompleted && !isCurrent;
              const className = isCompleted ? 'completed' : isCurrent ? 'current' : 'locked';
              return `
                <div class="module-card ${className}" data-index="${i}" ${isLocked ? '' : 'tabindex="0"'}>
                  <div class="module-index">${isCompleted ? '✓' : i + 1}</div>
                  <div class="module-info">
                    <h4>${m.title}</h4>
                    <p>${m.description || ''}</p>
                  </div>
                  <div class="module-xp">+${m.xpReward || 100} XP</div>
                </div>
              `;
            }).join('')}
          </div>

          ${canAccessProject ? `
            <div class="card-gradient" style="margin-top:20px;cursor:pointer;" id="project-card">
              <h4 style="color:var(--accent-cyan);">🛠️ Hands-on Project</h4>
              <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Your progress is ${Math.round(progressPct)}% — project is now available!</p>
            </div>
          ` : session.wantsProject ? `
            <div class="card" style="margin-top:20px;opacity:0.5;">
              <h4>🔒 Project (Unlocks at 45%)</h4>
              <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">Progress: ${Math.round(progressPct)}% — keep learning!</p>
            </div>
          ` : ''}

          ${allDone ? `
            <div class="card-gradient" style="margin-top:20px;cursor:pointer;" id="jobs-card">
              <h4 style="color:var(--accent-emerald);">💼 View Job Opportunities</h4>
              <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Congratulations! Explore jobs matching your acquired skills.</p>
            </div>
          ` : `
            <div class="card" style="margin-top:20px;cursor:pointer;" id="jobs-card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <h4>💼 Job Opportunities</h4>
                  <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">Preview roles you'll qualify for after completing your curriculum</p>
                </div>
                <span class="badge badge-cyan">Preview</span>
              </div>
            </div>
          `}

          <!-- Mentorship Card -->
          <div class="card-gradient" style="margin-top:16px;cursor:pointer;" id="mentors-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h4 style="color:var(--accent-violet-light);">🤝 Peer-to-Peer Mentorship</h4>
                <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Connect with experienced mentors matched to your learning path</p>
              </div>
              <span class="badge badge-violet">New</span>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="dash-sidebar">
          <!-- Progress Ring -->
          <div class="progress-ring-container">
            <canvas id="progress-ring"></canvas>
            <div class="progress-ring-label">Overall Progress</div>
          </div>

          <!-- Badges -->
          <div class="badges-container">
            <h4>🏅 Badges</h4>
            <div class="badges-grid">
              ${Object.entries(BADGES).map(([key, b]) => {
                const earned = (stats.badges || []).includes(key);
                return `
                  <div class="badge-item ${earned ? 'earned' : ''}" title="${b.desc}">
                    <span class="badge-icon">${b.icon}</span>
                    <span>${b.name}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Token Usage -->
          <div class="token-display">
            <h4>🪙 LLM Token Usage</h4>
            <div class="token-total">${(stats.tokens?.total || 0).toLocaleString()}</div>
            <div style="display:flex;justify-content:center;gap:16px;margin:8px 0;font-size:0.8rem;">
              <span style="color:var(--accent-cyan);">Prompt: ${(stats.tokens?.prompt || 0).toLocaleString()}</span>
              <span style="color:var(--accent-amber);">Completion: ${(stats.tokens?.completion || 0).toLocaleString()}</span>
            </div>
            <div style="text-align:center;font-size:0.82rem;color:var(--accent-emerald);margin-bottom:12px;">
              Est. Cost: ${stats.tokens?.estimatedCost || '$0.0000'} · ${stats.tokens?.callCount || 0} API calls
            </div>
            <div class="token-breakdown">
              ${(stats.tokens?.breakdown || []).map(t => `
                <div class="token-row">
                  <span class="feature">${t.feature?.replace(/_/g, ' ')}</span>
                  <span class="count">${t.tokens?.toLocaleString()} (${t.calls} calls)</span>
                </div>
              `).join('') || '<div style="font-size:0.85rem;color:var(--text-muted);">No usage yet</div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    // Draw progress ring
    const ringCanvas = document.getElementById('progress-ring');
    if (ringCanvas) {
      setTimeout(() => drawProgressRing(ringCanvas, progressPct), 200);
    }

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      clearSession();
      window.location.hash = '#/';
    });

    // Module click handlers
    document.querySelectorAll('.module-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index);
        window.location.hash = `#/lesson/${idx}`;
      });
    });

    // Project card
    document.getElementById('project-card')?.addEventListener('click', () => {
      window.location.hash = '#/project';
    });

    // Jobs card
    document.getElementById('jobs-card')?.addEventListener('click', () => {
      window.location.hash = '#/jobs';
    });

    // Mentors card
    document.getElementById('mentors-card')?.addEventListener('click', () => {
      window.location.hash = '#/mentors';
    });

  } catch (err) {
    container.querySelector('.dashboard').innerHTML = `
      <div class="loading-screen">
        <h3 style="color:var(--accent-rose);">Error loading dashboard</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}
