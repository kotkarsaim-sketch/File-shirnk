/* =====================================================
   File-Shrink — Frontend Logic (no emojis)
   ===================================================== */

let selectedFile = null;
let analysisData = null;

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

/* ── File Picking ── */
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (!e.target.closest('button')) fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) setFile(e.target.files[0]);
});

/* ── Drag & Drop ── */
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

/* ── Demo Mode ── */
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
  } catch {
    showError('Could not load sample text.');
  }
});

/* ── Analyze ── */
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

/* ── Render ── */
function renderResults(data) {
  document.getElementById('stat-total').textContent   = data.total_words.toLocaleString();
  document.getElementById('stat-unique').textContent  = data.unique_words.toLocaleString();
  document.getElementById('stat-avg-len').textContent = data.numpy_stats.mean;
  document.getElementById('stat-ratio').textContent   = data.compression.compression_ratio_percent + '%';

  // Gauge
  const ratio = data.compression.compression_ratio_percent;
  setTimeout(() => {
    document.getElementById('gauge-fill').style.width = Math.min(ratio, 100) + '%';
    document.getElementById('gauge-label').textContent = ratio + '%';
  }, 100);

  document.getElementById('meta-original').textContent   = formatBytes(data.compression.original_bytes);
  document.getElementById('meta-saved').textContent      = formatBytes(data.compression.saved_bytes);
  document.getElementById('meta-compressed').textContent = formatBytes(data.compression.compressed_bytes);

  // Table
  const tbody = document.getElementById('words-tbody');
  tbody.innerHTML = '';
  const top10Set = new Set(data.compression.top_10.map(x => x.word));

  data.all_top_20.forEach(item => {
    const isTop10 = top10Set.has(item.word);
    const savedRow = data.compression.top_10.find(x => x.word === item.word);
    const bytesSaved = savedRow ? savedRow.bytes_saved : 0;

    const tr = document.createElement('tr');
    if (isTop10) tr.classList.add('highlight-row');
    tr.innerHTML =
      '<td class="rank-cell">' + item.rank + '</td>' +
      '<td class="word-cell">' + escHtml(item.word) + (isTop10 ? '<span class="top-badge">TOP 10</span>' : '') + '</td>' +
      '<td class="freq-cell">' + item.frequency.toLocaleString() + '</td>' +
      '<td>' + item.percent + '%</td>' +
      '<td>' + item.word.length + '</td>' +
      '<td class="saved-cell">' + (isTop10 ? '-' + formatBytes(bytesSaved) : '—') + '</td>';
    tbody.appendChild(tr);
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

  // Bar chart
  const barChart = document.getElementById('bar-chart');
  barChart.innerHTML = '';
  const top10 = data.all_top_20.slice(0, 10);
  const maxFreq = top10[0]?.frequency || 1;
  top10.forEach(item => {
    const pct = Math.round((item.frequency / maxFreq) * 100);
    const div = document.createElement('div');
    div.className = 'bar-item';
    div.innerHTML =
      '<div class="bar-word">' + escHtml(item.word) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" data-pct="' + pct + '"><span class="bar-val">' + item.frequency + '</span></div></div>';
    barChart.appendChild(div);
  });
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
      bar.classList.add('animated');
    });
  }, 150);

  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Reset ── */
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

/* ── Error ── */
function showError(msg) { errorMsg.textContent = msg; errorCard.classList.remove('hidden'); }
function hideError() { errorCard.classList.add('hidden'); }
dismissError.addEventListener('click', hideError);

/* ── Utilities ── */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
