// ========== CodeNova — Frontend API Client ==========

const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Auth
export const registerUser = (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const getUser = (id) => request(`/auth/user/${id}`);
export const updateGoal = (id, data) => request(`/auth/user/${id}/goal`, { method: 'PUT', body: JSON.stringify(data) });

// Quiz
export const generateQuiz = (data) => request('/quiz/generate', { method: 'POST', body: JSON.stringify(data) });
export const submitQuiz = (data) => request('/quiz/submit', { method: 'POST', body: JSON.stringify(data) });
export const getQuizResults = (userId) => request(`/quiz/results/${userId}`);

// Curriculum
export const generateCurriculum = (data) => request('/curriculum/generate', { method: 'POST', body: JSON.stringify(data) });
export const getCurriculum = (userId) => request(`/curriculum/${userId}`);
export const completeModule = (data) => request('/curriculum/complete-module', { method: 'POST', body: JSON.stringify(data) });

// Streaming lesson
export async function streamLesson(data, onChunk, onDone) {
  const res = await fetch(`${API_BASE}/curriculum/lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.done) {
            fullContent = parsed.fullContent || fullContent;
            if (onDone) onDone(fullContent);
          } else if (parsed.content) {
            fullContent += parsed.content;
            if (onChunk) onChunk(parsed.content, fullContent);
          }
        } catch (e) { /* skip */ }
      }
    }
  }
  return fullContent;
}

// Project
export const generateProject = (data) => request('/project/generate', { method: 'POST', body: JSON.stringify(data) });
export const getProject = (userId) => request(`/project/${userId}`);
export const completeStep = (data) => request('/project/complete-step', { method: 'POST', body: JSON.stringify(data) });

// Stream project step detail
export async function streamStepDetail(data, onChunk, onDone) {
  const res = await fetch(`${API_BASE}/project/step-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.done) {
            fullContent = parsed.fullContent || fullContent;
            if (onDone) onDone(fullContent);
          } else if (parsed.content) {
            fullContent += parsed.content;
            if (onChunk) onChunk(parsed.content, fullContent);
          }
        } catch (e) { /* skip */ }
      }
    }
  }
  return fullContent;
}

// Jobs
export const generateJobs = (data) => request('/jobs/generate', { method: 'POST', body: JSON.stringify(data) });
export const getJobs = (userId) => request(`/jobs/${userId}`);

// Mentors
export const generateMentors = (data) => request('/mentors/generate', { method: 'POST', body: JSON.stringify(data) });

// Stats
export const getStats = (userId) => request(`/stats/${userId}`);
export const getTokenHistory = (userId) => request(`/stats/tokens/${userId}`);

// Utils
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
