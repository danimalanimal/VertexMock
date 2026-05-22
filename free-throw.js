/* ===========================================================================
   Vertex Free Throw % — single athlete at a time, M/Miss tap
   =========================================================================== */
(() => {
  'use strict';
  const { beep } = window.VertexAudio;

  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    setSize: 25,
    queue: [],
    qIdx: 0,
    shots: {},     // { id: [true/false, ...] }
    finishedIds: new Set(),
  };

  /* ------------- Setup ------------- */
  document.querySelectorAll('.set-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.set-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.setSize = parseInt(b.dataset.set, 10);
      refreshStart();
    });
  });

  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });

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
    $('startSub').textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} · ${state.setSize} shots each`;
  }
  refreshStart();

  /* ------------- Start ------------- */
  $('startBtn').addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.queue = Array.from(state.selected);
    state.qIdx = 0;
    state.shots = {};
    state.finishedIds.clear();
    state.queue.forEach(id => { state.shots[id] = []; });
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    renderCurrent();
  });

  /* ------------- Live screen ------------- */
  function renderCurrent() {
    if (state.qIdx >= state.queue.length) return endSession();
    const id = state.queue[state.qIdx];
    const a = state.athletes.find(x => x.id === id);
    $('ftInit').textContent = a?.initials || a?.name?.slice(0,2) || '—';
    $('ftInit').style.setProperty('--accent', a?.accent || '#9bd2ff');
    $('ftName').textContent = a?.name || '—';
    $('ftSet').textContent = state.setSize;
    updateStats();
    renderGrid();
  }

  function updateStats() {
    const id = state.queue[state.qIdx];
    const shots = state.shots[id] || [];
    const att = shots.length;
    const made = shots.filter(Boolean).length;
    const pct = att ? Math.round((made / att) * 100) : 0;
    $('ftShot').textContent = Math.min(att + 1, state.setSize);
    $('ftMade').textContent = made;
    $('ftAtt').textContent = att;
    $('ftPct').textContent = att ? pct + '%' : '—';
    // Streak: current run of consecutive makes from the end? Actually show CURRENT streak.
    let streak = 0;
    for (let i = shots.length - 1; i >= 0; i--) {
      if (shots[i]) streak++; else break;
    }
    $('ftStreak').textContent = streak;
  }

  function renderGrid() {
    const id = state.queue[state.qIdx];
    const shots = state.shots[id] || [];
    const wrap = $('ftGrid');
    wrap.innerHTML = '';
    for (let i = 0; i < state.setSize; i++) {
      const cell = document.createElement('div');
      let cls = 'ft-cell';
      let glyph = '·';
      if (i < shots.length) {
        if (shots[i]) { cls += ' ft-c-make'; glyph = '✓'; }
        else          { cls += ' ft-c-miss'; glyph = '✕'; }
      }
      cell.className = cls;
      cell.textContent = glyph;
      wrap.appendChild(cell);
    }
  }

  function recordShot(made) {
    const id = state.queue[state.qIdx];
    const shots = state.shots[id];
    if (shots.length >= state.setSize) return; // full
    shots.push(made);
    beep({ freq: made ? 1320 : 440, dur: 0.12, vol: 0.5 });
    updateStats(); renderGrid();
    if (shots.length >= state.setSize) {
      state.finishedIds.add(id);
      // Brief pause then advance
      setTimeout(() => nextAthlete(), 600);
    }
  }

  $('ftMakeBtn').addEventListener('click', () => recordShot(true));
  $('ftMissBtn').addEventListener('click', () => recordShot(false));
  $('ftUndoBtn').addEventListener('click', () => {
    const id = state.queue[state.qIdx];
    if (state.shots[id].length === 0) return;
    state.shots[id].pop();
    beep({ freq: 660, dur: 0.12, vol: 0.4 });
    updateStats(); renderGrid();
  });
  $('ftSkipBtn').addEventListener('click', () => {
    if (state.qIdx >= state.queue.length - 1) {
      if (confirm('End session now?')) endSession();
    } else {
      nextAthlete();
    }
  });

  function nextAthlete() {
    state.qIdx++;
    if (state.qIdx >= state.queue.length) return endSession();
    renderCurrent();
  }

  /* ------------- Results ------------- */
  function longestStreak(shots) {
    let max = 0, cur = 0;
    shots.forEach(s => { if (s) { cur++; if (cur > max) max = cur; } else cur = 0; });
    return max;
  }

  function endSession() {
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const rows = state.queue.map(id => {
      const a = state.athletes.find(x => x.id === id);
      const shots = state.shots[id] || [];
      const made = shots.filter(Boolean).length;
      const att = shots.length;
      const pct = att ? Math.round((made / att) * 100) : 0;
      const streak = longestStreak(shots);
      return { id, name: a?.name, initials: a?.initials, age: a?.age, made, att, pct, streak };
    }).sort((x, y) => y.pct - x.pct);

    $('rsAthletes').textContent = rows.length;
    $('rsSet').textContent = state.setSize;
    $('rsTop').textContent = rows.length && rows[0].att ? rows[0].pct + '%' : '—';

    const body = $('resultsBody');
    body.innerHTML = '';
    rows.forEach((r, i) => {
      const pctCls = r.pct >= 80 ? 'bnd-ex' : r.pct >= 65 ? 'bnd-good' : r.pct >= 50 ? 'bnd-avg' : 'bnd-low';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">${r.att ? '#'+(i+1) : 'DNF'}</td>
        <td class="rt-name"><span class="rt-init">${r.initials || ''}</span> ${r.name || '—'}</td>
        <td>${r.att ? `<span class="bnd ${pctCls}">${r.pct}%</span>` : '—'}</td>
        <td><b>${r.made}</b> / ${r.att}</td>
        <td><span class="streak-pill">${r.streak}</span></td>`;
      body.appendChild(tr);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const payload = state.queue.map(id => {
      const a = state.athletes.find(x => x.id === id);
      const shots = state.shots[id] || [];
      const made = shots.filter(Boolean).length;
      const att = shots.length;
      const pct = att ? Math.round((made / att) * 100) : 0;
      return { id, name: a?.name, age: a?.age, made, attempted: att, percent: pct, longestStreak: longestStreak(shots), shots };
    });
    VertexResults.save('free-throw', payload, { protocol: 'free-throw', setSize: state.setSize });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = { setSize: state.setSize, shots: state.shots };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `free-throw-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
