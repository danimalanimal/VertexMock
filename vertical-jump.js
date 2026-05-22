/* ===========================================================================
   Vertex Drop Jump — 3-impact mic detection + manual fallback
   (drop landing → take-off scuff → rebound landing)
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
  // RSI = jump height (m) / contact time (s)  — reactive strength index
  function rsiFor(cm, contactSec) {
    if (!isFinite(cm) || !isFinite(contactSec) || contactSec <= 0) return null;
    return (cm / 100) / contactSec;
  }
  // Plausibility windows
  const T_FLIGHT_MIN   = 0.20;  // ~5 cm rebound — implausibly low
  const T_FLIGHT_MAX   = 0.85;  // ~89 cm — beyond elite
  const T_CONTACT_MIN  = 0.08;  // sub-80ms is suspicious (false trigger)
  const T_CONTACT_MAX  = 0.45;  // 450ms+ = squat-jump, not reactive
  // Backwards-compat aliases used by older logic paths
  const T_MIN = T_FLIGHT_MIN;
  const T_MAX = T_FLIGHT_MAX;
  // Secondary-threshold window (catches the faint take-off scuff)
  const SCUFF_WINDOW_MS = 400;
  const SCUFF_THRESH_FACTOR = 3;   // baseThresh ÷ (6/3) = scuff threshold (half of base)
  // Auto-accept countdown
  const AUTO_ACCEPT_SEC = 4;
  // Cooldown between athletes
  const NEXT_ATHLETE_PAUSE_MS = 1500;

  /* ---------------- State ---------------- */
  const state = {
    mode: 'audio',                 // 'audio' | 'manual'
    jumpType: 'box20',  // 'box15' | 'box20' | 'box30' — drop box height
    attempts: 3,
    athletes: window.BoxerData ? BoxerData.athletes : [],
    selected: new Set(),
    checks: { floor: false, box: false, phone: false, quiet: false, brief: false },

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
    } else {
      $('startLabel').textContent = 'Calibrate microphone';
      $('startSub').textContent = state.selected.size ? `${state.selected.size} athletes · calibrate then run` : 'Pick at least one athlete';
      $('startFoot').textContent = 'Audio mode needs calibration + verification before running the class.';
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
        box15: '15 cm box — lower drop force, suitable for beginners or younger athletes. Easier to control landing.',
        box20: 'Standard 20 cm box — athletes step off, land both feet, immediately rebound jump for max height. Two solid impacts (drop + landing) and a faint take-off scuff in between.',
        box30: '30 cm box — higher drop force, more reactive demand. Use only with athletes who already nail the 20 cm version with clean form.',
      };
      $('jtBlurb').textContent = blurbs[state.jumpType] || blurbs.box20;
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
    setVerHud('listen', 'NOW', 'Listening for drop → scuff → land');
    $('verStatus').textContent = 'Listening';
    // Arm onset handler. Drop-jump expects up to 3 impacts:
    //   t0 = drop landing  (loud)
    //   t1 = rebound take-off scuff  (faint — lowered threshold window)
    //   t2 = rebound landing  (loud)
    state.det.setHandlers({
      onLevel: (rms) => { updateVu('verVuFill', rms); updateVu('vuFill', rms); },
      onOnset: (t) => {
        state.verifyOnsets.push(t);
        const n = state.verifyOnsets.length;
        if (n === 1) {
          // Open scuff window after first impact
          state.det.setSecondaryThreshold(state.threshold / SCUFF_THRESH_FACTOR, SCUFF_WINDOW_MS);
        }
        if (n >= 3) {
          // Got all three — finish
          clearTimeout(state.verifyTimer);
          setTimeout(finishVerify, 50);
        }
      },
    });
    // Timeout for incomplete sequence
    state.verifyTimer = setTimeout(finishVerify, 3000);
  }
  function finishVerify() {
    state.det.setHandlers({ onOnset: () => {} });
    state.det.setSecondaryThreshold(null);
    const onsets = state.verifyOnsets;
    const parsed = parseDropJumpOnsets(onsets);
    const { ok, cm, flight, contact, rsi, reason, conf } = parsed;

    state.verifyOk = ok;
    setVerHud(ok ? 'done' : 'ready', ok ? '✓' : '✗', reason);
    $('verResult').removeAttribute('hidden');
    if (ok) {
      $('verResultHeadline').textContent = `${cm.toFixed(1)} cm`;
      const rsiStr = rsi != null ? ` · RSI ${rsi.toFixed(2)}` : ' · RSI —';
      const ctStr = contact != null ? ` · contact ${(contact*1000).toFixed(0)}ms` : '';
      $('verResultMeta').textContent = `flight ${(flight*1000).toFixed(0)}ms${ctStr}${rsiStr} — sample only`;
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
      try { drawWaveform('verWave', state.det.getRecentSamples(2.5), onsets, state.det.getNowSec()); } catch (_) {}
      beep({ freq: 220, dur: 0.4 });
    }
  }

  /**
   * Parse a sequence of onset timestamps into a drop-jump result.
   * Tries 3-impact (drop → scuff → land) first; falls back to 2-impact
   * (drop → land, RSI unavailable).
   */
  function parseDropJumpOnsets(onsets) {
    if (!onsets || onsets.length < 1) {
      return { ok: false, reason: 'No impact heard — phone too far, or drop landing too soft' };
    }
    if (onsets.length === 1) {
      return { ok: false, reason: 'Only heard the drop landing — did the rebound jump miss the spot?' };
    }
    // Try 3-impact path: pick first + middle + last that satisfies windows
    if (onsets.length >= 3) {
      // Pick the triple that gives a valid drop→scuff→land pattern.
      // Strategy: t0 = onsets[0]; t2 = last onset within plausible total time;
      // t1 = any middle onset that splits contact + flight plausibly.
      const t0 = onsets[0];
      const t2 = onsets[onsets.length - 1];
      // Find candidate t1 between t0 and t2 — prefer one that makes both windows valid
      let bestTriple = null;
      for (let i = 1; i < onsets.length - 1; i++) {
        const t1 = onsets[i];
        const contact = t1 - t0;
        const flight  = t2 - t1;
        if (contact >= T_CONTACT_MIN && contact <= T_CONTACT_MAX &&
            flight  >= T_FLIGHT_MIN  && flight  <= T_FLIGHT_MAX) {
          bestTriple = { t0, t1, t2, contact, flight };
          break;
        }
      }
      if (bestTriple) {
        const cm = heightCmFromFlight(bestTriple.flight);
        const rsi = rsiFor(cm, bestTriple.contact);
        return {
          ok: true, cm, flight: bestTriple.flight, contact: bestTriple.contact,
          rsi, conf: 'high',
          reason: 'Drop → scuff → landing detected'
        };
      }
      // Triple didn't fit windows — fall through to two-impact attempt
    }
    // Two-impact fallback: assume scuff was missed; treat onsets[0]→onsets[last] as drop→land
    // and split nominal contact (assume 200ms) so we report a flight estimate.
    const t0 = onsets[0];
    const tEnd = onsets[onsets.length - 1];
    const totalGap = tEnd - t0;
    if (totalGap < T_FLIGHT_MIN + T_CONTACT_MIN) {
      return { ok: false, reason: `Impacts too close (${(totalGap*1000).toFixed(0)}ms) — likely a stumble` };
    }
    if (totalGap > T_FLIGHT_MAX + T_CONTACT_MAX) {
      return { ok: false, reason: `Impacts too far apart (${totalGap.toFixed(2)}s) — retry` };
    }
    // Estimate flight by subtracting nominal contact (200ms) from total gap
    const NOMINAL_CONTACT = 0.20;
    const flightEst = totalGap - NOMINAL_CONTACT;
    if (flightEst < T_FLIGHT_MIN || flightEst > T_FLIGHT_MAX) {
      return { ok: false, reason: `Couldn\'t resolve clean drop→rebound (gap ${(totalGap*1000).toFixed(0)}ms)` };
    }
    const cm = heightCmFromFlight(flightEst);
    return {
      ok: true, cm, flight: flightEst, contact: null, rsi: null,
      conf: 'medium',
      reason: 'Scuff missed — height estimated, RSI unavailable'
    };
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
      $('vjListenState').textContent = 'Listening for drop → rebound';
      $('vjListenSub').textContent = 'Step off the box when ready';
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
    const n = state.currentOnsets.length;

    if (n === 1) {
      // Drop landing detected — open scuff window
      try { state.det.setSecondaryThreshold(state.threshold / SCUFF_THRESH_FACTOR, SCUFF_WINDOW_MS); } catch (_) {}
      // Schedule a finalize attempt if no further impacts arrive within rebound window
      clearTimeout(state.onsetWindowTimer);
      state.onsetWindowTimer = setTimeout(() => {
        if (state.currentOnsets.length === 1) showSoftLandingPrompt();
      }, 1700);
    } else if (n === 2 || n === 3) {
      // Try to parse — if we have a valid 3-impact triple, emit; if 2-impact and total gap
      // is already past max plausible, fall back; otherwise wait briefly for a third.
      const parsed = parseDropJumpOnsets(state.currentOnsets);
      if (parsed.ok) {
        clearTimeout(state.onsetWindowTimer);
        emitDropJumpResult(parsed, 'audio');
      } else if (n === 2) {
        // Wait up to 200ms more for a possible third impact (scuff → landing)
        clearTimeout(state.onsetWindowTimer);
        state.onsetWindowTimer = setTimeout(() => {
          const reparsed = parseDropJumpOnsets(state.currentOnsets);
          if (reparsed.ok) emitDropJumpResult(reparsed, 'audio');
          else { flashListenWarning(reparsed.reason); state.currentOnsets = []; }
        }, 250);
      } else {
        flashListenWarning(parsed.reason);
        state.currentOnsets = [];
      }
    } else if (n > 3) {
      // Trim to a reasonable sliding window; try parsing the latest triple
      state.currentOnsets = state.currentOnsets.slice(-3);
      const reparsed = parseDropJumpOnsets(state.currentOnsets);
      if (reparsed.ok) {
        emitDropJumpResult(reparsed, 'audio');
      } else {
        const last = state.currentOnsets[state.currentOnsets.length - 1];
        const first = state.currentOnsets[0];
        const total = last - first;
        if (total > T_FLIGHT_MAX + T_CONTACT_MAX) {
          state.currentOnsets = state.currentOnsets.slice(-1);
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
    $('vjListenSub').textContent = 'Heard the drop — missed the rebound. Land firmer';
    setTimeout(() => {
      if (state.runListening && !state.pendingResult) {
        state.currentOnsets = [];
        $('vjListenSub').textContent = 'Step off the box when ready';
      }
    }, 2500);
  }
  function emitResult(flightSec, source, conf) {
    // Legacy two-impact entry point (kept for backwards compat with edit/numpad path)
    const parsed = {
      ok: true,
      cm: heightCmFromFlight(flightSec),
      flight: flightSec,
      contact: null,
      rsi: null,
      conf,
    };
    emitDropJumpResult(parsed, source);
  }
  function emitDropJumpResult(parsed, source) {
    stopRunListening();
    try { state.det && state.det.setSecondaryThreshold(null); } catch (_) {}
    const { athleteId, attemptIdx } = state.queue[state.cursor];
    state.pendingResult = {
      athleteId, attempt: attemptIdx,
      cm: parsed.cm,
      flightMs: Math.round(parsed.flight * 1000),
      contactMs: parsed.contact != null ? Math.round(parsed.contact * 1000) : null,
      rsi: parsed.rsi,
      source, conf: parsed.conf,
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
    const ctStr = r.contactMs != null ? ` · contact ${r.contactMs}ms` : '';
    const rsiStr = r.rsi != null ? ` · RSI ${r.rsi.toFixed(2)}` : '';
    const srcLabel = r.source === 'audio' ? 'auto' : r.source;
    $('vjResultMeta').textContent = `flight ${r.flightMs}ms${ctStr}${rsiStr} · ${srcLabel}`;
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
    ar.attempts[r.attempt] = {
      cm: r.cm, flightMs: r.flightMs,
      contactMs: r.contactMs, rsi: r.rsi,
      source: r.source, conf: r.conf,
    };
    if (ar.best == null || r.cm > ar.best) ar.best = r.cm;
    // Track best RSI per athlete too
    if (r.rsi != null && (ar.bestRsi == null || r.rsi > ar.bestRsi)) ar.bestRsi = r.rsi;
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
      const rsiCell = row.r.bestRsi != null
        ? `<b>${row.r.bestRsi.toFixed(2)}</b>`
        : '<span class="att-empty">—</span>';
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${row.a?.name || '—'}</td>
        <td><b>${row.r.best != null ? row.r.best.toFixed(1) + ' cm' : '—'}</b></td>
        <td>${rsiCell}</td>
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
        bestRsi: r.bestRsi != null ? r.bestRsi : null,
        attempts: r.attempts.map(att => att ? {
          cm: att.cm, flightMs: att.flightMs,
          contactMs: att.contactMs, rsi: att.rsi,
          source: att.source, conf: att.conf
        } : null),
      };
    });
    VertexResults.save('drop-jump', payload, {
      protocol: 'drop-jump',
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
      protocol: 'drop-jump',
      jumpType: state.jumpType,
      mode: state.mode,
      attempts: state.attempts,
      results: state.results,
      ts: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a'); dl.href = url; dl.download = `drop-jump-${Date.now()}.json`; dl.click();
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
