/* ===========================================================================
   Vertex Beep Test Runner
   Multi-stage fitness test (20 m MSFT). Web Audio synth, no asset deps.
   Cadence table is the standard Léger protocol approximation.
   =========================================================================== */
(() => {
  'use strict';

  // ----------------------------- Cadence table -----------------------------
  // 21 levels (enough for elite); each level: { speed km/h, shuttles, secs/shuttle }.
  // Standard 20 m beep test, derived: shuttleSecs = (20 / (speed * 1000 / 3600)).
  const LEVELS = [
    { spd: 8.0,  sh: 7  },
    { spd: 9.0,  sh: 8  },
    { spd: 9.5,  sh: 8  },
    { spd: 10.0, sh: 9  },
    { spd: 10.5, sh: 9  },
    { spd: 11.0, sh: 10 },
    { spd: 11.5, sh: 10 },
    { spd: 12.0, sh: 11 },
    { spd: 12.5, sh: 11 },
    { spd: 13.0, sh: 11 },
    { spd: 13.5, sh: 12 },
    { spd: 14.0, sh: 12 },
    { spd: 14.5, sh: 13 },
    { spd: 15.0, sh: 13 },
    { spd: 15.5, sh: 13 },
    { spd: 16.0, sh: 14 },
    { spd: 16.5, sh: 14 },
    { spd: 17.0, sh: 15 },
    { spd: 17.5, sh: 15 },
    { spd: 18.0, sh: 16 },
    { spd: 18.5, sh: 16 },
  ].map(L => ({ ...L, secs: +(20 / (L.spd * 1000 / 3600)).toFixed(3) }));

  // ----------------------------- State --------------------------------------
  const state = {
    screen: 'setup',           // setup | run | results
    roster: [],                // [athleteId]
    selected: new Set(),       // ids picked for the session
    active: new Set(),         // ids still running
    out: [],                   // [{id, level, shuttle, laps}] in elimination order
    levelIdx: 0,
    shuttle: 0,
    totalLaps: 0,
    startMs: 0,
    pausedFor: 0,
    pausedAt: 0,
    paused: false,
    muted: false,
    audioCtx: null,
    timeoutId: null,
    undoStack: [],             // for last-drop undo
  };

  // ----------------------------- DOM -----------------------------------------
  const $ = sel => document.querySelector(sel);
  const setupScreen = $('#setupScreen');
  const runScreen   = $('#runScreen');
  const resScreen   = $('#resultsScreen');
  const rosterGrid  = $('#rosterGrid');
  const rosterCount = $('#rosterCount');
  const startBtn    = $('#startBtn');
  const startSub    = $('#startSub');
  const muteBtn     = $('#muteBtn');
  const guideToggle = $('#guideToggle');
  const guideBody   = $('#guideBody');
  const audioTest   = $('#audioTestBtn');

  const hudLevel    = $('#hudLevel');
  const hudShuttle  = $('#hudShuttle');
  const hudTime     = $('#hudTime');
  const hudActive   = $('#hudActive');
  const rbSpeed     = $('#rbSpeed');
  const rbPace      = $('#rbPace');
  const rbNext      = $('#rbNext');
  const runGrid     = $('#runGrid');
  const outStrip    = $('#outStrip');
  const outCount    = $('#outCount');
  const pauseBtn    = $('#pauseBtn');
  const stopBtn     = $('#stopBtn');
  const undoToast   = $('#undoToast');
  const undoMsg     = $('#undoMsg');
  const undoBtn     = $('#undoBtn');

  const rsAthletes  = $('#rsAthletes');
  const rsMax       = $('#rsMax');
  const rsDur       = $('#rsDur');
  const resBody     = $('#resultsBody');
  const saveBtn     = $('#saveBtn');
  const againBtn    = $('#againBtn');
  const exportBtn   = $('#exportBtn');
  const saveToast   = $('#saveToast');

  // ----------------------------- Audio -------------------------------------
  function ensureCtx() {
    if (!state.audioCtx) {
      try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return state.audioCtx;
  }
  function beep({ freq = 880, dur = 0.18, vol = 0.5 } = {}) {
    if (state.muted) return;
    const ctx = ensureCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }
  function speak(text) {
    if (state.muted || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05; u.pitch = 1.0; u.volume = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // ----------------------------- Roster (setup) -----------------------------
  function loadRoster() {
    const D = window.BoxerData;
    if (!D || !D.athletes) { rosterGrid.innerHTML = '<p style="opacity:.6">Athlete data not loaded.</p>'; return; }
    state.roster = D.athletes.map(a => a);
    rosterGrid.innerHTML = '';
    state.roster.forEach(a => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'roster-chip';
      chip.dataset.id = a.id;
      chip.style.setProperty('--accent', a.accent || '#9bd2ff');
      chip.innerHTML = `
        <span class="rc-mono" aria-hidden="true">${a.initials || a.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</span>
        <span class="rc-name">${a.name}</span>
        <span class="rc-meta">${a.ageGroup || a.level}</span>
      `;
      chip.addEventListener('click', () => toggleSelect(a.id, chip));
      rosterGrid.appendChild(chip);
    });
    updateRosterCount();
  }
  function toggleSelect(id, chip) {
    if (state.selected.has(id)) { state.selected.delete(id); chip.classList.remove('on'); }
    else { state.selected.add(id); chip.classList.add('on'); }
    updateRosterCount();
  }
  function updateRosterCount() {
    const n = state.selected.size, total = state.roster.length;
    rosterCount.textContent = `${n} / ${total} selected`;
    startBtn.disabled = n === 0;
    startSub.textContent = n === 0 ? 'Pick at least one athlete' : `${n} athlete${n>1?'s':''} ready · tap to begin`;
  }
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    rosterGrid.querySelectorAll('.roster-chip').forEach(chip => {
      chip.classList.add('on'); state.selected.add(chip.dataset.id);
    });
    updateRosterCount();
  });
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    rosterGrid.querySelectorAll('.roster-chip').forEach(chip => chip.classList.remove('on'));
    state.selected.clear();
    updateRosterCount();
  });

  // Guide collapse
  guideToggle.addEventListener('click', () => {
    const expanded = guideToggle.getAttribute('aria-expanded') === 'true';
    guideToggle.setAttribute('aria-expanded', String(!expanded));
    guideToggle.textContent = expanded ? 'Show' : 'Hide';
    guideBody.hidden = expanded;
  });

  // Audio test
  audioTest.addEventListener('click', () => beep({ freq: 880, dur: 0.25, vol: 0.55 }));

  // Mute
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(state.muted));
  });

  // ----------------------------- Start session -----------------------------
  startBtn.addEventListener('click', () => {
    if (state.selected.size === 0) return;
    state.active = new Set(state.selected);
    state.out = [];
    state.levelIdx = 0;
    state.shuttle = 0;
    state.totalLaps = 0;
    state.pausedFor = 0;
    state.paused = false;
    state.undoStack = [];

    setupScreen.hidden = true;
    runScreen.hidden = false;
    state.screen = 'run';
    renderRunGrid();
    renderOutStrip();
    updateHud();
    countdownThenStart();
  });

  function countdownThenStart() {
    let n = 3;
    speak('Get ready');
    hudLevel.textContent = n;
    hudShuttle.textContent = '—';
    const tick = () => {
      if (n <= 0) {
        hudLevel.textContent = '1';
        hudShuttle.textContent = '0';
        speak('Level 1');
        beep({ freq: 1320, dur: 0.35, vol: 0.6 });
        state.startMs = performance.now();
        scheduleNextShuttle();
        return;
      }
      beep({ freq: 600, dur: 0.15, vol: 0.4 });
      hudLevel.textContent = n;
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  // ----------------------------- Loop --------------------------------------
  function scheduleNextShuttle() {
    if (state.paused) return;
    const lvl = LEVELS[state.levelIdx];
    if (!lvl) { return endSession(); }
    state.timeoutId = setTimeout(() => {
      onShuttleBeep();
      scheduleNextShuttle();
    }, lvl.secs * 1000);
  }
  function onShuttleBeep() {
    state.shuttle += 1;
    state.totalLaps += 1;
    const lvl = LEVELS[state.levelIdx];
    if (state.shuttle >= lvl.sh) {
      // level up
      state.levelIdx += 1;
      state.shuttle = 0;
      const newLvl = state.levelIdx + 1;
      beep({ freq: 1320, dur: 0.45, vol: 0.65 });
      speak(`Level ${newLvl}`);
    } else {
      beep({ freq: 880, dur: 0.16, vol: 0.5 });
    }
    updateHud();
    if (state.active.size === 0) endSession();
  }
  function updateHud() {
    const lvl = LEVELS[state.levelIdx] || LEVELS[LEVELS.length-1];
    hudLevel.textContent = String(state.levelIdx + 1);
    hudShuttle.textContent = `${state.shuttle} / ${lvl.sh}`;
    hudActive.textContent  = `${state.active.size} / ${state.selected.size}`;
    rbSpeed.textContent = `${lvl.spd.toFixed(1)} km/h`;
    rbPace.textContent  = `${lvl.secs.toFixed(2)} s/shuttle`;
    rbNext.textContent  = `${lvl.sh - state.shuttle} to go`;
    hudTime.textContent = fmtElapsed();
  }
  function fmtElapsed() {
    if (!state.startMs) return '0:00';
    const ms = (state.paused ? state.pausedAt : performance.now()) - state.startMs - state.pausedFor;
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }
  setInterval(() => { if (state.screen === 'run') hudTime.textContent = fmtElapsed(); }, 250);

  // ----------------------------- Active grid -------------------------------
  function renderRunGrid() {
    runGrid.innerHTML = '';
    state.roster.filter(a => state.active.has(a.id)).forEach(a => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'run-tile';
      tile.dataset.id = a.id;
      tile.style.setProperty('--accent', a.accent || '#9bd2ff');
      tile.innerHTML = `
        <span class="rt-init">${a.initials || a.name.slice(0,2)}</span>
        <span class="rt-name">${a.name}</span>
        <span class="rt-hint">tap when done</span>
      `;
      tile.addEventListener('click', () => dropAthlete(a.id));
      runGrid.appendChild(tile);
    });
  }
  function renderOutStrip() {
    outStrip.innerHTML = '';
    state.out.forEach((rec, i) => {
      const a = state.roster.find(x => x.id === rec.id);
      if (!a) return;
      const chip = document.createElement('div');
      chip.className = 'out-chip';
      chip.style.setProperty('--accent', a.accent || '#9bd2ff');
      chip.innerHTML = `
        <span class="oc-rank">#${state.out.length - i}</span>
        <span class="oc-init">${a.initials || a.name.slice(0,2)}</span>
        <span class="oc-name">${a.name}</span>
        <span class="oc-score">L${rec.level}·${rec.shuttle}</span>
      `;
      outStrip.appendChild(chip);
    });
    outCount.textContent = String(state.out.length);
  }
  function dropAthlete(id) {
    if (!state.active.has(id)) return;
    const a = state.roster.find(x => x.id === id);
    const rec = {
      id,
      level: state.levelIdx + 1,
      shuttle: state.shuttle,
      laps: state.totalLaps,
    };
    state.active.delete(id);
    state.out.unshift(rec);
    state.undoStack.push(rec);
    beep({ freq: 440, dur: 0.12, vol: 0.35 });
    renderRunGrid();
    renderOutStrip();
    updateHud();
    showUndo(`Dropped ${a.name} at L${rec.level}·${rec.shuttle}`);
    if (state.active.size === 0) {
      setTimeout(endSession, 600);
    }
  }
  function showUndo(msg) {
    undoMsg.textContent = msg;
    undoToast.hidden = false;
    clearTimeout(showUndo._t);
    showUndo._t = setTimeout(() => { undoToast.hidden = true; }, 5000);
  }
  function doUndo(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const rec = state.undoStack.pop();
    if (!rec) { undoToast.hidden = true; return; }
    state.active.add(rec.id);
    state.out = state.out.filter(r => r !== rec);
    renderRunGrid();
    renderOutStrip();
    updateHud();
    clearTimeout(showUndo._t);
    undoToast.hidden = true;
  }
  undoBtn.addEventListener('click', doUndo);
  // iOS fast-tap: fire on touchend before the 300ms click delay can lose the tap
  undoBtn.addEventListener('touchend', (e) => {
    // only treat as a tap if the touch didn’t move (i.e. not a scroll)
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || !undoBtn._touchStart) return doUndo(e);
    const dx = Math.abs(t.clientX - undoBtn._touchStart.x);
    const dy = Math.abs(t.clientY - undoBtn._touchStart.y);
    if (dx < 10 && dy < 10) doUndo(e);
  }, { passive: false });
  undoBtn.addEventListener('touchstart', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) undoBtn._touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  // ----------------------------- Pause / Stop ------------------------------
  pauseBtn.addEventListener('click', () => {
    if (state.screen !== 'run') return;
    if (!state.paused) {
      state.paused = true;
      state.pausedAt = performance.now();
      clearTimeout(state.timeoutId);
      pauseBtn.textContent = '▶ Resume';
      pauseBtn.classList.add('on');
    } else {
      state.paused = false;
      state.pausedFor += performance.now() - state.pausedAt;
      pauseBtn.textContent = '⏸ Pause';
      pauseBtn.classList.remove('on');
      scheduleNextShuttle();
    }
  });
  stopBtn.addEventListener('click', () => {
    if (state.screen !== 'run') return;
    // any remaining active athletes get logged at current level/shuttle
    state.roster.filter(a => state.active.has(a.id)).forEach(a => {
      state.out.unshift({
        id: a.id,
        level: state.levelIdx + 1,
        shuttle: state.shuttle,
        laps: state.totalLaps,
      });
    });
    state.active.clear();
    endSession();
  });

  // ----------------------------- End / Results -----------------------------
  function endSession() {
    clearTimeout(state.timeoutId);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    beep({ freq: 660, dur: 0.6, vol: 0.5 });
    setTimeout(() => beep({ freq: 880, dur: 0.6, vol: 0.5 }), 250);

    runScreen.hidden = true;
    resScreen.hidden = false;
    state.screen = 'results';
    renderResults();
  }
  function vo2max(level, age) {
    // Léger 20 m MSFT formula (approximation using level only)
    const speed = LEVELS[Math.min(level-1, LEVELS.length-1)].spd;
    const v = 31.025 + 3.238 * speed - 3.248 * age + 0.1536 * age * speed;
    return Math.round(v * 10) / 10;
  }
  function renderResults() {
    rsAthletes.textContent = state.selected.size;
    const maxL = Math.max(...state.out.map(r => r.level), 0);
    rsMax.textContent = `L${maxL}`;
    rsDur.textContent = fmtElapsed();

    // sort by level desc, shuttle desc
    const ranked = [...state.out].sort((a,b) => b.level - a.level || b.shuttle - a.shuttle);
    resBody.innerHTML = '';
    ranked.forEach((r, i) => {
      const a = state.roster.find(x => x.id === r.id);
      const tr = document.createElement('tr');
      tr.style.setProperty('--accent', a.accent || '#9bd2ff');
      tr.innerHTML = `
        <td class="rt-rank">#${i+1}</td>
        <td class="rt-name"><span class="rt-init">${a.initials || a.name.slice(0,2)}</span> ${a.name}</td>
        <td>${r.level}</td>
        <td>${r.shuttle}</td>
        <td>${r.laps}</td>
        <td><b>${vo2max(r.level, a.age || 14)}</b><span class="rt-unit"> ml/kg/min</span></td>
      `;
      resBody.appendChild(tr);
    });
  }

  saveBtn.addEventListener('click', () => {
    // persist to window so dashboard mockup can pick it up
    const payload = state.out.map(r => {
      const a = state.roster.find(x => x.id === r.id);
      return {
        id: r.id,
        name: a.name,
        level: r.level,
        shuttle: r.shuttle,
        laps: r.laps,
        vo2max: vo2max(r.level, a.age || 14),
        ts: Date.now(),
      };
    });
    window.__beepResults = payload;
    try { localStorage.setItem('vertex.beepResults', JSON.stringify(payload)); } catch {}
    saveToast.hidden = false;
    setTimeout(() => { saveToast.hidden = true; }, 2400);
  });

  againBtn.addEventListener('click', () => {
    state.selected = new Set();
    state.active = new Set();
    state.out = [];
    state.levelIdx = 0;
    state.shuttle = 0;
    resScreen.hidden = true;
    setupScreen.hidden = false;
    state.screen = 'setup';
    rosterGrid.querySelectorAll('.roster-chip').forEach(c => c.classList.remove('on'));
    updateRosterCount();
  });

  exportBtn.addEventListener('click', () => {
    const payload = JSON.stringify(window.__beepResults || state.out, null, 2);
    navigator.clipboard?.writeText(payload).then(() => {
      saveToast.querySelector('.bt-msg').textContent = 'JSON copied to clipboard';
      saveToast.hidden = false;
      setTimeout(() => { saveToast.hidden = true; }, 2200);
    }).catch(() => alert(payload));
  });

  // ----------------------------- Boot ---------------------------------------
  document.addEventListener('DOMContentLoaded', loadRoster);
  if (document.readyState !== 'loading') loadRoster();
})();
