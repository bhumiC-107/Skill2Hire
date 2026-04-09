// ========== Analysis / Results Page ==========
import { generateCurriculum } from '../api.js';
import { getSession, setSession, showToast } from '../main.js';
import { drawRadarChart } from '../utils/charts.js';

export async function renderAnalysis(container) {
  const session = getSession();
  if (!session?.assessment) { window.location.hash = '#/quiz'; return; }

  const a = session.assessment;

  container.innerHTML = `
    <div class="analysis page-enter">
      <div style="text-align:center;margin-bottom:32px;">
        <h2 class="gradient-text">Skill Gap Analysis</h2>
        <p style="color:var(--text-secondary);">Here's where you stand — and where you need to go</p>
      </div>

      <div class="readiness-score">
        <div class="readiness-number">${a.readiness || a.overallScore || 0}%</div>
        <p style="color:var(--text-secondary);font-size:1.1rem;">Readiness Score</p>
      </div>

      <div class="radar-container">
        <canvas id="radar-chart"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0;">
        <div class="card-gradient">
          <h4 style="color:var(--accent-emerald);margin-bottom:12px;">💪 Strengths</h4>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
            ${(a.strengths || []).map(s => `<li style="font-size:0.9rem;color:var(--text-secondary);">✓ ${s}</li>`).join('')}
          </ul>
        </div>
        <div class="card-gradient">
          <h4 style="color:var(--accent-rose);margin-bottom:12px;">📌 To Improve</h4>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
            ${(a.weaknesses || []).map(s => `<li style="font-size:0.9rem;color:var(--text-secondary);">→ ${s}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="skill-cards">
        ${(a.gaps || []).map(g => `
          <div class="skill-card">
            <div class="skill-header">
              <span style="font-weight:600;font-size:0.9rem;">${g.skill}</span>
              <span class="badge badge-${g.priority === 'high' ? 'rose' : g.priority === 'medium' ? 'amber' : 'emerald'}">${g.priority}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
              <span style="font-size:0.8rem;color:var(--accent-cyan);width:40px;">${g.current}%</span>
              <div class="progress-bar" style="flex:1;">
                <div class="progress-bar-fill" style="width:${g.current}%;background:var(--accent-cyan);"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="font-size:0.8rem;color:var(--accent-violet-light);width:40px;">${g.required}%</span>
              <div class="progress-bar" style="flex:1;">
                <div class="progress-bar-fill" style="width:${g.required}%;background:var(--accent-violet);"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <p style="text-align:center;color:var(--text-secondary);margin:24px 0;font-size:0.95rem;">
        ${a.summary || ''}
      </p>

      <div style="text-align:center;margin-top:32px;">
        <button class="btn btn-primary btn-lg" id="generate-curriculum-btn">
          🎓 Generate My Learning Path
        </button>
      </div>
    </div>
  `;

  // Draw radar chart
  const canvas = document.getElementById('radar-chart');
  if (canvas && a.currentSkills && a.requiredSkills) {
    setTimeout(() => drawRadarChart(canvas, a.currentSkills, a.requiredSkills), 200);
  }

  // Generate curriculum
  document.getElementById('generate-curriculum-btn').addEventListener('click', async () => {
    const btn = document.getElementById('generate-curriculum-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Creating your curriculum...';

    try {
      const result = await generateCurriculum({
        userId: session.userId,
        goal: session.goal,
        assessment: a,
      });

      setSession({ ...getSession(), curriculumGenerated: true });
      showToast('Curriculum created successfully!', 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '🎓 Generate My Learning Path';
    }
  });
}
