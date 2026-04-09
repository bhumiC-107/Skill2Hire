// ========== Project Page ==========
import { generateProject, getProject, completeStep, streamStepDetail } from '../api.js';
import { getSession, showToast, showXPPopup } from '../main.js';
import { createConfetti } from '../utils/gamification.js';

export async function renderProject(container) {
  const session = getSession();
  if (!session?.userId) { window.location.hash = '#/onboarding'; return; }

  container.innerHTML = `
    <div class="project">
      <div class="loading-screen" id="project-loading">
        <div class="spinner"></div>
        <h3>Loading project...</h3>
      </div>
    </div>
  `;

  try {
    // Try to get existing project
    let projectData;
    try {
      projectData = await getProject(session.userId);
    } catch {
      // Generate new project
      const projEl = container.querySelector('.project');
      projEl.innerHTML = `
        <div class="loading-screen">
          <div class="neural-loader">
            <div class="node"></div><div class="node"></div><div class="node"></div>
            <div class="node"></div><div class="node"></div><div class="node"></div>
          </div>
          <h3>AI is designing your project...</h3>
          <p style="color:var(--text-muted);">Creating a hands-on project for ${session.goal}</p>
        </div>
      `;

      const result = await generateProject({
        userId: session.userId,
        goal: session.goal,
        skills: session.assessment?.currentSkills?.map(s => s.name) || [],
      });
      projectData = { project: result.project, currentStep: 0, completed: false };
    }

    const project = projectData.project;
    const steps = project.steps || [];
    const currentStep = projectData.currentStep || 0;

    renderProjectUI(container, project, steps, currentStep, projectData.completed);
  } catch (err) {
    container.querySelector('.project').innerHTML = `
      <div class="loading-screen">
        <h3 style="color:var(--accent-rose);">Error</h3>
        <p style="color:var(--text-muted)">${err.message}</p>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Back to Dashboard</button>
      </div>
    `;
  }
}

function renderProjectUI(container, project, steps, currentStep, isCompleted) {
  const session = getSession();

  container.querySelector('.project').innerHTML = `
    <div class="lesson-header">
      <button class="btn btn-ghost" onclick="location.hash='#/dashboard'">← Back</button>
      <div style="flex:1;">
        <h3 style="font-size:1.1rem;">🛠️ ${project.title || 'Your Project'}</h3>
        <p style="font-size:0.85rem;color:var(--text-secondary);">${project.description || ''}</p>
      </div>
    </div>

    <div style="margin:16px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Progress</span>
        <span style="font-size:0.85rem;color:var(--text-muted);">${currentStep} / ${steps.length} steps</span>
      </div>
      <div class="progress-bar progress-bar-lg">
        <div class="progress-bar-fill" style="width:${(currentStep / steps.length) * 100}%"></div>
      </div>
    </div>

    <div class="project-steps">
      ${steps.map((s, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep && !isCompleted;
        return `
          <div class="project-step ${isDone ? 'completed' : isActive ? 'active' : ''}" data-index="${i}">
            <span class="step-number">${isDone ? '✓' : i + 1}</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.95rem;">${s.title}</div>
              <div style="font-size:0.82rem;color:var(--text-muted);">${s.description || ''}</div>
            </div>
            <span class="badge badge-amber">+${s.xpReward || 50} XP</span>
          </div>
        `;
      }).join('')}
    </div>

    ${isCompleted ? `
      <div style="text-align:center;margin-top:32px;padding:32px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid rgba(16,185,129,0.3);">
        <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
        <h3 style="color:var(--accent-emerald);">Project Completed!</h3>
        <p style="color:var(--text-secondary);margin:8px 0 20px;">Great work! You've earned the Builder badge.</p>
        <button class="btn btn-success" onclick="location.hash='#/jobs'">View Job Opportunities →</button>
      </div>
    ` : `
      <div id="step-detail-area" class="step-content" style="margin-top:20px;">
        <div style="text-align:center;">
          <button class="btn btn-primary" id="load-step-btn">
            📖 Load Step ${currentStep + 1} Instructions
          </button>
        </div>
      </div>
    `}
  `;

  if (!isCompleted) {
    document.getElementById('load-step-btn')?.addEventListener('click', async () => {
      const step = steps[currentStep];
      const area = document.getElementById('step-detail-area');
      area.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;color:var(--text-muted);margin-bottom:16px;">
          <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
          <span>Loading detailed instructions...</span>
        </div>
        <div id="step-text" class="lesson-content"></div>
      `;

      const textEl = document.getElementById('step-text');

      await streamStepDetail(
        {
          userId: session.userId,
          stepTitle: step.title,
          stepDescription: step.instructions || step.description,
          goal: session.goal,
        },
        (chunk, full) => {
          textEl.innerHTML = renderMarkdown(full);
          if (window.Prism) {
            textEl.querySelectorAll('pre code').forEach(b => window.Prism.highlightElement(b));
          }
        },
        (fullContent) => {
          textEl.innerHTML = renderMarkdown(fullContent);
          if (window.Prism) {
            textEl.querySelectorAll('pre code').forEach(b => window.Prism.highlightElement(b));
          }
          // Show complete button
          area.innerHTML += `
            <div style="text-align:center;margin-top:24px;">
              <button class="btn btn-success btn-lg" id="complete-step-btn">
                ✓ Complete Step ${currentStep + 1} (+${step.xpReward || 50} XP)
              </button>
            </div>
          `;

          document.getElementById('complete-step-btn').addEventListener('click', async () => {
            const btn = document.getElementById('complete-step-btn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
              const result = await completeStep({
                userId: session.userId,
                stepIndex: currentStep,
                xpReward: step.xpReward || 50,
              });

              showXPPopup(step.xpReward || 50);
              showToast(`Step ${currentStep + 1} completed!`, 'xp');

              if (result.completed) {
                createConfetti();
                showToast('🎉 Project completed! You earned the Builder badge!', 'success');
              }

              setTimeout(() => renderProject(container), 1000);
            } catch (err) {
              showToast('Error: ' + err.message, 'error');
              btn.disabled = false;
            }
          });
        }
      );
    });
  }
}

function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || 'javascript'}">${escapeHtml(code.trim())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
  return `<p>${html}</p>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
