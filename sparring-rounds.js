/* ===========================================================================
   Vertex Sparring Rounds — work/rest cycle timer with event log
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const { fmtMMSS } = window.VertexTimer;

  const $ = id => document.getElementById(id);

  const state = {
    workSec: 180,
    restSec: 60,
    rounds: 3,
    currentRound: 1,      // 1-indexed
    phase: 'work',        // 'work' | 'rest' | 'idle' | 'done'
    timer: null,
    countdownT: null,
    totalElapsed: 0,      // ms across all phases
    phaseStart: 0,
    paused: false,
    events: [],           // { round, phase, type, atMs (elapsed in phase) }
    tenSecPlayed: false,
  };

  /* ------------- Setup ------------- */
  function updateSummary() {
    const work = state.workSec >= 60 ? `${state.workSec/60} min` : `${state.workSec}s`;
    const rest = state.restSec >= 60 ? `${state.restSec/60} min` : `${state.restSec}s`;
    $('confSummary').textContent = `${state.rounds} × ${work} work / ${rest} rest.`;
    $('startSub').textContent    = `${state.rounds} × ${work} · ${rest} rest`;
  }
  document.querySelectorAll('.dur-btn[data-work]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn[data-work]').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.workSec = parseInt(b.dataset.work, 10);
      updateSummary();
    });
  });
  document.querySelectorAll('.dur-btn[data-rest]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn[data-rest]').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.restSec = parseInt(b.dataset.rest, 10);
      updateSummary();
    });
  });
  document.querySelectorAll('.set-btn[data-rounds]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.set-btn[data-rounds]').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.rounds = parseInt(b.dataset.rounds, 10);
      updateSummary();
    });
  });
  updateSummary();

  $('guideToggle').addEventListener('click', () => {
    const body = $('guideBody');
    const open = !body.hasAttribute('hidden');
    if (open) { body.setAttribute('hidden', ''); $('guideToggle').textContent = 'Show'; $('guideToggle').setAttribute('aria-expanded', 'false'); }
    else      { body.removeAttribute('hidden');  $('guideToggle').textContent = 'Hide'; $('guideToggle').setAttribute('aria-expanded', 'true'); }
  });
  $('muteBtn').addEventListener('click', () => {
    const m = !isMuted(); setMuted(m);
    $('muteBtn').textContent = m ? '🔇' : '🔊';
    $('muteBtn').setAttribute('aria-pressed', m ? 'true' : 'false');
  });

  /* ------------- Start session ------------- */
  $('startBtn').addEventListener('click', () => {
    state.currentRound = 1;
    state.phase = 'idle';
    state.events = [];
    state.totalElapsed = 0;
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    $('spRound').textContent = `1 / ${state.rounds}`;
    $('spPhase').textContent = 'READY';
    $('spTotal').textContent = '0:00';
    $('rhSub').textContent = `Round 1 of ${state.rounds}`;
    $('spEvtLog').innerHTML = '';
    countdownToStart();
  });

  function countdownToStart() {
    let n = 3;
    setHud('ready', String(n), 'GET READY');
    beep({ freq: 660, dur: 0.18 });
    state.countdownT = setInterval(() => {
      n--;
      if (n > 0) {
        $('rhClock').textContent = String(n);
        beep({ freq: 660, dur: 0.18 });
      } else {
        clearInterval(state.countdownT); state.countdownT = null;
        beep({ freq: 1320, dur: 0.5 });
        speak('Box');
        startPhase('work');
      }
    }, 1000);
  }

  /* ------------- Phase machine ------------- */
  function setHud(stateName, clockTxt, subTxt) {
    const hud = $('roundHud');
    hud.classList.remove('rh-work', 'rh-rest', 'rh-ready', 'rh-done');
    hud.classList.add('rh-' + stateName);
    $('rhState').textContent = stateName === 'ready' ? 'READY' : stateName === 'work' ? 'WORK' : stateName === 'rest' ? 'REST' : 'DONE';
    if (clockTxt !== undefined) $('rhClock').textContent = clockTxt;
    if (subTxt !== undefined)   $('rhSub').textContent = subTxt;
  }

  function startPhase(phase) {
    state.phase = phase;
    state.tenSecPlayed = false;
    const durSec = phase === 'work' ? state.workSec : state.restSec;
    state.phaseStart = state.totalElapsed;
    setHud(phase, fmtMMSS(durSec * 1000), `Round ${state.currentRound} of ${state.rounds}`);
    $('spPhase').textContent = phase === 'work' ? 'WORK' : 'REST';
    $('spRound').textContent = `${state.currentRound} / ${state.rounds}`;

    state.timer = VertexTimer.create({
      mode: 'down',
      startMs: durSec * 1000,
      tickHz: 10,
      onTick: ms => {
        $('rhClock').textContent = fmtMMSS(ms);
        const totalMs = state.phaseStart + (durSec * 1000 - ms);
        $('spTotal').textContent = fmtMMSS(totalMs);
        // 10s warning
        if (!state.tenSecPlayed && ms <= 10000 && ms > 9000) {
          state.tenSecPlayed = true;
          beep({ freq: 660, dur: 0.35, vol: 0.5 });
        }
      },
      onComplete: () => {
        const justFinished = durSec * 1000;
        state.totalElapsed += justFinished;
        // Phase-end bell
        beep({ freq: 880, dur: 0.7 });
        if (phase === 'work') {
          // After work: rest, unless this was the final round
          if (state.currentRound >= state.rounds) {
            endSession();
            return;
          }
          speak('Rest');
          startPhase('rest');
        } else {
          // After rest: next work round
          state.currentRound++;
          speak('Box');
          beep({ freq: 1320, dur: 0.4 });
          startPhase('work');
        }
      },
    });
    state.timer.start();
  }

  /* ------------- Pause / stop ------------- */
  $('pauseBtn').addEventListener('click', () => {
    if (!state.timer) return;
    if (state.paused) {
      state.timer.resume();
      state.paused = false;
      $('pauseBtn').textContent = '⏸ Pause';
    } else {
      state.timer.pause();
      state.paused = true;
      $('pauseBtn').textContent = '▶ Resume';
    }
  });

  $('stopBtn').addEventListener('click', () => {
    if (!confirm('End the session now?')) return;
    // capture partial phase elapsed
    if (state.timer) {
      const remaining = state.timer.getRemaining();
      const phaseDurMs = (state.phase === 'work' ? state.workSec : state.restSec) * 1000;
      state.totalElapsed += (phaseDurMs - remaining);
    }
    endSession();
  });

  /* ------------- Event log ------------- */
  document.querySelectorAll('.sp-evt').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (state.phase !== 'work' && state.phase !== 'rest') return;
      const type = btn.dataset.evt;
      const phaseDurMs = (state.phase === 'work' ? state.workSec : state.restSec) * 1000;
      const remaining = state.timer ? state.timer.getRemaining() : phaseDurMs;
      const atMs = phaseDurMs - remaining;
      const evt = { round: state.currentRound, phase: state.phase, type, atMs };
      state.events.push(evt);
      // Add to live log
      const item = document.createElement('div');
      item.className = 'sp-evt-item';
      const label = { knockdown: '🥊 Knockdown', standing8: '⏱ Standing 8', warning: '⚠️ Warning', note: '★ Note' }[type] || type;
      item.innerHTML = `<span class="sel-rd">R${state.currentRound}</span><span class="sel-time">${fmtMMSS(atMs)}</span><span class="sel-type">${label}</span>`;
      $('spEvtLog').prepend(item);
      btn.classList.add('tapped');
      setTimeout(() => btn.classList.remove('tapped'), 120);
      beep({ freq: 440, dur: 0.1, vol: 0.4 });
    });
    btn.addEventListener('click', e => e.preventDefault());
  });

  /* ------------- End session ------------- */
  function endSession() {
    if (state.timer) state.timer.stop();
    if (state.countdownT) clearInterval(state.countdownT);
    state.timer = null;
    state.phase = 'done';
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    $('rsRounds').textContent = `${state.currentRound > state.rounds ? state.rounds : state.currentRound}`;
    $('rsTime').textContent   = fmtMMSS(state.totalElapsed);
    $('rsEvents').textContent = String(state.events.length);

    // Per-round breakdown
    const body = $('resultsBody');
    body.innerHTML = '';
    const totalRounds = state.currentRound > state.rounds ? state.rounds : state.currentRound;
    for (let r = 1; r <= totalRounds; r++) {
      const evts = state.events.filter(e => e.round === r);
      const evtTxt = evts.length === 0 ? '—' : evts.map(e => {
        const sym = { knockdown:'🥊', standing8:'⏱', warning:'⚠️', note:'★' }[e.type] || '·';
        return sym;
      }).join(' ');
      const workTxt = state.workSec >= 60 ? `${state.workSec/60}m` : `${state.workSec}s`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r}</td><td>${workTxt}</td><td>${evtTxt}</td>`;
      body.appendChild(tr);
    }
  }

  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = {
      protocol: 'sparring-rounds',
      workSec: state.workSec,
      restSec: state.restSec,
      rounds: state.rounds,
      completedRounds: state.currentRound > state.rounds ? state.rounds : state.currentRound,
      totalElapsedMs: state.totalElapsed,
      events: state.events,
      ts: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = `sparring-${Date.now()}.json`; dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
