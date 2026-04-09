// ========== Landing Page ==========
import { initParticles } from '../utils/particles.js';
import { getSession, clearSession } from '../main.js';
import { getUser } from '../api.js';

export async function renderLanding(container) {
  // If session exists, validate it against the backend
  const session = getSession();
  if (session?.userId) {
    try {
      const data = await getUser(session.userId);
      if (data?.user) {
        // User exists — check if they have a curriculum
        if (data.user.goal) {
          window.location.hash = '#/dashboard';
          return;
        } else {
          window.location.hash = '#/onboarding';
          return;
        }
      }
    } catch {
      // User not found in DB — clear stale session
      clearSession();
    }
  }

  container.innerHTML = `
    <canvas id="particles-canvas"></canvas>
    <div class="landing">
      <div class="landing-hero">
        <div class="landing-logo">Skill2Hire</div>
        <p class="landing-subtitle">
          AI-powered learning that adapts to you. Assess your skills, follow a personalized curriculum, 
          build real projects, and land your dream job — all guided by intelligence.
        </p>
        <button class="btn btn-primary btn-lg btn-pulse" id="start-btn">
          🚀 Start Your Journey
        </button>
        <div class="landing-features">
          <div class="feature-card">
            <div class="icon">🎯</div>
            <h4>Skill Assessment</h4>
            <p>10 in-depth questions tailored to your career goal</p>
          </div>
          <div class="feature-card">
            <div class="icon">📚</div>
            <h4>Smart Curriculum</h4>
            <p>AI-generated learning path targeting your exact skill gaps</p>
          </div>
          <div class="feature-card">
            <div class="icon">🛠️</div>
            <h4>Guided Projects</h4>
            <p>Step-by-step project tutorials to build real experience</p>
          </div>
          <div class="feature-card">
            <div class="icon">💼</div>
            <h4>Job Matching</h4>
            <p>Curated opportunities based on your new skills</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = document.getElementById('particles-canvas');
  if (canvas) initParticles(canvas);

  document.getElementById('start-btn').addEventListener('click', () => {
    window.location.hash = '#/onboarding';
  });
}
