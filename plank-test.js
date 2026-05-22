/* ===========================================================================
   Vertex Plank Test — group plank with shared count-up timer + tap-out
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const { fmtMMSS } = window.VertexTimer;

  const CHECKLIST = [
    'Mats laid out, 1m spacing', 'Audio tested', 'Athletes warmed up (5 min)',
    'Form demo done with whole group', 'Water station ready', 'Coach watching for sag/pike',
  ];

  const MILESTONES_MS = [30000, 60000, 90000, 120000, 180000];
  const MILESTONE_LABELS = { 30000: '0:30', 60000: '1:00', 90000: '1:30', 120000: '2:00', 180000: '3:00' };

  // Age-banded plank benchmarks (seconds) — healthy youth athletes
  // [excellent, good, average, below]
  const BANDS = [
    { ageMax: 11, ex: 90,  good: 60,  avg: 30,  label: 'U12' },
    { ageMax: 13, ex: 120, good: 90,  avg: 60,  label: '12-13' },
    { ageMax: 15, ex: 150, good: 105, avg: 75,  label: '14-15' },
    { ageMax: 99, ex: 180, good: 120, avg: 90,  label: '16+' },
  ];
  function band(ageRaw, holdSec) {
    const age = ageRaw || 14;
    const b = BANDS.find(x => age <= x.ageMax) || BANDS[BANDS.length - 1];
    if (holdSec >= b.ex)   return { tag: 'Excellent',  cls: 'bnd-ex',   ref: b.label };
    if (holdSec >= b.good) return { tag: 'Good',       cls: 'bnd-good', ref: b.label };
    if (holdSec >= b.avg)  return { tag: 'Average',    cls: 'bnd-avg',  ref: b.label };
    return                       { tag: 'Below avg.', cls: 'bnd-low',  ref: b.label };
  }

  /* ------------- State ------------- */
  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    out: [],            // [{ id, name, ms, ts }]
    activeIds: [],
    startedAt: 0,
    timer: null,
    paused: false,
    lastDrop: null,
    undoT: null,
  };

  /* ------------- Setup ------------- */
  // Checklist
  $('checklist').innerHTML = CHECKLIST.map(item =>
    `<label class="check"><input type="checkbox" /><span>${item}</span></label>`).join('');

  // Roster
  const rosterApi = VertexRoster.mount({
    container: $('rosterGrid'),
    athletes: state.athletes,
    selected: state.selected,
    onChange: refreshStart,
  });
  $('selectAllBtn').addEventListener('click', () => rosterApi.selectAll());
  $('clearAllBtn').addEventListener('click', () => rosterApi.clear());

  // Guide toggle
  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });

  // Audio test + mute
  $('audioTestBtn').addEventListener('click', () => beep({ freq: 880, dur: 0.18, vol: 0.6 }));
  $('muteBtn').addEventListener('click', () => {
    const m = !isMuted(); setMuted(m);
    $('muteBtn').textContent = m ? '🔇' : '🔊';
    $('muteBtn').setAttribute('aria-pressed', m ? 'true' : 'false');
  });

  function refreshStart() {
    const n = state.selected.size;
    $('rosterCount').textContent = `${n} / ${state.athletes.length} selected`;
    $('startBtn').disabled = n === 0;
    $('startSub').textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} ready`;
  }
  refreshStart();

  /* ------------- Start ------------- */
  $('startBtn').addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.activeIds = Array.from(state.selected);
    state.out = [];
    countdownThenStart();
  });

  function countdownThenStart() {
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    renderRunGrid();
    renderOutStrip();
    updateActive();

    // 3-2-1-Hold
    let n = 3;
    $('bigClock').textContent = String(n);
    $('bigClockSub').textContent = 'get set';
    beep({ freq: 660, dur: 0.18 });
    const cd = setInterval(() => {
      n--;
      if (n > 0) {
        $('bigClock').textContent = String(n);
        beep({ freq: 660, dur: 0.18 });
      } else {
        clearInterval(cd);
        $('bigClock').textContent = '0:00';
        $('bigClockSub').textContent = 'elapsed';
        beep({ freq: 1320, dur: 0.4 });
        speak('Hold');
        startTimer();
      }
    }, 1000);
  }

  function startTimer() {
    state.startedAt = Date.now();
    state.timer = VertexTimer.create({
      mode: 'up',
      onTick: ms => {
        $('bigClock').textContent = fmtMMSS(ms);
        // next milestone
        const next = MILESTONES_MS.find(m => m > ms);
        $('rbNext').textContent = next ? MILESTONE_LABELS[next] : '—';
      },
      milestones: MILESTONES_MS,
      onMilestone: ms => {
        const label = MILESTONE_LABELS[ms] || fmtMMSS(ms);
        $('rbLast').textContent = label;
        beep({ freq: 1320, dur: 0.35, vol: 0.6 });
        speak(label.replace(':', ' '));
      },
    });
    state.timer.start();
  }

  /* ------------- Run grid ------------- */
  function renderRunGrid() {
    const wrap = $('runGrid');
    wrap.innerHTML = '';
    state.activeIds.forEach(id => {
      const a = state.athletes.find(x => x.id === id);
      if (!a) return;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'run-tile';
      tile.dataset.id = id;
      tile.style.setProperty('--accent', a.accent || '#9bd2ff');
      tile.innerHTML = `
        <span class="rt-init" aria-hidden="true">${a.initials || a.name.slice(0,2)}</span>
        <span class="rt-name">${a.name}</span>
        <span class="rt-tap">Tap to drop</span>`;
      tile.addEventListener('click', () => dropAthlete(id));
      wrap.appendChild(tile);
    });
  }

  function renderOutStrip() {
    const strip = $('outStrip');
    strip.innerHTML = '';
    state.out.slice().reverse().forEach(o => {
      const chip = document.createElement('div');
      chip.className = 'out-chip';
      const a = state.athletes.find(x => x.id === o.id);
      chip.style.setProperty('--accent', a?.accent || '#9bd2ff');
      chip.innerHTML = `<span class="oc-init">${a?.initials || ''}</span><span class="oc-name">${o.name}</span><span class="oc-meta">${fmtMMSS(o.ms)}</span>`;
      strip.appendChild(chip);
    });
    $('outCount').textContent = state.out.length;
  }

  function updateActive() {
    const total = state.selected.size;
    $('rbActive').textContent = `${state.activeIds.length} / ${total}`;
  }

  function dropAthlete(id) {
    const idx = state.activeIds.indexOf(id);
    if (idx < 0) return;
    const a = state.athletes.find(x => x.id === id);
    const ms = state.timer ? state.timer.getElapsed() : 0;
    state.activeIds.splice(idx, 1);
    state.out.push({ id, name: a.name, ms, ts: Date.now() });
    state.lastDrop = { id, ms };
    beep({ freq: 440, dur: 0.18, vol: 0.5 });
    renderRunGrid(); renderOutStrip(); updateActive();
    showUndo(`Dropped ${a.name} at ${fmtMMSS(ms)}`);
    if (state.activeIds.length === 0) endTest();
  }

  /* ------------- Undo toast (5s, iPhone-fix pattern) ------------- */
  const toast = $('undoToast');
  const undoBtn = $('undoBtn');
  let touchStartXY = null;

  function showUndo(msg) {
    $('undoMsg').textContent = msg;
    toast.removeAttribute('hidden');
    clearTimeout(state.undoT);
    state.undoT = setTimeout(() => toast.setAttribute('hidden', ''), 5000);
  }
  function doUndo() {
    if (!state.lastDrop) return;
    const { id } = state.lastDrop;
    const i = state.out.findIndex(o => o.id === id);
    if (i >= 0) state.out.splice(i, 1);
    if (!state.activeIds.includes(id)) state.activeIds.push(id);
    state.lastDrop = null;
    toast.setAttribute('hidden', '');
    renderRunGrid(); renderOutStrip(); updateActive();
    beep({ freq: 660, dur: 0.18 });
  }
  undoBtn.addEventListener('click', doUndo);
  undoBtn.addEventListener('touchstart', e => { touchStartXY = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  undoBtn.addEventListener('touchend', e => {
    if (!touchStartXY) return;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartXY.x);
    const dy = Math.abs(t.clientY - touchStartXY.y);
    touchStartXY = null;
    if (dx < 10 && dy < 10) { e.preventDefault(); doUndo(); }
  });

  /* ------------- Pause / End ------------- */
  $('pauseBtn').addEventListener('click', () => {
    if (!state.timer) return;
    if (state.paused) {
      state.timer.resume(); state.paused = false;
      $('pauseBtn').textContent = '⏸ Pause';
    } else {
      state.timer.pause(); state.paused = true;
      $('pauseBtn').textContent = '▶ Resume';
    }
  });
  $('stopBtn').addEventListener('click', () => {
    if (state.activeIds.length === 0 || confirm('End the test now? Athletes still holding will record their current time.')) {
      endTest();
    }
  });

  function endTest() {
    if (!state.timer) return;
    const finalMs = state.timer.getElapsed();
    state.timer.stop();
    // Athletes still in record their final hold
    state.activeIds.forEach(id => {
      const a = state.athletes.find(x => x.id === id);
      if (a) state.out.push({ id, name: a.name, ms: finalMs, ts: Date.now(), heldToEnd: true });
    });
    state.activeIds = [];
    beep({ freq: 660, dur: 0.4 });
    speak('Test complete');
    showResults();
  }

  /* ------------- Results ------------- */
  function showResults() {
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    // Sort by hold descending
    const ranked = state.out.slice().sort((a, b) => b.ms - a.ms);

    $('rsAthletes').textContent = ranked.length;
    $('rsBest').textContent = ranked.length ? fmtMMSS(ranked[0].ms) : '—';
    const avgMs = ranked.length ? ranked.reduce((s, r) => s + r.ms, 0) / ranked.length : 0;
    $('rsAvg').textContent = fmtMMSS(avgMs);

    const body = $('resultsBody');
    body.innerHTML = '';
    ranked.forEach((r, i) => {
      const a = state.athletes.find(x => x.id === r.id);
      const sec = Math.round(r.ms / 1000);
      const b = band(a?.age, sec);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">#${i+1}</td>
        <td class="rt-name"><span class="rt-init">${a?.initials || ''}</span> ${r.name}${r.heldToEnd ? ' <span class="rt-flag">held to end</span>' : ''}</td>
        <td><b>${fmtMMSS(r.ms)}</b></td>
        <td><span class="bnd ${b.cls}">${b.tag}</span><span class="bnd-ref">${b.ref}</span></td>`;
      body.appendChild(tr);
    });
  }

  /* ------------- Result actions ------------- */
  $('saveBtn').addEventListener('click', () => {
    const payload = state.out.map(r => {
      const a = state.athletes.find(x => x.id === r.id);
      const sec = Math.round(r.ms / 1000);
      return { id: r.id, name: r.name, age: a?.age, holdSec: sec, holdMs: r.ms, heldToEnd: !!r.heldToEnd, band: band(a?.age, sec).tag };
    });
    VertexResults.save('plank', payload, { protocol: 'plank' });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = state.out.map(r => ({ name: r.name, ms: r.ms, sec: Math.round(r.ms/1000), heldToEnd: !!r.heldToEnd }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `plank-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
