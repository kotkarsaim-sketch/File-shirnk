/* =====================================================
   File-Shrink — Frontend Logic + Motion & Interactivity
   ===================================================== */

// ── State ──
let selectedFile = null;
let analysisData = null;

// ── DOM ──
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const browseBtn      = document.getElementById('browse-btn');
const demoBtn        = document.getElementById('demo-btn');
const fileInfo       = document.getElementById('file-info');
const fileNameLabel  = document.getElementById('file-name-label');
const analyzeBtn     = document.getElementById('analyze-btn');
const loadingSection = document.getElementById('loading-section');
const errorCard      = document.getElementById('error-card');
const errorMsg       = document.getElementById('error-msg');
const dismissError   = document.getElementById('dismiss-error');
const results        = document.getElementById('results');
const resetBtn       = document.getElementById('reset-btn');
const uploadSection  = document.getElementById('upload-section');

/* ══════════════════════════════════════════
   PARTICLES — Floating dots background
   ══════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;
  const PARTICLE_COUNT = 40;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.2 + 0.05,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249,115,22,' + p.alpha + ')';
      ctx.fill();
    });

    // Draw connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(249,115,22,' + (0.04 * (1 - dist / 120)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ══════════════════════════════════════════
   SCROLL REVEAL — IntersectionObserver
   ══════════════════════════════════════════ */
(function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-scale').forEach(el => observer.observe(el));

  // Re-observe new elements after results render
  window._scrollRevealObserver = observer;
})();

/* ══════════════════════════════════════════
   HEADER SCROLL EFFECT
   ══════════════════════════════════════════ */
(function initHeaderScroll() {
  const header = document.getElementById('header');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  });
})();

/* ══════════════════════════════════════════
   COUNTER ANIMATION — animate numbers up
   ══════════════════════════════════════════ */
function animateCounter(element, target, duration, isFloat) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;

    if (isFloat) {
      element.textContent = current.toFixed(2);
    } else {
      element.textContent = Math.round(current).toLocaleString();
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Final exact value
      if (isFloat) {
        element.textContent = target.toFixed(2);
      } else {
        element.textContent = target.toLocaleString();
      }
    }
  }
  requestAnimationFrame(tick);
}

function animateCounterWithSuffix(element, target, duration, suffix) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    element.textContent = current.toFixed(2) + suffix;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = target + suffix;
    }
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════
   FILE UPLOAD LOGIC
   ══════════════════════════════════════════ */
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (!e.target.closest('button')) fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) setFile(e.target.files[0]);
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    if (!file.name.endsWith('.txt')) { showError('Only .txt files are supported.'); return; }
    setFile(file);
  }
});

function setFile(file) {
  selectedFile = file;
  fileNameLabel.textContent = file.name + '  (' + formatBytes(file.size) + ')';
  fileInfo.classList.remove('hidden');
  hideError();
}

// Demo
demoBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/sample');
    const data = await res.json();
    const blob = new Blob([data.text], { type: 'text/plain' });
    selectedFile = new File([blob], 'sample_text.txt', { type: 'text/plain' });
    fileNameLabel.textContent = 'sample_text.txt  (demo)';
    fileInfo.classList.remove('hidden');
    hideError();
    await runAnalysis();
  } catch { showError('Could not load sample text.'); }
});

/* ══════════════════════════════════════════
   ANALYZE
   ══════════════════════════════════════════ */
analyzeBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!selectedFile) return;

  uploadSection.classList.add('hidden');
  results.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  hideError();

  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  let stepIdx = 0;
  const stepInterval = setInterval(() => {
    if (stepIdx > 0) {
      document.getElementById(steps[stepIdx - 1]).classList.remove('active');
      document.getElementById(steps[stepIdx - 1]).classList.add('done');
    }
    if (stepIdx < steps.length) {
      document.getElementById(steps[stepIdx]).classList.add('active');
      stepIdx++;
    } else { clearInterval(stepInterval); }
  }, 500);

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const res = await fetch('/analyze', { method: 'POST', body: formData });
    const data = await res.json();

    clearInterval(stepInterval);
    steps.forEach(id => {
      document.getElementById(id).classList.remove('active');
      document.getElementById(id).classList.add('done');
    });
    await delay(400);
    loadingSection.classList.add('hidden');

    if (!res.ok || data.error) {
      showError(data.error || 'Analysis failed.');
      uploadSection.classList.remove('hidden');
      return;
    }

    analysisData = data;
    renderResults(data);
  } catch {
    clearInterval(stepInterval);
    loadingSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    showError('Network error. Make sure the server is running.');
  }
}

/* ══════════════════════════════════════════
   RENDER RESULTS
   ══════════════════════════════════════════ */
