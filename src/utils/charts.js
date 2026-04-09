// ========== Canvas Charts ==========

export function drawRadarChart(canvas, currentSkills, requiredSkills) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 360;
  const H = canvas.height = 360;
  const cx = W / 2;
  const cy = H / 2;
  const R = 130;
  const labels = requiredSkills.map(s => s.name);
  const n = labels.length;
  if (n === 0) return;

  ctx.clearRect(0, 0, W, H);

  // Grid
  for (let ring = 1; ring <= 5; ring++) {
    const r = (R / 5) * ring;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
  }

  // Required polygon
  ctx.beginPath();
  requiredSkills.forEach((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (s.level / 100) * R;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(124, 58, 237, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Current polygon
  ctx.beginPath();
  currentSkills.forEach((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (s.level / 100) * R;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  currentSkills.forEach((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (s.level / 100) * R;
    ctx.beginPath();
    ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
  });

  // Labels
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + (R + 24) * Math.cos(angle);
    const ly = cy + (R + 24) * Math.sin(angle);
    ctx.fillText(label.length > 14 ? label.slice(0, 12) + '...' : label, lx, ly + 4);
  });
}

export function drawProgressRing(canvas, percent) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width = canvas.height = 160;
  const cx = size / 2;
  const cy = size / 2;
  const R = 62;
  const lineWidth = 10;

  ctx.clearRect(0, 0, size, size);

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Progress ring
  const start = -Math.PI / 2;
  const end = start + (Math.PI * 2 * percent) / 100;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(1, '#06b6d4');

  ctx.beginPath();
  ctx.arc(cx, cy, R, start, end);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center text
  ctx.font = '700 28px Inter, sans-serif';
  ctx.fillStyle = '#e6edf3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(percent)}%`, cx, cy);
}
