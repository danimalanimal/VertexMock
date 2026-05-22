/* ===========================================================================
   Vertex Broad Jump — roster grid + 3 attempts each + number pad
   =========================================================================== */
(() => {
  'use strict';

  const CHECKLIST = [
    'Take-off line taped', 'Tape measure laid 3m+', 'Landing surface clear',
    'Athletes warmed up (10 min)', 'Practice jumps demonstrated', 'Coach measuring closest heel',
  ];

  // Broad jump benchmarks (cm) — youth athletes, all-rounders
  // [excellent, good, average] — below those = below avg
  const BANDS = [
    { ageMax: 11, ex: 170, good: 150, avg: 130, label: 'U12' },
    { ageMax: 13, ex: 190, good: 170, avg: 150, label: '12-13' },
    { ageMax: 15, ex: 215, good: 195, avg: 175, label: '14-15' },
    { ageMax: 99, ex: 235, good: 215, avg: 195, label: '16+' },
  ];
  function band(ageRaw, cm) {
    const age = ageRaw || 14;
    const b = BANDS.find(x => age <= x.ageMax) || BANDS[BANDS.length - 1];
    if (cm >= b.ex)   return { tag: 'Excellent',  cls: 'bnd-ex',   ref: b.label };
    if (cm >= b.good) return { tag: 'Good',       cls: 'bnd-good', ref: b.label };
    if (cm >= b.avg)  return { tag: 'Average',    cls: 'bnd-avg',  ref: b.label };
    return                  { tag: 'Below avg.', cls: 'bnd-low',  ref: b.label };
  }

  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    unit: 'cm',
    attempts: {},      // { athleteId: [att1, att2, att3] } — null = unattempted, 0 = foul, n = cm
    editing: null,     // { id, idx }
    npRaw: '',
  };

  /* ------------- Setup ------------- */
  $('checklist').innerHTML = CHECKLIST.map(item =>
    `<label class="check"><input type="checkbox" /><span>${item}</span></label>`).join('');

  document.querySelectorAll('.unit-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.unit = b.dataset.unit;
      $('bjUnit').textContent = state.unit;
      $('npUnit').textContent = state.unit;
    });
  });

  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });

  // Roster
  const rosterApi = VertexRoster.mount({
    container: $('rosterGrid'),
    athletes: state.athletes,
    selected: state.selected,
    onChange: refreshStart,
  });
  $('selectAllBtn').addEventListener('click', () => rosterApi.selectAll());
  $('clearAllBtn').addEventListener('click', () => rosterApi.clear());

  function refreshStart() {
    const n = state.selected.size;
    $('rosterCount').textContent = `${n} / ${state.athletes.length} selected`;
    $('startBtn').disabled = n === 0;
    $('startSub').textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} · 3 attempts each`;
  }
  refreshStart();

  $('startBtn').addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.attempts = {};
    Array.from(state.selected).forEach(id => { state.attempts[id] = [null, null, null]; });
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    $('bjAthletes').textContent = state.selected.size;
    $('bjUnit').textContent = state.unit;
    renderList();
  });

  /* ------------- Attempts list (Screen B) ------------- */
  function renderList() {
    const wrap = $('bjList');
    wrap.innerHTML = '';
    Array.from(state.selected).forEach(id => {
      const a = state.athletes.find(x => x.id === id);
      if (!a) return;
      const row = document.createElement('div');
      row.className = 'bj-row';
      row.style.setProperty('--accent', a.accent || '#9bd2ff');
      const atts = state.attempts[id] || [null, null, null];
      const best = bestOf(atts);
      const slots = atts.map((v, i) => {
        let label, cls;
        if (v === null) { label = '—'; cls = 'bj-slot bj-slot-empty'; }
        else if (v === 0) { label = 'foul'; cls = 'bj-slot bj-slot-foul'; }
        else { label = `${v}`; cls = 'bj-slot bj-slot-filled' + (v === best && best > 0 ? ' bj-slot-best' : ''); }
        return `<button type="button" class="${cls}" data-id="${id}" data-idx="${i}"><span class="bjs-k">A${i+1}</span><span class="bjs-v">${label}</span></button>`;
      }).join('');
      row.innerHTML = `
        <div class="bj-who">
          <span class="bjw-init" aria-hidden="true">${a.initials || a.name.slice(0,2)}</span>
          <span class="bjw-name">${a.name}</span>
          <span class="bjw-best">${best > 0 ? best + ' ' + state.unit : '—'}</span>
        </div>
        <div class="bj-slots">${slots}</div>`;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('.bj-slot').forEach(btn => {
      btn.addEventListener('click', () => openPad(btn.dataset.id, parseInt(btn.dataset.idx, 10)));
    });
    updateAttemptsCount();
  }

  function bestOf(atts) {
    const nums = atts.filter(v => typeof v === 'number' && v > 0);
    return nums.length ? Math.max(...nums) : 0;
  }

  function updateAttemptsCount() {
    let done = 0, total = state.selected.size * 3;
    Object.values(state.attempts).forEach(arr => arr.forEach(v => { if (v !== null) done++; }));
    $('bjAttempts').textContent = `${done} / ${total}`;
  }

  /* ------------- Number pad ------------- */
  const overlay = $('numpadOverlay');

  function openPad(id, idx) {
    const a = state.athletes.find(x => x.id === id);
    state.editing = { id, idx };
    const v = state.attempts[id][idx];
    state.npRaw = (typeof v === 'number' && v > 0) ? String(v) : '';
    $('npTitle').textContent = `${a.name} · Attempt ${idx+1}`;
    $('npUnit').textContent = state.unit;
    refreshNpDisplay();
    overlay.removeAttribute('hidden');
  }
  function closePad() {
    overlay.setAttribute('hidden', '');
    state.editing = null;
    state.npRaw = '';
  }
  function refreshNpDisplay() {
    $('npValue').textContent = state.npRaw || '0';
  }
  $('npClose').addEventListener('click', closePad);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePad(); });

  document.querySelectorAll('.np-key').forEach(k => {
    k.addEventListener('click', () => {
      const v = k.dataset.k;
      if (v === 'back') { state.npRaw = state.npRaw.slice(0, -1); refreshNpDisplay(); return; }
      if (v === 'foul') {
        if (!state.editing) return;
        state.attempts[state.editing.id][state.editing.idx] = 0;
        closePad(); renderList();
        return;
      }
      // digit
      if (state.npRaw.length >= 4) return;
      state.npRaw = (state.npRaw + v).replace(/^0+/, '');
      refreshNpDisplay();
    });
  });
  $('npSave').addEventListener('click', () => {
    if (!state.editing) return closePad();
    const n = parseInt(state.npRaw, 10);
    if (!n || n < 1) return; // empty save = no-op
    state.attempts[state.editing.id][state.editing.idx] = n;
    closePad();
    renderList();
  });

  /* ------------- Finish + cancel ------------- */
  $('finishBtn').addEventListener('click', () => showResults());
  $('cancelBtn').addEventListener('click', () => {
    if (confirm('Cancel session? All entered attempts will be lost.')) location.reload();
  });

  /* ------------- Results ------------- */
  function toCmIfNeeded(v) {
    if (!v) return 0;
    return state.unit === 'inches' ? Math.round(v * 2.54) : v;
  }

  function showResults() {
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const rows = Array.from(state.selected).map(id => {
      const a = state.athletes.find(x => x.id === id);
      const atts = state.attempts[id] || [null, null, null];
      const best = bestOf(atts);
      return { id, name: a?.name || '—', initials: a?.initials || '', age: a?.age, atts, best };
    }).sort((x, y) => y.best - x.best);

    $('rsAthletes').textContent = rows.length;
    const valid = rows.filter(r => r.best > 0);
    $('rsBest').textContent = valid.length ? `${valid[0].best} ${state.unit}` : '—';
    const avg = valid.length ? Math.round(valid.reduce((s, r) => s + r.best, 0) / valid.length) : 0;
    $('rsAvg').textContent = valid.length ? `${avg} ${state.unit}` : '—';

    const body = $('resultsBody');
    body.innerHTML = '';
    rows.forEach((r, i) => {
      const bestCm = toCmIfNeeded(r.best);
      const b = r.best > 0 ? band(r.age, bestCm) : { tag: '—', cls: '', ref: '—' };
      const attsHtml = r.atts.map(v => {
        if (v === null) return '<span class="att-cell att-empty">—</span>';
        if (v === 0)    return '<span class="att-cell att-foul">foul</span>';
        return `<span class="att-cell ${v === r.best ? 'att-best' : ''}">${v}</span>`;
      }).join('');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">#${i+1}</td>
        <td class="rt-name"><span class="rt-init">${r.initials}</span> ${r.name}</td>
        <td><b>${r.best > 0 ? r.best + ' ' + state.unit : '—'}</b></td>
        <td><div class="att-row">${attsHtml}</div></td>
        <td>${r.best > 0 ? `<span class="bnd ${b.cls}">${b.tag}</span><span class="bnd-ref">${b.ref}</span>` : '—'}</td>`;
      body.appendChild(tr);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const payload = Array.from(state.selected).map(id => {
      const a = state.athletes.find(x => x.id === id);
      const atts = state.attempts[id] || [null, null, null];
      const best = bestOf(atts);
      const bestCm = toCmIfNeeded(best);
      return { id, name: a?.name, age: a?.age, attempts: atts, best, bestCm, unit: state.unit, band: best > 0 ? band(a?.age, bestCm).tag : null };
    });
    VertexResults.save('broad-jump', payload, { protocol: 'broad-jump', unit: state.unit });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = { unit: state.unit, attempts: state.attempts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `broad-jump-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
