/* ===========================================================================
   Vertex Punches Per Minute — single-athlete tap counter
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const { fmtMMSS } = window.VertexTimer;

  const $ = id => document.getElementById(id);
  const state = {
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    durationSec: 60,
    punches: [],     // [{ msSinceStart, ts }]
    timer: null,
    countdownT: null,
    finalCountdownDone: new Set(),
    halfwayPlayed: false,
  };

  const DUR_BLURBS = {
    '30':  '30s — sprint round, used to test peak punch output.',
    '60':  '60s — standard Punches Per Minute test, used in boxing combine.',
    '120': '2 min — extended test, includes anaerobic capacity component.',
    '180': '3 min — full round duration, mirrors competition pacing.',
  };

  /* ------------- Setup ------------- */
  document.querySelectorAll('.dur-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.durationSec = parseInt(b.dataset.dur, 10);
      $('durBlurb').textContent = DUR_BLURBS[String(state.durationSec)] || '';
    });
  });

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

  // Single-select roster
  const rosterApi = VertexRoster.mount({
    container: $('rosterGrid'),
    athletes: state.athletes,
    selected: state.selected,
    onChange: () => {
      // Enforce single selection
      if (state.selected.size > 1) {
        const arr = Array.from(state.selected);
        const keep = arr[arr.length - 1];
        state.selected.clear();
        state.selected.add(keep);
        // Re-render selection
        document.querySelectorAll('#rosterGrid .roster-chip').forEach(c => {
          c.classList.toggle('on', c.dataset.id === keep);
        });
      }
      refreshStart();
    },
  });

  function refreshStart() {
    const n = state.selected.size;
    $('startBtn').disabled = n === 0;
    if (n === 0) $('startSub').textContent = 'Pick an athlete';
    else {
      const id = Array.from(state.selected)[0];
      const a = state.athletes.find(x => x.id === id);
      $('startSub').textContent = `${a?.name || ''} · ${state.durationSec}s round`;
    }
  }
  refreshStart();

  /* ------------- Start ------------- */
  $('startBtn').addEventListener('click', () => {
    if (state.selected.size === 0) return;
    countdownThenStart();
  });

  function countdownThenStart() {
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    state.punches = [];
    state.finalCountdownDone.clear();
    state.halfwayPlayed = false;
    $('ppmCount').textContent = '0';
    $('tzCount').textContent = '0';
    $('ppmPace').textContent = '—';
    $('ppmClock').textContent = fmtMMSS(state.durationSec * 1000);

    let n = 3;
    $('tzCount').textContent = String(n);
    beep({ freq: 660, dur: 0.18 });
    state.countdownT = setInterval(() => {
      n--;
      if (n > 0) {
        $('tzCount').textContent = String(n);
        beep({ freq: 660, dur: 0.18 });
      } else {
        clearInterval(state.countdownT);
        $('tzCount').textContent = '0';
        beep({ freq: 1320, dur: 0.4 });
        speak('Go');
        startTimer();
      }
    }, 1000);
  }

  function startTimer() {
    state.timer = VertexTimer.create({
      mode: 'down',
      startMs: state.durationSec * 1000,
      tickHz: 10,
      onTick: ms => {
        $('ppmClock').textContent = fmtMMSS(ms);
        // Halfway beep
        if (!state.halfwayPlayed && ms <= (state.durationSec * 500)) {
          state.halfwayPlayed = true;
          beep({ freq: 1320, dur: 0.25, vol: 0.5 });
        }
        // Final 10s countdown
        const secLeft = Math.ceil(ms / 1000);
        if (secLeft <= 10 && secLeft >= 1 && !state.finalCountdownDone.has(secLeft)) {
          state.finalCountdownDone.add(secLeft);
          beep({ freq: 660, dur: 0.12, vol: 0.5 });
        }
        // Live PPM pace
        const elapsedSec = state.durationSec - ms / 1000;
        if (elapsedSec > 1) {
          const pace = Math.round((state.punches.length / elapsedSec) * 60);
          $('ppmPace').textContent = pace + ' ppm';
        }
      },
      onComplete: () => {
        beep({ freq: 880, dur: 0.6 });
        speak('Time');
        endRound();
      },
    });
    state.timer.start();
  }

  /* ------------- Tap counter ------------- */
  function recordPunch() {
    if (!state.timer || !state.timer.isRunning()) return;
    const elapsedMs = (state.durationSec * 1000) - state.timer.getRemaining();
    state.punches.push({ ms: elapsedMs, ts: Date.now() });
    const n = state.punches.length;
    $('ppmCount').textContent = n;
    $('tzCount').textContent = n;
  }

  const tapZone = $('tapZone');
  // Use pointerdown for instant response (faster than click)
  tapZone.addEventListener('pointerdown', e => {
    e.preventDefault();
    recordPunch();
    tapZone.classList.add('tapped');
    setTimeout(() => tapZone.classList.remove('tapped'), 80);
  });
  // Prevent double-count via click after pointerdown
  tapZone.addEventListener('click', e => e.preventDefault());

  $('undoLastBtn').addEventListener('click', () => {
    if (state.punches.length === 0) return;
    state.punches.pop();
    const n = state.punches.length;
    $('ppmCount').textContent = n;
    $('tzCount').textContent = n;
    beep({ freq: 440, dur: 0.12, vol: 0.4 });
  });

  $('stopBtn').addEventListener('click', () => {
    if (confirm('End the round now?')) endRound();
  });

  /* ------------- End + Results ------------- */
  function endRound() {
    if (state.timer) state.timer.stop();
    if (state.countdownT) clearInterval(state.countdownT);
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const id = Array.from(state.selected)[0];
    const a = state.athletes.find(x => x.id === id);
    const total = state.punches.length;
    const ppm = Math.round((total / state.durationSec) * 60);

    $('rsAthlete').textContent = a?.name || '—';
    $('rsTotal').textContent = String(total);
    $('rsPpm').textContent = ppm + ' ppm';

    // 10s splits
    const splitsCount = Math.ceil(state.durationSec / 10);
    const splits = new Array(splitsCount).fill(0);
    state.punches.forEach(p => {
      const idx = Math.min(splitsCount - 1, Math.floor((p.ms / 1000) / 10));
      splits[idx]++;
    });
    const maxSplit = Math.max(1, ...splits);

    const wrap = $('ppmSplits');
    wrap.innerHTML = '';
    splits.forEach((cnt, i) => {
      const start = i * 10;
      const end = Math.min(state.durationSec, (i+1) * 10);
      const pct = Math.round((cnt / maxSplit) * 100);
      const item = document.createElement('div');
      item.className = 'split-row';
      item.innerHTML = `
        <span class="sr-label">${start}-${end}s</span>
        <div class="sr-bar-wrap"><div class="sr-bar" style="width:${pct}%"></div></div>
        <span class="sr-val">${cnt}</span>`;
      wrap.appendChild(item);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const id = Array.from(state.selected)[0];
    const a = state.athletes.find(x => x.id === id);
    const total = state.punches.length;
    const ppm = Math.round((total / state.durationSec) * 60);
    const payload = [{
      id, name: a?.name, age: a?.age,
      total, ppm, durationSec: state.durationSec,
      punches: state.punches.map(p => p.ms),
    }];
    VertexResults.save('ppm', payload, { protocol: 'ppm', durationSec: state.durationSec });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const id = Array.from(state.selected)[0];
    const a = state.athletes.find(x => x.id === id);
    const data = { athlete: a?.name, durationSec: state.durationSec, total: state.punches.length, punches: state.punches };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = `ppm-${Date.now()}.json`; dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