function renderResults(data) {
  // Animated counters for stats
  const statTotal = document.getElementById('stat-total');
  const statUnique = document.getElementById('stat-unique');
  const statAvg = document.getElementById('stat-avg-len');
  const statRatio = document.getElementById('stat-ratio');

  animateCounter(statTotal, data.total_words, 1200, false);
  animateCounter(statUnique, data.unique_words, 1200, false);
  animateCounter(statAvg, data.numpy_stats.mean, 1200, true);
  animateCounterWithSuffix(statRatio, data.compression.compression_ratio_percent, 1200, '%');

  // Gauge
  const ratio = data.compression.compression_ratio_percent;
  setTimeout(() => {
    document.getElementById('gauge-fill').style.width = Math.min(ratio, 100) + '%';
    animateCounterWithSuffix(document.getElementById('gauge-label'), ratio, 1400, '%');
  }, 200);

  document.getElementById('meta-original').textContent   = formatBytes(data.compression.original_bytes);
  document.getElementById('meta-saved').textContent      = formatBytes(data.compression.saved_bytes);
  document.getElementById('meta-compressed').textContent = formatBytes(data.compression.compressed_bytes);

  // Table — staggered row animation
  const tbody = document.getElementById('words-tbody');
  tbody.innerHTML = '';
  const top10Set = new Set(data.compression.top_10.map(x => x.word));

  data.all_top_20.forEach((item, idx) => {
    const isTop10 = top10Set.has(item.word);
    const savedRow = data.compression.top_10.find(x => x.word === item.word);
    const bytesSaved = savedRow ? savedRow.bytes_saved : 0;

    const tr = document.createElement('tr');
    if (isTop10) tr.classList.add('highlight-row');
    // Staggered entry
    tr.style.opacity = '0';
    tr.style.transform = 'translateY(8px)';
    tr.style.transition = 'opacity 0.3s ease ' + (idx * 40) + 'ms, transform 0.3s ease ' + (idx * 40) + 'ms';

    tr.innerHTML =
      '<td class="rank-cell">' + item.rank + '</td>' +
      '<td class="word-cell">' + escHtml(item.word) + (isTop10 ? '<span class="top-badge">TOP 10</span>' : '') + '</td>' +
      '<td class="freq-cell">' + item.frequency.toLocaleString() + '</td>' +
      '<td>' + item.percent + '%</td>' +
      '<td>' + item.word.length + '</td>' +
      '<td class="saved-cell">' + (isTop10 ? '-' + formatBytes(bytesSaved) : '—') + '</td>';
    tbody.appendChild(tr);

    // Trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tr.style.opacity = '1';
        tr.style.transform = 'translateY(0)';
      });
    });
  });

  // NumPy grid
  const stats = data.numpy_stats;
  const numpyGrid = document.getElementById('numpy-grid');
  numpyGrid.innerHTML = '';
  [
    { label: 'Mean Length', value: stats.mean },
    { label: 'Std Dev',     value: stats.std },
    { label: 'Max Length',  value: stats.max },
    { label: 'Min Length',  value: stats.min },
    { label: 'Unique Words',value: stats.total_unique },
  ].forEach(item => {
    const div = document.createElement('div');
    div.className = 'numpy-stat';
    div.innerHTML = '<div class="n-value">' + item.value + '</div><div class="n-label">' + item.label + '</div>';
    numpyGrid.appendChild(div);
  });

  // Code block
  const lengthSample = data.all_top_20.slice(0, 10).map(x => x.word.length).join(', ');
  document.getElementById('code-lengths').textContent = lengthSample + ', ...';
  document.getElementById('code-mean').textContent    = stats.mean;
  document.getElementById('code-std').textContent     = stats.std;
  document.getElementById('code-max').textContent     = stats.max;
  document.getElementById('code-min').textContent     = stats.min;

  // Bar chart — staggered bars
  const barChart = document.getElementById('bar-chart');
  barChart.innerHTML = '';
  const top10 = data.all_top_20.slice(0, 10);
  const maxFreq = top10[0]?.frequency || 1;
  top10.forEach((item, idx) => {
    const pct = Math.round((item.frequency / maxFreq) * 100);
    const div = document.createElement('div');
    div.className = 'bar-item';
    div.style.opacity = '0';
    div.style.transform = 'translateX(-12px)';
    div.style.transition = 'opacity 0.4s ease ' + (idx * 80) + 'ms, transform 0.4s ease ' + (idx * 80) + 'ms';
    div.innerHTML =
      '<div class="bar-word">' + escHtml(item.word) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" data-pct="' + pct + '"><span class="bar-val">' + item.frequency + '</span></div></div>';
    barChart.appendChild(div);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        div.style.opacity = '1';
        div.style.transform = 'translateX(0)';
      });
    });
  });

  // Animate bar fills after entry
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
      bar.classList.add('animated');
    });
  }, 300);

  // Show results & re-observe for scroll reveals
  results.classList.remove('hidden');

  // Re-observe newly added reveal elements
  if (window._scrollRevealObserver) {
    results.querySelectorAll('.reveal, .reveal-scale').forEach(el => {
      window._scrollRevealObserver.observe(el);
    });
  }

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════
   RESET
   ══════════════════════════════════════════ */
resetBtn.addEventListener('click', () => {
  selectedFile = null;
  analysisData = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  results.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  hideError();
  ['step-1','step-2','step-3','step-4'].forEach(id => {
    document.getElementById(id).classList.remove('active', 'done');
  });
  document.getElementById('step-1').classList.add('active');
  document.getElementById('gauge-fill').style.width = '0%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ══════════════════════════════════════════
   ERROR
   ══════════════════════════════════════════ */
function showError(msg) { errorMsg.textContent = msg; errorCard.classList.remove('hidden'); }
function hideError() { errorCard.classList.add('hidden'); }
dismissError.addEventListener('click', hideError);

/* ══════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════ */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
