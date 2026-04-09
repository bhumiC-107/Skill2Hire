// ========== Lesson Page ==========
import { getCurriculum, streamLesson, completeModule } from '../api.js';
import { getSession, showToast, showXPPopup } from '../main.js';

export async function renderLesson(container, moduleIndex) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }
  if (moduleIndex === null || moduleIndex === undefined) { window.location.hash = '#/dashboard'; return; }

  container.innerHTML = `
    <div class="lesson">
      <div class="loading-screen" id="lesson-loading">
        <div class="spinner"></div>
        <h3>Loading lesson...</h3>
      </div>
    </div>
  `;

  try {
    const currData = await getCurriculum(session.userId);
    const modules = currData.curriculum.modules || [];
    const mod = modules[moduleIndex];

    if (!mod) {
      container.querySelector('.lesson').innerHTML = `
        <div class="loading-screen">
          <h3>Module not found</h3>
          <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Back to Dashboard</button>
        </div>
      `;
      return;
    }

    container.querySelector('.lesson').innerHTML = `
      <div class="lesson-header">
        <button class="btn btn-ghost" onclick="location.hash='#/dashboard'">← Back</button>
        <div style="flex:1;">
          <h3 style="font-size:1.1rem;">${mod.title}</h3>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <span class="badge badge-violet">${mod.difficulty || 'intermediate'}</span>
            <span class="badge badge-amber">+${mod.xpReward || 100} XP</span>
          </div>
        </div>
      </div>

      <div class="lesson-content" id="lesson-text">
        <div style="display:flex;align-items:center;gap:12px;color:var(--text-muted);">
          <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
          <span>Generating lesson content...</span>
        </div>
      </div>

      <div class="lesson-actions" id="lesson-actions" style="display:none;">
        <button class="btn btn-primary btn-lg" id="complete-btn">
          ✓ Complete Module (+${mod.xpReward || 100} XP)
        </button>
      </div>
    `;

    const lessonEl = document.getElementById('lesson-text');

    // Stream lesson content
    await streamLesson(
      {
        userId: session.userId,
        moduleIndex,
        moduleTitle: mod.title,
        moduleTopics: mod.topics || [],
        goal: session.goal,
      },
      (chunk, full) => {
        lessonEl.innerHTML = renderMarkdown(full);
        // Highlight code blocks
        if (window.Prism) {
          lessonEl.querySelectorAll('pre code').forEach(block => {
            window.Prism.highlightElement(block);
          });
        }
      },
      (fullContent) => {
        lessonEl.innerHTML = renderMarkdown(fullContent);
        if (window.Prism) {
          lessonEl.querySelectorAll('pre code').forEach(block => {
            window.Prism.highlightElement(block);
          });
        }
        document.getElementById('lesson-actions').style.display = 'flex';
      }
    );

    // Complete button
    document.getElementById('complete-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('complete-btn');
      btn.disabled = true;
      btn.textContent = 'Saving progress...';

      try {
        const result = await completeModule({
          userId: session.userId,
          moduleIndex,
          xpReward: mod.xpReward || 100,
        });

        showXPPopup(mod.xpReward || 100);
        showToast(`Module completed! +${mod.xpReward || 100} XP`, 'xp');

        if (result.newBadges?.length > 0) {
          result.newBadges.forEach(b => {
            setTimeout(() => showToast(`🏅 New badge: ${b}`, 'success'), 500);
          });
        }

        setTimeout(() => { window.location.hash = '#/dashboard'; }, 1200);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = `✓ Complete Module (+${mod.xpReward || 100} XP)`;
      }
    });

  } catch (err) {
    container.querySelector('.lesson').innerHTML = `
      <div class="loading-screen">
        <h3 style="color:var(--accent-rose);">Error</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Back</button>
      </div>
    `;
  }
}

// Simple markdown parser
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || 'javascript'}">${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  return `<p>${html}</p>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
