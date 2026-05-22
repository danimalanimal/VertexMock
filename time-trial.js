/* ===========================================================================
   Vertex Time Trial — group timer + finish-line tap
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const { fmtMMSSt, fmtMMSS, fmtPace } = window.VertexTimer;

  const CHECKLIST = [
    'Course measured + marked', 'Finish line cone visible', 'Athletes warmed up (10 min)',
    'Water at start + finish', 'Inhalers / first aid accessible', 'Coach at finish with phone',
  ];

  const DISTANCES = {
    '400': { m: 400, label: '400m', blurb: '400m — 1 lap of the track. Anaerobic threshold test.' },
    '800': { m: 800, label: '800m', blurb: '800m — 2 laps. Anaerobic / aerobic transition.' },
    '1000': { m: 1000, label: '1 km', blurb: '1 km — standard youth aerobic benchmark.' },
    '1600': { m: 1600, label: '1.6 km', blurb: '1.6 km (~1 mile) — classic aerobic benchmark.' },
    '3000': { m: 3000, label: '3 km', blurb: '3 km — sustained aerobic capacity test.' },
    '5000': { m: 5000, label: '5 km', blurb: '5 km — endurance benchmark, requires base mileage.' },
  };

  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    distM: 1000,
    distLabel: '1 km',
    course: 'track',
    finished: [],       // [{ id, name, ms, ts }]
    activeIds: [],
    timer: null,
    paused: false,
    lastFin: null,
    undoT: null,
  };

  /* ------------- Setup wiring ------------- */
  // Checklist
  $('checklist').innerHTML = CHECKLIST.map(item =>
    `<label class="check"><input type="checkbox" /><span>${item}</span></label>`).join('');

  // Distance picker
  document.querySelectorAll('.dist-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dist-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      const v = b.dataset.dist;
      if (v === 'custom') {
        $('distCustomWrap').removeAttribute('hidden');
        const m = parseInt($('customDistInput').value, 10) || 0;
        if (m >= 50) { state.distM = m; state.distLabel = m >= 1000 ? (m/1000).toFixed(m%1000?2:0)+' km' : m+'m'; }
        else { state.distM = 0; state.distLabel = 'Custom'; }
        $('distBlurb').textContent = 'Custom distance — confirm course is correctly measured.';
      } else {
        $('distCustomWrap').setAttribute('hidden', '');
        const d = DISTANCES[v];
        state.distM = d.m; state.distLabel = d.label;
        $('distBlurb').textContent = d.blurb;
      }
      refreshStart();
    });
  });
  $('customDistInput').addEventListener('input', () => {
    const m = parseInt($('customDistInput').value, 10) || 0;
    if (m >= 50) {
      state.distM = m;
      state.distLabel = m >= 1000 ? `${(m/1000).toFixed(m%1000?2:0)} km` : `${m}m`;
      $('customDistSub').textContent = state.distLabel;
    } else {
      state.distM = 0; state.distLabel = 'Custom';
      $('customDistSub').textContent = 'Enter metres';
    }
    refreshStart();
  });

  // Course
  document.querySelectorAll('.course-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.course-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.course = b.dataset.course;
    });
  });

  // Guide toggle
  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });

  // Audio + mute
  $('audioTestBtn').addEventListener('click', () => beep({ freq: 880, dur: 0.18, vol: 0.6 }));
  $('muteBtn').addEventListener('click', () => {
    const m = !isMuted(); setMuted(m);
    $('muteBtn').textContent = m ? '🔇' : '🔊';
    $('muteBtn').setAttribute('aria-pressed', m ? 'true' : 'false');
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
    const ready = n > 0 && state.distM >= 50;
    $('startBtn').disabled = !ready;
    if (n === 0)              $('startSub').textContent = 'Pick at least one athlete';
    else if (state.distM < 50) $('startSub').textContent = 'Pick a valid distance';
    else                       $('startSub').textContent = `${n} athlete${n>1?'s':''} · ${state.distLabel}`;
  }
  refreshStart();

  /* ------------- Start ------------- */
  $('startBtn').addEventListener('click', () => {
    if ($('startBtn').disabled) return;
    state.activeIds = Array.from(state.selected);
    state.finished = [];
    $('bcDist').textContent = state.distLabel;
    countdownThenStart();
  });

  function countdownThenStart() {
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    renderRunGrid(); renderOutStrip(); updateRibbon();

    let n = 3;
    $('bigClock').textContent = String(n);
    beep({ freq: 660, dur: 0.18 });
    const cd = setInterval(() => {
      n--;
      if (n > 0) {
        $('bigClock').textContent = String(n);
        beep({ freq: 660, dur: 0.18 });
      } else {
        clearInterval(cd);
        $('bigClock').textContent = '0:00.0';
        beep({ freq: 1320, dur: 0.4 });
        speak('Go');
        startTimer();
      }
    }, 1000);
  }

  function startTimer() {
    state.timer = VertexTimer.create({
      mode: 'up',
      tickHz: 10,
      onTick: ms => { $('bigClock').textContent = fmtMMSSt(ms); },
    });
    state.timer.start();
  }

  /* ------------- Run grid + finish tap ------------- */
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
        <span class="rt-tap">Tap on finish</span>`;
      tile.addEventListener('click', () => finishAthlete(id));
      wrap.appendChild(tile);
    });
  }

  function renderOutStrip() {
    const strip = $('outStrip');
    strip.innerHTML = '';
    state.finished.slice().reverse().forEach((o, i) => {
      const a = state.athletes.find(x => x.id === o.id);
      const chip = document.createElement('div');
      chip.className = 'out-chip';
      chip.style.setProperty('--accent', a?.accent || '#9bd2ff');
      const rank = state.finished.length - i; // overall finish order
      chip.innerHTML = `<span class="oc-init">#${rank}</span><span class="oc-name">${o.name}</span><span class="oc-meta">${fmtMMSSt(o.ms)}</span>`;
      strip.appendChild(chip);
    });
    $('outCount').textContent = state.finished.length;
  }

  function updateRibbon() {
    const total = state.selected.size;
    $('rbFin').textContent = `${state.finished.length} / ${total}`;
    if (state.finished.length) {
      const last = state.finished[state.finished.length - 1];
      $('rbLast').textContent = fmtMMSSt(last.ms);
      const avgMs = state.finished.reduce((s, r) => s + r.ms, 0) / state.finished.length;
      const secPerKm = (avgMs / 1000) / (state.distM / 1000);
      $('rbPace').textContent = fmtPace(secPerKm);
    } else {
      $('rbLast').textContent = '—';
      $('rbPace').textContent = '—';
    }
  }

  function finishAthlete(id) {
    const idx = state.activeIds.indexOf(id);
    if (idx < 0) return;
    const a = state.athletes.find(x => x.id === id);
    const ms = state.timer ? state.timer.getElapsed() : 0;
    state.activeIds.splice(idx, 1);
    state.finished.push({ id, name: a.name, ms, ts: Date.now() });
    state.lastFin = { id, ms };
    beep({ freq: 1320, dur: 0.18, vol: 0.6 });
    renderRunGrid(); renderOutStrip(); updateRibbon();
    showUndo(`${a.name} finished at ${fmtMMSSt(ms)}`);
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
    if (!state.lastFin) return;
    const { id } = state.lastFin;
    const i = state.finished.findIndex(o => o.id === id);
    if (i >= 0) state.finished.splice(i, 1);
    if (!state.activeIds.includes(id)) state.activeIds.push(id);
    state.lastFin = null;
    toast.setAttribute('hidden', '');
    renderRunGrid(); renderOutStrip(); updateRibbon();
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
    if (state.paused) { state.timer.resume(); state.paused = false; $('pauseBtn').textContent = '⏸ Pause'; }
    else              { state.timer.pause();  state.paused = true;  $('pauseBtn').textContent = '▶ Resume'; }
  });
  $('stopBtn').addEventListener('click', () => {
    if (state.activeIds.length === 0 || confirm('End the trial now? Athletes still on course will be marked DNF.')) endTest();
  });

  function endTest() {
    if (!state.timer) return;
    state.timer.stop();
    beep({ freq: 660, dur: 0.4 });
    speak('Trial complete');
    showResults();
  }

  /* ------------- Results ------------- */
  function showResults() {
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const ranked = state.finished.slice().sort((a, b) => a.ms - b.ms);
    const dnf = state.activeIds.map(id => {
      const a = state.athletes.find(x => x.id === id);
      return { id, name: a?.name || '—', ms: null };
    });

    $('rsDist').textContent = state.distLabel;
    $('rsBest').textContent = ranked.length ? fmtMMSSt(ranked[0].ms) : '—';
    const avgMs = ranked.length ? ranked.reduce((s, r) => s + r.ms, 0) / ranked.length : 0;
    $('rsAvg').textContent = ranked.length ? fmtMMSSt(avgMs) : '—';

    const body = $('resultsBody');
    body.innerHTML = '';
    ranked.forEach((r, i) => {
      const a = state.athletes.find(x => x.id === r.id);
      const secPerKm = (r.ms / 1000) / (state.distM / 1000);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">#${i+1}</td>
        <td class="rt-name"><span class="rt-init">${a?.initials || ''}</span> ${r.name}</td>
        <td><b>${fmtMMSSt(r.ms)}</b></td>
        <td>${fmtPace(secPerKm)}</td>`;
      body.appendChild(tr);
    });
    dnf.forEach(r => {
      const a = state.athletes.find(x => x.id === r.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rt-rank">DNF</td>
        <td class="rt-name"><span class="rt-init">${a?.initials || ''}</span> ${r.name}</td>
        <td><b>—</b></td>
        <td>—</td>`;
      body.appendChild(tr);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const payload = state.finished.map(r => {
      const a = state.athletes.find(x => x.id === r.id);
      const secPerKm = (r.ms / 1000) / (state.distM / 1000);
      return { id: r.id, name: r.name, age: a?.age, ms: r.ms, sec: r.ms/1000, secPerKm };
    });
    VertexResults.save('time-trial', payload, { protocol: 'time-trial', distanceM: state.distM, distanceLabel: state.distLabel, course: state.course });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = { distance: state.distLabel, distanceM: state.distM, course: state.course, results: state.finished };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `time-trial-${state.distM}m-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
