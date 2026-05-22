/* ===========================================================================
   Vertex Vertical Jump — mic impact detection + manual fallback
   Flow: setup → calibrate → verify → run → results
   =========================================================================== */
(() => {
  'use strict';
  const { beep, speak, setMuted, isMuted } = window.VertexAudio;
  const $ = id => document.getElementById(id);

  /* ---------------- Physics ---------------- */
  const G = 9.81;
  // flight time (s) -> jump height (cm)
  function heightCmFromFlight(tSec) { return (G * tSec * tSec) / 8 * 100; }
  // Plausibility window for flight time
  const T_MIN = 0.25;   // 8 cm — implausibly low
  const T_MAX = 0.90;   // ~99 cm — beyond elite
  // Auto-accept countdown
  const AUTO_ACCEPT_SEC = 4;
  // Cooldown between athletes
  const NEXT_ATHLETE_PAUSE_MS = 1500;

  /* ---------------- State ---------------- */
  const state = {
    mode: 'audio',                 // 'audio' | 'manual'
    jumpType: 'cmj',
    attempts: 3,
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    checks: { floor: false, phone: false, quiet: false, brief: false },

    // Audio detector
    det: null,
    threshold: 0.05,
    calibration: null,             // { noiseFloorRms, ... }
    tapTestHits: 0,

    // Verify
    verifyOnsets: [],
    verifyTimer: null,
    verifyCountdownT: null,
    verifyOk: false,

    // Run
    queue: [],                     // [{ athleteId, attemptIdx }]
    cursor: 0,                     // index into queue
    results: {},                   // athleteId -> { attempts: [{ cm, source, conf, flightMs }], best }
    currentOnsets: [],
    onsetWindowTimer: null,
    pendingResult: null,           // { athleteId, attempt, cm, flightMs, source, conf, waveSamples }
    autoAcceptT: null,
    autoAcceptLeft: 0,
    lastAccepted: null,            // for undo
    paused: false,
    runListening: false,

    // Numpad
    npValue: '',
    npTarget: null,                // 'manual-run' | 'edit'
  };

  /* ---------------- Setup screen ---------------- */
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.mode = b.dataset.mode;
      onModeChange();
    });
  });
  function onModeChange() {
    if (state.mode === 'manual') {
      $('startLabel').textContent = 'Start session';
      $('startSub').textContent = state.selected.size ? `${state.selected.size} athletes · 3 attempts · manual entry` : 'Pick at least one athlete';
      $('startFoot').textContent = 'Manual mode skips calibration. You\'ll enter each jump with the number pad.';
      // Enable Approach option
      const approachBtn = document.querySelector('.proto-btn[data-jt="approach"]');
      approachBtn.disabled = false; approachBtn.removeAttribute('aria-disabled');
    } else {
      $('startLabel').textContent = 'Calibrate microphone';
      $('startSub').textContent = state.selected.size ? `${state.selected.size} athletes · calibrate then run` : 'Pick at least one athlete';
      $('startFoot').textContent = 'Audio mode needs calibration + verification before running the class.';
      // Disable Approach + force off
      const approachBtn = document.querySelector('.proto-btn[data-jt="approach"]');
      approachBtn.disabled = true; approachBtn.setAttribute('aria-disabled', 'true');
      if (state.jumpType === 'approach') {
        state.jumpType = 'cmj';
        document.querySelectorAll('.proto-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        const cmj = document.querySelector('.proto-btn[data-jt="cmj"]');
        cmj.classList.add('on'); cmj.setAttribute('aria-checked', 'true');
      }
    }
    refreshStartGuard();
  }

  document.querySelectorAll('.proto-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (b.disabled) return;
      document.querySelectorAll('.proto-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.jumpType = b.dataset.jt;
      const blurbs = {
        cmj: 'Counter-movement jump — squat then jump in one fluid motion. Tests reactive strength.',
        sj:  'Squat jump — pause for 1-2s in the squat before jumping. Tests pure concentric power.',
        approach: 'Approach jump — short run-up before the jump. Manual entry only (audio can\'t isolate take-off).',
      };
      $('jtBlurb').textContent = blurbs[state.jumpType];
    });
  });

  document.querySelectorAll('.att-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.att-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      state.attempts = parseInt(b.dataset.att, 10);
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

  // Checklist
  document.querySelectorAll('.cl-box').forEach(box => {
    box.addEventListener('change', () => {
      state.checks[box.dataset.c] = box.checked;
      refreshStartGuard();
    });
  });

  // Roster
  const rosterApi = VertexRoster.mount({
    container: $('rosterGrid'),
    athletes: state.athletes,
    selected: state.selected,
    onChange: () => { refreshStartGuard(); updateRosterCount(); },
  });
  $('selectAllBtn').addEventListener('click', () => { rosterApi.selectAll(); refreshStartGuard(); updateRosterCount(); });
  $('clearAllBtn').addEventListener('click', () => { rosterApi.clear(); refreshStartGuard(); updateRosterCount(); });
  function updateRosterCount() {
    $('rosterCount').textContent = `${state.selected.size} / ${state.athletes.length} selected`;
  }
  updateRosterCount();

  function allChecks() { return Object.values(state.checks).every(Boolean); }
  function refreshStartGuard() {
    const ok = state.selected.size > 0 && (state.mode === 'manual' || allChecks());
    $('startBtn').disabled = !ok;
    if (!state.selected.size) $('startSub').textContent = 'Pick at least one athlete';
    else if (state.mode === 'audio' && !allChecks()) $('startSub').textContent = 'Complete the checklist to continue';
    else if (state.mode === 'manual') $('startSub').textContent = `${state.selected.size} athletes · ${state.attempts} attempts · manual entry`;
    else $('startSub').textContent = `${state.selected.size} athletes · calibrate then run`;
  }
  refreshStartGuard();
  onModeChange();

  /* ---------------- Screen switching ---------------- */
  function showScreen(id) {
    ['setupScreen', 'calibrateScreen', 'verifyScreen', 'runScreen', 'resultsScreen'].forEach(s => {
      const el = $(s);
      if (s === id) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
    // Scroll new screen to top so users see the head
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- Start CTA ---------------- */
  $('startBtn').addEventListener('click', async () => {
    if ($('startBtn').disabled) return;
    if (state.mode === 'manual') {
      buildQueue(); openRunForCurrent();
      showScreen('runScreen');
    } else {
      // Audio mode → calibrate
      $('calAthletes').textContent = String(state.selected.size);
      showScreen('calibrateScreen');
    }
  });

  /* ---------------- Calibrate screen ---------------- */
  let calStartedOnce = false;
  $('calStartBtn').addEventListener('click', async () => {
    $('calStartBtn').disabled = true;
    $('calStartBtn').textContent = 'Requesting mic...';
    try {
      if (!state.det) {
        state.det = await VertexAudioDetect.create({
          bandpass: [80, 600],
          frameSize: 256,
          deadTimeMs: 100,
          onLevel: (rms) => updateVu('vuFill', rms),
          onOnset: () => {}, // installed later
        });
        await state.det.requestMic();
        state.det.start();
      }
    } catch (e) {
      alert('Microphone permission was denied or unavailable. Switching to Manual mode.');
      // Force manual fallback
      state.mode = 'manual';
      document.querySelectorAll('.mode-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      document.querySelector('.mode-btn[data-mode="manual"]').classList.add('on');
      onModeChange();
      buildQueue(); openRunForCurrent();
      showScreen('runScreen');
      return;
    }
    runCalibration();
  });

  async function runCalibration() {
    $('vjCalStartActions').setAttribute('hidden', '');
    $('vjVerdict').setAttribute('hidden', '');
    $('vjTapTest').setAttribute('hidden', '');
    $('vjCalActions').setAttribute('hidden', '');
    $('vuThresh').setAttribute('hidden', '');
    $('calTitle').textContent = 'Listening...';
    $('calBlurb').textContent = 'Stay quiet for 2 seconds — measuring ambient noise.';
    const result = await state.det.calibrate(2000);
    state.calibration = result;
    showVerdict(result);
  }

  function showVerdict(c) {
    $('calTitle').textContent = 'Calibration result';
    $('calBlurb').textContent = '';
    const v = $('vjVerdict'); v.removeAttribute('hidden');
    v.classList.remove('vv-good', 'vv-mixed', 'vv-bad');
    if (c.verdict === 'good') {
      v.classList.add('vv-good');
      $('vvIcon').textContent = '✓';
      $('vvTitle').textContent = 'Room is quiet';
      $('vvDetail').textContent = `Noise floor ${(c.noiseFloorRms*1000).toFixed(1)}m. Threshold set. Test it below.`;
    } else if (c.verdict === 'mixed') {
      v.classList.add('vv-mixed');
      $('vvIcon').textContent = '⚠';
      $('vvTitle').textContent = 'Noise spikes detected';
      $('vvDetail').textContent = `Dynamic range ${c.dynamicDb.toFixed(1)}dB. You can continue but the detector may misfire.`;
    } else {
      v.classList.add('vv-bad');
      $('vvIcon').textContent = '✗';
      $('vvTitle').textContent = 'Background too loud';
      $('vvDetail').textContent = `Noise floor ${(c.noiseFloorRms*1000).toFixed(1)}m — try a quieter space or switch to Manual.`;
    }
    // Set threshold based on noise floor
    const thresh = Math.max(c.noiseFloorRms * 6, 0.02);
    state.threshold = thresh;
    state.det.setThreshold(thresh);
    showVuThresh(thresh);

    // Tap-test only if verdict is acceptable
    if (c.verdict !== 'too-loud') {
      $('vjTapTest').removeAttribute('hidden');
      $('vtStatus').textContent = 'Tap the floor near the phone...';
      state.tapTestHits = 0;
      state.det.setHandlers({
        onOnset: () => {
          state.tapTestHits++;
          $('vtStatus').textContent = `Impact ${state.tapTestHits} heard ✓`;
          beep({ freq: 880, dur: 0.1, vol: 0.4 });
        },
      });
    }
    // Always show actions
    $('vjCalActions').removeAttribute('hidden');
    $('calNextBtn').disabled = (c.verdict === 'too-loud');
  }

  function showVuThresh(rms) {
    const el = $('vuThresh');
    const pct = Math.min(100, rms / 0.3 * 100); // 0.3 RMS = full scale
    el.style.left = pct + '%';
    el.removeAttribute('hidden');
  }
  function updateVu(elId, rms) {
    const el = $(elId);
    if (!el) return;
    const pct = Math.min(100, Math.sqrt(rms / 0.3) * 100);
    el.style.width = pct + '%';
  }

  $('recalBtn').addEventListener('click', () => {
    // Reset tap-test counter
    state.det.setHandlers({ onOnset: () => {} });
    runCalibration();
  });
  $('calToManualBtn').addEventListener('click', () => switchToManual('calibrate'));
  $('calNextBtn').addEventListener('click', () => {
    if ($('calNextBtn').disabled) return;
    showScreen('verifyScreen');
    resetVerifyScreen();
  });

  /* ---------------- Verify screen ---------------- */
  function resetVerifyScreen() {
    state.verifyOnsets = [];
    state.verifyOk = false;
    setVerHud('ready', '3', 'Tap READY to start countdown');
    $('verResult').setAttribute('hidden', '');
    $('verRetryBtn').setAttribute('hidden', '');
    $('verAcceptBtn').setAttribute('hidden', '');
    $('verReadyBtn').removeAttribute('hidden');
    $('verBest').textContent = '—';
    $('verStatus').textContent = 'Ready';
    // Bind level updates for the verify VU meter
    state.det.setHandlers({
      onLevel: (rms) => { updateVu('verVuFill', rms); updateVu('vuFill', rms); },
      onOnset: () => {}, // armed only during listening window
    });
    setVerVuThresh();
  }
  function setVerVuThresh() {
    const el = $('verVuThresh');
    const pct = Math.min(100, state.threshold / 0.3 * 100);
    el.style.left = pct + '%';
  }
  function setVerHud(stateName, clock, sub) {
    const hud = $('verHud');
    hud.classList.remove('rh-ready', 'rh-work', 'rh-rest', 'rh-done');
    hud.classList.add('rh-' + (stateName === 'listen' ? 'work' : stateName === 'done' ? 'rest' : 'ready'));
    $('verHudState').textContent = stateName === 'ready' ? 'READY' : stateName === 'listen' ? 'JUMP!' : stateName === 'done' ? 'DONE' : stateName.toUpperCase();
    if (clock !== undefined) $('verHudClock').textContent = clock;
    if (sub !== undefined) $('verHudSub').textContent = sub;
  }

  $('verReadyBtn').addEventListener('click', () => {
    $('verReadyBtn').setAttribute('hidden', '');
    runVerifyCountdown();
  });
  $('verToManualBtn').addEventListener('click', () => switchToManual('verify'));
  $('verRetryBtn').addEventListener('click', () => { resetVerifyScreen(); });
  $('verAcceptBtn').addEventListener('click', () => {
    if (!state.verifyOk) return;
    // Move to RUN
    buildQueue(); openRunForCurrent();
    showScreen('runScreen');
    startRunListening();
  });

  function runVerifyCountdown() {
    let n = 3;
    setVerHud('ready', String(n), 'Get ready to jump');
    beep({ freq: 660, dur: 0.18 });
    state.verifyCountdownT = setInterval(() => {
      n--;
      if (n > 0) {
        $('verHudClock').textContent = String(n);
        beep({ freq: 660, dur: 0.18 });
      } else {
        clearInterval(state.verifyCountdownT); state.verifyCountdownT = null;
        beep({ freq: 1320, dur: 0.4 });
        speak('Jump');
        startVerifyListen();
      }
    }, 1000);
  }
  function startVerifyListen() {
    state.verifyOnsets = [];
    setVerHud('listen', 'NOW', 'Listening for take-off + landing');
    $('verStatus').textContent = 'Listening';
    // Arm onset handler
    state.det.setHandlers({
      onLevel: (rms) => { updateVu('verVuFill', rms); updateVu('vuFill', rms); },
      onOnset: (t) => {
        state.verifyOnsets.push(t);
        if (state.verifyOnsets.length >= 2) {
          // Stop listening on 2nd onset, plus small grace
          clearTimeout(state.verifyTimer);
          setTimeout(finishVerify, 50);
        }
      },
    });
    // Timeout for no-second-onset
    state.verifyTimer = setTimeout(finishVerify, 2500);
  }
  function finishVerify() {
    state.det.setHandlers({ onOnset: () => {} });
    const onsets = state.verifyOnsets;
    let cm = null, flight = null, ok = false, reason = '';
    if (onsets.length < 1) {
      reason = 'No impact heard — phone may be too far from the jump spot, or floor too soft';
    } else if (onsets.length === 1) {
      reason = 'Only heard one impact — was the landing too soft?';
    } else if (onsets.length > 2) {
      // Pick first + last as plausible take-off/landing
      const t = onsets[onsets.length - 1] - onsets[0];
      if (t >= T_MIN && t <= T_MAX) {
        flight = t; cm = heightCmFromFlight(t); ok = true;
        reason = `${onsets.length} impacts detected — using first + last. Watch for cheers / shouts.`;
      } else {
        reason = `${onsets.length} impacts heard — couldn\'t isolate a clean jump. Try again in quieter conditions.`;
      }
    } else {
      const t = onsets[1] - onsets[0];
      if (t < T_MIN) reason = `Impacts too close (${(t*1000).toFixed(0)}ms) — likely a stumble or shuffle`;
      else if (t > T_MAX) reason = `Impacts too far apart (${t.toFixed(2)}s) — likely a delayed landing`;
      else { flight = t; cm = heightCmFromFlight(t); ok = true; reason = 'Two clean impacts detected'; }
    }
    state.verifyOk = ok;
    setVerHud(ok ? 'done' : 'ready', ok ? '✓' : '✗', reason);
    $('verResult').removeAttribute('hidden');
    if (ok) {
      $('verResultHeadline').textContent = `${cm.toFixed(1)} cm`;
      $('verResultMeta').textContent = `flight ${(flight*1000).toFixed(0)}ms — sample only, not saved`;
      $('verBest').textContent = `${cm.toFixed(1)} cm`;
      $('verStatus').textContent = 'Verified ✓';
      $('verAcceptBtn').removeAttribute('hidden');
      drawWaveform('verWave', state.det.getRecentSamples(2.5), onsets, state.det.getNowSec());
      beep({ freq: 880, dur: 0.4 });
    } else {
      $('verResultHeadline').textContent = 'Not detected';
      $('verResultMeta').textContent = reason;
      $('verStatus').textContent = 'Retry';
      $('verRetryBtn').removeAttribute('hidden');
      // Still draw waveform if we got any samples — helps debug
      try { drawWaveform('verWave', state.det.getRecentSamples(2.5), onsets, state.det.getNowSec()); } catch (_) {}
      beep({ freq: 220, dur: 0.4 });
    }
  }

  /* ---------------- Manual fallback switcher ---------------- */
  function switchToManual(fromScreen) {
    state.mode = 'manual';
    if (state.det) {
      try { state.det.stop(); } catch (_) {}
      try { state.det.dispose(); } catch (_) {}
      state.det = null;
    }
    document.querySelectorAll('.mode-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
    document.querySelector('.mode-btn[data-mode="manual"]').classList.add('on');
    onModeChange();
    buildQueue(); openRunForCurrent();
    showScreen('runScreen');
  }

  /* ---------------- Build queue + open athlete ---------------- */
  function buildQueue() {
    state.queue = [];
    state.cursor = 0;
    state.results = {};
    state.lastAccepted = null;
    const selectedIds = Array.from(state.selected);
    selectedIds.forEach(id => {
      state.results[id] = { attempts: [], best: null };
      for (let a = 0; a < state.attempts; a++) {
        state.queue.push({ athleteId: id, attemptIdx: a });
      }
    });
  }
  function openRunForCurrent() {
    if (state.cursor >= state.queue.length) { finishSession(); return; }
    const { athleteId, attemptIdx } = state.queue[state.cursor];
    const a = state.athletes.find(x => x.id === athleteId);
    $('vjInit').textContent = a?.initials || '—';
    $('vjName').textContent = a?.name || '—';
    $('vjMeta').textContent = a?.age ? `Age ${a.age}` : '';
    $('vjAttempt').textContent = `${attemptIdx + 1} / ${state.attempts}`;
    const best = state.results[athleteId]?.best;
    $('vjBest').textContent = best != null ? `${best.toFixed(1)} cm` : '—';
    $('vjLeft').textContent = `${state.queue.length - state.cursor}`;
    // Show listen stage, hide result stage
    $('vjListenStage').removeAttribute('hidden');
    $('vjResultStage').setAttribute('hidden', '');
    if (state.mode === 'manual') {
      // Open numpad directly for manual mode
      $('vjListenState').textContent = 'Manual entry';
      $('vjListenSub').textContent = 'Tap the screen to enter jump height';
      openNumpadFor('manual-run');
    } else {
      $('vjListenState').textContent = 'Listening for jump...';
      $('vjListenSub').textContent = 'Athlete jumps when ready';
    }
  }

  /* ---------------- Run listening ---------------- */
  function startRunListening() {
    if (state.mode !== 'audio' || !state.det) return;
    state.runListening = true;
    state.currentOnsets = [];
    // Reset gating state
    state.det.setHandlers({
      onLevel: (rms) => updateVu('vjVuFill', rms),
      onOnset: onRunOnset,
    });
    setVuThreshAt('vjVuThresh');
  }
  function setVuThreshAt(elId) {
    const el = $(elId);
    const pct = Math.min(100, state.threshold / 0.3 * 100);
    el.style.left = pct + '%';
  }
  function stopRunListening() {
    state.runListening = false;
    if (state.det) state.det.setHandlers({ onOnset: () => {} });
  }
  function onRunOnset(t) {
    if (!state.runListening || state.pendingResult) return;
    state.currentOnsets.push(t);
    if (state.currentOnsets.length === 1) {
      // Wait for second onset; if it doesn't come in 1.5s, treat as bail
      clearTimeout(state.onsetWindowTimer);
      state.onsetWindowTimer = setTimeout(() => {
        if (state.currentOnsets.length === 1) {
          showSoftLandingPrompt();
        }
      }, 1500);
    } else if (state.currentOnsets.length === 2) {
      clearTimeout(state.onsetWindowTimer);
      const flight = state.currentOnsets[1] - state.currentOnsets[0];
      if (flight < T_MIN) {
        // Likely false trigger from coach/audience — reset and keep listening
        flashListenWarning('Impacts too close — listening...');
        state.currentOnsets = [];
      } else if (flight > T_MAX) {
        flashListenWarning('Impacts too far apart — listening...');
        state.currentOnsets = [];
      } else {
        // Valid jump
        emitResult(flight, 'audio', confidenceFor(state.currentOnsets));
      }
    } else if (state.currentOnsets.length > 2) {
      // Keep collecting; pick the best plausible pair below
      const last = state.currentOnsets[state.currentOnsets.length - 1];
      const first = state.currentOnsets[0];
      const t = last - first;
      if (t > T_MAX) {
        // Re-anchor: use the last two onsets
        state.currentOnsets = state.currentOnsets.slice(-2);
        const t2 = state.currentOnsets[1] - state.currentOnsets[0];
        if (t2 >= T_MIN && t2 <= T_MAX) {
          emitResult(t2, 'audio', 'medium');
        }
      }
    }
  }
  function confidenceFor(onsets) {
    // 2 clean onsets = high; 3+ that we picked from = medium
    return onsets.length === 2 ? 'high' : 'medium';
  }
  function flashListenWarning(msg) {
    $('vjListenSub').textContent = msg;
    setTimeout(() => {
      if (state.runListening && !state.pendingResult) $('vjListenSub').textContent = 'Athlete jumps when ready';
    }, 1500);
  }
  function showSoftLandingPrompt() {
    if (state.pendingResult) return;
    $('vjListenSub').textContent = 'Only heard take-off — ask athlete to land more firmly';
    setTimeout(() => {
      if (state.runListening && !state.pendingResult) {
        state.currentOnsets = [];
        $('vjListenSub').textContent = 'Athlete jumps when ready';
      }
    }, 2500);
  }
  function emitResult(flightSec, source, conf) {
    stopRunListening();
    const cm = heightCmFromFlight(flightSec);
    const { athleteId, attemptIdx } = state.queue[state.cursor];
    state.pendingResult = {
      athleteId, attempt: attemptIdx,
      cm, flightMs: Math.round(flightSec * 1000),
      source, conf,
      onsets: state.currentOnsets.slice(),
      wave: state.det ? state.det.getRecentSamples(2.5) : null,
      nowSec: state.det ? state.det.getNowSec() : 0,
    };
    showResultStage();
    startAutoAcceptCountdown();
    beep({ freq: 880, dur: 0.25 });
  }
  function showResultStage() {
    $('vjListenStage').setAttribute('hidden', '');
    $('vjResultStage').removeAttribute('hidden');
    const r = state.pendingResult;
    $('vjResultCm').textContent = `${r.cm.toFixed(1)} cm`;
    $('vjResultMeta').textContent = `flight ${r.flightMs}ms · ${r.source === 'audio' ? 'auto' : r.source}`;
    if (r.wave) drawWaveform('vjWave', r.wave, r.onsets, r.nowSec);
    else { const c = $('vjWave').getContext('2d'); c.clearRect(0,0,$('vjWave').width,$('vjWave').height); }
  }
  function startAutoAcceptCountdown() {
    state.autoAcceptLeft = AUTO_ACCEPT_SEC;
    $('vjAutoCount').textContent = String(state.autoAcceptLeft);
    $('vjAutoAccept').removeAttribute('hidden');
    clearInterval(state.autoAcceptT);
    state.autoAcceptT = setInterval(() => {
      state.autoAcceptLeft--;
      $('vjAutoCount').textContent = String(state.autoAcceptLeft);
      if (state.autoAcceptLeft <= 0) {
        clearInterval(state.autoAcceptT);
        acceptResult();
      }
    }, 1000);
  }
  function cancelAutoAccept() {
    clearInterval(state.autoAcceptT);
    state.autoAcceptT = null;
    $('vjAutoAccept').setAttribute('hidden', '');
  }

  $('vjAcceptBtn').addEventListener('click', () => acceptResult());
  $('vjRedoBtn').addEventListener('click', () => redoCurrent());
  $('vjEditBtn').addEventListener('click', () => { cancelAutoAccept(); openNumpadFor('edit'); });

  function acceptResult() {
    cancelAutoAccept();
    const r = state.pendingResult;
    if (!r) return;
    // Store
    const ar = state.results[r.athleteId];
    ar.attempts[r.attempt] = { cm: r.cm, flightMs: r.flightMs, source: r.source, conf: r.conf };
    if (ar.best == null || r.cm > ar.best) ar.best = r.cm;
    state.lastAccepted = { athleteId: r.athleteId, attempt: r.attempt };
    state.pendingResult = null;
    // Advance
    state.cursor++;
    setTimeout(() => {
      openRunForCurrent();
      if (state.cursor < state.queue.length && state.mode === 'audio') startRunListening();
    }, NEXT_ATHLETE_PAUSE_MS);
  }
  function redoCurrent() {
    cancelAutoAccept();
    state.pendingResult = null;
    state.currentOnsets = [];
    $('vjResultStage').setAttribute('hidden', '');
    $('vjListenStage').removeAttribute('hidden');
    $('vjListenSub').textContent = 'Athlete jumps when ready';
    if (state.mode === 'audio') startRunListening();
    else openNumpadFor('manual-run');
  }

  $('vjUndoBtn').addEventListener('click', () => {
    if (!state.lastAccepted) return;
    const la = state.lastAccepted;
    const ar = state.results[la.athleteId];
    ar.attempts[la.attempt] = undefined;
    ar.best = ar.attempts.filter(Boolean).reduce((m, x) => x.cm > (m||0) ? x.cm : m, null);
    state.cursor = Math.max(0, state.cursor - 1);
    state.lastAccepted = null;
    // Show toast
    const t = $('vjUndoToast'); $('vjUndoMsg').textContent = 'Undone — re-listening';
    t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 5000);
    cancelAutoAccept();
    state.pendingResult = null;
    openRunForCurrent();
    if (state.mode === 'audio') startRunListening();
  });

  $('vjSkipBtn').addEventListener('click', () => {
    if (!confirm('Skip this attempt?')) return;
    cancelAutoAccept();
    state.pendingResult = null;
    const { athleteId, attemptIdx } = state.queue[state.cursor];
    state.results[athleteId].attempts[attemptIdx] = { cm: null, source: 'skip', conf: 'low' };
    state.cursor++;
    openRunForCurrent();
    if (state.mode === 'audio' && state.cursor < state.queue.length) startRunListening();
  });

  $('vjStopBtn').addEventListener('click', () => {
    if (!confirm('End the session and view results?')) return;
    cancelAutoAccept();
    stopRunListening();
    finishSession();
  });

  /* ---------------- Numpad ---------------- */
  function openNumpadFor(target) {
    state.npTarget = target;
    state.npValue = '';
    const { athleteId, attemptIdx } = state.queue[state.cursor] || {};
    const a = state.athletes.find(x => x.id === athleteId);
    $('npTitle').textContent = `${a?.name || '—'} · Attempt ${attemptIdx != null ? attemptIdx + 1 : ''}`;
    $('npValue').textContent = '0';
    $('numpadOverlay').removeAttribute('hidden');
  }
  function closeNumpad() {
    $('numpadOverlay').setAttribute('hidden', '');
    state.npTarget = null;
  }
  $('npClose').addEventListener('click', closeNumpad);
  document.querySelectorAll('.np-key').forEach(k => {
    k.addEventListener('click', () => {
      const v = k.dataset.k;
      if (v === 'back') state.npValue = state.npValue.slice(0, -1);
      else if (v === 'skip') {
        // Skip this attempt
        const { athleteId, attemptIdx } = state.queue[state.cursor];
        state.results[athleteId].attempts[attemptIdx] = { cm: null, source: 'skip', conf: 'low' };
        state.lastAccepted = { athleteId, attempt: attemptIdx };
        state.cursor++;
        closeNumpad();
        openRunForCurrent();
        if (state.mode === 'audio' && state.cursor < state.queue.length) startRunListening();
        return;
      } else if (state.npValue.length < 3) state.npValue += v;
      $('npValue').textContent = state.npValue === '' ? '0' : state.npValue;
    });
  });
  $('npSave').addEventListener('click', () => {
    const cm = parseInt(state.npValue, 10);
    if (!isFinite(cm) || cm <= 0) { closeNumpad(); return; }
    const { athleteId, attemptIdx } = state.queue[state.cursor];
    if (state.npTarget === 'edit' && state.pendingResult) {
      // Override pending result
      state.pendingResult.cm = cm;
      state.pendingResult.source = 'edited';
      state.pendingResult.conf = 'manual';
      state.pendingResult.flightMs = Math.round(Math.sqrt(8 * (cm/100) / G) * 1000);
      closeNumpad();
      showResultStage();
      startAutoAcceptCountdown();
      return;
    }
    // Manual run entry: store and advance
    const ar = state.results[athleteId];
    ar.attempts[attemptIdx] = { cm, flightMs: null, source: 'manual', conf: 'manual' };
    if (ar.best == null || cm > ar.best) ar.best = cm;
    state.lastAccepted = { athleteId, attempt: attemptIdx };
    state.cursor++;
    closeNumpad();
    openRunForCurrent();
  });

  // Tapping listen stage in manual mode opens the numpad
  $('vjListenStage').addEventListener('click', () => {
    if (state.mode === 'manual') openNumpadFor('manual-run');
  });

  /* ---------------- Results ---------------- */
  function finishSession() {
    stopRunListening();
    if (state.det) { try { state.det.stop(); } catch (_) {} }
    showScreen('resultsScreen');
    const ids = Array.from(state.selected);
    const bests = ids.map(id => state.results[id]?.best).filter(x => x != null);
    $('rsAthletes').textContent = String(ids.length);
    $('rsBest').textContent  = bests.length ? `${Math.max(...bests).toFixed(1)} cm` : '—';
    $('rsAvg').textContent   = bests.length ? `${(bests.reduce((s,x) => s+x, 0) / bests.length).toFixed(1)} cm` : '—';

    // Per-athlete table, sorted by best desc
    const rows = ids.map(id => ({ id, a: state.athletes.find(x => x.id === id), r: state.results[id] }));
    rows.sort((p, q) => (q.r.best || -1) - (p.r.best || -1));
    const body = $('resultsBody'); body.innerHTML = '';
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      const attemptsStr = row.r.attempts.map(att => {
        if (!att) return '<span class="att-cell att-empty">—</span>';
        if (att.cm == null) return '<span class="att-cell att-foul">skip</span>';
        const isBest = att.cm === row.r.best;
        return `<span class="att-cell${isBest ? ' att-best' : ''}">${att.cm.toFixed(0)}</span>`;
      }).join(' ');
      // Confidence = best of attempt confs
      const confs = row.r.attempts.filter(Boolean).map(att => att.conf);
      const conf = confs.includes('high') ? 'high' : confs.includes('medium') ? 'medium' : 'low';
      const dots = conf === 'high' ? '●●●' : conf === 'medium' ? '●●○' : '●○○';
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${row.a?.name || '—'}</td>
        <td><b>${row.r.best != null ? row.r.best.toFixed(1) + ' cm' : '—'}</b></td>
        <td>${attemptsStr}</td>
        <td><span class="conf-dots conf-${conf}">${dots}</span></td>`;
      body.appendChild(tr);
    });
  }

  $('saveBtn').addEventListener('click', () => {
    const payload = Object.entries(state.results).map(([id, r]) => {
      const a = state.athletes.find(x => x.id === id);
      return {
        id, name: a?.name, age: a?.age,
        best: r.best,
        attempts: r.attempts.map(att => att ? { cm: att.cm, flightMs: att.flightMs, source: att.source, conf: att.conf } : null),
      };
    });
    VertexResults.save('vertical-jump', payload, {
      protocol: 'vertical-jump',
      jumpType: state.jumpType,
      mode: state.mode,
      attempts: state.attempts,
    });
    const t = $('saveToast'); t.removeAttribute('hidden');
    setTimeout(() => t.setAttribute('hidden', ''), 2200);
  });
  $('againBtn').addEventListener('click', () => location.reload());
  $('exportBtn').addEventListener('click', () => {
    const data = {
      protocol: 'vertical-jump',
      jumpType: state.jumpType,
      mode: state.mode,
      attempts: state.attempts,
      results: state.results,
      ts: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = `vertical-jump-${Date.now()}.json`; dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------------- Waveform drawing ---------------- */
  function drawWaveform(canvasId, samples, onsetTimes, nowSec) {
    const c = $(canvasId);
    if (!c || !samples) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, w, h);
    // Midline
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
    // Waveform
    ctx.strokeStyle = 'rgba(89,183,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(samples.length / w));
    for (let x = 0; x < w; x++) {
      const i = x * step;
      const v = samples[i] || 0;
      const y = h/2 - v * h * 1.6;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Onset markers
    if (onsetTimes && onsetTimes.length && nowSec) {
      // Samples cover the most-recent ~2.5s up to nowSec
      const SR = 48000; // approx; doesn't have to be exact
      const sampleDurSec = samples.length / SR;
      const startSec = nowSec - sampleDurSec;
      ctx.strokeStyle = 'rgba(255,191,102,0.9)';
      ctx.lineWidth = 2;
      onsetTimes.forEach(t => {
        const rel = (t - startSec) / sampleDurSec;
        if (rel >= 0 && rel <= 1) {
          const x = rel * w;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
      });
    }
  }

  /* ---------------- Cleanup on unload ---------------- */
  window.addEventListener('beforeunload', () => {
    if (state.det) { try { state.det.dispose(); } catch (_) {} }
  });

})();
