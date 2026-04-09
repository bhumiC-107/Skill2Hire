// ========== Jobs Page ==========
import { generateJobs, getJobs } from '../api.js';
import { getSession, showToast } from '../main.js';
import { createConfetti } from '../utils/gamification.js';

export async function renderJobs(container) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }

  container.innerHTML = `
    <div class="jobs">
      <div class="loading-screen" id="jobs-loading">
        <div class="neural-loader">
          <div class="node"></div><div class="node"></div><div class="node"></div>
          <div class="node"></div><div class="node"></div><div class="node"></div>
        </div>
        <h3>Finding opportunities for you...</h3>
        <p style="color:var(--text-muted);">Matching your skills with market demand</p>
      </div>
    </div>
  `;

  try {
    // Try cached first
    let jobsData;
    try {
      jobsData = await getJobs(session.userId);
    } catch {
      jobsData = await generateJobs({
        userId: session.userId,
        goal: session.goal,
        skills: session.assessment?.currentSkills?.map(s => s.name) || [],
      });
    }

    const jobs = jobsData.jobs || [];

    // Confetti on first load
    setTimeout(() => createConfetti(), 500);

    renderJobsUI(container, jobs);
  } catch (err) {
    container.querySelector('.jobs').innerHTML = `
      <div class="loading-screen">
        <h3 style="color:var(--accent-rose);">Error</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Back</button>
      </div>
    `;
  }
}

let activeFilter = 'all';

function renderJobsUI(container, jobs) {
  const filtered = activeFilter === 'all' ? jobs :
    activeFilter === 'remote' ? jobs.filter(j => j.type === 'remote') :
    activeFilter === 'onsite' ? jobs.filter(j => j.type === 'onsite') :
    activeFilter === 'hybrid' ? jobs.filter(j => j.type === 'hybrid') :
    activeFilter === 'trending' ? jobs.filter(j => j.trending) : jobs;

  container.querySelector('.jobs').innerHTML = `
    <div class="jobs-celebration">
      <div style="font-size:3.5rem;margin-bottom:8px;">💼</div>
      <h2 class="gradient-text">Job Opportunities</h2>
      <p style="color:var(--text-secondary);max-width:550px;margin:0 auto;">
        Jobs matched to skills you'll acquire from your curriculum. Match % is calculated by comparing each job's required skills against your learned skills using fuzzy matching.
      </p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div class="jobs-filters">
        <button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All (${jobs.length})</button>
        <button class="filter-btn ${activeFilter === 'remote' ? 'active' : ''}" data-filter="remote">🏠 Remote</button>
        <button class="filter-btn ${activeFilter === 'onsite' ? 'active' : ''}" data-filter="onsite">🏢 On-site</button>
        <button class="filter-btn ${activeFilter === 'hybrid' ? 'active' : ''}" data-filter="hybrid">🔄 Hybrid</button>
        <button class="filter-btn ${activeFilter === 'trending' ? 'active' : ''}" data-filter="trending">🔥 Trending</button>
      </div>
      <button class="btn btn-ghost" onclick="location.hash='#/dashboard'">← Dashboard</button>
    </div>

    <div class="jobs-grid" style="margin-top:16px;">
      ${filtered.map(j => {
        const matchColor = j.matchPercentage >= 80 ? 'var(--accent-emerald)' :
          j.matchPercentage >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)';
        return `
          <div class="job-card">
            ${j.trending ? '<span class="job-trending badge badge-amber">🔥 Trending</span>' : ''}
            <div class="job-header">
              <div>
                <div class="job-title">${j.title}</div>
                <div class="job-company">${j.company}</div>
                <div class="job-location">📍 ${j.location} · ${j.type}</div>
              </div>
            </div>
            <div class="job-salary">${j.salary}</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">${j.description}</p>
            <div class="job-skills">
              ${(j.requiredSkills || []).map(s => `<span class="job-skill-tag">${s}</span>`).join('')}
            </div>
            <div class="job-match">
              <div class="match-bar">
                <div class="match-fill" style="width:${j.matchPercentage}%;background:${matchColor};"></div>
              </div>
              <span class="match-text" style="color:${matchColor};">${j.matchPercentage}% match</span>
            </div>
            ${j.postedDays ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">Posted ${j.postedDays} days ago</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    ${filtered.length === 0 ? '<p style="text-align:center;color:var(--text-muted);margin-top:32px;">No jobs match this filter</p>' : ''}
  `;

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderJobsUI(container, jobs);
    });
  });
}
