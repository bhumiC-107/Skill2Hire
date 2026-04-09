// ========== CodeNova — SPA Entry + Router ==========

import { renderLanding } from './pages/landing.js';
import { renderOnboarding } from './pages/onboarding.js';
import { renderQuiz } from './pages/quiz.js';
import { renderAnalysis } from './pages/analysis.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderLesson } from './pages/lesson.js';
import { renderProject } from './pages/project.js';
import { renderJobs } from './pages/jobs.js';
import { renderMentors } from './pages/mentors.js';

const app = document.getElementById('app');

// Session storage
export function getSession() {
  const data = localStorage.getItem('skill2hire_session');
  return data ? JSON.parse(data) : null;
}

export function setSession(data) {
  localStorage.setItem('skill2hire_session', JSON.stringify(data));
}

export function clearSession() {
  localStorage.removeItem('skill2hire_session');
}

// Toast system
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ', xp: '⚡' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// XP popup
export function showXPPopup(xp) {
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.textContent = `+${xp} XP`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1500);
}

// Router
const routes = {
  '': renderLanding,
  '#/': renderLanding,
  '#/onboarding': renderOnboarding,
  '#/quiz': renderQuiz,
  '#/analysis': renderAnalysis,
  '#/dashboard': renderDashboard,
  '#/lesson': renderLesson,
  '#/project': renderProject,
  '#/jobs': renderJobs,
  '#/mentors': renderMentors,
};

export function navigate(hash) {
  window.location.hash = hash;
}

function getRoute() {
  const hash = window.location.hash;
  // Handle parameterized routes like #/lesson/3
  if (hash.startsWith('#/lesson/')) return '#/lesson';
  if (hash.startsWith('#/project')) return '#/project';
  return hash || '#/';
}

function getRouteParam() {
  const hash = window.location.hash;
  if (hash.startsWith('#/lesson/')) {
    return parseInt(hash.split('/')[2], 10);
  }
  return null;
}

async function render() {
  const route = getRoute();
  const renderer = routes[route] || routes['#/'];
  app.innerHTML = '';
  app.className = 'page-enter';
  try {
    await renderer(app, getRouteParam());
  } catch (err) {
    console.error('Render error:', err);
    app.innerHTML = `<div class="loading-screen"><h3>Something went wrong</h3><p style="color:var(--text-muted)">${err.message}</p><button class="btn btn-primary" onclick="location.hash='#/'">Go Home</button></div>`;
  }
  // Re-init lucide icons
  if (window.lucide) window.lucide.createIcons();
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);
