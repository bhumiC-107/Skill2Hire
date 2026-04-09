// ========== Mentorship Page ==========
import { generateMentors } from '../api.js';
import { getSession, showToast } from '../main.js';

export async function renderMentors(container) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }

  container.innerHTML = `
    <div class="jobs" style="max-width:1100px;margin:0 auto;padding:40px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
        <div>
          <h2 class="gradient-text">Peer-to-Peer Mentorship</h2>
          <p style="color:var(--text-secondary);">Connect with experienced mentors matched to your learning path</p>
        </div>
        <button class="btn btn-ghost" onclick="location.hash='#/dashboard'">← Dashboard</button>
      </div>
      <div class="loading-screen" id="mentors-area" style="min-height:300px;">
        <div class="spinner"></div>
        <h3>Finding mentors for you...</h3>
      </div>
    </div>
  `;

  try {
    const result = await generateMentors({
      userId: session.userId,
      goal: session.goal,
      skills: session.assessment?.currentSkills?.map(s => s.name) || [],
    });

    const mentors = result.mentors || [];
    document.getElementById('mentors-area').innerHTML = `
      <div class="jobs-grid" style="width:100%;">
        ${mentors.map(m => `
          <div class="card" style="position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--gradient-primary);"></div>
            <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;">
              <div style="width:52px;height:52px;background:var(--gradient-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;flex-shrink:0;">${m.avatar || m.name?.split(' ').map(w=>w[0]).join('') || '?'}</div>
              <div style="flex:1;">
                <div style="font-weight:700;font-size:1.05rem;">${m.name}</div>
                <div style="font-size:0.85rem;color:var(--accent-cyan);">${m.title}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);">${m.company} · ${m.experience}</div>
              </div>
              ${m.available ? '<span class="badge badge-emerald">Available</span>' : '<span class="badge badge-rose">Busy</span>'}
            </div>
            <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:12px;">${m.bio}</p>
            <div class="job-skills" style="margin-bottom:12px;">
              ${(m.expertise || []).map(s => `<span class="job-skill-tag">${s}</span>`).join('')}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border-subtle);">
              <div style="display:flex;gap:16px;">
                <span style="font-size:0.82rem;color:var(--accent-amber);">⭐ ${m.rating || '4.8'}</span>
                <span style="font-size:0.82rem;color:var(--text-muted);">${m.sessions || 0} sessions</span>
                <span style="font-size:0.82rem;font-weight:600;color:var(--accent-violet-light);">${m.matchScore || 90}% match</span>
              </div>
              <button class="btn btn-primary btn-sm" onclick="alert('Mentorship request sent to ${m.name}! They will reach out within 24 hours.')">
                Connect
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-top:24px;text-align:center;">
        <h4 style="margin-bottom:8px;">🤝 How Peer Mentorship Works</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:16px;">
          <div>
            <div style="font-size:1.5rem;margin-bottom:4px;">1️⃣</div>
            <div style="font-weight:600;font-size:0.9rem;">Connect</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Send a mentorship request to your matched mentor</div>
          </div>
          <div>
            <div style="font-size:1.5rem;margin-bottom:4px;">2️⃣</div>
            <div style="font-weight:600;font-size:0.9rem;">Schedule</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Book 1-on-1 sessions around your availability</div>
          </div>
          <div>
            <div style="font-size:1.5rem;margin-bottom:4px;">3️⃣</div>
            <div style="font-weight:600;font-size:0.9rem;">Learn</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Get personalized guidance, code reviews, and career advice</div>
          </div>
          <div>
            <div style="font-size:1.5rem;margin-bottom:4px;">4️⃣</div>
            <div style="font-weight:600;font-size:0.9rem;">Give Back</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Become a mentor yourself as you grow</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('mentors-area').innerHTML = `
      <div class="loading-screen" style="min-height:200px;">
        <h3 style="color:var(--accent-rose);">Error loading mentors</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}
