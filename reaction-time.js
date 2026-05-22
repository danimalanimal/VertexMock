/* ===========================================================================
   Vertex Reaction Time — random GO stimulus, ms precision
   States: idle → wait (red) → go (green) → result → next | done
   Early tap during wait = failed trial, restart.
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const $ = id => document.getElementById(id);

  const state = {
    trialsTarget: 5,
    trialNumber: 0,         // 1-indexed during run
    trials: [],             // { ms, status: 'ok' | 'early' }
    phase: 'idle',          // 'idle' | 'wait' | 'go' | 'result' | 'done'
    waitT: null,
    goStartedAt: 0,         // performance.now() when GO appeared
  };

  /* ------------- Setup ------------- */
  document.querySelectorAll('.set-btn[data-trials]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.set-btn[data-trials]').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.trialsTarget = parseInt(b.dataset.trials, 10);
      $('startSub').textContent = `${state.trialsTarget} trials`;
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

  /* ------------- Start session ------------- */
  $('startBtn').addEventListener('click', () => {
    state.trialNumber = 0;
    state.trials = [];
    state.phase = 'idle';
    $('setupScreen').setAttribute('hidden', '');
    $('runScreen').removeAttribute('hidden');
    updateRibbon();
    setZone('idle', 'TAP TO START', `Trial 1 of ${state.trialsTarget}`);
  });

  function updateRibbon() {
    const oks = state.trials.filter(t => t.status === 'ok').map(t => t.ms);
    $('rxnTrial').textContent = `${Math.min(state.trialNumber, state.trialsTarget)} / ${state.trialsTarget}`;
    $('rxnBest').textContent  = oks.length ? Math.min(...oks) + ' ms' : '—';
    $('rxnLast').textContent  = state.trials.length ? (state.trials[state.trials.length-1].status === 'ok' ? state.trials[state.trials.length-1].ms + ' ms' : 'early') : '—';
  }

  function setZone(stateName, mainTxt, subTxt) {
    const z = $('rxnZone');
    z.classList.remove('rxn-state-idle','rxn-state-wait','rxn-state-go','rxn-state-early','rxn-state-result');
    z.classList.add('rxn-state-' + stateName);
    $('rxnState').textContent = mainTxt;
    if (subTxt !== undefined) $('rxnSub').textContent = subTxt;
  }

  /* ------------- Phase machine ------------- */
  function beginTrial() {
    state.trialNumber++;
    if (state.trialNumber > state.trialsTarget) {
      endSession();
      return;
    }
    state.phase = 'wait';
    setZone('wait', 'WAIT...', `Trial ${state.trialNumber} of ${state.trialsTarget}`);
    // Random delay 2000-5000ms
    const delay = 2000 + Math.random() * 3000;
    state.waitT = setTimeout(() => {
      if (state.phase !== 'wait') return;
      state.phase = 'go';
      state.goStartedAt = performance.now();
      setZone('go', 'GO!', 'TAP NOW');
      beep({ freq: 1320, dur: 0.18 });
    }, delay);
  }

  function recordTap() {
    if (state.phase === 'idle') {
      beginTrial();
      return;
    }
    if (state.phase === 'wait') {
      // Early — counts as failed trial
      clearTimeout(state.waitT); state.waitT = null;
      state.trials.push({ ms: null, status: 'early' });
      state.phase = 'result';
      setZone('early', 'TOO EARLY', 'Tap to retry this trial');
      beep({ freq: 220, dur: 0.4 });
      // Roll back the trial number — they'll redo
      state.trialNumber--;
      updateRibbon();
      return;
    }
    if (state.phase === 'go') {
      const ms = Math.round(performance.now() - state.goStartedAt);
      state.trials.push({ ms, status: 'ok' });
      state.phase = 'result';
      setZone('result', ms + ' ms', 'Tap for next trial');
      beep({ freq: 880, dur: 0.18 });
      updateRibbon();
      return;
    }
    if (state.phase === 'result') {
      if (state.trialNumber >= state.trialsTarget) {
        endSession();
      } else {
        beginTrial();
      }
    }
  }

  const zone = $('rxnZone');
  zone.addEventListener('pointerdown', e => {
    e.preventDefault();
    recordTap();
  });
  zone.addEventListener('click', e => e.preventDefault());

  $('skipBtn').addEventListener('click', () => {
    // Reset current trial: clear any pending wait timer, return to idle for this trial
    if (state.waitT) { clearTimeout(state.waitT); state.waitT = null; }
    if (state.phase === 'idle' || state.phase === 'done') return;
    // If we were in a trial, pop the last failed marker if present
    state.phase = 'idle';
    setZone('idle', 'TAP TO START', `Trial ${Math.min(state.trialNumber + 1, state.trialsTarget)} of ${state.trialsTarget}`);
  });

  $('stopBtn').addEventListener('click', () => {
    if (!confirm('End the session now?')) return;
    if (state.waitT) { clearTimeout(state.waitT); state.waitT = null; }
    endSession();
  });

  /* ------------- End + scoring ------------- */
  function endSession() {
    state.phase = 'done';
    if (state.waitT) { clearTimeout(state.waitT); state.waitT = null; }
    $('runScreen').setAttribute('hidden', '');
    $('resultsScreen').removeAttribute('hidden');

    const oks = state.trials.filter(t => t.status === 'ok').map(t => t.ms);
    if (oks.length === 0) {
      $('rsAvg').textContent = '—';
      $('rsBest').textContent = '—';
      $('rsWorst').textContent = '—';
    } else {
      const sorted = oks.slice().sort((a,b) => a - b);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      let middle = sorted;
      if (sorted.length >= 3) middle = sorted.slice(1, -1);
      const avg = Math.round(middle.reduce((s,n) => s+n, 0) / middle.length);
      $('rsAvg').textContent = avg + ' ms';
      $('rsBest').textContent = best + ' ms';
      $('rsWorst').textContent = worst + ' ms';
    }

    // Trial table — show every trial in order
    const body = $('resultsBody');
    body.innerHTML = '';
    if (state.trials.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" style="text-align:center;color:var(--muted)">No trials completed</td>`;
      body.appendChild(tr);
    } else {
      // Determine which OK trials are dropped (best+worst)
      const oksOnly = state.trials.filter(t => t.status === 'ok').map(t => t.ms);
      const dropBest = oksOnly.length > 0 ? Math.min(...oksOnly) : null;
      const dropWorst = oksOnly.length > 1 ? Math.max(...oksOnly) : null;
      let droppedBest = false, droppedWorst = false;
      state.trials.forEach((t, i) => {
        const tr = document.createElement('tr');
        let timeTxt, statusTxt;
        if (t.status === 'early') {
          timeTxt = '—';
          statusTxt = 'Early — failed';
        } else {
          timeTxt = t.ms + ' ms';
          if (oksOnly.length >= 3 && !droppedBest && t.ms === dropBest)  { statusTxt = 'Best (dropped)';  droppedBest  = true; }
          else if (oksOnly.length >= 3 && !droppedWorst && t.ms === dropWorst) { statusTxt = 'Worst (dropped)'; droppedWorst = true; }
          else statusTxt = 'Counted';
        }
        tr.innerHTML = `<td>${i+1}</td><td>${timeTxt}</td><td>${statusTxt}</td>`;
        body.appendChild(tr);
      });
    }
  }

  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const oks = state.trials.filter(t => t.status === 'ok').map(t => t.ms);
    const sorted = oks.slice().sort((a,b) => a-b);
    const middle = sorted.length >= 3 ? sorted.slice(1,-1) : sorted;
    const avg = middle.length ? Math.round(middle.reduce((s,n)=>s+n,0)/middle.length) : null;
    const data = {
      protocol: 'reaction-time',
      trialsTarget: state.trialsTarget,
      trials: state.trials,
      averageMs: avg,
      bestMs: oks.length ? Math.min(...oks) : null,
      worstMs: oks.length ? Math.max(...oks) : null,
      ts: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = `reaction-${Date.now()}.json`; dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
