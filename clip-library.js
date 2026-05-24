/* clip-library.js — audit page for the recording library
 *
 * Calls GET /api/list-clips, groups returned blobs by label (which we parse from the pathname:
 *   clips/coach-<coach>/<timestamp>__<label>.wav
 * Note: the server's /api/list-clips returns blob metadata, not the tokenPayload — we'd need a
 * follow-up call to /api/blob/get-metadata for that. For the v1 audit page we parse from path,
 * which is reliable because record-clip.js controls the naming convention.
 */
(function () {
  'use strict';

  const filterField    = document.getElementById('filterField');
  const refreshBtn     = document.getElementById('refreshBtn');
  const downloadIdxBtn = document.getElementById('downloadIndexBtn');
  const loadingState   = document.getElementById('loadingState');
  const emptyState     = document.getElementById('emptyState');
  const errorState     = document.getElementById('errorState');
  const errorMsg       = document.getElementById('errorMsg');
  const groupsContainer= document.getElementById('groupsContainer');
  const libStats       = document.getElementById('libStats');
  const statTotal      = document.getElementById('statTotal');
  const statLabels     = document.getElementById('statLabels');
  const statSize       = document.getElementById('statSize');
  const statCoaches    = document.getElementById('statCoaches');

  let allClips = [];   // raw items from /api/list-clips

  // ---- Parse pathname helper ----
  // 'clips/coach-jane/2026-05-24T12-03-04-001Z__clean-rip-land.wav'
  function parsePath(pathname) {
    const m = /^clips\/coach-([^/]+)\/([^_]+)__([^.]+)\.wav$/i.exec(pathname);
    if (!m) return { coach: '?', when: '?', label: 'unknown' };
    return {
      coach: m[1],
      when: m[2].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z$/, 'T$1:$2:$3.$4Z'),
      label: m[3],
    };
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function humanDate(iso) {
    if (!iso) return '?';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-AU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    } catch (_) { return iso; }
  }

  function fmt(blob) {
    const parsed = parsePath(blob.pathname);
    return { ...blob, ...parsed };
  }

  // ---- Fetch ----
  async function loadClips() {
    loadingState.hidden = false;
    emptyState.hidden = true;
    errorState.hidden = true;
    libStats.hidden = true;
    groupsContainer.innerHTML = '';

    try {
      const res = await fetch('/api/list-clips', { cache: 'no-store' });
      if (!res.ok) {
        // Don't leak HTML error pages to UI — show short summary only
        throw new Error(`HTTP ${res.status} (clip API not configured yet)`);
      }
      const data = await res.json();
      allClips = (data.items || []).map(fmt);
      loadingState.hidden = true;

      if (allClips.length === 0) {
        emptyState.hidden = false;
        return;
      }
      renderStats();
      render();
    } catch (err) {
      loadingState.hidden = true;
      errorState.hidden = false;
      errorMsg.textContent = 'Failed to load clips: ' + (err.message || err);
      console.error(err);
    }
  }

  function renderStats() {
    const labels = new Set();
    const coaches = new Set();
    let totalSize = 0;
    for (const c of allClips) {
      labels.add(c.label);
      coaches.add(c.coach);
      totalSize += (c.size || 0);
    }
    statTotal.textContent = allClips.length;
    statLabels.textContent = labels.size;
    statSize.textContent = humanSize(totalSize);
    statCoaches.textContent = coaches.size;
    libStats.hidden = false;
  }

  // ---- Filter + group + render ----
  function render() {
    const q = (filterField.value || '').toLowerCase().trim();
    const filtered = q
      ? allClips.filter(c =>
          (c.label || '').toLowerCase().includes(q) ||
          (c.coach || '').toLowerCase().includes(q) ||
          (c.pathname || '').toLowerCase().includes(q))
      : allClips;

    // Group by label
    const groups = new Map();
    for (const c of filtered) {
      const key = c.label || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    // Sort group keys alphabetically, but pin known "clean-*" labels to the top
    const order = (k) => {
      if (k.startsWith('clean-')) return '0_' + k;
      if (k === 'unknown' || k === 'other') return '9_' + k;
      return '5_' + k;
    };
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => order(a).localeCompare(order(b)));

    groupsContainer.innerHTML = sortedKeys.map(key => {
      const clips = groups.get(key);
      return `
        <section class="group">
          <div class="group-head">
            <h2>${escapeHtml(key)}</h2>
            <span class="count">${clips.length} clip${clips.length === 1 ? '' : 's'}</span>
          </div>
          ${clips.map(c => `
            <div class="clip-row">
              <div class="clip-meta">
                <span class="pill">${escapeHtml(c.coach)}</span>
                <span class="pill">${humanSize(c.size || 0)}</span>
                <span class="pill">${humanDate(c.uploadedAt)}</span>
                <div class="path">${escapeHtml(c.pathname)}</div>
              </div>
              <div class="clip-controls">
                <audio controls preload="none" src="${escapeAttr(c.streamUrl)}"></audio>
                <a class="dl" href="${escapeAttr(c.downloadUrl)}" download title="Download">⬇</a>
              </div>
            </div>
          `).join('')}
        </section>
      `;
    }).join('');
  }

  // ---- Index JSON download (for offline ML work) ----
  function downloadIndex() {
    const blob = new Blob([JSON.stringify(allClips, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vertex-clip-index-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- HTML safety ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---- Wire up ----
  refreshBtn.addEventListener('click', loadClips);
  downloadIdxBtn.addEventListener('click', downloadIndex);
  filterField.addEventListener('input', render);

  // ---- Init ----
  loadClips();
})();
