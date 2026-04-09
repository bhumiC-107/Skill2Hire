// ========== Gamification Engine ==========

export const BADGES = {
  first_lesson: { icon: '🌱', name: 'First Step', desc: 'Complete your first lesson' },
  five_lessons: { icon: '🔥', name: 'On Fire', desc: 'Complete 5 lessons' },
  streak_3: { icon: '⚡', name: '3-Day Streak', desc: 'Learn 3 days in a row' },
  streak_7: { icon: '💎', name: 'Week Warrior', desc: '7-day learning streak' },
  level_5: { icon: '🏆', name: 'Level 5', desc: 'Reach level 5' },
  project_complete: { icon: '🚀', name: 'Builder', desc: 'Complete the project' },
  quiz_ace: { icon: '🎯', name: 'Quiz Ace', desc: 'Score 80%+ on quiz' },
  curriculum_done: { icon: '👑', name: 'Graduate', desc: 'Complete the full curriculum' },
};

export function getLevelProgress(xp) {
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXP = (level - 1) * 500;
  const nextLevelXP = level * 500;
  const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
  return { level, progress, currentXP: xp - currentLevelXP, needed: nextLevelXP - currentLevelXP };
}

export function createConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6'];

  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = (Math.random() * 8 + 5) + 'px';
    confetti.style.height = (Math.random() * 8 + 5) + 'px';
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    confetti.style.animationDelay = (Math.random() * 1.5) + 's';
    container.appendChild(confetti);
  }

  setTimeout(() => container.remove(), 5000);
}
